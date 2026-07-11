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

## 3c. Slice 2 status (economy tick + build costs) — done in this branch

- game-service v0.43.2 now runs a faithful port of the reference per-tick
  economy (`applyEconomyTickPure` and helpers from `src/App.jsx` /
  `src/gameMath.js` / `src/gameData.js`) for every active player inside the
  manual tick, after action processing. Fidelity verified against the verbatim
  reference formulas over 3 tick cycles on seeded nonzero state (population,
  money, food, water, energy all exact).
- Scope honesty: of the five canonical hosted buildings, only living areas and
  banks appear in the reference economy at all. The producers
  (nutrition_suppliers, water_purifiers, power_plants) are not hosted building
  types yet, so their production terms are zero BY DATA on the live schema; the
  engine already computes them and lights up as soon as those building types
  gain hosted rows. Bank interest needs a hosted `banked` balance (none yet).
  **Follow-up done in this branch:** the producer types are now in the
  queueable set server- and client-side with reference costs (200/250/7500);
  production verified nonzero against the reference oracle from a zero state
  (queue → tick applies builds → economy sees them the same tick). Bank
  interest remains the only dormant economy term (needs hosted `banked`).
- Build orders now debit the reference cost at queue time
  (`insufficient_funds` reject; refund on failed insert). New player states
  seed money 1,000,000 (Intro-profile pairing with the hosted 1000 land seed);
  proof reset re-seeds economy state and zeroes all five building types.
- Manual tick and proof reset now require a grant identity (same pattern as
  queue). The launcher tick button sends the identity body.
- Second pre-existing bug fixed: `getOrCreatePlayerArmies` upserted count 0
  over BOTH army rows on every hosted entry, wiping army counts (dormant while
  armies were all zero; exposed by the consumption term).
- `roundSummary.queuedCount` staleness (observed once against the deployed
  instance) was NOT fixed: `currentPlayerSummary` is overwritten with fresh
  counts server-side, so the earlier attribution to it was wrong; the stale
  zero likely came from the round-wide canonical-rows filter. Needs a dedicated
  look; the client reads the correct top-level field either way.

## 3e. Slice 4 status (completion-timing correction + Barracks training) — done

- **Build timing corrected**: orders now carry a real duration from the
  reference formula (constructionDurationSeconds; factory curve; 1 tick = 1800
  game-seconds). Manual ticks only advance time and economy. A due order is
  "finished" (actionSummary.dueNow, surfaced as "Orders ready to complete") and
  applies only when the player visits the matching screen, which calls
  POST /api/dev/actions/complete-due — the local prototype's page-visit
  completion pattern. The mechanism is generic (screen → action types → applier
  registry); Science and Explore plug in later without new plumbing.
- **Barracks/training live** (Option C): six race-agnostic slot rows
  (unit_1..unit_6), race resolved at read time from state.race_key, costs/caps/
  names verbatim from the reference races table, duration from
  trainingDurationSeconds (species divider neutral at 1). training_count shows
  pending training; completion on the Barracks visit moves it into count.
  returning_count stays dormant (combat returns survivors immediately in this
  game's model — future combat slice). Verified for human AND lithi costs/caps.
- Consequence for earlier slices: the economy's "completions before production"
  ordering note is superseded — completions now happen outside ticks entirely;
  a completed producer starts producing on the tick after its completion.
  Verified against the reference oracle including a 3-tick power plant order.
- Third latent bug fixed: normalizeHostedArmySummary read training_count/
  returning_count in snake_case only while the enter path feeds camelCased
  rows — trainingCount always read 0 there (dormant until this slice).
- Species-bonus modifiers (construction/training speed, speed-mineral caps) are
  wording-mode/species dependent and deferred with the species-selection slice;
  all hosted durations use their neutral reference values, documented in code.

## 3f. Slice 5 status (Explore) — done

- Explore is the fourth screen on the shared due-order mechanism — no new
  plumbing, one applier + one screen-map entry + one queue endpoint. Gain is
  the verbatim reference formula (estimateExploreGain; scanner bonus exactly 1
  at zero scanners by the reference curve — scanners are not hosted state);
  duration is hours x 3600 game-seconds (2 ticks per hour); reference
  validation order preserved (invalid_hours / invalid_spend /
  insufficient_funds / explore_gain_exceeds_land, gain locked at queue time).
  Completion on the Explore screen adds the locked gain to state.land.
  Verified: gain/duration oracles exact, finished-not-applied across ticks,
  three-way screen isolation (build/barracks/explore).
- The local single-order-at-a-time rule remains unenforced hosted-side for all
  three order screens (stacking), a documented divergence to revisit when the
  hosted pages leave the DEV-shell stage.

## 3g. Slice 6 status (Science + economy un-freeze) — done

- Science is the fifth screen on the shared due-order mechanism. Duration is the
  verbatim scienceDurationSeconds/scienceLabMultiplier port (src/gameMath.js):
  quadratic in nextLevel = currentLevel+1 over the 0/1k/4k lab curve; the queue
  endpoint reads the field's CURRENT level so pricing is never off a stale
  baseline. No card cost (local startScienceResearch spends 0); gates are
  science_labs > 0 (no_science_labs) and single-order-PER-FIELD
  (research_already_running, 409 — concurrent research on OTHER fields allowed).
  Completion on the Science visit increments the field level by 1.
- New state surface: `multiplayer_player_science` K/V table, one row per field
  (agriculture/combat/crime/housing/population/banking/turrets), mirroring the
  buildings/armies row pattern (getOrCreate creates only missing rows; seeded/
  reset alongside the other tables; proof reset returns every field to 0).
- **Economy un-freeze (both parts landed together):** every constant-folded
  scienceLevelBonus(0)=1 in economyCalcCaps/economyProductionPerTick/
  computeEconomyTick is now the real per-field bonus — maxPop→housing,
  maxFed/maxWatered/food/water→agriculture, maxPoliced→crime, bankCap/interest→
  banking, popGain/tax→population; energy and consumption take none. Fidelity
  re-verified against the verbatim reference oracle parameterized by NON-1
  levels (housing 100 / agriculture 200 / population 400), over 3 cycles, WITH
  an explicit assertion that the server diverges from the level-0 oracle —
  proving the un-freeze is observable, not a constant that cancels. banking's
  effect stays dormant (needs hosted `banked`); crime/combat/turrets are wired
  but not economy-observable (crime→maxPoliced, combat/turrets→military).
- Two whitelist-drop bugs fixed in passing (same class): the hosted-round/enter
  response handler and the client normaliseHostedRoundSummary each explicitly
  list fields and had omitted `science`, so the page rendered level 0 despite
  correct server state. Both now carry it.

## 3h. Slice 7 status (bank interest — economy port complete) — done

- The last dormant economy term is live. `banked` is a per-player scalar (same
  family as money/food/water/energy/population) so it is a
  `multiplayer_player_state` COLUMN, not a K/V table — a deliberate deviation
  from the buildings/armies/science K/V pattern, because those hold multiple
  keyed rows per player and a single balance does not. Threaded into every state
  select/insert/reset, normalizeHostedPlayerState, formatState.
- Interest ported verbatim from applyEconomyTickPure (src/App.jsx): interest =
  floor(banked * 0.0010415 * scienceLevelBonus(banking)); toBank = min(max(0,
  bankCap - banked), interest) where bankCap = banks * 250000 *
  scienceLevelBonus(banking); money += interest - toBank; banked += toBank. So
  banking science scales BOTH the interest and the cap. Verified against the
  verbatim oracle with a non-zero balance over 2 cycles (all-to-bank under cap)
  AND a cap-overflow case (all interest to money at cap).
- The real action that sets the balance: instant Bank deposit/withdraw
  (/api/dev/actions/bank-deposit + bank-withdraw, grant identity required) —
  ports of depositBankAmount/withdrawBankAmount. INSTANT, not due-orders (the
  local Bank screen mutates immediately), so Bank has no completion-on-visit
  effect and no DEV_SCREEN_ACTION_TYPES entry. Rejections: no_banks /
  insufficient_funds / banks_full / no_banked_funds / invalid_amount.
- **Economy port is now COMPLETE**: every term in applyEconomyTickPure has a
  faithful hosted counterpart (production/consumption, pop growth + starvation,
  tax, per-field science bonuses, and now bank interest). Nothing in the
  reference economy tick remains stubbed or zero-by-data.

### Deploy-integrity finding (from this slice's production probe)
- Production auto-tracks this branch and is on v0.43.2 with this session's code —
  the long-standing "deployed instance still v0.43.1" note is CLOSED.
- BUT the production database is behind the code: `multiplayer_player_state.banked`
  does not exist there (round-summary/enter currently 500 on reads), and the
  Science slice's `multiplayer_player_science` table was added in code without a
  migration file. **Required before production works again:** apply
  `supabase/multiplayer/003_add_player_banked.sql` AND
  `004_add_player_science_table.sql` to the production Supabase. Both are now in
  the repo; 001 skeleton includes them for fresh installs.

## 3i. Slice 8 status (Market/Shops sub-slice 6a: minerals state + Shops) — done

- First groundwork of the first player-to-player roadmap item, but this sub-slice
  is deliberately self-only: minerals state + the fixed-price Shop. Market
  (list/buy/cancel, the order book, the cross-player atomic buy) is 6b/6c, NOT
  started here.
- **Minerals K/V table** (`multiplayer_player_minerals`, 15 rows/player) mirrors
  the buildings/armies/science pattern exactly: getOrCreate seeds/creates only
  missing rows, reset returns all to 0, threaded through readDevRoundSummary,
  the enter path (minerals.byKey/counts), canonicalState, and the enter-handler
  whitelist. Schema in 001 + 005_add_player_minerals_table.sql (MUST be applied
  to production before this code deploys — same 003/004 ordering hazard).
- **Shops** is instant and self-only, ported from buyShopMinerals (src/App.jsx):
  /api/dev/actions/shop-buy (item + qty, grant identity), fixed DEV_SHOP_PRICES
  cited verbatim from gameData.js. Debits money, credits the item —
  Food/Water/Energy to state columns, minerals to the K/V row. Rejections:
  item_not_sold / invalid_amount / insufficient_funds. No completion mechanism
  (Bank's shape), no screen-map entry.
- Verified: 9 shop prices spot-checked incl. overrides (Arthok 61,107 /
  Endaurios 65,000 / Feronga 39,688 / Armidi 11,000) and defaults (33,333) and
  Food/Water/Energy (40/2/3,333); mineral + food credit with exact money debit;
  all rejections; browser buy (money 1,000,000 → 694,465, Arthok stockpile → 5).
- Whitelist-drop bug fixed in passing (same class as science c94e0eb): the
  client `normaliseHostedRoundSummary` had dropped `minerals`, so a bought
  mineral read 0 after refresh despite correct server state.

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
