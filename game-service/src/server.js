import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_ENV_PATH = path.resolve(__dirname, '..', '.env');
const LOCAL_ENV_LOADED = loadLocalEnv(LOCAL_ENV_PATH);

const SERVICE_NAME = 'antrophai-game-service';
const SERVICE_VERSION = 'v0.41.91';
const GAME_SERVICE_ENV = process.env.GAME_SERVICE_ENV || 'local';
const PORT = Number(process.env.PORT || 8790);
const RAW_ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '');
const ENABLE_DEV_ENDPOINTS = parseBoolean(process.env.ENABLE_DEV_ENDPOINTS);
const CONFIGURED_ALLOWED_ORIGINS = splitCsvList(RAW_ALLOWED_ORIGINS);
const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'http://localhost:4173',
  'http://localhost:4174',
];
const ALLOWED_ORIGINS = new Set(CONFIGURED_ALLOWED_ORIGINS.length > 0 ? CONFIGURED_ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS);
const SUPABASE_URL = normalizeText(process.env.SUPABASE_URL || '');
const SUPABASE_SERVICE_ROLE_KEY = normalizeText(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_CLIENT = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
const TABLES_TO_CHECK = [
  'multiplayer_rounds',
  'multiplayer_players',
  'multiplayer_player_access_links',
  'multiplayer_action_queue',
  'multiplayer_tick_log',
  'multiplayer_round_events',
];
const DEV_ROUND_DEFAULTS = {
  roundKey: 'shared-dev-001',
  roundName: 'Shared Multiplayer DEV',
  playerKey: 'dev-player-001',
  displayName: 'DEV Player One',
  testerLabel: 'DEV seed player',
};
const DEV_SEED_EVENT_TYPE = 'dev_seed_created';
const DEV_SEED_AUDIT_EVENT_TYPE = 'dev_seed_created';
const DEV_PLAYER_MARKER_PREFIX = 'dev-seed';

const app = express();
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, ALLOWED_ORIGINS.has(normalizeText(origin)));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/health', async (req, res) => {
  try {
    const roundCheck = await checkTableReachability('multiplayer_rounds');
    const dbReachable = roundCheck.reachable === undefined ? null : roundCheck.reachable;

    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: GAME_SERVICE_ENV,
      localEnvLoaded: LOCAL_ENV_LOADED,
      supabaseConfigured: SUPABASE_CONFIGURED,
      devEndpointsEnabled: ENABLE_DEV_ENDPOINTS,
      allowedOriginsConfigured: CONFIGURED_ALLOWED_ORIGINS.length > 0,
      allowedOriginsCount: ALLOWED_ORIGINS.size,
      dbReachable,
      schemaCheck: {
        multiplayer_rounds: roundCheck,
      },
      timestamp: nowIso(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: GAME_SERVICE_ENV,
      localEnvLoaded: LOCAL_ENV_LOADED,
      supabaseConfigured: SUPABASE_CONFIGURED,
      devEndpointsEnabled: ENABLE_DEV_ENDPOINTS,
      allowedOriginsConfigured: CONFIGURED_ALLOWED_ORIGINS.length > 0,
      allowedOriginsCount: ALLOWED_ORIGINS.size,
      dbReachable: false,
      schemaCheck: {
        multiplayer_rounds: {
          reachable: false,
          error: 'health_check_failed',
        },
      },
      error: 'health_check_failed',
      message: error instanceof Error ? error.message : 'Unexpected health check failure.',
      timestamp: nowIso(),
    });
  }
});

app.get('/api/version', (req, res) => {
  res.status(200).json({
    ok: true,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: GAME_SERVICE_ENV,
    runtime: 'skeleton',
    localEnvLoaded: LOCAL_ENV_LOADED,
    supabaseConfigured: SUPABASE_CONFIGURED,
    devEndpointsEnabled: ENABLE_DEV_ENDPOINTS,
    notes: 'Read-only game-service skeleton. Dev seed/read proof endpoints are temporary scaffolding.',
    timestamp: nowIso(),
  });
});

app.post('/api/dev/seed-round', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev seed endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const seedInput = normalizeSeedInput(req.body || {});
    const result = await seedDevRound(seedInput);

    res.status(200).json({
      ok: true,
      created: result.created,
      round: result.round,
      player: result.player,
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'seed_round_failed');
  }
});

app.get('/api/dev/round-summary', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev summary endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const roundKey = normalizeText(req.query.roundKey || DEV_ROUND_DEFAULTS.roundKey);
    const summary = await readDevRoundSummary(roundKey);

    if (!summary) {
      res.status(404).json({
        ok: false,
        error: 'round_not_found',
        message: 'Shared multiplayer DEV round has not been seeded yet.',
        roundKey,
        timestamp: nowIso(),
      });
      return;
    }

    res.status(200).json({
      ok: true,
      round: summary.round,
      players: summary.players,
      recentEvents: summary.recentEvents,
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'round_summary_failed');
  }
});

app.get('/api/schema-status', async (req, res) => {
  if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
    res.status(503).json({
      ok: false,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: GAME_SERVICE_ENV,
      error: 'supabase_not_configured',
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to check multiplayer schema status.',
      tables: buildSkippedTableMap(),
      timestamp: nowIso(),
    });
    return;
  }

  try {
    const results = await Promise.all(TABLES_TO_CHECK.map((tableName) => checkTableReachability(tableName)));
    const tables = Object.fromEntries(results.map((result) => [result.table, result]));
    const ok = results.every((result) => result.reachable === true);

    res.status(ok ? 200 : 503).json({
      ok,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: GAME_SERVICE_ENV,
      supabaseConfigured: true,
      tables,
      timestamp: nowIso(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: GAME_SERVICE_ENV,
      supabaseConfigured: true,
      error: 'schema_status_failed',
      message: error instanceof Error ? error.message : 'Unexpected schema status failure.',
      tables: buildFailedTableMap('schema_status_failed'),
      timestamp: nowIso(),
    });
  }
});

app.use((err, req, res, next) => {
  if (req.path && req.path.startsWith('/api/dev/') && !ENABLE_DEV_ENDPOINTS) {
    respondDevDisabled(res);
    return;
  }

  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({
      ok: false,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: GAME_SERVICE_ENV,
      error: 'invalid_json',
      message: 'Request body must be valid JSON.',
      timestamp: nowIso(),
    });
    return;
  }

  next(err);
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    error: 'not_found',
    message: 'Route not implemented in the v0.41.91 game-service skeleton.',
  });
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} ${SERVICE_VERSION} listening on port ${PORT}`);
});

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const result = dotenv.config({ path: filePath, override: false });
  return !result.error;
}

function splitCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function nowIso() {
  return new Date().toISOString();
}

async function checkTableReachability(tableName) {
  if (!SUPABASE_CLIENT) {
    return {
      table: tableName,
      reachable: null,
      error: 'supabase_not_configured',
    };
  }

  const { error } = await SUPABASE_CLIENT.from(tableName).select('*', { head: true }).limit(1);

  if (error) {
    return {
      table: tableName,
      reachable: false,
      error: error.message,
      code: error.code || null,
    };
  }

  return {
    table: tableName,
    reachable: true,
  };
}

function buildSkippedTableMap() {
  return Object.fromEntries(
    TABLES_TO_CHECK.map((tableName) => [
      tableName,
      {
        table: tableName,
        reachable: null,
        error: 'supabase_not_configured',
      },
    ])
  );
}

function buildFailedTableMap(errorCode) {
  return Object.fromEntries(
    TABLES_TO_CHECK.map((tableName) => [
      tableName,
      {
        table: tableName,
        reachable: false,
        error: errorCode,
      },
    ])
  );
}

function parseBoolean(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function requireDevEndpoints(req, res, next) {
  if (ENABLE_DEV_ENDPOINTS) {
    next();
    return;
  }

  respondDevDisabled(res);
}

function respondDevDisabled(res) {
  res.status(404).json({
    ok: false,
    error: 'dev_endpoints_disabled',
    message: 'Enable ENABLE_DEV_ENDPOINTS=true to use this development-only proof endpoint.',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    timestamp: nowIso(),
  });
}

function sendErrorResponse(res, error, fallbackCode) {
  const statusCode = error && typeof error === 'object' && 'statusCode' in error && Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;
  const code = error && typeof error === 'object' && 'code' in error && error.code
    ? error.code
    : fallbackCode;
  const message = error instanceof Error ? error.message : 'Unexpected service failure.';

  res.status(statusCode).json({
    ok: false,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: GAME_SERVICE_ENV,
    error: code,
    message,
    timestamp: nowIso(),
  });
}

function normalizeSeedInput(body) {
  return {
    roundKey: normalizeText(body.roundKey || DEV_ROUND_DEFAULTS.roundKey),
    roundName: normalizeText(body.roundName || DEV_ROUND_DEFAULTS.roundName),
    playerKey: normalizeText(body.playerKey || DEV_ROUND_DEFAULTS.playerKey),
    displayName: normalizeText(body.displayName || DEV_ROUND_DEFAULTS.displayName),
    testerLabel: normalizeText(body.testerLabel || DEV_ROUND_DEFAULTS.testerLabel),
  };
}

async function seedDevRound(seedInput) {
  const round = await getOrCreateDevRound(seedInput);
  const player = await getOrCreateDevPlayer(round.row.id, seedInput);
  const playerRound = await getOrCreatePlayerRound(round.row.id, player.row.id);
  const state = await getOrCreatePlayerState(round.row.id, player.row.id);
  const buildings = await getOrCreatePlayerBuildings(round.row.id, player.row.id);
  const armies = await getOrCreatePlayerArmies(round.row.id, player.row.id);
  const event = await getOrCreateDevEvent(round.row.id, player.row.id, seedInput);
  const audit = await getOrCreateDevAudit(round.row.id, player.row.id, seedInput);

  return {
    created: {
      round: round.created,
      player: player.created,
      playerRound: playerRound.created,
      state: state.created,
      buildings: buildings.created,
      armies: armies.created,
      event: event.created,
      audit: audit.created,
    },
    round: formatRound(round.row),
    player: formatPlayer(player.row),
  };
}

async function readDevRoundSummary(roundKey) {
  const round = await fetchSingleRow('multiplayer_rounds', 'id, round_key, round_name, status, current_tick, created_at, updated_at, notes', (query) =>
    query.eq('round_key', roundKey)
  );

  if (!round) {
    return null;
  }

  const playerRounds = await fetchRows(
    'multiplayer_player_rounds',
    'id, player_id, round_id, role, status, joined_at, left_at, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('status', 'active')
  );
  const playerIds = playerRounds.map((row) => row.player_id);
  const players = playerIds.length > 0
    ? await fetchRows('multiplayer_players', 'id, display_name, tester_label, status, created_from_grant_id, created_at, updated_at, last_seen_at, notes', (query) =>
        query.in('id', playerIds)
      )
    : [];
  const states = playerIds.length > 0
    ? await fetchRows(
        'multiplayer_player_state',
        'id, player_id, round_id, tick, state_version, race_key, land, power, money, energy, food, water, population, created_at, updated_at',
        (query) => query.eq('round_id', round.id).in('player_id', playerIds)
      )
    : [];
  const buildings = playerIds.length > 0
    ? await fetchRows(
        'multiplayer_player_buildings',
        'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
        (query) => query.eq('round_id', round.id).in('player_id', playerIds)
      )
    : [];
  const armies = playerIds.length > 0
    ? await fetchRows(
        'multiplayer_player_armies',
        'id, player_id, round_id, unit_key, count, training_count, returning_count, created_at, updated_at',
        (query) => query.eq('round_id', round.id).in('player_id', playerIds)
      )
    : [];
  const recentEvents = await fetchRows(
    'multiplayer_round_events',
    'id, round_id, tick, event_type, visibility, actor_player_id, target_player_id, alliance_id, title, body, payload, created_at',
    (query) => query.eq('round_id', round.id).order('created_at', { ascending: false }).limit(5)
  );

  const stateByPlayerId = new Map(states.map((state) => [state.player_id, state]));
  const buildingsByPlayerId = groupRowsByKey(buildings, 'player_id');
  const armiesByPlayerId = groupRowsByKey(armies, 'player_id');

  return {
    round: formatRound(round),
    players: players
      .map((player) => ({
        id: player.id,
        displayName: player.display_name,
        testerLabel: player.tester_label,
        state: formatState(stateByPlayerId.get(player.id)),
        buildings: formatBuildingRows(buildingsByPlayerId.get(player.id) || []),
        armies: formatArmyRows(armiesByPlayerId.get(player.id) || []),
      }))
      .sort((left, right) => {
        const leftTick = left.state?.tick ?? 0;
        const rightTick = right.state?.tick ?? 0;
        if (rightTick !== leftTick) {
          return rightTick - leftTick;
        }

        return left.displayName.localeCompare(right.displayName);
      }),
    recentEvents: recentEvents.map(formatEvent),
  };
}

async function getOrCreateDevRound(seedInput) {
  const existing = await fetchSingleRow('multiplayer_rounds', 'id, round_key, round_name, status, current_tick, created_at, updated_at, notes', (query) =>
    query.eq('round_key', seedInput.roundKey)
  );

  if (existing) {
    return {
      row: existing,
      created: false,
    };
  }

  const inserted = await insertSingleRow('multiplayer_rounds', {
    round_key: seedInput.roundKey,
    round_name: seedInput.roundName,
    status: 'draft',
    game_speed: 1,
    current_tick: 0,
    notes: `v0.41.91 dev seed round for ${seedInput.roundKey}`,
  });

  return {
    row: inserted,
    created: true,
  };
}

async function getOrCreateDevPlayer(roundId, seedInput) {
  const devSeedMarker = getDevSeedMarker(seedInput);
  const byMarker = await fetchSingleRow('multiplayer_players', 'id, display_name, tester_label, status, created_from_grant_id, created_at, updated_at, last_seen_at, notes', (query) =>
    query.eq('created_from_grant_id', devSeedMarker)
  );

  if (byMarker) {
    return {
      row: byMarker,
      created: false,
    };
  }

  const byIdentity = await fetchSingleRow('multiplayer_players', 'id, display_name, tester_label, status, created_from_grant_id, created_at, updated_at, last_seen_at, notes', (query) =>
    query.eq('display_name', seedInput.displayName).eq('tester_label', seedInput.testerLabel)
  );

  if (byIdentity) {
    return {
      row: byIdentity,
      created: false,
    };
  }

  const inserted = await insertSingleRow('multiplayer_players', {
    display_name: seedInput.displayName,
    tester_label: seedInput.testerLabel,
    status: 'active',
    created_from_grant_id: devSeedMarker,
    notes: `v0.41.91 dev seed player for ${seedInput.roundKey}`,
  });

  return {
    row: inserted,
    created: true,
  };
}

async function getOrCreatePlayerRound(roundId, playerId) {
  const existing = await fetchSingleRow('multiplayer_player_rounds', 'id, player_id, round_id, role, status, joined_at, left_at, created_at, updated_at', (query) =>
    query.eq('round_id', roundId).eq('player_id', playerId)
  );

  if (existing) {
    return {
      row: existing,
      created: false,
    };
  }

  const inserted = await insertSingleRow('multiplayer_player_rounds', {
    round_id: roundId,
    player_id: playerId,
    role: 'player',
    status: 'active',
  });

  return {
    row: inserted,
    created: true,
  };
}

async function getOrCreatePlayerState(roundId, playerId) {
  const existing = await fetchSingleRow(
    'multiplayer_player_state',
    'id, player_id, round_id, tick, state_version, race_key, land, power, money, energy, food, water, population, created_at, updated_at',
    (query) => query.eq('round_id', roundId).eq('player_id', playerId)
  );

  if (existing) {
    return {
      row: existing,
      created: false,
    };
  }

  const inserted = await insertSingleRow('multiplayer_player_state', {
    round_id: roundId,
    player_id: playerId,
    tick: 0,
    state_version: 0,
    race_key: 'human',
    land: 1000,
    power: 0,
    money: 0,
    energy: 0,
    food: 0,
    water: 0,
    population: 0,
  });

  return {
    row: inserted,
    created: true,
  };
}

async function getOrCreatePlayerBuildings(roundId, playerId) {
  const expectedRows = [
    { building_key: 'living_area', count: 0 },
    { building_key: 'factory', count: 0 },
    { building_key: 'barracks', count: 0 },
  ];
  const existing = await fetchRows('multiplayer_player_buildings', 'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at', (query) =>
    query.eq('round_id', roundId).eq('player_id', playerId)
  );
  const existingKeys = new Set(existing.map((row) => row.building_key));
  const created = expectedRows.some((row) => !existingKeys.has(row.building_key));

  await Promise.all(
    expectedRows.map((row) =>
      upsertRow('multiplayer_player_buildings', {
        round_id: roundId,
        player_id: playerId,
        building_key: row.building_key,
        count: row.count,
      }, 'player_id,round_id,building_key')
    )
  );

  return {
    created,
  };
}

async function getOrCreatePlayerArmies(roundId, playerId) {
  const expectedRows = [
    { unit_key: 'infantry', count: 0 },
    { unit_key: 'defense', count: 0 },
  ];
  const existing = await fetchRows('multiplayer_player_armies', 'id, player_id, round_id, unit_key, count, training_count, returning_count, created_at, updated_at', (query) =>
    query.eq('round_id', roundId).eq('player_id', playerId)
  );
  const existingKeys = new Set(existing.map((row) => row.unit_key));
  const created = expectedRows.some((row) => !existingKeys.has(row.unit_key));

  await Promise.all(
    expectedRows.map((row) =>
      upsertRow('multiplayer_player_armies', {
        round_id: roundId,
        player_id: playerId,
        unit_key: row.unit_key,
        count: row.count,
        training_count: 0,
        returning_count: 0,
      }, 'player_id,round_id,unit_key')
    )
  );

  return {
    created,
  };
}

async function getOrCreateDevEvent(roundId, playerId, seedInput) {
  const existing = await fetchSingleRow('multiplayer_round_events', 'id, round_id, tick, event_type, visibility, title, body, payload, created_at', (query) =>
    query.eq('round_id', roundId).eq('event_type', DEV_SEED_EVENT_TYPE)
  );

  if (existing) {
    return {
      row: existing,
      created: false,
    };
  }

  const inserted = await insertSingleRow('multiplayer_round_events', {
    round_id: roundId,
    tick: 0,
    event_type: DEV_SEED_EVENT_TYPE,
    visibility: 'public',
    actor_player_id: playerId,
    title: 'DEV seed created',
    body: 'Shared Multiplayer DEV seed prepared by the game-service skeleton.',
    payload: {
      seedKey: getDevSeedMarker(seedInput),
      roundKey: seedInput.roundKey,
      playerKey: seedInput.playerKey,
    },
  });

  return {
    row: inserted,
    created: true,
  };
}

async function getOrCreateDevAudit(roundId, playerId, seedInput) {
  const existing = await fetchSingleRow('multiplayer_audit_log', 'id, round_id, player_id, actor_type, event_type, event_data, created_at', (query) =>
    query.eq('round_id', roundId).eq('event_type', DEV_SEED_AUDIT_EVENT_TYPE)
  );

  if (existing) {
    return {
      row: existing,
      created: false,
    };
  }

  const inserted = await insertSingleRow('multiplayer_audit_log', {
    round_id: roundId,
    player_id: playerId,
    actor_type: 'system',
    event_type: DEV_SEED_AUDIT_EVENT_TYPE,
    event_data: {
      seedKey: getDevSeedMarker(seedInput),
      roundKey: seedInput.roundKey,
      playerKey: seedInput.playerKey,
      displayName: seedInput.displayName,
      testerLabel: seedInput.testerLabel,
    },
  });

  return {
    row: inserted,
    created: true,
  };
}

async function fetchSingleRow(tableName, columns, filterFn) {
  const query = SUPABASE_CLIENT.from(tableName).select(columns).limit(1);
  const filtered = filterFn(query);
  const { data, error } = await filtered;

  if (error) {
    throw Object.assign(new Error(error.message), { code: error.code || 'supabase_query_failed' });
  }

  if (!data) {
    return null;
  }

  return Array.isArray(data) ? data[0] || null : data;
}

async function fetchRows(tableName, columns, filterFn) {
  const query = SUPABASE_CLIENT.from(tableName).select(columns);
  const filtered = filterFn(query);
  const { data, error } = await filtered;

  if (error) {
    throw Object.assign(new Error(error.message), { code: error.code || 'supabase_query_failed' });
  }

  return data || [];
}

async function insertSingleRow(tableName, values) {
  const { data, error } = await SUPABASE_CLIENT.from(tableName).insert(values).select('*').single();

  if (error) {
    throw Object.assign(new Error(error.message), { code: error.code || 'supabase_insert_failed' });
  }

  return data;
}

async function upsertRow(tableName, values, onConflict) {
  const { data, error } = await SUPABASE_CLIENT.from(tableName)
    .upsert(values, { onConflict, ignoreDuplicates: false })
    .select('*')
    .single();

  if (error) {
    throw Object.assign(new Error(error.message), { code: error.code || 'supabase_upsert_failed' });
  }

  return data;
}

function getDevSeedMarker(seedInput) {
  return `dev-seed:${seedInput.roundKey}:${seedInput.playerKey}`;
}

function formatRound(round) {
  return {
    id: round.id,
    roundKey: round.round_key,
    roundName: round.round_name,
    status: round.status,
    currentTick: round.current_tick,
  };
}

function formatPlayer(player) {
  return {
    id: player.id,
    displayName: player.display_name,
    testerLabel: player.tester_label,
  };
}

function formatState(state) {
  if (!state) {
    return null;
  }

  return {
    id: state.id,
    tick: state.tick,
    stateVersion: state.state_version,
    raceKey: state.race_key,
    land: state.land,
    power: state.power,
    money: state.money,
    energy: state.energy,
    food: state.food,
    water: state.water,
    population: state.population,
  };
}

function formatBuildingRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    buildingKey: row.building_key,
    count: row.count,
    effectiveCount: row.effective_count,
  }));
}

function formatArmyRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    unitKey: row.unit_key,
    count: row.count,
    trainingCount: row.training_count,
    returningCount: row.returning_count,
  }));
}

function formatEvent(event) {
  return {
    id: event.id,
    tick: event.tick,
    eventType: event.event_type,
    visibility: event.visibility,
    title: event.title,
    body: event.body,
    payload: event.payload,
    createdAt: event.created_at,
  };
}

function groupRowsByKey(rows, keyName) {
  return rows.reduce((map, row) => {
    const key = row[keyName];
    const bucket = map.get(key) || [];
    bucket.push(row);
    map.set(key, bucket);
    return map;
  }, new Map());
}
