-- 003_add_player_banked.sql
-- Incremental migration: add the per-player banked (bank balance) scalar to
-- multiplayer_player_state, used by the economy tick's bank-interest term and
-- the Bank deposit/withdraw actions.
--
-- banked is a single per-player resource scalar in the same family as money /
-- food / water / energy / population — those are columns on
-- multiplayer_player_state, so banked is a column too (not a keyed collection
-- table like buildings / armies / science). Apply to existing databases that
-- were created before this column existed; fresh installs get it from 001.
--
-- Draft/reviewable, consistent with the rest of supabase/multiplayer. Do not run
-- against production without explicit approval.

alter table public.multiplayer_player_state
  add column if not exists banked numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'multiplayer_player_state_banked_check'
  ) then
    alter table public.multiplayer_player_state
      add constraint multiplayer_player_state_banked_check check (banked >= 0);
  end if;
end $$;

comment on column public.multiplayer_player_state.banked is 'Cardisium held in the player''s banks; earns interest each tick and is set by Bank deposit/withdraw actions.';
