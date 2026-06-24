# AntrophAI multiplayer API contract draft

Status: draft only, not implemented

This document sketches the future hosted game-service API for server-authoritative multiplayer.
It is intentionally separate from the current browser-local prototype and separate from the invite-token service.

v0.41.90 adds the first standalone game-service skeleton under `game-service/`. It only exposes read-only health and schema-check probes for now.

v0.41.91 adds temporary dev-only seed/read proof endpoints under `game-service/`. They are scaffolding, not normal gameplay endpoints, and should be removed or disabled before public multiplayer testing.

## v0.41.91 dev proof endpoints

These endpoints exist only to prove the hosted game service can write and read a tiny canonical multiplayer DEV state:

- `POST /api/dev/seed-round`
- `GET /api/dev/round-summary`

They are not player action endpoints, they do not process ticks, and they are not part of the normal multiplayer gameplay contract.

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
    "version": "v0.41.91",
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
