# AntrophAI multiplayer architecture plan - v0.41.95

Status: planning/docs only

This branch does not add multiplayer code, schema migrations, or gameplay changes.
It documents the target server-authoritative architecture for the next phase after the current browser-local prototype.

Current runtime note:

- Current game client runtime remains v0.41.95.
- The invite-token service remains a separate access-control service.
- The current hosted token service at https://antrophai-glwtest-passkey.onrender.com is the proof point for the Browser -> Render -> Supabase pattern.
- Local GLW/IG prototype mode still uses browser localStorage for saves.
- v0.41.92 adds a read-only Shared Multiplayer DEV launcher preview that reads hosted round-summary data from the game service.
- v0.41.94 adds the first dev-only queued action and manual tick proof: the browser queues +1 factory for DEV Player One and the hosted game service applies it on a manual DEV tick.
- v0.41.95 adds a proof-reset control for the same DEV round so the queue/manual-tick sequence can be replayed safely without touching browser-local saves.
- Future multiplayer access should keep player identity and access-link history in separate records.
- The hosted game-service skeleton now has temporary dev seed/read proof endpoints for v0.41.91, the legacy build-factory proof endpoint for v0.41.93, the queued-action/manual-tick proof endpoints for v0.41.94, and the proof-reset endpoint for v0.41.95.

## Core principle

The browser is not the authority.

Use this framing:

- The player is like a king on a throne.
- The player issues orders.
- The work is calculated elsewhere.
- The server validates and performs the work.
- The shared database records the state of the kingdom.

In technical terms:

- Browser client displays state and submits actions.
- Hosted game service validates actions and applies rules.
- Supabase/shared database stores canonical game state, player access-link history, and append-only game history.
- Browser localStorage may remain for local prototype mode, but not as multiplayer truth.

## Current architecture

The current prototype is a React/Vite client with browser-local saves.

Current characteristics:

- localStorage stores GLW/IG save state
- launcher and slot manager run entirely in the browser
- invite-token access is stored locally after redemption
- the token service proves a Browser -> Render -> Supabase pattern for access control

That pattern is important because it shows how the browser can ask a hosted service to validate and record something, while the browser itself only keeps a local convenience record.

## How the invite-token service bridges to multiplayer

The invite-token flow already splits responsibilities:

1. Browser collects a token or fallback code.
2. Render-hosted token service validates the token.
3. Supabase stores the canonical token row and claim status.
4. Browser stores only a local access grant.

Multiplayer extends the same shape from access control to game state:

- invite-token redemption becomes player identity linking
- access grant becomes a browser-local proof of which player this browser may act as
- the game service becomes the authority for state changes
- Supabase becomes the durable shared record for rounds, players, actions, logs, and first-class round history
- a separate access-link table keeps grant provenance distinct from the player identity row

## Target three-layer architecture

### 1. Browser client

Responsibilities:

- display launcher, shared state, and action UI
- submit player actions
- show validation errors and server results
- keep only local convenience data, cache, and access grants

Must not:

- directly edit canonical multiplayer state
- calculate authoritative combat or economy results
- trust localStorage as shared truth

### 2. Game service

Likely hosting target:

- Render Web Service

Responsibilities:

- validate all player actions
- apply game rules
- process ticks
- write canonical state to Supabase
- generate logs and audit trails

Must own:

- server-side economy changes
- combat resolution
- alliance changes
- missile and LRC resolution
- tick progression

### 3. Supabase/shared database

Responsibilities:

- store canonical multiplayer records
- store per-round and per-player state
- keep action history and logs
- support recovery and auditing

Must be treated as:

- the source of truth for multiplayer state
- writable only through the game service

## Why the browser cannot be trusted

The browser is useful for rendering and collecting input, but it is not a trust boundary.

Reasons:

- the client code is inspectable
- localStorage is editable
- users can replay or fake requests
- browser state can diverge from shared state
- two browsers can disagree unless the server resolves the conflict

So multiplayer state must live in the service and database, not in the client.

## Local prototype vs shared multiplayer

Keep these modes separate:

- Local Prototype
- Shared Multiplayer DEV

Local prototype mode:

- keeps current GLW/IG formula testing intact
- keeps browser-local saves useful
- remains valuable for UI and mechanics work

Shared multiplayer mode:

- uses server-authoritative state
- never mixes with local prototype saves
- should not automatically import old local saves into canonical multiplayer records

Avoid accidental migration of local test saves into multiplayer state.

## Token-to-player model

Current invite-token model:

- one invite token is redeemed once
- redeemed access is stored locally
- token rows live in Supabase

Target multiplayer model:

- one invite token should link to one multiplayer player identity
- the access grant should prove that the browser may act as that player
- the service should be able to revoke or revalidate access later
- the same invite-token pattern can later be extended or replaced by a fuller account system

Open questions to answer before schema work:

- Should one invite token create exactly one player?
- Should the player display name be editable?
- Can one tester have multiple rounds?
- Should access grants be revocable?
- How should a lost browser localStorage record be recovered?
- Should invite-token linkage be stored on the player row or in a separate access-link table?

## Tick model

The future multiplayer tick model must be server-side and authoritative.

Requirements:

- tick number and tick time must be stored centrally
- actions may be queued and resolved on ticks
- tick logs must be durable and easy to inspect
- the server must be able to recover from partial failures

Staged plan:

- Phase A: manual admin tick with a visible log
- Phase B: scheduled tick service
- Phase C: robust recovery if a tick fails halfway

## Migration path

Safe sequence:

1. v0.41.87: planning/docs only
2. v0.41.88: Supabase multiplayer schema skeleton, review-only SQL files, no client use
3. v0.41.90: game-service skeleton with `/health`, `/api/version`, `/api/schema-status`
4. v0.41.91: dev-only seed/read proof endpoints for canonical multiplayer DEV records
5. v0.41.92: read-only Shared Multiplayer DEV launcher preview
6. v0.41.93: legacy dev-only server-authorised build-action proof
7. v0.41.94: dev-only queued action and manual tick proof
8. v0.41.95: dev-only proof reset control for the Shared Multiplayer DEV round
9. v0.41.96: invite-token grant creates or links a player
10. v0.41.97: client can load shared player state read-only
11. v0.41.98: first general server-side economy action, beyond the proof endpoint
12. v0.41.99: manual server tick updates shared player state
13. v0.42.00+: rankings, messages, alliances, attacks
14. Later: missiles, LRC, and full war systems

Do not attempt full multiplayer in one leap.

The first multiplayer milestone should be two players seeing separate shared database records.

The first action should be a simple economy/build action, not combat.

## Security and trust notes

- Client-side code is inspectable.
- Browser must not directly write canonical multiplayer state.
- Game service must validate every action.
- Supabase service role key must never appear in the client.
- Player actions need audit logs.
- Token access is access limiting, not DRM.
- Server-authoritative rules are required before public testing.

## Recommended next step after review

The next technical step after this planning pass should be a schema skeleton branch that defines the multiplayer tables without wiring the current client to them yet.
