-- 005_add_player_minerals_table.sql
-- Incremental migration: create multiplayer_player_minerals, the per-mineral
-- stockpile table (one row per mineral per player per round), mirroring the
-- multiplayer_player_buildings / _armies / _science K/V snapshot pattern.
--
-- Prerequisite for Shops (mineral purchases) and the later Market slices. Fresh
-- installs get it from 001; apply this to databases that predate it.
--
-- MUST be applied to the production Supabase BEFORE the game-service code that
-- reads/writes minerals is deployed, or round-summary / hosted-round enter reads
-- that select minerals will fail (same ordering hazard as 003/004).
--
-- Draft/reviewable, consistent with the rest of supabase/multiplayer. Do not run
-- against production without explicit approval.

create table if not exists public.multiplayer_player_minerals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.multiplayer_players (id),
  round_id uuid not null references public.multiplayer_rounds (id),
  mineral_key text not null,
  count numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_player_minerals_player_round_mineral_unique unique (player_id, round_id, mineral_key),
  constraint multiplayer_player_minerals_count_check check (count >= 0)
);

comment on table public.multiplayer_player_minerals is 'Snapshot table for per-mineral stockpile counts per player and round (one row per mineral). Server updates this as canonical state.';

create index if not exists idx_multiplayer_player_minerals_player_id on public.multiplayer_player_minerals (player_id);
create index if not exists idx_multiplayer_player_minerals_round_id on public.multiplayer_player_minerals (round_id);
create index if not exists idx_multiplayer_player_minerals_round_player on public.multiplayer_player_minerals (round_id, player_id);
