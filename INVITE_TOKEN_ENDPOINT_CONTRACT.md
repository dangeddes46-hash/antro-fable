# AntrophAI invite-token endpoint contract

Status: v0.41.84 Phase 2 contract

## Purpose

This contract defines the minimal hosted invite-token service needed to support one-time invite redemption for the current static AntrophAI prototype.

The game itself remains static-hosted and browser-local. Saves remain in browser localStorage. This service only handles access control and token lifecycle.

Implementation note: the current branch now includes a Supabase service skeleton in `token-service/` plus the implementation guide in `INVITE_TOKEN_SUPABASE_IMPLEMENTATION.md`.
The token service can be hosted separately on Render; the game client is still not wired to it yet.

## Scope

In scope:

- invite-token redemption
- access grant issuance
- grant revalidation
- token ledger state
- revocation and expiry handling
- debug/export redaction guidance

Out of scope:

- gameplay logic
- save sync
- multiplayer
- server-side game state
- full accounts or password login
- DRM or source-code protection

## Terms

- invite token: the raw code a tester enters once
- tester label: a friendly human-readable label for the invited tester
- token hash: a one-way server-side hash of the token, never the raw token itself
- redemption: the act of claiming an unused invite token
- local access grant: the browser-stored record that says this browser has already redeemed access
- revoked token: a token or grant that has been manually disabled after issue
- development fallback code: the current static local tester code path used only for local/dev builds

## Contract summary

The static front end should call a tiny hosted access service.

On success, the service returns an access grant that the browser stores locally. On future visits, the client uses that local grant to skip the invite screen unless revalidation says otherwise.

The service must be the source of truth for whether a token is unused, claimed, revoked, or expired.

## Transport and CORS

- Use HTTPS only.
- Allow CORS only from the hosted AntrophAI static origins where practical.
- Support preflight requests.
- Keep the API small and explicit.

Recommended headers:

- `Content-Type: application/json`
- `Cache-Control: no-store`
- `Access-Control-Allow-Origin: <allowed-static-origin>`
- `Access-Control-Allow-Credentials: false`

## Endpoint: `POST /redeem`

Purpose:

- Claim an unused invite token.
- Return a local access grant payload for the browser to store.

Request body:

```json
{
  "token": "raw-token-entered-by-user",
  "clientBuild": "v0.41.84",
  "clientNonce": "browser-generated-random-id",
  "testerComment": ""
}
```

Field notes:

- `token` is required and transient; validate then discard.
- `clientBuild` helps the service decide whether the build is allowed.
- `clientNonce` is a non-secret browser-generated identifier for correlation and replay logging.
- `testerComment` is optional and may be truncated or ignored.

Successful response:

```json
{
  "ok": true,
  "accessGrant": {
    "grantId": "grant_xxx",
    "testerLabel": "Proteus X",
    "tokenId": "tok_xxx",
    "tokenHashPrefix": "abc123",
    "issuedAt": "2026-06-18T00:00:00.000Z",
    "expiresAt": null,
    "accessMode": "invite-token"
  }
}
```

Recommended HTTP status:

- `200 OK`

Failure responses:

```json
{
  "ok": false,
  "error": {
    "code": "token_invalid",
    "message": "Invite token was not recognised."
  }
}
```

Recommended failure codes:

- `token_invalid` -> `401 Unauthorized` or `404 Not Found`
- `token_claimed` -> `409 Conflict`
- `token_revoked` -> `403 Forbidden`
- `token_expired` -> `410 Gone`
- `build_not_allowed` -> `403 Forbidden`
- `rate_limited` -> `429 Too Many Requests`
- `service_unavailable` -> `503 Service Unavailable`

Suggested failure message patterns:

- invalid token
- already claimed
- revoked
- expired
- service unavailable

The service may optionally include `retryAfterSeconds`, `revokedAt`, or `expiresAt` in error responses when helpful.

## Endpoint: `POST /revalidate`

Purpose:

- Check whether an existing local access grant is still valid.
- Detect revocation or expiry after the grant has already been stored locally.

Request body:

```json
{
  "grantId": "grant_xxx",
  "tokenId": "tok_xxx",
  "clientBuild": "v0.41.84",
  "clientNonce": "browser-generated-random-id"
}
```

Optional alternative:

- the client may also send its stored `accessGrant` object if that is easier for the implementation, provided the server still validates the relevant IDs and ignores any untrusted fields.

Successful response:

```json
{
  "ok": true,
  "grantValid": true,
  "accessGrant": {
    "grantId": "grant_xxx",
    "testerLabel": "Proteus X",
    "tokenId": "tok_xxx",
    "tokenHashPrefix": "abc123",
    "issuedAt": "2026-06-18T00:00:00.000Z",
    "expiresAt": null,
    "lastRevalidatedAt": "2026-06-18T00:05:00.000Z",
    "accessMode": "invite-token"
  }
}
```

If revoked or expired:

```json
{
  "ok": false,
  "grantValid": false,
  "error": {
    "code": "grant_revoked",
    "message": "This invite grant has been revoked."
  }
}
```

Recommended revalidate failure codes:

- `grant_revoked`
- `grant_expired`
- `grant_not_found`
- `grant_invalid`
- `service_unavailable`

## Token ledger fields

Recommended persistent fields:

- `tokenId`
- `tokenHash` - never the raw token
- `testerLabel`
- `status` - `unused` / `claimed` / `revoked` / `expired`
- `createdAt`
- `claimedAt`
- `revokedAt`
- `lastSeenAt`
- `claimCount`
- `notes`
- `allowedBuilds`
- `minBuild`
- `grantId`
- `currentGrantId`

Recommended additional audit fields when useful:

- `claimedClientBuild`
- `claimedClientNonce`
- `claimedIpPrefix` or a similarly light audit hint if needed for abuse control

Do not store the raw invite token in the ledger.

## Security rules

- Never store raw tokens in the ledger.
- Never include raw tokens in debug export.
- Client localStorage should store the access grant only, not the raw token.
- Redemption must be atomic so two browsers cannot claim the same token at the same time.
- Rate-limit redemption attempts.
- Allow only the hosted AntrophAI static origins where practical.
- Avoid invasive fingerprinting for now.
- Keep the grant payload small and non-sensitive.

## Client behaviour

The future static client should:

- show an invite-token input field when hosted-token mode is enabled
- call `POST /redeem`
- store `accessGrant` in localStorage on success
- show the tester label if one is returned
- use the local grant on later visits
- optionally call `POST /revalidate`
- fall back to local-dev static codes only in dev or non-public builds

The client should not:

- store raw tokens in localStorage
- treat a localStorage flag as equivalent to real redemption
- invent or fake token validity without a server response

## Debug export guidance

Future debug exports should include:

- `accessMode`
- `testerLabel`
- `grantId`
- `tokenId` or `tokenHashPrefix`
- `issuedAt`
- `lastRevalidatedAt` if present

Future debug exports must not include:

- raw token
- secrets
- full token hash if that is sensitive in your operating model

## Deployment options comparison

### Render web service

Pros:

- fits the current Render deployment ecosystem
- easy to pair with a small durable ledger
- simple CORS story if the static site is also on Render

Cons:

- still requires a small backend service to operate
- needs its own deployment and monitoring

### Serverless function

Pros:

- small surface area
- easy to keep the API tiny
- good for a narrow redemption endpoint

Cons:

- can be harder to reason about if cold starts or provider-specific limits matter
- still needs durable storage for the ledger

### Supabase / Firebase style table + function

Pros:

- quick to stand up
- ledger and API can be managed together
- durable shared state is straightforward

Cons:

- introduces another platform dependency
- access policy and audit design still need care

### GitHub file-backed ledger

Pros:

- looks simple at first

Cons:

- awkward for atomic claims
- race-prone
- not a good fit for real redemption control
- easy to outgrow and hard to secure properly

### Recommendation

Use Supabase as the shared ledger and atomic claim layer.

The smallest practical implementation path for this branch is a Supabase-backed token table plus a tiny service layer that hashes the raw token, calls the `redeem_invite_token` RPC, and stores only the resulting local grant in the browser.

## Migration path

1. Keep the current static codes for development fallback.
2. Add the hosted token service and ledger.
3. Add client token mode behind config.
4. Test on DEV static first.
5. Roll to the stable tester site.
6. Remove shared static codes from tester builds once the hosted flow is proven.

## Non-goals

Not included:

- full user accounts
- passwords
- email login
- multiplayer identity
- server-side game state
- DRM or source-code protection
- payment/access control

## Testing checklist

- unused token succeeds once
- reused token fails on second browser
- revoked grant fails revalidation
- existing local saves persist after access change
- debug export redacts secrets
- network failure gives a clear message
- dev fallback still works only where intended

## Recommendation summary

The current static prototype should stay unchanged for gameplay and saves.

Phase 2 should make invite redemption a small hosted service with a durable shared ledger, while the front end stores only the resulting local access grant.
