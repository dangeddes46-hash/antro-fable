# AntrophAI v0.41.83 GLW handoff build

This package is a clean local prototype handoff for the single-player Godlike Warfare (GLW) test build of AntrophAI.

v0.41.83 keeps the browser-local tester gate and slot manager, and polishes the launcher wording for clearer GLW / Intro Game static testing.

Planning note: v0.41.84 invite-token access architecture is documented in `INVITE_TOKEN_ACCESS_PLAN.md`. The current static gate remains the default until a hosted token service exists.

Phase 2 contract note: `INVITE_TOKEN_ENDPOINT_CONTRACT.md` defines the hosted redemption endpoint shape and ledger rules for the future token service.

Supabase skeleton note: `INVITE_TOKEN_SUPABASE_IMPLEMENTATION.md` and `token-service/` now sketch the server-side pieces for the future invite-token flow without wiring them into the client yet.

## Scope

This is not a hosted multiplayer implementation. It is a reference/client prototype for validating the reconstructed game loop before the hosted version is built.

Current focus:

- GLW single-round launcher
- static tester access gate for trusted testers
- browser-local slot manager with multi-slot GLW / Intro Game saves
- local save/load through browser localStorage
- build, train, attack, missile, LRC, scanner, ranking and report behaviour
- admin/debug tools for tester validation

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
