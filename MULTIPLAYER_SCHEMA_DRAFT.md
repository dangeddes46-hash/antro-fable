# AntrophAI multiplayer schema draft

Status: draft only, no SQL migration yet

This document sketches the target Supabase schema for server-authoritative multiplayer.
It is design-only and should not be treated as executable migration output.

v0.41.89 refinement note:

- separate invite-token access linkage from multiplayer player identity
- treat gameplay history, round events, and audit rows as first-class records
- keep the current-state tables as snapshots, not the only history source

Related review files:

- `supabase/multiplayer/README.md`
- `supabase/multiplayer/001_multiplayer_schema_skeleton.sql`
- `supabase/multiplayer/002_multiplayer_seed_dev_round_example.sql`
- `supabase/multiplayer/RLS_SECURITY_NOTES.md`

## Design goals

- Keep canonical multiplayer state in the database.
- Keep browser localStorage out of multiplayer truth.
- Separate current state from logs and audit history.
- Make recovery and debugging easy.
- Preserve the ability to run the current local prototype separately.

## Data classification

- Canonical: the current authoritative state
- Canonical snapshot: the latest server-updated current-state row
- Append-only history: game events, logs, and audit records kept for recovery and review

## Tables

### multiplayer_rounds

Purpose:

- Store the active multiplayer round definitions and the authoritative tick clock.

Important fields:

- `round_id`
- `round_key`
- `name`
- `status`
- `speed`
- `tick_number`
- `tick_started_at`
- `tick_finished_at`
- `created_at`
- `updated_at`

Relationships:

- one round has many players
- one round has many alliances
- one round has many events, logs, and audit rows

Data type:

- Canonical

Security concerns:

- server-only writes
- round state must not be editable from the browser

### multiplayer_players

Purpose:

- Store player identity records for the shared multiplayer world.

Important fields:

- `player_id`
- `round_id`
- `invite_token_id`
- `invite_grant_id`
- `display_name`
- `tester_label`
- `status`
- `created_at`
- `last_seen_at`
- `access_mode`

Relationships:

- belongs to one round
- may be linked to one invite token or future account record
- may have many historical access links over time

Data type:

- Canonical identity record

Security concerns:

- no raw invite token should be stored
- identity changes should be server-controlled
- the current access grant should live in a separate access-link table

### multiplayer_player_access_links

Purpose:

- Track the invite-token or account access history that links a browser-approved grant to a multiplayer player record.

Important fields:

- `id`
- `player_id`
- `access_type`
- `invite_token_id`
- `grant_id`
- `token_hash_prefix`
- `provider`
- `status`
- `issued_at`
- `revoked_at`
- `created_at`
- `updated_at`
- `notes`

Relationships:

- many access links may point to one player over time
- active grant ids should remain unique
- invite token provenance stays separate from the player row

Data type:

- Canonical access history

Security concerns:

- never store the raw invite token
- keep the access grant separate from gameplay state
- use this table for provenance and revocation, not as the multiplayer truth source

### multiplayer_player_state

Purpose:

- Store the current shared economy and core state for each player.

Important fields:

- `player_id`
- `round_id`
- `land`
- `power`
- `cards`
- `energy`
- `population`
- `progress`
- `state_version`
- `updated_at`

Relationships:

- one row per player per round

Data type:

- Canonical snapshot

Security concerns:

- server-only writes
- use row-level controls so players only see what they should see

### multiplayer_player_buildings

Purpose:

- Store the current building counts for each player.

Important fields:

- `player_id`
- `round_id`
- `banks`
- `factories`
- `barracks`
- `science_labs`
- `missile_bases`
- `star_wars`
- `lrc_structures`
- `impact_shields`
- `updated_at`

Relationships:

- one row per player per round

Data type:

- Canonical snapshot

Security concerns:

- keep values in sync with tick resolution
- do not let the client write counts directly

### multiplayer_player_armies

Purpose:

- Store current army and military-ready counts for each player.

Important fields:

- `player_id`
- `round_id`
- `offense_units`
- `defense_units`
- `missiles`
- `scanners`
- `energy_spent`
- `updated_at`

Relationships:

- one row per player per round

Data type:

- Canonical snapshot

Security concerns:

- combat and missile counts must be server-authoritative

### multiplayer_alliances

Purpose:

- Store alliance records and alliance-level metadata.

Important fields:

- `alliance_id`
- `round_id`
- `name`
- `leader_player_id`
- `status`
- `created_at`
- `updated_at`

Relationships:

- one alliance belongs to one round
- one alliance has many members

Data type:

- Canonical

Security concerns:

- alliance changes must be server-validated

### multiplayer_alliance_members

Purpose:

- Track which players belong to which alliance.

Important fields:

- `alliance_id`
- `player_id`
- `round_id`
- `role`
- `joined_at`
- `left_at`

Relationships:

- join table between players and alliances

Data type:

- Canonical

Security concerns:

- join and leave actions need locking and audit logging

### multiplayer_messages

Purpose:

- Store player messages and system messages.

Important fields:

- `message_id`
- `round_id`
- `sender_player_id`
- `recipient_player_id`
- `message_type`
- `subject`
- `body`
- `status`
- `visibility`
- `read_at`
- `redacted_at`
- `created_at`

Relationships:

- references players and rounds

Data type:

- Canonical player-visible record
- part of game history, not a disposable scratch table

Security concerns:

- size limits
- moderation hooks if public testing requires them
- prefer redaction or archival over casual deletion

### multiplayer_round_events

Purpose:

- Store append-only round news, milestones, and player-visible event summaries.

Important fields:

- `id`
- `round_id`
- `tick`
- `event_type`
- `visibility`
- `actor_player_id`
- `target_player_id`
- `alliance_id`
- `title`
- `body`
- `payload`
- `created_at`

Relationships:

- references players, alliances, and rounds

Data type:

- Append-only history

Security concerns:

- visibility must be filtered by the service
- keep secrets and raw internal details out of player-visible records
- do not rewrite history unless a recovery process explicitly requires it

### multiplayer_action_queue

Purpose:

- Store queued player actions waiting on tick processing or validation.

Important fields:

- `action_id`
- `round_id`
- `player_id`
- `action_type`
- `client_action_id`
- `payload_json`
- `status`
- `queued_at`
- `processed_at`
- `result_json`

Relationships:

- one queued action belongs to one player and one round

Data type:

- Canonical while pending
- append-only operational history once processed

Security concerns:

- must be protected from direct client writes
- idempotency keys should prevent duplicate submission

### multiplayer_attack_log

Purpose:

- Record attack orders and combat results.

Important fields:

- `attack_log_id`
- `round_id`
- `attacker_player_id`
- `target_player_id`
- `action_id`
- `tick_number`
- `result_json`
- `created_at`

Relationships:

- references players, round, and action queue rows

Data type:

- Append-only game history

Security concerns:

- should capture enough detail for dispute resolution without exposing secrets

### multiplayer_lrc_sequences

Purpose:

- Record LRC firing sequences and their shot-by-shot outcomes.

Important fields:

- `sequence_id`
- `round_id`
- `source_player_id`
- `target_alliance_id`
- `target_player_id`
- `tick_started_at`
- `tick_finished_at`
- `status`
- `result_json`

Relationships:

- references players, alliances, and tick logs

Data type:

- Canonical for active sequences
- Append-only game history after completion

Security concerns:

- sequence state must be locked while active

### multiplayer_missile_log

Purpose:

- Record missile launches, impacts, and interception outcomes.

Important fields:

- `missile_log_id`
- `round_id`
- `player_id`
- `target_player_id`
- `action_id`
- `tick_number`
- `result_json`
- `created_at`

Relationships:

- references players and action rows

Data type:

- Append-only game history

Security concerns:

- no client-side authority over interception or damage

### multiplayer_tick_log

Purpose:

- Keep the authoritative record of each server tick.

Important fields:

- `tick_log_id`
- `round_id`
- `tick_number`
- `started_at`
- `finished_at`
- `status`
- `processed_actions`
- `error_json`

Relationships:

- one row per tick per round

Data type:

- Append-only authoritative tick history

Security concerns:

- essential for recovery if a tick fails halfway
- should support retry or replay logic

### multiplayer_audit_log

Purpose:

- Keep a broad append-only audit trail for important service events.

Important fields:

- `audit_log_id`
- `round_id`
- `player_id`
- `event_type`
- `source`
- `details_json`
- `created_at`

Relationships:

- may reference any other multiplayer table

Data type:

- Append-only operational and security audit log

Security concerns:

- redact secrets and avoid raw tokens
- keep the audit trail readable but not overexposed

## Invite-token to player linkage

The invite-token bridge should use a separate access-link table to connect an invite grant to a multiplayer player record.

Likely fields involved:

- `invite_token_id`
- `invite_grant_id`
- `tester_label`
- `display_name`
- `access_mode`

Do not store the raw invite token in multiplayer tables.

Recommended posture for the first prototype:

- keep `multiplayer_players` as the player identity row
- keep `multiplayer_player_access_links` as the grant/provenance history
- keep `multiplayer_player_state`, `multiplayer_player_buildings`, and `multiplayer_player_armies` as current-state snapshots
- keep `multiplayer_messages` and `multiplayer_round_events` as player-visible history records
- keep `multiplayer_audit_log` separate and non-player-visible

## Open schema questions

- Should `invite_token_id` become a real FK in the first migration or stay nullable until the token-service integration settles?
- Which round events should be player-visible and which should remain internal?
- Should current state and detailed history be split into separate snapshot and event tables?
- Should `multiplayer_action_queue` be the only write path for all player actions?
- Should `multiplayer_messages` be public-read, private-read, or alliance-scoped?
- Should local prototype data be kept in separate tables or separate database objects entirely?

## Pseudocode only

This document is design-only.
Do not treat the field lists above as executable SQL until a later schema branch writes the actual migration scripts.
