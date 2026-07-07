# Authority-Readiness Map (v0.43.1 → server authority)

Branch: `dev-authority-readiness-refactor` (off `dev-player-foundation-v04301`).
Scope of this pass: map the local/hosted state architecture, extract the seams needed
for server-authority migration, change no behavior and no UI. Authority itself has
NOT been migrated — this document is the map for doing that next, one slice at a time.

## 1. Current architecture: two state sources, one UI

### Local prototype mode (`activeGameMode === "local"`, the default)
- All game state lives in React state inside `App()` (~80 `useState` hooks in
  `src/App.jsx` around line 1655+): `player`, `demoOpponents` (bots), `alliance`,
  `marketOrders`, `messages`, `worldReports`, `retalRecords`, `scienceLevels`,
  missiles, diplomacy, LRC, plus per-page form drafts.
- Persistence: one autosave `useEffect` (App.jsx, search `safeWriteSave(payload)`)
  serialises `currentSavePayload()` to localStorage on every relevant state change —
  main save key + active round slot + round-slot index. Hydration happens in the
  mount effect via `safeLoadRoundSlot`/`safeLoadSave` → `applySavedState`.
- Time/simulation authority is the **browser**: `runPageUpdate()` (App.jsx) runs
  `calculatePageUpdate` (elapsed pro-rata production, order completion) and
  `runActiveBots` (bot economy, bot attacks, market listings) on every page
  navigation. Combat resolves client-side in `demoAttack`/`rowAttack`.
- Every local action (build, train, explore, bank, market, war, alliance, missiles,
  spy, science, disband, destroy, shops) mutates state directly via `setPlayer`/etc.

### Hosted mode (`activeGameMode === "hosted"`, v0.43.1 identity work)
- Entry: tester gate (invite token redeemed against the invite-token service, or a
  development fallback code). The access grant is stored browser-locally
  (`localSaveStore.safeWriteTesterAccess`).
- Server state arrives via five fetch orchestrators in App.jsx, all now delegating
  transport to `src/hostedApi.js`:
  - `refreshMultiplayerHealth` → `GET /health`
  - `refreshMultiplayerPreview` → `GET /api/dev/round-summary?roundKey=shared-dev-001`
  - `refreshHostedDevRound` → `POST /api/dev/hosted-round/enter` (grant → canonical player)
  - `refreshMultiplayerIdentity` → `POST /api/dev/identity/resolve-player`
  - `submitMultiplayerDevAction` → `POST /api/dev/actions/queue-build-factory`,
    `/api/dev/tick/manual-run`, `/api/dev/reset-proof-round`, `/api/dev/actions/build-factory`
- Hosted React state: `hostedRoundState`, `multiplayerIdentityState`,
  `multiplayerPreviewState`, `multiplayerHealthState`, `multiplayerDevActionState`.
  None of it is ever written to localStorage or the local save payload.
- Hosted pages read only through `getHostedShellSnapshot()` →
  `hostedState.buildHostedShellSnapshot()` (the hosted read model).
- Identity rule (preserved): the canonical player id always comes from the service
  response / invite grant. Client-supplied display names and tester labels are
  advisory only (`requestedDisplayNameIgnored` handling).

### The mode boundary (page-level consumers)
- `renderMainContent()` (end of App.jsx): if hosted+entered, only `status`, `build`
  and the diagnostics panel (`todo`) are served, everything else →
  `renderHostedPageUnavailable`.
- `renderStatus()` / `renderBuild()` / `renderPersistentStats()` each start with the
  same guard: `if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHosted…()`.
  **This guard is the seam every future page migration will extend.**
- `returnToBaseScreen()` flips back to local mode; local slots are untouched by
  hosted play.

## 2. Modules extracted in this pass (behavior-preserving)

| Module | Owns | Notes |
|---|---|---|
| `src/hostedApi.js` | Service URLs, request transport (12s timeout, JSON-or-raw parse), all hosted failure messages, `makeInviteTokenClientNonce`, `maskStableIdentifier` | One function per endpoint; requests are byte-identical to pre-refactor (same headers per endpoint). No React state. |
| `src/localSaveStore.js` | Every localStorage read/write for the prototype save, round slots, slot index, tester-access record; access-grant normalisers; fallback-code allowlist | The local-authority persistence boundary. Hosted state must never flow through it. |
| `src/hostedState.js` | Request-body builders (`buildIdentityRequestBody`, `buildHostedRoundRequestBody`, fallback summary), response→summary normalisers (health, preview, hosted round, identity), `buildHostedShellSnapshot` | Pure functions; the "state adapter" layer between service payloads and what pages render. |

App.jsx keeps the orchestration (loading guards, error mapping, `setState` wiring) as
thin functions over these seams. Admin snapshot/rewind tools still touch
localStorage directly (deliberately untouched — DEV diagnostics preserved).

## 3. Verification performed

- `vite build` passes; before the refactor the build byte-reproduced the committed
  `dist/` hashes, confirming a deterministic baseline.
- Local prototype walked end-to-end in the browser: tester gate (fallback code) →
  species/launcher → enter game → Day 1 build started (cards deducted, order
  created) → autosave keys written → hard reload → full state restored with the
  pending order intact. Retro orange/black presentation, species wording and nav
  unchanged. No console errors (only the pre-existing Tailwind CDN warning).
- Hosted wiring: on gate acceptance the app fired exactly
  `GET /health` and `GET /api/dev/round-summary?roundKey=shared-dev-001` against the
  configured game service; development-fallback mode correctly skipped identity
  resolution (guarded fallback summary, no POST). Service unreachable from the test
  origin → the same handled failure messages as before. Full invite-token round
  entry requires a real single-use token and was verified as a verbatim code move
  (transport, request bodies and normalisers are unchanged expressions).
- UI: no JSX was modified anywhere; all extractions were expression-identical moves.

## 3b. Slice 1 status (Build generalization + Status read-model) — done in this branch

- The hosted Build page now renders all server building rows (`living_area`,
  `factory`, `barracks`, `bank`, `science_labs` from `buildings.byKey`) with a
  generalized, grant-routed queue pipeline (`buildingKey` + `amount` in the body).
- **Deployed-service contract, verified live 2026-07-06:** the v0.43.1 game-service
  queue endpoint accepts a `buildingKey` payload but records `factory` regardless,
  accepts requests with NO identity (falls back to "DEV Player One"), and has no
  generalized queue route (404).
- **Closed in game-service v0.43.2 (this branch, `game-service/src/server.js`):**
  the queue endpoint now honours `buildingKey` for all five canonical types
  end-to-end (queue → tick → per-key building row), rejects provided-but-unknown
  keys with 400 `invalid_building_key`, and requires a grant identity
  (400 `identity_not_provided`); a missing `buildingKey` still defaults to factory
  for the launcher proof panel. The legacy immediate build-factory proof rejects
  non-factory keys. `HOSTED_QUEUEABLE_BUILDING_KEYS` has been removed from the
  client; instead the client verifies the `buildingKey` echoed in the queue
  response, so a stale deployment that coerces to factory surfaces an explicit
  error. **The DEPLOYED Render instance still runs v0.43.1** — redeploy
  `game-service/` from this branch (Render service `antrophai-game-service-dev`,
  root `game-service`; update the tracked branch or merge). `/health` reporting
  `v0.43.2` confirms the fix is live. Note: `game-service/RENDER_DEPLOYMENT.md`
  names a stale branch; the live instance matches `dev-player-foundation-v04301`.
- Pre-existing v0.43.1 crash fixed in passing: the DEV diagnostics toggle on
  hosted Status/Build threw `renderSharedMultiplayerPreviewPanel is not defined`
  (panel was defined inside `renderNameSetup`); hoisted to component scope.
- Hosted Status surfaces the full server economy read-model (land/power/money/
  energy/food/water/population) read-only.
- Server quirk found: after queueing, top-level `queuedCount`/`actionSummary`
  update but `currentPlayerSummary.queuedCount` lags stale. Client reads the
  correct (top-level) field.

## 4. Recommended migration order (next slices, one at a time)

Each slice = move one gameplay action's authority to the game-service, render it
through the hosted guard pattern, leave local prototype mode untouched.

1. **Build (general construction)** — the queue-build-factory pipeline already
   proves the action→queue→tick→state loop. Generalise it to the full building
   table and make `renderHostedBuildPage` render the real Build UI fed by hosted
   state. Smallest gap between what exists and what's needed.
2. **Status economy read-model** — replace the placeholder land/power/money rows
   with the full server-computed economy snapshot (pop caps, production per tick).
   Read-only; zero action risk; unblocks the persistent stats sidebar in hosted mode.
3. **Explore, then Barracks/train** — same order-with-finish-time shape as build;
   server owns finish times and completion.
4. **Bank / Shops / Market** — pure resource mutations, then the first
   player-to-player surface (market) which needs server-side listing state anyway.
5. **War/combat last** — largest rule surface (kill rates, revives, retals,
   protection, dedupe). Do not start until orders/economy are stable server-side.
   The client battle engine stays as the local-prototype reference implementation.

Defer indefinitely: missiles, LRC, spies/mercenaries, poisoning — mechanics are
partially specified; keep as local-prototype placeholders (per hard boundary: do not
invent behavior).

## 5. Risks / coupling found in App.jsx

- **The autosave effect has a ~75-entry dependency list** and serialises nearly all
  React state. Any hosted value accidentally added to `currentSavePayload()` would
  leak server state into local saves. Keep hosted state out of that payload
  (currently correct).
- **`runPageUpdate` fires on every nav** (`navigatePage`). In hosted mode the local
  simulation still runs underneath (hosted pages just render over it). Harmless
  today because hosted mode renders only hosted pages, but when real hosted pages
  reuse local render functions, make the guard suppress local simulation, not just
  local rendering.
- **Bots mutate the player asynchronously** (`setTimeout(0)` chains inside
  `runPageUpdate` merging `botUpdate.player` back into `player`). This is the
  hardest local flow to reason about and a reason to migrate combat last.
- **`page` state is shared across modes** — entering hosted mode keeps the current
  page key; unknown pages fall back to `renderHostedPageUnavailable`. Fine, but any
  new hosted page must handle stale page-local form state.
- **Identity fallbacks are layered** (hosted summary → identity summary → tester
  record). `buildHostedShellSnapshot` documents the precedence; keep new code
  reading player id from that snapshot only, never from display names/labels.
- **Round-slot bookkeeping writes `ROUND_SLOT_CURRENT_KEY` directly** in several
  launcher functions (not via localSaveStore). Cosmetically inconsistent; candidate
  for a later cleanup slice, not needed for authority migration.
