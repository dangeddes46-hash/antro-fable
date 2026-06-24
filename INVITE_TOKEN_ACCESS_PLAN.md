# AntrophAI invite-token access plan

Status: v0.41.86 rollout note

## Purpose

This document describes the safest practical path from the current browser-local tester gate to a future invite-token model.

v0.41.87 planning note: the invite-token grant is also the first bridge toward future multiplayer player identity. It still remains access limiting, not DRM, and it still does not make the browser authoritative for gameplay.

The current static build is still the source of truth for gameplay. This note is only about access control and tester pool management.

## What the current static gate does

The current gate:

- accepts a small allowlist of local tester codes as a fallback
- redeems hosted invite tokens in the DEV client
- stores the accepted state in browser localStorage
- skips the gate on later visits in the same browser/origin
- keeps the GLW and Intro Game local saves separate from the access flag

The current gate does not:

- prove identity
- prevent link sharing
- prevent code sharing
- prevent reuse of the same code in another browser
- revoke an already shared code across devices

## Why localStorage alone cannot do one-time tokens

A true one-time token means the system must know, globally, whether the token has already been redeemed.

If the only state lives in browser localStorage:

- another browser can still submit the same token
- a copied browser profile can still replay the same local state
- the game client can be inspected and modified
- there is no shared redemption ledger

So static-only localStorage can remember access locally, but it cannot enforce one-time redemption across devices.

## Recommended minimal architecture

Keep the game itself static on Render.

Use Supabase as the shared invite-token ledger and atomic redemption record.

A lightweight service skeleton now lives in `token-service/` and is documented in `INVITE_TOKEN_SUPABASE_IMPLEMENTATION.md`.

See `INVITE_TOKEN_ENDPOINT_CONTRACT.md` for the implementation-ready request/response shape, grant fields, and ledger contract.

### Suggested token ledger fields

- tokenId or hashed token
- testerLabel or testerName
- status: unused / claimed / revoked
- claimedAt
- optional claimedBrowserNote or claimedDeviceNote
- lastSeenAt if useful for audit

Do not overdo fingerprinting. A light note about the claiming browser/device can help support, but it should not become a privacy-heavy tracking system.

### Suggested request flow

1. Tester enters an invite token.
2. Front end sends the token to the hosted token endpoint.
3. Endpoint validates the token against the ledger.
4. If valid and unused, the endpoint marks it claimed.
5. Front end stores a local access grant in browser localStorage.
6. Later visits in the same browser can skip the gate.
7. If the token is revoked or already claimed, new browsers should fail redemption.

### Suggested retention model

- Keep the local access grant for convenience.
- Optionally revalidate occasionally in future hosted phases.
- Do not make the client the source of truth for token ownership.

## What this protects, and what it does not

This is access limiting, not strong DRM.

It helps with:

- casual code sharing
- tester-pool control
- basic revocation
- accountless invite management

It does not fully stop:

- browser asset copying
- source inspection
- determined manual duplication of the static app
- screenshots, screen recording, or informal redistribution

Stronger protection would require server-rendered or authenticated delivery, which is beyond the current prototype scope.

## Front-end scaffolding recommendation

If front-end scaffolding is added later, keep it dormant and feature-flagged.

Recommended approach:

- preserve the existing local tester codes for current static development
- add a future hosted-token mode beside the current gate
- do not replace the static gate until the hosted endpoint exists
- do not hardcode real future invite tokens in the client

The client should clearly distinguish between:

- local test access for the current static prototype
- hosted invite redemption for the future token build

## Debug export recommendation

Future debug exports should include:

- tester access mode
- tester label if available
- token id or hash prefix only, not the full token
- access grant timestamp
- local access state

Do not export secret token values.

## Suggested implementation phases

### Phase 1

- Write this design document
- Keep the current static tester gate
- Update wording to be honest about the current local-only behaviour

### Phase 2

- Add the Supabase-backed token ledger and atomic redemption RPC
- Add the service skeleton behind the contract
- The DEV client now includes the front-end redemption flow.
- Keep fallback static test codes only for local development

Use the endpoint contract in `INVITE_TOKEN_ENDPOINT_CONTRACT.md` as the source of truth for request/response fields and failure handling.

### Phase 3

- Add admin token list / revoke / export tools
- Add tester labels to debug export
- Remove shared static codes from the public tester build
- Use the invite-token grant as the bridge to future multiplayer player identity, but keep gameplay authority on the server

## Risks and tradeoffs

- A hosted token endpoint adds a small amount of infrastructure and operational maintenance.
- Token revocation needs a durable shared record.
- More aggressive fingerprinting could be fragile, privacy-sensitive, and unnecessary for this use case.
- Keeping the current static gate during transition is helpful for developer continuity, but it should eventually be treated as a dev-only fallback.

## Recommendation

Keep the current static prototype unchanged for gameplay and saves.

Document the future token service now.

When hosted token infrastructure is ready, the public tester flow can use the redemption endpoint while the local static codes remain a development fallback.
