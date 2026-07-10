-- 004_add_player_science_table.sql
-- Incremental migration: create multiplayer_player_science, the per-field research
-- level table (one row per science field per player per round), mirroring the
-- multiplayer_player_buildings / multiplayer_player_armies K/V snapshot pattern.
--
-- Backfill note: this table was added to the game-service in code during the
-- Science slice but a migration file was not created at the time; existing
-- databases that predate it need this migration before the v0.43.x game-service
-- round-summary / hosted-round enter reads (which now select science rows) work.
-- Fresh installs get it from 001.
--
-- Draft/reviewable, consistent with the rest of supabase/multiplayer. Do not run
-- against production without explicit approval.

create table if not exists public.multiplayer_player_science (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.multiplayer_players (id),
  round_id uuid not null references public.multiplayer_rounds (id),
  science_key text not null,
  level integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_player_science_player_round_field_unique unique (player_id, round_id, science_key),
  constraint multiplayer_player_science_level_check check (level >= 0)
);

comment on table public.multiplayer_player_science is 'Snapshot table for per-field research levels per player and round (one row per science field). Server updates this as canonical state.';

create index if not exists idx_multiplayer_player_science_player_id on public.multiplayer_player_science (player_id);
create index if not exists idx_multiplayer_player_science_round_id on public.multiplayer_player_science (round_id);
create index if not exists idx_multiplayer_player_science_round_player on public.multiplayer_player_science (round_id, player_id);
