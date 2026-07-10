-- AntrophAI v0.41.88 multiplayer schema skeleton
-- Draft review SQL only. Do not apply to Supabase until reviewed.

create extension if not exists pgcrypto;

create table if not exists public.multiplayer_rounds (
  id uuid primary key default gen_random_uuid(),
  round_key text not null,
  round_name text not null,
  status text not null default 'draft',
  game_speed integer not null default 1,
  current_tick integer not null default 0,
  tick_length_seconds integer,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  notes text,
  constraint multiplayer_rounds_round_key_key unique (round_key),
  constraint multiplayer_rounds_status_check check (status in ('draft', 'active', 'paused', 'finished', 'archived')),
  constraint multiplayer_rounds_game_speed_check check (game_speed > 0),
  constraint multiplayer_rounds_current_tick_check check (current_tick >= 0),
  constraint multiplayer_rounds_tick_length_seconds_check check (tick_length_seconds is null or tick_length_seconds > 0)
);

comment on table public.multiplayer_rounds is 'Canonical multiplayer round/game instance for server-authoritative play.';
comment on column public.multiplayer_rounds.round_key is 'Stable developer-facing round key.';
comment on column public.multiplayer_rounds.current_tick is 'Current authoritative tick number managed by the game service.';
comment on column public.multiplayer_rounds.notes is 'Draft notes field for review and operations context.';

create index if not exists idx_multiplayer_rounds_status on public.multiplayer_rounds (status);
create index if not exists idx_multiplayer_rounds_current_tick on public.multiplayer_rounds (current_tick);

create table if not exists public.multiplayer_players (
  id uuid primary key default gen_random_uuid(),
  tester_label text,
  display_name text not null,
  status text not null default 'active',
  created_from_invite_token_id uuid,
  created_from_grant_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  last_seen_at timestamptz,
  notes text,
  constraint multiplayer_players_status_check check (status in ('active', 'suspended', 'disabled', 'retired'))
);

comment on table public.multiplayer_players is 'Player/tester identity for multiplayer mode.';
comment on column public.multiplayer_players.created_from_invite_token_id is 'Nullable provenance field only. Canonical access history belongs in multiplayer_player_access_links. FK to existing invite_tokens table is intentionally deferred until the final relationship and source type are confirmed.';
comment on column public.multiplayer_players.created_from_grant_id is 'Nullable provenance field only. Canonical access history belongs in multiplayer_player_access_links.';
comment on column public.multiplayer_players.notes is 'Draft notes field for review and support context.';

create index if not exists idx_multiplayer_players_display_name on public.multiplayer_players (display_name);
create index if not exists idx_multiplayer_players_status on public.multiplayer_players (status);
create index if not exists idx_multiplayer_players_created_from_invite_token_id on public.multiplayer_players (created_from_invite_token_id);
create index if not exists idx_multiplayer_players_created_from_grant_id on public.multiplayer_players (created_from_grant_id);

create table if not exists public.multiplayer_player_access_links (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.multiplayer_players (id),
  access_type text not null default 'invite-token',
  invite_token_id uuid,
  grant_id text,
  token_hash_prefix text,
  provider text not null default 'antrophai-token-service',
  status text not null default 'active',
  issued_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  notes text,
  constraint multiplayer_player_access_links_status_check check (status in ('active', 'revoked', 'replaced', 'expired'))
);

comment on table public.multiplayer_player_access_links is 'Separate access-link history for player identity, grants, and future revocation or provider migration.';
comment on column public.multiplayer_player_access_links.invite_token_id is 'Nullable draft link to the existing invite_tokens table. FK is intentionally deferred until the invite-token source relationship is confirmed.';
comment on column public.multiplayer_player_access_links.grant_id is 'Server-issued access-grant identifier. Active grant ids are indexed for lookup and deduplication.';
comment on column public.multiplayer_player_access_links.token_hash_prefix is 'Short hash prefix only. Never store the raw token.';
comment on column public.multiplayer_player_access_links.provider is 'Access provider or issuing service name.';

create index if not exists idx_multiplayer_player_access_links_player_id on public.multiplayer_player_access_links (player_id);
create index if not exists idx_multiplayer_player_access_links_grant_id on public.multiplayer_player_access_links (grant_id);
create index if not exists idx_multiplayer_player_access_links_invite_token_id on public.multiplayer_player_access_links (invite_token_id);
create index if not exists idx_multiplayer_player_access_links_status on public.multiplayer_player_access_links (status);
create unique index if not exists idx_multiplayer_player_access_links_active_grant_id
  on public.multiplayer_player_access_links (grant_id)
  where grant_id is not null and status = 'active';

create table if not exists public.multiplayer_player_rounds (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.multiplayer_players (id),
  round_id uuid not null references public.multiplayer_rounds (id),
  role text not null default 'player',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_player_rounds_player_round_unique unique (player_id, round_id),
  constraint multiplayer_player_rounds_status_check check (status in ('active', 'left', 'revoked')),
  constraint multiplayer_player_rounds_role_check check (role in ('player', 'observer', 'admin'))
);

comment on table public.multiplayer_player_rounds is 'Join table connecting players to rounds.';

create index if not exists idx_multiplayer_player_rounds_player_id on public.multiplayer_player_rounds (player_id);
create index if not exists idx_multiplayer_player_rounds_round_id on public.multiplayer_player_rounds (round_id);
create index if not exists idx_multiplayer_player_rounds_round_player on public.multiplayer_player_rounds (round_id, player_id);

create table if not exists public.multiplayer_player_state (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.multiplayer_players (id),
  round_id uuid not null references public.multiplayer_rounds (id),
  tick integer not null default 0,
  state_version bigint not null default 0,
  race_key text,
  land integer not null default 0,
  power numeric not null default 0,
  money numeric not null default 0,
  banked numeric not null default 0,
  energy numeric not null default 0,
  food numeric not null default 0,
  water numeric not null default 0,
  population numeric not null default 0,
  morale numeric,
  protection_until_tick integer,
  vacation_until_tick integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_player_state_player_round_unique unique (player_id, round_id),
  constraint multiplayer_player_state_tick_check check (tick >= 0),
  constraint multiplayer_player_state_state_version_check check (state_version >= 0),
  constraint multiplayer_player_state_land_check check (land >= 0),
  constraint multiplayer_player_state_power_check check (power >= 0),
  constraint multiplayer_player_state_money_check check (money >= 0),
  constraint multiplayer_player_state_banked_check check (banked >= 0),
  constraint multiplayer_player_state_energy_check check (energy >= 0),
  constraint multiplayer_player_state_food_check check (food >= 0),
  constraint multiplayer_player_state_water_check check (water >= 0),
  constraint multiplayer_player_state_population_check check (population >= 0),
  constraint multiplayer_player_state_protection_until_tick_check check (protection_until_tick is null or protection_until_tick >= 0),
  constraint multiplayer_player_state_vacation_until_tick_check check (vacation_until_tick is null or vacation_until_tick >= 0)
);

comment on table public.multiplayer_player_state is 'Canonical snapshot table for current player resources and core state in a given round.';
comment on column public.multiplayer_player_state.state_version is 'Monotonic snapshot version for optimistic sync and debugging.';
comment on column public.multiplayer_player_state.tick is 'Tick at which this snapshot was last authoritative.';

create index if not exists idx_multiplayer_player_state_player_id on public.multiplayer_player_state (player_id);
create index if not exists idx_multiplayer_player_state_round_id on public.multiplayer_player_state (round_id);
create index if not exists idx_multiplayer_player_state_round_player on public.multiplayer_player_state (round_id, player_id);

create table if not exists public.multiplayer_player_buildings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.multiplayer_players (id),
  round_id uuid not null references public.multiplayer_rounds (id),
  building_key text not null,
  count integer not null default 0,
  effective_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_player_buildings_player_round_building_unique unique (player_id, round_id, building_key),
  constraint multiplayer_player_buildings_count_check check (count >= 0),
  constraint multiplayer_player_buildings_effective_count_check check (effective_count is null or effective_count >= 0)
);

comment on table public.multiplayer_player_buildings is 'Snapshot table for current building counts per player and round. Server updates this as canonical state.';

create index if not exists idx_multiplayer_player_buildings_player_id on public.multiplayer_player_buildings (player_id);
create index if not exists idx_multiplayer_player_buildings_round_id on public.multiplayer_player_buildings (round_id);
create index if not exists idx_multiplayer_player_buildings_round_player on public.multiplayer_player_buildings (round_id, player_id);

create table if not exists public.multiplayer_player_armies (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.multiplayer_players (id),
  round_id uuid not null references public.multiplayer_rounds (id),
  unit_key text not null,
  count integer not null default 0,
  training_count integer not null default 0,
  returning_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_player_armies_player_round_unit_unique unique (player_id, round_id, unit_key),
  constraint multiplayer_player_armies_count_check check (count >= 0),
  constraint multiplayer_player_armies_training_count_check check (training_count >= 0),
  constraint multiplayer_player_armies_returning_count_check check (returning_count >= 0)
);

comment on table public.multiplayer_player_armies is 'Snapshot table for current military and unit counts per player and round. Server updates this as canonical state.';

create index if not exists idx_multiplayer_player_armies_player_id on public.multiplayer_player_armies (player_id);
create index if not exists idx_multiplayer_player_armies_round_id on public.multiplayer_player_armies (round_id);
create index if not exists idx_multiplayer_player_armies_round_player on public.multiplayer_player_armies (round_id, player_id);

create table if not exists public.multiplayer_alliances (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  alliance_name text not null,
  alliance_tag text,
  status text not null default 'active',
  created_by_player_id uuid references public.multiplayer_players (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  notes text,
  constraint multiplayer_alliances_round_name_unique unique (round_id, alliance_name),
  constraint multiplayer_alliances_status_check check (status in ('active', 'closed', 'disbanded'))
);

comment on table public.multiplayer_alliances is 'Alliance records for a multiplayer round.';
comment on column public.multiplayer_alliances.alliance_tag is 'Optional short tag. Unique enforcement for non-null values is handled by a partial unique index.';

create unique index if not exists idx_multiplayer_alliances_round_tag_unique
  on public.multiplayer_alliances (round_id, alliance_tag)
  where alliance_tag is not null;
create index if not exists idx_multiplayer_alliances_round_id on public.multiplayer_alliances (round_id);
create index if not exists idx_multiplayer_alliances_created_by_player_id on public.multiplayer_alliances (created_by_player_id);

create table if not exists public.multiplayer_alliance_members (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.multiplayer_alliances (id),
  player_id uuid not null references public.multiplayer_players (id),
  round_id uuid not null references public.multiplayer_rounds (id),
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_alliance_members_alliance_player_unique unique (alliance_id, player_id),
  constraint multiplayer_alliance_members_status_check check (status in ('active', 'left', 'kicked')),
  constraint multiplayer_alliance_members_role_check check (role in ('member', 'officer', 'leader'))
);

comment on table public.multiplayer_alliance_members is 'Join table for player membership in alliances.';

create index if not exists idx_multiplayer_alliance_members_alliance_id on public.multiplayer_alliance_members (alliance_id);
create index if not exists idx_multiplayer_alliance_members_player_id on public.multiplayer_alliance_members (player_id);
create index if not exists idx_multiplayer_alliance_members_round_id on public.multiplayer_alliance_members (round_id);

create table if not exists public.multiplayer_action_queue (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  player_id uuid not null references public.multiplayer_players (id),
  action_type text not null,
  status text not null default 'queued',
  requested_tick integer,
  execute_after_tick integer,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz,
  constraint multiplayer_action_queue_status_check check (status in ('queued', 'processing', 'processed', 'failed', 'cancelled')),
  constraint multiplayer_action_queue_requested_tick_check check (requested_tick is null or requested_tick >= 0),
  constraint multiplayer_action_queue_execute_after_tick_check check (execute_after_tick is null or execute_after_tick >= 0)
);

comment on table public.multiplayer_action_queue is 'Canonical queued player orders and the main server write path.';
comment on column public.multiplayer_action_queue.payload is 'Serialized action arguments submitted by the browser through the game service.';
comment on column public.multiplayer_action_queue.result is 'Resolved action result written by the game service.';
comment on column public.multiplayer_action_queue.idempotency_key is 'Client-supplied key for deduplicating repeated submissions.';

create index if not exists idx_multiplayer_action_queue_round_status_execute_after
  on public.multiplayer_action_queue (round_id, status, execute_after_tick);
create index if not exists idx_multiplayer_action_queue_round_player
  on public.multiplayer_action_queue (round_id, player_id);
create unique index if not exists idx_multiplayer_action_queue_player_round_idempotency
  on public.multiplayer_action_queue (player_id, round_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.multiplayer_tick_log (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  tick integer not null,
  status text not null,
  started_at timestamptz,
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint multiplayer_tick_log_round_tick_unique unique (round_id, tick),
  constraint multiplayer_tick_log_tick_check check (tick >= 0),
  constraint multiplayer_tick_log_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'replayed'))
);

comment on table public.multiplayer_tick_log is 'Record of every authoritative tick processed for a round.';

create index if not exists idx_multiplayer_tick_log_round_tick on public.multiplayer_tick_log (round_id, tick);
create index if not exists idx_multiplayer_tick_log_round_status on public.multiplayer_tick_log (round_id, status);

create table if not exists public.multiplayer_audit_log (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.multiplayer_rounds (id),
  player_id uuid references public.multiplayer_players (id),
  actor_type text not null default 'system',
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.multiplayer_audit_log is 'Append-only security and game audit log.';
comment on column public.multiplayer_audit_log.event_data is 'Event details should be redacted as needed and should never include secrets.';

create index if not exists idx_multiplayer_audit_log_round_player_event_type
  on public.multiplayer_audit_log (round_id, player_id, event_type);
create index if not exists idx_multiplayer_audit_log_round_created_at
  on public.multiplayer_audit_log (round_id, created_at);

create table if not exists public.multiplayer_messages (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  sender_player_id uuid references public.multiplayer_players (id),
  recipient_player_id uuid references public.multiplayer_players (id),
  recipient_alliance_id uuid references public.multiplayer_alliances (id),
  message_type text not null default 'player',
  subject text,
  body text not null,
  status text not null default 'active',
  visibility text not null default 'private',
  redacted_at timestamptz,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint multiplayer_messages_message_type_check check (message_type in ('player', 'alliance', 'system')),
  constraint multiplayer_messages_status_check check (status in ('active', 'hidden', 'redacted', 'archived')),
  constraint multiplayer_messages_visibility_check check (visibility in ('private', 'player', 'alliance', 'public')),
  constraint multiplayer_messages_recipient_check check (
    recipient_player_id is not null
    or recipient_alliance_id is not null
    or message_type = 'system'
  )
);

comment on table public.multiplayer_messages is 'Game-visible communication. Messages are game records and should not be casually deleted.';
comment on column public.multiplayer_messages.status is 'Operational/message moderation status. Prefer status or visibility changes over hard delete.';
comment on column public.multiplayer_messages.visibility is 'Audience visibility for the message record.';
comment on column public.multiplayer_messages.redacted_at is 'Optional timestamp for moderation or redaction.';

create index if not exists idx_multiplayer_messages_round_id on public.multiplayer_messages (round_id);
create index if not exists idx_multiplayer_messages_recipient_player_id on public.multiplayer_messages (recipient_player_id);
create index if not exists idx_multiplayer_messages_recipient_alliance_id on public.multiplayer_messages (recipient_alliance_id);
create index if not exists idx_multiplayer_messages_round_created_at on public.multiplayer_messages (round_id, created_at);

create table if not exists public.multiplayer_round_events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  tick integer,
  event_type text not null,
  visibility text not null default 'public',
  actor_player_id uuid references public.multiplayer_players (id),
  target_player_id uuid references public.multiplayer_players (id),
  alliance_id uuid references public.multiplayer_alliances (id),
  title text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint multiplayer_round_events_tick_check check (tick is null or tick >= 0)
);

comment on table public.multiplayer_round_events is 'Game-facing round news/event stream. Append-only by design and separate from operational audit logs.';
comment on column public.multiplayer_round_events.visibility is 'Audience visibility for game-facing events such as public, alliance, or player-scoped news.';

create index if not exists idx_multiplayer_round_events_round_tick on public.multiplayer_round_events (round_id, tick);
create index if not exists idx_multiplayer_round_events_round_created_at on public.multiplayer_round_events (round_id, created_at);
create index if not exists idx_multiplayer_round_events_event_type on public.multiplayer_round_events (event_type);
create index if not exists idx_multiplayer_round_events_visibility on public.multiplayer_round_events (visibility);

create table if not exists public.multiplayer_attack_log (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  attacker_player_id uuid references public.multiplayer_players (id),
  defender_player_id uuid references public.multiplayer_players (id),
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz,
  constraint multiplayer_attack_log_status_check check (status in ('queued', 'resolved', 'failed', 'cancelled'))
);

comment on table public.multiplayer_attack_log is 'Game history log for attack resolution. Append-only in normal operation and may feed player-facing reports.';

create index if not exists idx_multiplayer_attack_log_round_status on public.multiplayer_attack_log (round_id, status);
create index if not exists idx_multiplayer_attack_log_attacker_player_id on public.multiplayer_attack_log (attacker_player_id);
create index if not exists idx_multiplayer_attack_log_defender_player_id on public.multiplayer_attack_log (defender_player_id);

create table if not exists public.multiplayer_lrc_sequences (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  firing_player_id uuid references public.multiplayer_players (id),
  target_player_id uuid references public.multiplayer_players (id),
  target_alliance_id uuid references public.multiplayer_alliances (id),
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz,
  constraint multiplayer_lrc_sequences_status_check check (status in ('queued', 'running', 'resolved', 'failed', 'cancelled')),
  constraint multiplayer_lrc_sequences_target_check check (
    target_player_id is not null
    or target_alliance_id is not null
  )
);

comment on table public.multiplayer_lrc_sequences is 'Game history log for LRC sequences. Append-only in normal operation and may feed player-facing reports.';

create index if not exists idx_multiplayer_lrc_sequences_round_status on public.multiplayer_lrc_sequences (round_id, status);
create index if not exists idx_multiplayer_lrc_sequences_firing_player_id on public.multiplayer_lrc_sequences (firing_player_id);
create index if not exists idx_multiplayer_lrc_sequences_target_player_id on public.multiplayer_lrc_sequences (target_player_id);
create index if not exists idx_multiplayer_lrc_sequences_target_alliance_id on public.multiplayer_lrc_sequences (target_alliance_id);

create table if not exists public.multiplayer_missile_log (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.multiplayer_rounds (id),
  firing_player_id uuid references public.multiplayer_players (id),
  target_player_id uuid references public.multiplayer_players (id),
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz,
  constraint multiplayer_missile_log_status_check check (status in ('queued', 'running', 'resolved', 'failed', 'cancelled')),
  constraint multiplayer_missile_log_target_check check (target_player_id is not null)
);

comment on table public.multiplayer_missile_log is 'Game history log for missile launches and impacts. Append-only in normal operation and may feed player-facing reports.';

create index if not exists idx_multiplayer_missile_log_round_status on public.multiplayer_missile_log (round_id, status);
create index if not exists idx_multiplayer_missile_log_firing_player_id on public.multiplayer_missile_log (firing_player_id);
create index if not exists idx_multiplayer_missile_log_target_player_id on public.multiplayer_missile_log (target_player_id);
