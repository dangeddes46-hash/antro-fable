# Render deployment - AntrophAI game-service skeleton

Deploy this folder as a separate Render Web Service.

## Render settings

- Service type: `Web Service`
- Repository: `dangeddes46-hash/antrophai_GLWTest`
- Branch: `dev-multiplayer-game-service-skeleton-v04190`
- Root Directory: `game-service`
- Build Command: `npm install`
- Start Command: `npm start`

## Environment variables

Set these in Render:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
- `GAME_SERVICE_ENV=production`

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
```

If Supabase credentials are missing or incorrect, `/api/schema-status` should fail clearly rather than exposing secrets.

## Phase note

This is the first skeleton only.

- No browser wiring yet.
- No gameplay mutations yet.
- No tick runner yet.
- No `/state` action API yet.
