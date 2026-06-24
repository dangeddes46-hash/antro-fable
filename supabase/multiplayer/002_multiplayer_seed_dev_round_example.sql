-- AntrophAI v0.41.88 multiplayer schema skeleton
-- Optional dev/example seed only. Do not use for production data.

-- Example round
insert into public.multiplayer_rounds (
  id,
  round_key,
  round_name,
  status,
  game_speed,
  current_tick,
  tick_length_seconds,
  started_at,
  ended_at,
  notes
)
values (
  '11111111-1111-1111-1111-111111111111',
  'dev-review-round',
  'Draft Multiplayer Review Round',
  'draft',
  1,
  0,
  3600,
  null,
  null,
  'Optional dev-only seed round for schema review.'
)
on conflict (round_key) do nothing;

-- Example players
insert into public.multiplayer_players (
  id,
  tester_label,
  display_name,
  status,
  created_from_invite_token_id,
  created_from_grant_id,
  last_seen_at,
  notes
)
values
  (
    '22222222-2222-2222-2222-222222222222',
    'Example Tester Alpha',
    'Example Player Alpha',
    'active',
    null,
    'dev-seed-grant-alpha',
    now(),
    'Optional dev-only sample player for schema review.'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Example Tester Beta',
    'Example Player Beta',
    'active',
    null,
    'dev-seed-grant-beta',
    now(),
    'Optional dev-only sample player for schema review.'
  )
on conflict (id) do nothing;

-- Example access link
insert into public.multiplayer_player_access_links (
  id,
  player_id,
  access_type,
  invite_token_id,
  grant_id,
  token_hash_prefix,
  provider,
  status,
  issued_at,
  revoked_at,
  notes
)
values (
  '44444444-aaaa-4444-aaaa-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'invite-token',
  null,
  'dev-seed-grant-alpha',
  'devseed1',
  'antrophai-token-service',
  'active',
  now(),
  null,
  'Optional dev-only access-link sample for schema review.'
)
on conflict (id) do nothing;

-- Example round membership
insert into public.multiplayer_player_rounds (
  id,
  player_id,
  round_id,
  role,
  status,
  joined_at
)
values
  (
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'player',
    'active',
    now()
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'player',
    'active',
    now()
  )
on conflict (player_id, round_id) do nothing;

-- Example round event
insert into public.multiplayer_round_events (
  id,
  round_id,
  tick,
  event_type,
  visibility,
  actor_player_id,
  target_player_id,
  alliance_id,
  title,
  body,
  payload
)
values (
  '55555555-aaaa-5555-aaaa-555555555555',
  '11111111-1111-1111-1111-111111111111',
  0,
  'round_started',
  'public',
  null,
  null,
  null,
  'Review round opened',
  'Optional dev-only public event for schema review.',
  '{"source":"seed"}'::jsonb
)
on conflict (id) do nothing;

-- Example player state
insert into public.multiplayer_player_state (
  id,
  player_id,
  round_id,
  tick,
  state_version,
  race_key,
  land,
  power,
  money,
  energy,
  food,
  water,
  population,
  morale,
  protection_until_tick,
  vacation_until_tick
)
values
  (
    '66666666-6666-6666-6666-666666666666',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    0,
    1,
    'trysaur',
    1000,
    1000,
    1000,
    1000,
    1000,
    1000,
    1000,
    100,
    null,
    null
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    0,
    1,
    'lithi',
    1000,
    1000,
    1000,
    1000,
    1000,
    1000,
    1000,
    100,
    null,
    null
  )
on conflict (player_id, round_id) do nothing;

-- Example buildings
insert into public.multiplayer_player_buildings (
  id,
  player_id,
  round_id,
  building_key,
  count,
  effective_count
)
values
  (
    '88888888-8888-8888-8888-888888888888',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'factory',
    25,
    25
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'factory',
    20,
    20
  )
on conflict (player_id, round_id, building_key) do nothing;

-- Example armies
insert into public.multiplayer_player_armies (
  id,
  player_id,
  round_id,
  unit_key,
  count,
  training_count,
  returning_count
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'soldier',
    0,
    0,
    0
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'soldier',
    0,
    0,
    0
  )
on conflict (player_id, round_id, unit_key) do nothing;

-- Example message
insert into public.multiplayer_messages (
  id,
  round_id,
  sender_player_id,
  recipient_player_id,
  recipient_alliance_id,
  message_type,
  subject,
  body,
  status,
  visibility,
  redacted_at
)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  null,
  'player',
  'Welcome',
  'Optional dev-only player message for schema review.',
  'active',
  'private',
  null
)
on conflict (id) do nothing;
