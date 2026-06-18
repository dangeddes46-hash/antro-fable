# AntrophAI token-service skeleton

This folder contains the Supabase-backed invite-token service skeleton for the future hosted access flow.

It is intentionally separate from the React/Vite game client.
It can run locally from `token-service/.env` or on Render from dashboard environment variables.

## What this service does

- hashes invite tokens on the server
- calls the Supabase redemption RPC
- returns a browser-local grant payload on success
- exposes a small revalidation endpoint
- keeps raw tokens out of the database

## What it does not do

- it does not replace the current browser-local tester gate
- it does not change GLW gameplay
- it does not add login, accounts, multiplayer, or shared saves
- it does not wire directly into `src/App.jsx` yet

## Files

- `src/server.js` - minimal HTTP service skeleton
- `supabase/schema.sql` - invite-token table and indexes
- `supabase/redeem_invite_token.sql` - atomic redemption RPC
- `scripts/hash-token.js` - helper for safe token hashing
- `.env.example` - local environment template

## Required environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
- `PORT`

Optional:

- `TOKEN_HASH_PEPPER`

## Local run

`src/server.js` automatically loads `token-service/.env` during local development.

This skeleton does not require a separate runtime dependency install.

Run it with Node 18 or newer:

```bash
node src/server.js
```

## Endpoints

- `GET /health`
- `POST /redeem`
- `POST /revalidate`

## Supabase setup

1. Apply `supabase/schema.sql` to the Supabase project.
2. Create the `redeem_invite_token` RPC using the plan in `INVITE_TOKEN_SUPABASE_IMPLEMENTATION.md`.
3. Set the service environment variables.
4. Allow only the hosted static origins in `ALLOWED_ORIGINS`.

## Notes

- Store only local access grants in browser storage.
- Keep the invite-token service and the game save state separate.
- Use the helper script to hash raw tokens before inserting rows.
- `token-service/.env` is ignored by Git and should never be committed.
