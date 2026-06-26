# Render deployment - AntrophAI game-service dev seed/read/queued-action/manual-tick/reset/identity proof

Deploy this folder as a separate Render Web Service.

## Render settings

- Service type: `Web Service`
- Repository: `dangeddes46-hash/antrophai_GLWTest`
- Branch: `dev-multiplayer-token-player-identity-v04196`
- Root Directory: `game-service`
- Build Command: `npm install`
- Start Command: `npm start`

## Environment variables

Set these in Render:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
- `GAME_SERVICE_ENV=production`
- `ENABLE_DEV_ENDPOINTS=true` for temporary DEV proof runs only

Do not commit the service role key. Keep it in Render only.

Suggested `ALLOWED_ORIGINS` value:

```text
<DEV static URL>,<stable static URL>,http://127.0.0.1:4173,http://127.0.0.1:4174
```

Render supplies `PORT` automatically, so do not set it unless Render support asks for it.

## Smoke-test flow

After Render deploys the service, test the hosted URL with PowerShell:

```powershell
Invoke-RestMethod https://antrophai-game-service-dev.onrender.com/health
Invoke-RestMethod https://antrophai-game-service-dev.onrender.com/api/version
Invoke-RestMethod https://antrophai-game-service-dev.onrender.com/api/schema-status
Invoke-RestMethod "https://antrophai-game-service-dev.onrender.com/api/dev/round-summary?roundKey=shared-dev-001"
Invoke-RestMethod -Method Post -Uri "https://antrophai-game-service-dev.onrender.com/api/dev/identity/resolve-player" -ContentType "application/json" -Body (@{
  roundKey = "shared-dev-001"
  grantId = "grant_xxx"
  testerLabel = "Tester Name"
  displayName = "Resolved Player Name"
} | ConvertTo-Json)

Invoke-RestMethod -Method Post -Uri "https://antrophai-game-service-dev.onrender.com/api/dev/actions/queue-build-factory" -ContentType "application/json" -Body (@{
  roundKey = "shared-dev-001"
  grantId = "grant_xxx"
  testerLabel = "Tester Name"
  displayName = "Resolved Player Name"
  amount = 1
} | ConvertTo-Json)

Invoke-RestMethod "https://antrophai-game-service-dev.onrender.com/api/dev/round-summary?roundKey=shared-dev-001"

Invoke-RestMethod -Method Post -Uri "https://antrophai-game-service-dev.onrender.com/api/dev/tick/manual-run" -ContentType "application/json" -Body (@{
  roundKey = "shared-dev-001"
} | ConvertTo-Json)

Invoke-RestMethod -Method Post -Uri "https://antrophai-game-service-dev.onrender.com/api/dev/reset-proof-round" -ContentType "application/json" -Body (@{
  roundKey = "shared-dev-001"
  grantId = "grant_xxx"
  testerLabel = "Tester Name"
  displayName = "Resolved Player Name"
} | ConvertTo-Json)

```

Optional legacy comparison only:

```powershell
Invoke-RestMethod -Method Post -Uri "https://antrophai-game-service-dev.onrender.com/api/dev/actions/build-factory" -ContentType "application/json" -Body (@{
  roundKey = "shared-dev-001"
  grantId = "grant_xxx"
  testerLabel = "Tester Name"
  displayName = "Resolved Player Name"
  amount = 1
} | ConvertTo-Json)

Invoke-RestMethod "https://antrophai-game-service-dev.onrender.com/api/dev/round-summary?roundKey=shared-dev-001"
```

If Supabase credentials are missing or incorrect, `/api/schema-status` should fail clearly rather than exposing secrets.
The queued-action proof should return `ok: true`, keep the round tick unchanged, and report the requested queue timing for `DEV Player One`.
The manual tick proof should return `ok: true` and advance the round tick by one while applying due queued actions.
After the queue and tick, the round summary should show the updated factory count for `DEV Player One`, a recent `dev_order_queued` event, a recent `dev_build_factory_processed` event, and compact action/tick-log rows.

## Phase note

This is the first proof-only service step.

- No browser wiring yet for general multiplayer gameplay.
- The build-factory proof remains legacy scaffolding, not final building gameplay.
- The queued-action/manual-tick/reset proof is dev-only scaffolding, not final building gameplay.
- No automatic tick loop yet.
- No `/state` action API yet.
- Disable or remove the dev endpoints before any public multiplayer testing.
