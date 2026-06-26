# AntrophAI multiplayer API contract draft

Status: draft only, not implemented

This document sketches the future hosted game-service API for server-authoritative multiplayer.
It is intentionally separate from the current browser-local prototype and separate from the invite-token service.

v0.41.90 adds the first standalone game-service skeleton under `game-service/`. It only exposes read-only health and schema-check probes for now.

v0.41.91 adds temporary dev-only seed/read proof endpoints under `game-service/`. They are scaffolding, not normal gameplay endpoints, and should be removed or disabled before public multiplayer testing.

v0.41.92 adds a browser-side read-only launcher preview that consumes `GET /api/dev/round-summary`. It is inspection-only and does not write multiplayer state or call Supabase directly.

v0.41.93 adds the first dev-only server-authorised multiplayer action proof: `POST /api/dev/actions/build-factory`. It remains legacy immediate proof scaffolding for testing the browser -> service -> Supabase authority path and is not final building gameplay.

v0.41.94 adds the first dev-only queued action and manual tick proof: `POST /api/dev/actions/queue-build-factory` queues the order, and `POST /api/dev/tick/manual-run` applies due queued actions on the server tick.

v0.41.95 adds a proof-reset control: `POST /api/dev/reset-proof-round` clears the shared DEV proof state so the queue/manual-tick proof can be replayed safely.

v0.41.96 adds a token-to-player identity resolver: `POST /api/dev/identity/resolve-player` turns an already-redeemed invite-grant into a multiplayer player identity without sending the raw token back to the game service.

## v0.41.91 dev proof endpoints

These endpoints exist only to prove the hosted game service can write and read a tiny canonical multiplayer DEV state:

- `POST /api/dev/seed-round`
- `GET /api/dev/round-summary`

They are not player action endpoints, they do not process ticks, and they are not part of the normal multiplayer gameplay contract.

## v0.41.93 legacy immediate proof endpoint

This endpoint exists only to prove that the hosted game service can accept a browser order, validate the round/player pair, and write one canonical multiplayer DEV change.

- `POST /api/dev/actions/build-factory`

Request body:

```json
{
  "roundKey": "shared-dev-001",
  "displayName": "DEV Player One",
  "amount": 1
}
```

Response shape:

```json
{
  "ok": true,
  "action": {
    "type": "dev_build_factory",
    "amount": 1,
    "buildingKey": "factory",
    "oldCount": 0,
    "newCount": 1
  },
  "round": {
    "roundKey": "shared-dev-001",
    "currentTick": 0
  },
  "player": {
    "displayName": "DEV Player One"
  }
}
```

Auth/access requirements:

- temporary DEV-only access
- `ENABLE_DEV_ENDPOINTS=true`

Validation responsibilities:

- ensure the round exists
- ensure the named player exists and is joined to the round
- validate the requested amount is an integer between 1 and 10
- write the action queue row, round event, audit row, and updated factory count in Supabase
- never accept browser-side direct Supabase writes

What to log:

- round id and player id
- requested amount and resulting factory counts
- action queue id and event/audit ids
- any validation failure reason

## Common conventions

- Content-Type: `application/json`
- All mutating endpoints require an authenticated player session.
- The game service must validate every request against server state.
- The service, not the browser, decides whether an action is legal.
- Every mutating request should carry a client action id for idempotency, such as `clientActionId`.
- Responses should avoid secrets and should return only the state slice the browser needs.
- Logs should include `requestId`, `playerId`, `roundId`, endpoint name, validation result, and any state change summary.

## Game history posture

- Current-state snapshots, player-visible history, and audit logs are separate concerns.
- `multiplayer_round_events` and `multiplayer_messages` are game-facing records, while `multiplayer_audit_log` stays internal.
- The browser should never assume raw table parity; future reads may return filtered history slices instead.

Suggested auth placeholder for the draft:

- `Authorization: Bearer <player-session-token>`

That token could later be derived from the invite-token flow or a fuller account system.

## v0.41.94 dev queued action endpoint

This endpoint exists only to prove that the hosted game service can accept a browser order, queue it on the canonical action table, and leave it pending until the next manual tick.

- `POST /api/dev/actions/queue-build-factory`

Request body:

```json
{
  "roundKey": "shared-dev-001",
  "displayName": "DEV Player One",
  "amount": 1
}
```

Response shape:

```json
{
  "ok": true,
  "action": {
    "id": "action_xxx",
    "type": "dev_queue_build_factory",
    "status": "queued",
    "buildingKey": "factory",
    "amount": 1,
    "requestedTick": 0,
    "executeAfterTick": 1
  },
  "round": {
    "roundKey": "shared-dev-001",
    "previousTick": 0,
    "currentTick": 0
  },
  "player": {
    "displayName": "DEV Player One"
  },
  "message": "Build order queued for next tick."
}
```

Auth/access requirements:

- temporary DEV-only access
- `ENABLE_DEV_ENDPOINTS=true`

Validation responsibilities:

- ensure the round exists
- ensure the named player exists and is joined to the round
- validate the requested amount is an integer between 1 and 10
- write the action queue row, round event, and audit row in Supabase
- never accept browser-side direct Supabase writes

What to log:

- round id and player id
- requested amount and queue timing
- action queue id and event/audit ids
- any validation failure reason

## v0.41.94 manual tick endpoint

This endpoint exists only to prove that the hosted game service can advance a round tick manually and apply due queued actions on the server.

- `POST /api/dev/tick/manual-run`

Request body:

```json
{
  "roundKey": "shared-dev-001"
}
```

Response shape:

```json
{
  "ok": true,
  "round": {
    "roundKey": "shared-dev-001",
    "previousTick": 0,
    "currentTick": 1
  },
  "processed": {
    "total": 1,
    "factoryBuilds": 1
  },
  "message": "Manual tick processed."
}
```

Auth/access requirements:

- temporary DEV-only access
- `ENABLE_DEV_ENDPOINTS=true`

Validation responsibilities:

- ensure the round exists
- create or resume the tick log row using schema-compatible statuses
- apply queued `dev_queue_build_factory` rows that are due for the next tick
- update the authoritative current tick on the round
- write round events and audit rows without exposing secrets

What to log:

- round id and tick transition
- queued action ids processed or failed
- resulting factory counts
- tick log id and any validation failure reason

## v0.41.96 dev proof reset endpoint

This endpoint exists only to reset the shared DEV proof round so the queued-action/manual-tick proof can be replayed safely without deleting the history rows. In v0.41.96 it resets all active proof players in the round, not just one player.

- `POST /api/dev/reset-proof-round`

Request body:

```json
{
  "roundKey": "shared-dev-001",
  "grantId": "grant_xxx",
  "testerLabel": "Tester Name",
  "displayName": "Resolved Player Name"
}
```

Response shape:

```json
{
  "ok": true,
  "round": {
    "roundKey": "shared-dev-001",
    "previousTick": 1,
    "currentTick": 0
  },
  "player": {
    "displayName": "DEV Player One",
    "factoryCount": 0
  },
  "proofState": {
    "resetPlayerCount": 2,
    "cancelledActionCount": 1,
    "resetTickLogCount": 1
  },
  "message": "Shared DEV proof state reset."
}
```

Auth/access requirements:

- temporary DEV-only access
- `ENABLE_DEV_ENDPOINTS=true`

Validation responsibilities:

- ensure the shared DEV proof round exists
- resolve the actor player from the invite-grant identity when supplied, otherwise use the named fallback player
- reset the proof round tick counter and zero the factory count for all active players in the round
- cancel queued or processing proof action rows safely instead of deleting them
- mark proof tick-log rows ready for replay without deleting the history rows
- write a public `dev_proof_reset` round event and an internal audit log row

## v0.41.96 dev identity resolver endpoint

This endpoint exists only to resolve an already-redeemed invite grant into a multiplayer player identity for the proof panel.

- `POST /api/dev/identity/resolve-player`

Request body:

```json
{
  "roundKey": "shared-dev-001",
  "grantId": "grant_xxx",
  "testerLabel": "Tester Name",
  "displayName": "Resolved Player Name"
}
```

Response shape:

```json
{
  "ok": true,
  "identity": {
    "grantId": "grant_xxx",
    "resolvedFrom": "invite_grant",
    "roundKey": "shared-dev-001",
    "roundName": "Shared Multiplayer DEV",
    "roundStatus": "draft",
    "currentTick": 0,
    "playerId": "player_xxx",
    "displayName": "Resolved Player Name",
    "testerLabel": "Tester Name",
    "playerRoundId": "player_round_xxx"
  },
  "round": {
    "roundKey": "shared-dev-001",
    "currentTick": 0
  },
  "player": {
    "displayName": "Resolved Player Name"
  },
  "message": "Multiplayer identity resolved."
}
```

Auth/access requirements:

- temporary DEV-only access
- `ENABLE_DEV_ENDPOINTS=true`

Validation responsibilities:

- ensure the shared DEV proof round exists
- require an active grant id
- resolve the grant to an existing player via `multiplayer_player_access_links`
- ensure the player is joined to the shared round
- seed current player snapshot rows if missing
- write no raw invite token or service secrets back to the browser

What to log:

- round id, round key, and player id
- previous tick and previous factory count
- cancelled action ids and reset tick-log ids
- event/audit ids and any validation failure reason

## GET /health

Purpose:

- Check service liveness and deployment wiring.

Request body:

- None.

Response shape:

```json
{
  "ok": true,
  "service": "antrophai-game-service",
  "version": "v0.41.96",
  "environment": "production",
  "databaseReady": true,
  "tickReady": true
}
```

Auth/access requirements:

- Public health probe.

Validation responsibilities:

- confirm the service can reach Supabase
- confirm tick dependencies are configured

What to log:

- basic liveness checks only

## GET /me

Purpose:

- Return the currently authenticated player identity and access scope.

Request body:

- None.

Response shape:

```json
{
  "ok": true,
  "player": {
    "playerId": "player_xxx",
    "displayName": "SONAR",
    "roundId": "round_xxx",
    "status": "active"
  },
  "access": {
    "mode": "invite-token",
    "grantId": "grant_xxx"
  }
}
```

Auth/access requirements:

- valid player session required

Validation responsibilities:

- verify session is valid and not revoked
- verify the player belongs to the active round

What to log:

- player lookup result and access mode

## GET /rounds/current

Purpose:

- Return the active multiplayer round metadata.

Request body:

- None.

Response shape:

```json
{
  "ok": true,
  "round": {
    "roundId": "round_xxx",
    "roundKey": "glw-shared-dev",
    "name": "Godlike Warfare",
    "status": "open",
    "tick": 1284,
    "tickAt": "2026-06-23T00:00:00.000Z",
    "speed": 4
  }
}
```

Auth/access requirements:

- authenticated player or public read-only access, depending on future policy

Validation responsibilities:

- confirm the round exists and is active

What to log:

- round access and cache timing

## GET /state

Purpose:

- Return the canonical state for the requesting player and the visible public state.

Request body:

- Optional query or JSON body with `roundId` if multiple rounds are possible.

Response shape:

```json
{
  "ok": true,
  "state": {
    "roundId": "round_xxx",
    "player": { "playerId": "player_xxx" },
    "economy": {},
    "buildings": {},
    "armies": {},
    "alliances": {},
    "visibility": {}
  },
  "stateVersion": 91234
}
```

Auth/access requirements:

- authenticated player required for private state

Validation responsibilities:

- enforce row-level visibility by player and round

What to log:

- state snapshot version and request scope

## GET /rankings

Purpose:

- Return the current shared rankings for the round.

Request body:

- Optional `roundId`, pagination, and sort parameters.

Response shape:

```json
{
  "ok": true,
  "rankings": [
    {
      "playerId": "player_xxx",
      "displayName": "SONAR",
      "land": 50000,
      "power": 50000
    }
  ]
}
```

Auth/access requirements:

- read access for the active round

Validation responsibilities:

- ensure the requested round is visible

What to log:

- ranking query parameters

## POST /actions/build

Purpose:

- Queue or apply a server-authoritative building action.

Request body:

```json
{
  "roundId": "round_xxx",
  "clientActionId": "uuid",
  "buildingType": "factory",
  "quantity": 10,
  "clientStateVersion": 91234
}
```

Response shape:

```json
{
  "ok": true,
  "accepted": true,
  "actionId": "action_xxx",
  "stateVersion": 91235
}
```

Auth/access requirements:

- authenticated player in the target round

Validation responsibilities:

- check resources, build limits, timing, and round rules
- reject duplicate `clientActionId`

What to log:

- before/after resource counts
- validated build quantity and building type
- tick or queue placement

## POST /actions/train

Purpose:

- Queue or apply unit training.

Request body:

```json
{
  "roundId": "round_xxx",
  "clientActionId": "uuid",
  "unitType": "soldier",
  "quantity": 100
}
```

Response shape:

```json
{
  "ok": true,
  "accepted": true,
  "actionId": "action_xxx",
  "stateVersion": 91236
}
```

Auth/access requirements:

- authenticated player in the target round

Validation responsibilities:

- check queue capacity, resources, and training rules

What to log:

- resources spent
- queue effects
- final training result

## POST /actions/attack

Purpose:

- Submit a server-authoritative attack order.

Request body:

```json
{
  "roundId": "round_xxx",
  "clientActionId": "uuid",
  "targetPlayerId": "player_target_xxx",
  "attackType": "standard"
}
```

Response shape:

```json
{
  "ok": true,
  "accepted": true,
  "actionId": "action_xxx",
  "resolution": "queued"
}
```

Auth/access requirements:

- authenticated player in the target round

Validation responsibilities:

- confirm target exists
- confirm timing, protection, and combat prerequisites
- reject illegal attacks

What to log:

- attacker, target, combat summary, and final resolution

## POST /actions/join-alliance

Purpose:

- Create or change alliance membership.

Request body:

```json
{
  "roundId": "round_xxx",
  "clientActionId": "uuid",
  "allianceId": "ally_xxx"
}
```

Response shape:

```json
{
  "ok": true,
  "accepted": true,
  "allianceId": "ally_xxx"
}
```

Auth/access requirements:

- authenticated player in the target round

Validation responsibilities:

- check alliance capacity, locks, and join rules

What to log:

- join/leave request and resulting membership change

## POST /actions/message

Purpose:

- Send a player message or system note.

Request body:

```json
{
  "roundId": "round_xxx",
  "clientActionId": "uuid",
  "recipientPlayerId": "player_target_xxx",
  "subject": "Hello",
  "body": "Message text"
}
```

Response shape:

```json
{
  "ok": true,
  "accepted": true,
  "messageId": "msg_xxx"
}
```

Auth/access requirements:

- authenticated player in the target round

Validation responsibilities:

- enforce size limits and spam controls
- redact or reject unsafe content if required by later policy

What to log:

- sender, recipient, message id, and moderation flags

## POST /tick/admin-run

Purpose:

- Run a manual administrative tick in development or controlled operations.

Request body:

```json
{
  "roundId": "round_xxx",
  "reason": "manual smoke test"
}
```

Response shape:

```json
{
  "ok": true,
  "tick": 1285,
  "processed": true
}
```

Auth/access requirements:

- admin only

Validation responsibilities:

- ensure the caller is an authorized operator
- ensure only one tick process is active at a time

What to log:

- operator identity
- tick start and finish
- any partial failure details

## Contract notes

- Mutating endpoints should be idempotent where possible.
- Client state should be treated as advisory only.
- Every action should produce an audit trail.
- Public reads should expose only the minimum needed to render the UI.
- First-class game history should be modeled separately from audit-only logs.
- Combat, missiles, LRC, alliances, and tick processing should all be server-authoritative.
