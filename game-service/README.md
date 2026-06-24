# AntrophAI v0.41.91 game-service dev seed/read proof

This folder contains the first standalone multiplayer game-service proof for AntrophAI.

It is separate from the invite-token service and separate from the browser client.

Important:

- This service is read-only by default in v0.41.91.
- It is not wired to the client yet.
- It does not mutate multiplayer state yet.
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

If Supabase is not configured locally, `/health` still starts cleanly and `/api/schema-status` returns a useful configuration error.

The dev seed/read endpoints are temporary scaffolding. Keep them disabled for any public multiplayer test unless a specific DEV proof run requires them.

## Render deployment

See [`RENDER_DEPLOYMENT.md`](./RENDER_DEPLOYMENT.md) for the Render Web Service settings.
