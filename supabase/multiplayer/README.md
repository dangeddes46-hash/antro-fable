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
- `003_add_player_banked.sql` - incremental: adds multiplayer_player_state.banked
- `004_add_player_science_table.sql` - incremental: creates multiplayer_player_science
- `005_add_player_minerals_table.sql` - incremental: creates multiplayer_player_minerals
- `006_add_market_listings_table.sql` - incremental: creates multiplayer_market_listings
- `007_market_buy_function.sql` - incremental: multiplayer_market_buy RPC + multiplayer_apply_economy_tick_state (atomic money movements)
- `RLS_SECURITY_NOTES.md` - access and policy notes for future review

## Migration ordering / deploy note

The v0.43.x game-service reads columns and tables that must exist before the
service is deployed against a database. Apply the incremental migrations
(003, 004, 005, 006, 007) to any database created from an earlier skeleton, or
the round-summary and hosted-round reads will fail (e.g. `column
multiplayer_player_state.banked does not exist`). Fresh installs from 001 already
include them.

**007 is load-bearing for the economy tick, not just Market Buy.** From
game-service v0.43.3 onward, every manual economy tick calls
`multiplayer_apply_economy_tick_state`, and every Market Buy calls
`multiplayer_market_buy`. Deploying a v0.43.3+ service against a database
without 007 breaks ticking for the whole round. Apply 007 BEFORE deploying;
the functions are inert until the new service calls them, so applying early is
safe.

## Notes

- The schema is intentionally conservative and reviewable.
- It uses standard Postgres/Supabase-compatible SQL.
- It separates player identity from access-link history.
- It treats round events and logs as first-class history records.
- It is not the final multiplayer design.
- It exists to support review before any migration is applied.
