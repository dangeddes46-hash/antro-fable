-- 007_market_buy_function.sql
-- Incremental migration: SQL functions for Market Buy (slice 6c) — the first
-- cross-player money transfer in the hosted architecture.
--
-- ============================================================================
-- DEPLOYMENT ORDER — READ THIS FIRST
--
-- This migration MUST be applied to the production Supabase BEFORE any
-- game-service build at or after v0.43.3 is deployed. That service calls BOTH
-- functions below:
--   * multiplayer_market_buy            — every Market Buy request
--   * multiplayer_apply_economy_tick_state — EVERY ECONOMY TICK
-- Deploying the service first does not merely break the new Buy feature; it
-- breaks the manual economy tick for the whole round. Migration first, service
-- second. No exceptions. (Same ordering hazard class as 003-006, but with a
-- larger blast radius.)
-- ============================================================================
--
-- Why SQL functions instead of application-level sequenced writes:
--
-- multiplayer_market_buy is a real two-party financial transaction. A plpgsql
-- function body runs inside a single Postgres transaction: every statement
-- commits together or rolls back together, and RAISE EXCEPTION anywhere undoes
-- everything. SELECT ... FOR UPDATE on the listing row serialises concurrent
-- buys of the same listing (the second transaction blocks until the first
-- commits, then re-reads the decremented/closed row), which makes double-fill
-- impossible rather than merely unlikely. Money moves via atomic increment
-- expressions (money = money - cost / money = money + cost), never
-- read-modify-write, so a concurrent writer of the same row cannot be
-- clobbered by this transaction and cannot clobber it.
--
-- multiplayer_apply_economy_tick_state exists for the same reason from the
-- other side: the economy tick previously wrote money as an absolute value
-- computed from a state row read several queries earlier. Any money delta that
-- committed inside that read->write window (e.g. a market buy) would have been
-- silently erased by the tick's absolute write. The tick now passes the
-- INCOME DELTA and the function applies money = money + delta atomically, so
-- a buy and a tick racing on the same player's money both land, in either
-- commit order. (Population/food/water/energy/banked remain absolute writes:
-- market buy never touches them, ticks cannot run concurrently with each other
-- — the tick_in_progress guard — and the pre-existing instant-action races on
-- those columns are documented existing behaviour, unchanged by this slice.)
--
-- Draft/reviewable, consistent with the rest of supabase/multiplayer. Do not
-- run against production without explicit approval.

create or replace function public.multiplayer_market_buy(
  p_round_id uuid,
  p_listing_id uuid,
  p_buyer_player_id uuid,
  p_quantity numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.multiplayer_market_listings%rowtype;
  v_qty numeric;
  v_cost numeric;
  v_rows integer;
  v_remaining numeric;
  v_status text;
begin
  -- Buyer identity is the grant-resolved canonical player id, passed by the
  -- game service. The client never supplies it.
  if p_quantity is null or p_quantity <= 0 or p_quantity <> floor(p_quantity) then
    raise exception 'invalid_amount';
  end if;

  -- Lock the listing row. Concurrent buys of the same listing serialise here:
  -- the loser of the race blocks, then sees the already-decremented quantity
  -- (or a non-active status) and proceeds/fails accordingly. No double-fill.
  select * into v_listing
  from public.multiplayer_market_listings
  where id = p_listing_id
    and round_id = p_round_id
  for update;

  if not found then
    raise exception 'listing_not_found';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing_not_found';
  end if;
  if v_listing.seller_player_id = p_buyer_player_id then
    raise exception 'cannot_buy_own_listing';
  end if;
  if v_listing.quantity <= 0 then
    raise exception 'listing_not_found';
  end if;
  if v_listing.price <= 0 then
    raise exception 'invalid_price';
  end if;

  -- Reference semantics (buyMarketOrder, src/App.jsx): the requested quantity
  -- is clamped to what the listing still holds — a partial fill, not a reject.
  v_qty := least(p_quantity, v_listing.quantity);
  v_cost := v_qty * v_listing.price;

  -- Debit the buyer. The affordability check is fused into the UPDATE's WHERE
  -- clause and the debit is an atomic increment expression: there is no window
  -- between "check funds" and "take funds", and no read-modify-write to clobber
  -- or be clobbered by a concurrent writer of the same row.
  update public.multiplayer_player_state
     set money = money - v_cost,
         state_version = state_version + 1,
         updated_at = now()
   where round_id = p_round_id
     and player_id = p_buyer_player_id
     and money >= v_cost;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    perform 1 from public.multiplayer_player_state
      where round_id = p_round_id and player_id = p_buyer_player_id;
    if not found then
      raise exception 'player_not_found';
    end if;
    raise exception 'insufficient_funds';
  end if;

  -- Credit the seller — the other half of the transfer, same atomic form.
  -- Money conservation: this credit is the exact debit amount; nothing is
  -- minted or destroyed anywhere in this function.
  update public.multiplayer_player_state
     set money = money + v_cost,
         state_version = state_version + 1,
         updated_at = now()
   where round_id = p_round_id
     and player_id = v_listing.seller_player_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- Seller state row missing would strand the buyer's debit if we continued;
    -- raising here rolls the whole transaction back instead.
    raise exception 'seller_state_not_found';
  end if;

  -- Hand the escrowed goods to the buyer. The minerals were debited from the
  -- seller at List time (escrow), so the seller is NOT debited here.
  insert into public.multiplayer_player_minerals (player_id, round_id, mineral_key, count, updated_at)
  values (p_buyer_player_id, p_round_id, v_listing.mineral_key, v_qty, now())
  on conflict (player_id, round_id, mineral_key)
  do update set count = public.multiplayer_player_minerals.count + excluded.count,
                updated_at = now();

  -- Shrink or close the listing.
  v_remaining := v_listing.quantity - v_qty;
  if v_remaining <= 0 then
    v_status := 'sold';
    update public.multiplayer_market_listings
       set quantity = 0,
           status = 'sold',
           updated_at = now()
     where id = v_listing.id;
  else
    v_status := 'active';
    update public.multiplayer_market_listings
       set quantity = v_remaining,
           updated_at = now()
     where id = v_listing.id;
  end if;

  return jsonb_build_object(
    'listing_id', v_listing.id,
    'seller_player_id', v_listing.seller_player_id,
    'mineral_key', v_listing.mineral_key,
    'quantity_bought', v_qty,
    'price', v_listing.price,
    'cost', v_cost,
    'remaining_quantity', greatest(v_remaining, 0),
    'listing_status', v_status
  );
end;
$$;

comment on function public.multiplayer_market_buy(uuid, uuid, uuid, numeric) is
  'Atomic cross-player market purchase: row-locks the listing (FOR UPDATE), verifies active/not-own/affordable, moves money between buyer and seller as atomic increments, credits the buyer the escrowed minerals, decrements or closes the listing. All-or-nothing; any failure rolls back every step.';

create or replace function public.multiplayer_apply_economy_tick_state(
  p_state_id uuid,
  p_money_delta numeric,
  p_population numeric,
  p_banked numeric,
  p_food numeric,
  p_water numeric,
  p_energy numeric,
  p_tick integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- money is applied as a DELTA (atomic increment), so a market buy or other
  -- money movement that commits between the tick's state read and this write
  -- is preserved instead of clobbered. The remaining columns are absolute:
  -- no concurrent writer of them exists inside a tick's window that this
  -- slice introduces (see header note).
  update public.multiplayer_player_state
     set money = money + p_money_delta,
         population = p_population,
         banked = p_banked,
         food = p_food,
         water = p_water,
         energy = p_energy,
         tick = p_tick,
         state_version = state_version + 1,
         updated_at = now()
   where id = p_state_id;
end;
$$;

comment on function public.multiplayer_apply_economy_tick_state(uuid, numeric, numeric, numeric, numeric, numeric, numeric, integer) is
  'Applies one economy tick to a player state row with money as an atomic delta (money = money + p_money_delta) so concurrent money movements (e.g. market buys) are never lost to the tick''s read-modify-write window.';
