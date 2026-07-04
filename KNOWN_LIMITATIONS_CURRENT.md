# Known limitations - current v0.43.1 handoff

## Hosted multiplayer not implemented

This is a local client prototype. The hosted version needs server-side authority for all meaningful game state.

## Spies deferred

Spies are not currently reconstructed. They are separate from scanners and should remain deferred until old-player input confirms their function.

## Asset/library manifests contain placeholders

Some archive, story, race and library art manifests refer to image paths that are not present in this lightweight package. The current gameplay UI has fallbacks. Missing archive/library images are not a GLW deployment blocker unless those sections are in scope.

## Monolithic App component

`src/App.jsx` remains large and contains gameplay logic plus UI. This is acceptable for prototype testing but should be split for hosted development.

## Admin tools are local prototype tools

Debug/admin buttons are useful for testing, but must be permission-gated and server-validated in a hosted version.

## Tester access gate

v0.41.86 keeps the browser-local GLW / Intro Game slot manager. The DEV client now supports invite-token access against the hosted token service, but it is still local UI, not real authentication, and it leaves browser-local saves untouched.

v0.41.92 adds a read-only Shared Multiplayer DEV preview in the launcher. It only reads hosted round-summary data and does not write multiplayer state or touch browser-local GLW / Intro Game saves.

v0.41.94 adds a dev-only queued action and manual tick proof in the Shared Multiplayer DEV panel. It proves the browser can queue a canonical server order and the server can apply it on a manual tick, but it is not final building gameplay and must be disabled or removed before public multiplayer testing.

v0.41.96 adds a dev-only token-to-player identity proof in the Shared Multiplayer DEV panel. It resolves an already-redeemed invite grant to a multiplayer player in the hosted game service, and the proof reset control clears the shared DEV proof round for all active players so the proof can be replayed safely, but it is still not final multiplayer gameplay and must remain disabled or removed before public multiplayer testing.

v0.43.1 locks the hosted player foundation around a single canonical grant-linked player id per round while keeping the hosted DEV round entry view. It loads canonical player state from the hosted game service for an invite-token grant, but it is still a DEV-only scaffold and must remain disabled or removed before public multiplayer testing.

## Multiplayer planning only

v0.41.87 is a planning/docs-only multiplayer architecture pass.

v0.41.88 adds reviewable multiplayer Supabase schema skeleton files only. The SQL is draft-only and has not been applied.

v0.41.90 adds a read-only multiplayer game-service skeleton under `game-service/`. It does not mutate state or run ticks yet.

v0.41.91 adds temporary dev-only seed/read proof endpoints under `game-service/`. They are scaffolding and should be disabled or removed before public multiplayer testing.

It does not:

- add multiplayer code
- change gameplay formulas
- migrate local saves into shared state
- add a schema migration

The next real technical step after review is expected to be a schema skeleton branch.

The current reviewable SQL files live under `supabase/multiplayer/`.

True one-time tester tokens require a server-side redemption record or hosted token ledger. The client now stores the resulting access grant locally in one browser after redeeming a valid invite token.

See `INVITE_TOKEN_ACCESS_PLAN.md` for the invite-token access rollout and fallback notes.

See `MULTIPLAYER_ARCHITECTURE_PLAN.md` for the future server-authoritative design direction.

See `INVITE_TOKEN_ENDPOINT_CONTRACT.md` for the Phase 2 hosted redemption contract and ledger shape.

See `INVITE_TOKEN_SUPABASE_IMPLEMENTATION.md` and `token-service/` for the current Supabase service skeleton. The DEV client now redeems invite tokens against that hosted service.

## Display modes

Hybrid AntrophAI is the normal/default mode. Modern and Classic display choices are intentionally locked in this GLW handoff build to avoid misleading UI. Retro Mode remains admin/reference only.

## Randomness

Some random choices, such as LRC random alliance member targeting, are client-side in the local prototype. Hosted play must move this authority server-side.
