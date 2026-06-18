# AntrophAI v0.41.84 Supabase invite-token implementation skeleton

## Purpose

This document defines the implementation-ready Supabase path for the future invite-token flow.

The current React/Vite app stays static and browser-local in this branch. The game client is not wired to the token service yet. The goal here is to prepare the service shape, schema, and operational notes so the hosted invite-token phase can be added later without redesigning the game.

The token-service can run locally from `token-service/.env` or be deployed separately to Render as a standalone Web Service.

## Chosen path

Use Supabase as the shared redemption ledger and the service backend for invite-token access control.

The recommended split is:

- browser-local static game client
- small token-service process or function
- Supabase table for invite-token ledger rows
- atomic Supabase RPC for first redemption

## Repository layout

Expected files for this skeleton:

- `token-service/package.json`
- `token-service/src/server.js`
- `token-service/scripts/hash-token.js`
- `token-service/.env.example`
- `token-service/README.md`
- `token-service/supabase/schema.sql`

## Runtime responsibilities

The token service should:

- accept a raw invite token from a future hosted client or admin tool
- hash the token on the server
- call the Supabase redemption RPC
- return a local browser grant payload on success
- expose a light revalidation endpoint for already issued grants
- avoid storing or returning raw token values
- support local `.env` loading without overriding Render environment variables

The game client should continue to:

- store only local browser access state
- keep browser-local GLW saves untouched
- avoid any direct token logic until the future hosted integration phase

## Environment variables

Required or expected variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
- `PORT`

Optional:

- `TOKEN_HASH_PEPPER`

Suggested local example values:

- `PORT=8787`
- `ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173`

## Supabase schema

The minimal table lives in `token-service/supabase/schema.sql`.

It should keep the ledger small and explicit:

- `token_hash` for the one-way token lookup key
- `token_prefix` for safe support/debug display
- `tester_label` for human-readable ownership
- `grant_id` for the local browser grant, kept as a compatibility alias
- `current_grant_id` for the current live claim pointer
- `claim_count` for simple claim/redeem tracking
- `status` for `unused`, `claimed`, `revoked`, or `expired`
- timestamps for claim, revoke, expiry, and updates

The schema should not store raw invite tokens.

## Atomic redemption plan

The core redemption rule is simple:

1. Hash the raw token in the service.
2. Generate a fresh grant id in the service.
3. Call Supabase RPC `redeem_invite_token(p_token_hash text, p_grant_id text, p_client_build text)`.
4. Let Supabase atomically move a matching unused token to claimed.
5. Return the resulting grant payload to the browser.

The RPC should be the only place that decides whether a token is still unused.

### Recommended redemption RPC behavior

The function should:

- find a row by `token_hash`
- reject missing, revoked, expired, or already claimed tokens
- update the row in a single transaction
- write `grant_id`, `current_grant_id`, `claim_count`, `claimed_at`, and `claimed_client_build`
- return a small JSON payload suitable for the service response

Suggested function shape:

```sql
create or replace function public.redeem_invite_token(
  p_token_hash text,
  p_grant_id text,
  p_client_build text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_tokens%rowtype;
begin
  update public.invite_tokens
     set status = 'claimed',
         grant_id = p_grant_id,
         claimed_at = now(),
         claimed_client_build = p_client_build,
         last_seen_at = now()
   where token_hash = p_token_hash
     and status = 'unused'
   returning * into v_row;

  if not found then
    select * into v_row
      from public.invite_tokens
     where token_hash = p_token_hash;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'token_invalid',
          'message', 'Invite token was not recognised.'
        )
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code',
        case v_row.status
          when 'claimed' then 'token_claimed'
          when 'revoked' then 'token_revoked'
          when 'expired' then 'token_expired'
          else 'token_invalid'
        end,
        'message',
        case v_row.status
          when 'claimed' then 'Invite token was already claimed.'
          when 'revoked' then 'Invite token has been revoked.'
          when 'expired' then 'Invite token has expired.'
          else 'Invite token was not recognised.'
        end
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'grant', jsonb_build_object(
      'grantId', v_row.grant_id,
      'tokenId', concat('tok_', v_row.id::text),
      'testerLabel', v_row.tester_label,
      'tokenHashPrefix', v_row.token_prefix,
      'issuedAt', v_row.claimed_at,
      'expiresAt', v_row.expires_at,
      'accessMode', 'invite-token'
    )
  );
end;
$$;
```

The exact return shape can be adjusted later, but the key rule is to keep the claim atomic and server-side.

## Revalidation plan

`POST /revalidate` can stay small and read-only:

- look up the grant by `grant_id`
- confirm it is still claimed and not revoked or expired
- optionally update `last_seen_at`
- return the current grant summary

If revalidation is not ready yet, the service can return a clear `not_implemented` style response for that route until the ledger workflow is complete.

## Service response shape

Recommended success response:

```json
{
  "ok": true,
  "accessGrant": {
    "grantId": "grant_xxx",
    "tokenId": "tok_123",
    "testerLabel": "Proteus X",
    "tokenHashPrefix": "abc12345",
    "issuedAt": "2026-06-18T00:00:00.000Z",
    "expiresAt": null,
    "accessMode": "invite-token"
  }
}
```

Recommended error response:

```json
{
  "ok": false,
  "error": {
    "code": "token_invalid",
    "message": "Invite token was not recognised."
  }
}
```

## Security notes

- Never store raw invite tokens in the database.
- Never commit secrets, service-role keys, or real tokens.
- Keep the browser grant separate from the game save state.
- Use service-role access only on the server side.
- Keep CORS tight to the hosted static origins.
- Add rate limiting or upstream protection before public use.

## Deployment note

This skeleton is for the future hosted invite-token phase only.

The current static tester access gate stays in place until the hosted integration is ready.
