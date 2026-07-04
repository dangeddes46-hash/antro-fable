# AntrophAI v0.43.1 GLW handoff build

This package is a clean local prototype handoff for the single-player Godlike Warfare (GLW) test build of AntrophAI.

v0.41.86 hardens the DEV invite-token gate while keeping the browser-local tester fallback and slot manager for trusted development testing.

v0.41.87 is a planning/docs-only multiplayer architecture pass. It does not change gameplay, does not add multiplayer code, and does not add a schema migration yet.

v0.41.88 adds reviewable multiplayer Supabase schema skeleton files only. The SQL is draft-only and has not been applied.

v0.41.90 adds the first standalone multiplayer game-service skeleton under `game-service/`. It is read-only, does not mutate multiplayer state yet, and is not wired to the client yet.

v0.41.91 adds temporary dev-only seed/read proof endpoints under `game-service/` so the hosted service can create and read a tiny canonical multiplayer DEV state. The client is still not wired.

v0.41.92 adds a read-only Shared Multiplayer DEV launcher preview that reads the hosted round summary from the game service. It does not add client-side multiplayer actions or any direct Supabase access from the browser.

v0.41.94 adds the first dev-only queued action and manual tick proof. The Shared Multiplayer DEV panel can ask the hosted game service to queue +1 factory for DEV Player One and then run a manual DEV tick to apply it. The older immediate build proof remains as temporary legacy scaffolding for comparison.

v0.41.96 adds a dev-only token-to-player identity proof for the Shared Multiplayer DEV panel. It resolves an already-redeemed invite grant to a multiplayer player in the hosted game service and keeps the proof/reset actions scoped to the shared DEV round without touching browser-local GLW or Intro Game saves.

v0.43.1 locks the hosted player foundation around a single grant-linked canonical player id per round. The client can still load canonical server state for the hosted round while keeping the diagnostic proof tooling available, and the local GLW prototype remains browser-only.

Planning note: `INVITE_TOKEN_ACCESS_PLAN.md` documents the invite-token access rollout, including the hosted DEV path and the remaining static fallback codes.

Multiplayer planning notes:

- `MULTIPLAYER_ARCHITECTURE_PLAN.md`
- `MULTIPLAYER_API_CONTRACT_DRAFT.md`
- `MULTIPLAYER_SCHEMA_DRAFT.md`
- `supabase/multiplayer/`

Phase 2 contract note: `INVITE_TOKEN_ENDPOINT_CONTRACT.md` defines the hosted redemption endpoint shape and ledger rules for the token service.

Supabase skeleton note: `INVITE_TOKEN_SUPABASE_IMPLEMENTATION.md` and `token-service/` sketch the server-side pieces for the invite-token flow that the DEV client now redeems against.

## Scope

This is not a hosted multiplayer implementation. It is a reference/client prototype for validating the reconstructed game loop before the hosted version is built.

Current focus:

- GLW single-round launcher
- static tester access gate for trusted testers
- browser-local slot manager with multi-slot GLW / Intro Game saves
- local save/load through browser localStorage
- build, train, attack, missile, LRC, scanner, ranking and report behaviour
- admin/debug tools for tester validation
- hosted DEV round entry using canonical server state from the game-service

Deferred:

- hosted accounts
- authoritative server-side combat/resource resolution
- real multiplayer persistence
- spies
- final public asset/library polish
- true one-time tester tokens, which need a server-side redemption record or hosted token ledger

## Running locally

```bash
npm install
npm run dev
```

If Vite appears to serve an old build on Windows, stop existing Node processes first:

```bat
taskkill /f /im node.exe
npm run dev
```

## Clean package notes

This handoff package intentionally excludes:

- `node_modules`
- old `src/App.jsx.*` backup files
- obsolete local build clutter

A fresh `dist/` can be produced with:

```bash
npm run build
```

## Important documents

- `README_HOSTED_HANDOFF.md` — what a hosted developer needs to know first.
- `PROTOTYPE_RULES.md` — current gameplay rules implemented or intentionally deferred.
- `KNOWN_LIMITATIONS_CURRENT.md` — current known limitations and non-bugs.
- `PLAYTEST_NOTES.md` — older playtest notes retained for project context.
