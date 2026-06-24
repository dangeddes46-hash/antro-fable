# AntrophAI v0.41.90 game-service skeleton

This folder contains the first standalone multiplayer game-service skeleton for AntrophAI.

It is separate from the invite-token service and separate from the browser client.

Important:

- This service is read-only in v0.41.90.
- It is not wired to the client yet.
- It does not mutate multiplayer state yet.
- It does not run ticks yet.
- The browser client must not directly write multiplayer state.
- The Supabase service role key is server-only.

## Endpoints

- `GET /health`
- `GET /api/version`
- `GET /api/schema-status`

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

## Render deployment

See [`RENDER_DEPLOYMENT.md`](./RENDER_DEPLOYMENT.md) for the Render Web Service settings.
