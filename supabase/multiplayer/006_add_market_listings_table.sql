-- 006_add_market_listings_table.sql
-- Incremental migration: create multiplayer_market_listings, the round-scoped
-- shared order book for player-to-player mineral sell listings (Market slice 6b).
--
-- Unlike the per-player K/V snapshot tables (buildings/armies/science/minerals),
-- this is shared round state: every player in the round reads the same listing
-- rows. Listed minerals are escrowed out of the seller's
-- multiplayer_player_minerals row while the listing is active; Cancel returns
-- them. (Buy — the cross-player money transfer — is sub-slice 6c, not here.)
--
-- MUST be applied to the production Supabase BEFORE the game-service code that
-- reads/writes market listings is deployed, or round-summary / hosted-round
-- enter reads that select listings will fail (same ordering hazard as 003-005).
--
-- Draft/reviewable, consistent with the rest of supabase/multiplayer. Do not run
-- against production without explicit approval.

create table if not exists public.multiplayer_market_listings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  seller_player_id uuid not null references public.multiplayer_players (id),
  mineral_key text not null,
  quantity numeric not null default 0,
  price numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_market_listings_quantity_check check (quantity >= 0),
  constraint multiplayer_market_listings_price_check check (price >= 0)
);

comment on table public.multiplayer_market_listings is 'Round-scoped shared order book for player-to-player mineral sell listings. Listed minerals are escrowed out of the seller multiplayer_player_minerals row while the listing is active.';

create index if not exists idx_multiplayer_market_listings_round_id on public.multiplayer_market_listings (round_id);
create index if not exists idx_multiplayer_market_listings_round_status on public.multiplayer_market_listings (round_id, status);
create index if not exists idx_multiplayer_market_listings_seller on public.multiplayer_market_listings (seller_player_id);
