# AntrophAI v0.43.1 game-service dev seed/read/queued-action/manual-tick/reset/identity/hosted-round proof

This folder contains the first standalone multiplayer game-service proof for AntrophAI. v0.43.1 locks hosted identity to a single canonical grant-linked player per round.

It is separate from the invite-token service and separate from the browser client.

Important:

- This service is read-only by default except for the temporary DEV proof endpoints enabled below.
- It is not wired to the client yet.
- It does not run ticks yet.
- The browser client must not directly write multiplayer state.
- The Supabase service role key is server-only.
- Dev-only seed/read endpoints exist only when `ENABLE_DEV_ENDPOINTS=true`.
- Set `ENABLE_DEV_ENDPOINTS=true` locally only when you want to run the proof endpoints.

## Endpoints

- `GET /health`
- `GET /api/version`
- `GET /api/schema-status`
- `POST /api/dev/seed-round` when dev endpoints are enabled
- `GET /api/dev/round-summary` when dev endpoints are enabled
- `POST /api/dev/actions/build-factory` when dev endpoints are enabled for legacy immediate proof
- `POST /api/dev/actions/queue-build-factory` when dev endpoints are enabled
- `POST /api/dev/tick/manual-run` when dev endpoints are enabled
- `POST /api/dev/reset-proof-round` when dev endpoints are enabled
- `POST /api/dev/identity/resolve-player` when dev endpoints are enabled
- `POST /api/dev/hosted-round/enter` when dev endpoints are enabled

## Local setup

1. Open this folder:

   ```powershell
   cd game-service
   ```

2. Install dependencies:

   ```powershell
   npm install
   ```

3. Create a local env file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Add your local values to `.env`.

   The server loads `game-service/.env` automatically through `dotenv`, so you do not need to set these values manually in the shell each time.

5. Start the service:

   ```powershell
   npm start
   ```

6. Check the endpoints:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8790/health
   Invoke-RestMethod http://127.0.0.1:8790/api/version
   Invoke-RestMethod http://127.0.0.1:8790/api/schema-status
   ```

If Supabase is not configured locally, `/health` still starts cleanly and `/api/schema-status` returns a useful configuration error. The proof action endpoint fails cleanly with a dev-endpoints-disabled or Supabase-configured error instead of writing directly from the browser.

The dev seed/read endpoints, the queued-action/manual-tick/reset proof endpoints, and the hosted-round entry endpoint are temporary scaffolding. Keep them disabled for any public multiplayer test unless a specific DEV proof run requires them.

## Render deployment

See [`RENDER_DEPLOYMENT.md`](./RENDER_DEPLOYMENT.md) for the Render Web Service settings.
