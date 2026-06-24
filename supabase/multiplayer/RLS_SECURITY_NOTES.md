# AntrophAI multiplayer RLS and security notes

This document explains the intended security posture for the future multiplayer service.

## Early prototype rule

- The game service should use the Supabase service role key server-side only.
- The browser client should not directly write multiplayer tables.
- Canonical multiplayer state must remain server-authoritative.

## Read access options

There are two likely read strategies for future review:

1. Game service only
   - Browser reads go through the hosted game service.
   - Supabase tables remain private from the browser.

2. Limited Supabase read views later
   - If direct client reads are ever needed, expose only carefully designed read-only views.
   - Pair them with strict RLS policies.

## Write access

- Write access must remain server-authoritative.
- The browser should submit actions to the game service, not write rows directly.
- The service should validate every action before it becomes canonical state.

## Service role safety

- Never place the Supabase service role key in the browser client.
- Never expose the service role key in logs, exports, or debug payloads.
- The service role key belongs only in the hosted game service environment.

## Audit logging

- Important action attempts should be recorded.
- Validation failures should be recorded where useful.
- Successful canonical state changes should be recorded.
- Rejected actions should not silently disappear.

## Game-visible history vs audit logs

- Game logs contain sensitive gameplay information.
- Not every log is visible to every player.
- Player-visible reports need server-side filtering.
- The server must decide what a player may read.
- Public round events may be safe to show broadly.
- Audit logs should never be directly exposed to normal players.
- If future direct Supabase reads are used, prefer restricted views over raw tables.

## Future RLS direction

If the browser ever reads multiplayer tables directly, review:

- round-scoped read access
- player-scoped read access
- alliance-scoped read access
- safe public summary views
- message privacy rules

This file does not define the final policy set.
It only captures the intended security direction for the schema review pass.
