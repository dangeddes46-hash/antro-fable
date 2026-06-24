# AntrophAI multiplayer schema skeleton

This folder contains draft Supabase SQL and review notes for the future server-authoritative multiplayer architecture.

## Important

- These files are draft schema skeletons for review only.
- Do not run them against production or test Supabase yet unless explicitly approved.
- v0.41.89 refines the review docs and draft SQL around access links and game history.
- No client/runtime code changed in this pass.
- Multiplayer state is intended to be server-authoritative.
- The browser must not directly write canonical multiplayer state.
- The future game service should use the Supabase service role key only on the server.

## Files

- `001_multiplayer_schema_skeleton.sql` - main draft schema skeleton
- `002_multiplayer_seed_dev_round_example.sql` - optional dev/example seed
- `RLS_SECURITY_NOTES.md` - access and policy notes for future review

## Notes

- The schema is intentionally conservative and reviewable.
- It uses standard Postgres/Supabase-compatible SQL.
- It separates player identity from access-link history.
- It treats round events and logs as first-class history records.
- It is not the final multiplayer design.
- It exists to support review before any migration is applied.
