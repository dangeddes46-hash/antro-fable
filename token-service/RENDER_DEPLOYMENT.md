# AntrophAI token-service Render deployment guide

This guide covers the standalone `token-service/` Render Web Service for the future invite-token phase.

The game client is now wired to this service for DEV invite-token access.
The current runtime game remains v0.41.86.
This deployment work is token-service infrastructure only.

## 1) Create the Render service

Create a new **Render Web Service** and point it at:

- Repository: `https://github.com/dangeddes46-hash/antrophai_GLWTest.git`
- Branch: `dev-invite-token-hardening-v04186`
- Root Directory: `token-service`
- Build Command: `npm install`
- Start Command: `npm start`

Render web services provide `PORT` automatically. Do not hardcode a fixed port for production. The service listens on `process.env.PORT`, and the local `.env` file uses `PORT=8787` only for local development.

## 2) Add Render environment variables

Set these in the Render dashboard, not in Git:

- `SUPABASE_URL=https://qhxcomdwebyknnqcemig.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<paste your private Supabase service_role key here>`
- `ALLOWED_ORIGINS=<DEV static URL>,<stable static URL>,http://127.0.0.1:4173,http://127.0.0.1:4174`
- `TOKEN_HASH_PEPPER=` leave blank for now unless you have already standardized on a pepper

Important:

- `SUPABASE_SERVICE_ROLE_KEY` must be a Render environment variable only
- never commit the service role key
- never paste the service role key into chat
- never store it in the repo

## 3) Local `.env`

`token-service/src/server.js` automatically loads `token-service/.env` for local development.

Local `.env` contents should look like:

```ini
SUPABASE_URL=https://qhxcomdwebyknnqcemig.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your private service_role key>
ALLOWED_ORIGINS=http://127.0.0.1:4173,http://127.0.0.1:4174
PORT=8787
TOKEN_HASH_PEPPER=
```

The repo ignores `token-service/.env`, so it stays local only.

## 4) Local checks

From `token-service/`:

```powershell
node --check src/server.js
node --check scripts/hash-token.js
npm start
```

Expected local `/health` response should include:

- `ok: true`
- `environment: "local"`
- `localEnvLoaded: true`
- `supabaseConfigured: true`
- `allowedOriginsConfigured: true`

## 5) Hosted smoke test commands

Replace the base URL with your Render service URL:

```powershell
$base = 'https://antrophai-token-service-dev.onrender.com'
Invoke-RestMethod -Method Get -Uri "$base/health"
```

Expected:

- HTTP 200
- `ok: true`
- `environment: "production"`
- `supabaseConfigured: true`
- `allowedOriginsConfigured: true`

### Create a fresh dummy token

Use a throwaway test token only:

`ANTROPHAI-RENDER-DUMMY-001`

Hash it from `token-service/`:

```powershell
node scripts/hash-token.js ANTROPHAI-RENDER-DUMMY-001
```

Example output:

```json
{
  "tokenHash": "ef435950e27720533f8505eb38f914765ced2e5b01e15cc03dc41552c05771b7",
  "tokenPrefix": "ef435950",
  "tokenLength": 25
}
```

Paste this into the Supabase SQL Editor using the hash and prefix above:

```sql
insert into public.invite_tokens (
  token_hash,
  token_prefix,
  tester_label,
  grant_id,
  current_grant_id,
  claim_count,
  status,
  notes
) values (
  'ef435950e27720533f8505eb38f914765ced2e5b01e15cc03dc41552c05771b7',
  'ef435950',
  'Render smoke test',
  null,
  null,
  0,
  'unused',
  'Dummy token for Render smoke test only'
);
```

### Redeem once

```powershell
$body = @{
  token = 'ANTROPHAI-RENDER-DUMMY-001'
  clientBuild = 'v0.41.86'
  clientNonce = 'render-smoke-test'
  testerComment = 'Render smoke test'
} | ConvertTo-Json

$redeem = Invoke-RestMethod -Method Post -Uri "$base/redeem" -ContentType 'application/json' -Body $body
$redeem
```

Expected:

- HTTP 200
- `ok: true`
- `accessGrant.grantId` is present
- `accessGrant.currentGrantId` is present
- `accessGrant.claimCount` is `1`

### Redeem again

```powershell
try {
  Invoke-RestMethod -Method Post -Uri "$base/redeem" -ContentType 'application/json' -Body $body
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected:

- HTTP 409
- `token_claimed`

### Revalidate

```powershell
$revalidateBody = @{
  grantId = $redeem.accessGrant.grantId
  clientBuild = 'v0.41.86'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$base/revalidate" -ContentType 'application/json' -Body $revalidateBody
```

Expected:

- HTTP 200
- `ok: true`
- `grantValid: true`
- `accessGrant.lastRevalidatedAt` is present

## 6) Dummy token reset

Warning:

- use this only for dummy smoke-test rows
- never reset a real tester token casually

```sql
update public.invite_tokens
set status = 'unused',
    grant_id = null,
    current_grant_id = null,
    claimed_at = null,
    claimed_client_build = null,
    last_seen_at = null,
    claim_count = 0,
    updated_at = now()
where token_hash = 'ef435950e27720533f8505eb38f914765ced2e5b01e15cc03dc41552c05771b7';
```

## 7) Notes

- The service remains separate from the game client.
- The game client is not wired to the token service yet.
- The Render deployment is only the standalone invite-token service.
