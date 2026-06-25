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
const SERVICE_VERSION = 'v0.41.95';
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
const DEV_PROOF_RESET_EVENT_TYPE = 'dev_proof_reset';

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
    notes: 'Dev-only game-service skeleton. Seed/read proof endpoints, the queued-action/manual-tick proof, and the proof-reset endpoint are temporary scaffolding.',
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
      recentPublicEvents: summary.recentPublicEvents,
      recentActions: summary.recentActions,
      recentTickLogs: summary.recentTickLogs,
      actionSummary: summary.actionSummary,
      roundSummary: summary.roundSummary,
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'round_summary_failed');
  }
});

app.post('/api/dev/actions/queue-build-factory', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev queue-build-factory endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const actionInput = normalizeDevBuildFactoryInput(req.body || {});
    const result = await queueDevFactoryAction(actionInput);

    res.status(200).json({
      ok: true,
      action: {
        id: result.action.id,
        type: 'dev_queue_build_factory',
        status: result.action.status,
        buildingKey: 'factory',
        amount: result.amount,
        requestedTick: result.requestedTick,
        executeAfterTick: result.executeAfterTick,
        payload: result.action.payload,
        result: result.action.result,
      },
      round: {
        roundKey: result.round.roundKey,
        previousTick: result.previousTick,
        currentTick: result.round.currentTick,
      },
      player: {
        displayName: result.player.displayName,
      },
      message: 'Build order queued for next tick.',
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'queue_build_factory_failed');
  }
});

app.post('/api/dev/tick/manual-run', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev manual-run endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const tickInput = normalizeDevManualTickInput(req.body || {});
    const result = await runManualDevTick(tickInput);

    res.status(200).json({
      ok: true,
      round: {
        roundKey: result.round.roundKey,
        previousTick: result.previousTick,
        currentTick: result.round.currentTick,
      },
      processed: {
        total: result.processed.total,
        factoryBuilds: result.processed.factoryBuilds,
      },
      message: 'Manual tick processed.',
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'manual_tick_failed');
  }
});

app.post('/api/dev/reset-proof-round', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev reset-proof-round endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const resetInput = normalizeDevProofResetInput(req.body || {});
    const result = await resetDevProofRound(resetInput);

    res.status(200).json({
      ok: true,
      round: {
        roundKey: result.round.roundKey,
        previousTick: result.previousTick,
        currentTick: result.round.currentTick,
      },
      player: {
        displayName: result.player.displayName,
        factoryCount: result.player.factoryCount,
      },
      proofState: {
        cancelledActionCount: result.cancelledActionCount,
        resetTickLogCount: result.resetTickLogCount,
      },
      message: 'Shared DEV proof state reset.',
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'reset_proof_round_failed');
  }
});

app.post('/api/dev/actions/build-factory', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev build-factory endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const actionInput = normalizeDevBuildFactoryInput(req.body || {});
    const result = await buildDevFactoryAction(actionInput);

    res.status(200).json({
      ok: true,
      action: {
        type: 'dev_build_factory',
        amount: result.amount,
        buildingKey: 'factory',
        oldCount: result.oldCount,
        newCount: result.newCount,
      },
      round: {
        roundKey: result.round.roundKey,
        currentTick: result.round.currentTick,
      },
      player: {
        displayName: result.player.displayName,
      },
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'build_factory_failed');
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
    message: 'Route not implemented in the v0.41.95 game-service skeleton.',
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

function normalizeDevBuildFactoryInput(body) {
  return {
    roundKey: normalizeText(body.roundKey || DEV_ROUND_DEFAULTS.roundKey),
    displayName: normalizeText(body.displayName || DEV_ROUND_DEFAULTS.displayName),
    amount: clampDevBuildAmount(body.amount),
    idempotencyKey: normalizeText(body.idempotencyKey || body.idempotency_key || ''),
  };
}

function normalizeDevManualTickInput(body) {
  return {
    roundKey: normalizeText(body.roundKey || DEV_ROUND_DEFAULTS.roundKey),
  };
}

function normalizeDevProofResetInput(body) {
  const roundKey = normalizeText(body.roundKey || DEV_ROUND_DEFAULTS.roundKey);
  const displayName = normalizeText(body.displayName || DEV_ROUND_DEFAULTS.displayName);

  if (roundKey !== DEV_ROUND_DEFAULTS.roundKey || displayName !== DEV_ROUND_DEFAULTS.displayName) {
    throw createServiceError(400, 'unsupported_proof_target', 'This reset endpoint only targets the shared DEV proof round for DEV Player One.');
  }

  return {
    roundKey,
    displayName,
  };
}

function clampDevBuildAmount(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 1;
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed)) {
    throw createServiceError(400, 'invalid_amount', 'Amount must be an integer between 1 and 10.');
  }

  return Math.min(10, Math.max(1, parsed));
}

function createServiceError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
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
  const recentActions = await fetchRows(
    'multiplayer_action_queue',
    'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
    (query) => query.eq('round_id', round.id).order('created_at', { ascending: false }).limit(8)
  );
  const recentTickLogs = await fetchRows(
    'multiplayer_tick_log',
    'id, round_id, tick, status, started_at, completed_at, summary, error_message, created_at, updated_at',
    (query) => query.eq('round_id', round.id).order('tick', { ascending: false }).limit(5)
  );
  const recentEvents = await fetchRows(
    'multiplayer_round_events',
    'id, round_id, tick, event_type, visibility, actor_player_id, target_player_id, alliance_id, title, body, payload, created_at',
    (query) => query.eq('round_id', round.id).eq('visibility', 'public').order('created_at', { ascending: false }).limit(5)
  );

  const stateByPlayerId = new Map(states.map((state) => [state.player_id, state]));
  const buildingsByPlayerId = groupRowsByKey(buildings, 'player_id');
  const armiesByPlayerId = groupRowsByKey(armies, 'player_id');
  const actionSummary = summarizeActionQueueRows(recentActions, round.current_tick);
  const formattedPlayers = players
    .map((player) => ({
      id: player.id,
      displayName: player.display_name,
      testerLabel: player.tester_label,
      state: formatState(stateByPlayerId.get(player.id)),
      buildings: formatBuildingRows(buildingsByPlayerId.get(player.id) || []),
      armies: formatArmyRows(armiesByPlayerId.get(player.id) || []),
      factoryCount: Math.max(
        0,
        Math.floor(
          Number(
            (buildingsByPlayerId.get(player.id) || []).find((row) => row.building_key === 'factory')?.effective_count ??
            (buildingsByPlayerId.get(player.id) || []).find((row) => row.building_key === 'factory')?.count ??
            0
          )
        )
      ),
    }))
    .sort((left, right) => {
      const leftTick = left.state?.tick ?? 0;
      const rightTick = right.state?.tick ?? 0;
      if (rightTick !== leftTick) {
        return rightTick - leftTick;
      }

      return left.displayName.localeCompare(right.displayName);
    });
  const totalFactoryCount = formattedPlayers.reduce((sum, player) => sum + Number(player.factoryCount || 0), 0);
  const recentPublicEventTitles = recentEvents.slice(0, 3).map((event) => event.title || event.event_type || 'Event');

  return {
    round: formatRound(round),
    players: formattedPlayers,
    recentActions: recentActions.map(formatActionQueue),
    recentTickLogs: recentTickLogs.map(formatTickLog),
    recentPublicEvents: recentEvents.map(formatEvent),
    recentEvents: recentEvents.map(formatEvent),
    actionSummary,
    roundSummary: {
      roundKey: round.round_key,
      roundName: round.round_name,
      roundStatus: round.status,
      currentTick: Number(round.current_tick || 0),
      playerCount: formattedPlayers.length,
      factoryCount: totalFactoryCount,
      queuedCount: actionSummary.queued,
      processedCount: actionSummary.processed,
      recentEventTitles: recentPublicEventTitles,
    },
  };
}

function summarizeActionQueueRows(rows = [], currentTick = 0) {
  const counts = rows.reduce((acc, row) => {
    const key = row.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {
    queued: 0,
    processing: 0,
    processed: 0,
    failed: 0,
    cancelled: 0,
    unknown: 0,
  });

  return {
    total: rows.length,
    queued: counts.queued,
    processing: counts.processing,
    processed: counts.processed,
    failed: counts.failed,
    cancelled: counts.cancelled,
    unknown: counts.unknown,
    dueNow: rows.filter((row) => row.status === 'queued' && Number(row.execute_after_tick ?? 0) <= Number(currentTick ?? 0)).length,
  };
}

async function buildDevFactoryAction(actionInput) {
  const { round, player } = await loadDevRoundPlayerContext(actionInput);

  const idempotencyKey = actionInput.idempotencyKey || null;
  if (idempotencyKey) {
    const existingAction = await fetchSingleRow(
      'multiplayer_action_queue',
      'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('action_type', 'dev_build_factory').eq('idempotency_key', idempotencyKey)
    );

    if (existingAction) {
      const existingResult = existingAction.result || {};
      const oldCount = Number(existingResult.old_count ?? existingResult.oldCount ?? existingAction.payload?.old_count ?? existingAction.payload?.oldCount ?? 0);
      const newCount = Number(existingResult.new_count ?? existingResult.newCount ?? existingAction.payload?.new_count ?? existingAction.payload?.newCount ?? oldCount);
      return {
        round: formatRound(round),
        player: formatPlayer(player),
        amount: Number(existingAction.payload?.amount ?? actionInput.amount),
        oldCount,
        newCount,
      };
    }
  }

  const buildingRow = await fetchSingleRow(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'factory')
  );
  const oldCount = Math.max(0, Math.floor(Number(buildingRow?.count ?? 0)));
  const amount = actionInput.amount;
  const newCount = oldCount + amount;
  const processedAt = nowIso();
  const actionPayload = {
    round_key: round.round_key,
    display_name: player.display_name,
    building_key: 'factory',
    amount,
    old_count: oldCount,
    new_count: newCount,
  };
  const actionResult = {
    amount,
    building_key: 'factory',
    old_count: oldCount,
    new_count: newCount,
  };
  const actionRow = await insertSingleRow('multiplayer_action_queue', {
    round_id: round.id,
    player_id: player.id,
    action_type: 'dev_build_factory',
    status: 'processed',
    requested_tick: round.current_tick,
    execute_after_tick: round.current_tick,
    payload: actionPayload,
    result: actionResult,
    idempotency_key: idempotencyKey,
    processed_at: processedAt,
    updated_at: processedAt,
  });

  try {
    await upsertRow('multiplayer_player_buildings', {
      round_id: round.id,
      player_id: player.id,
      building_key: 'factory',
      count: newCount,
      effective_count: newCount,
      updated_at: processedAt,
    }, 'player_id,round_id,building_key');

    const factoryWord = amount === 1 ? 'factory' : 'factories';

    await insertSingleRow('multiplayer_round_events', {
      round_id: round.id,
      tick: round.current_tick,
      event_type: 'dev_build_factory',
      visibility: 'public',
      actor_player_id: player.id,
      title: 'Factory built',
      body: `${player.display_name} built ${amount} ${factoryWord}.`,
      payload: actionResult,
    });

    await insertSingleRow('multiplayer_audit_log', {
      round_id: round.id,
      player_id: player.id,
      actor_type: 'dev',
      event_type: 'dev_build_factory',
      event_data: {
        round_id: round.id,
        round_key: round.round_key,
        player_id: player.id,
        display_name: player.display_name,
        action_queue_id: actionRow.id,
        building_key: 'factory',
        amount,
        old_count: oldCount,
        new_count: newCount,
      },
    });
  } catch (error) {
    await updateSingleRow('multiplayer_action_queue', {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unexpected build-factory failure.',
      updated_at: nowIso(),
    }, (query) => query.eq('id', actionRow.id)).catch(() => {});
    throw error;
  }

  return {
    round: formatRound(round),
    player: formatPlayer(player),
    amount,
    oldCount,
    newCount,
  };
}

async function queueDevFactoryAction(actionInput) {
  const { round, player } = await loadDevRoundPlayerContext(actionInput);

  const idempotencyKey = actionInput.idempotencyKey || null;
  if (idempotencyKey) {
    const existingAction = await fetchSingleRow(
      'multiplayer_action_queue',
      'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('action_type', 'dev_queue_build_factory').eq('idempotency_key', idempotencyKey)
    );

    if (existingAction) {
      return {
        round: formatRound(round),
        player: formatPlayer(player),
        previousTick: Number(round.current_tick || 0),
        requestedTick: Number(existingAction.requested_tick ?? round.current_tick ?? 0),
        executeAfterTick: Number(existingAction.execute_after_tick ?? Number(round.current_tick || 0) + 1),
        amount: Number(existingAction.payload?.amount ?? actionInput.amount ?? 1),
        action: formatActionQueue(existingAction),
      };
    }
  }

  const previousTick = Number(round.current_tick || 0);
  const requestedTick = previousTick;
  const executeAfterTick = previousTick + 1;
  const amount = actionInput.amount;
  const actionPayload = {
    buildingKey: 'factory',
    amount,
  };
  const queuedAt = nowIso();
  const actionRow = await insertSingleRow('multiplayer_action_queue', {
    round_id: round.id,
    player_id: player.id,
    action_type: 'dev_queue_build_factory',
    status: 'queued',
    requested_tick: requestedTick,
    execute_after_tick: executeAfterTick,
    payload: actionPayload,
    result: null,
    error_message: null,
    idempotency_key: idempotencyKey,
    processed_at: null,
    updated_at: queuedAt,
  });

  try {
    await insertSingleRow('multiplayer_round_events', {
      round_id: round.id,
      tick: requestedTick,
      event_type: 'dev_order_queued',
      visibility: 'public',
      actor_player_id: player.id,
      title: 'Build order queued',
      body: `${player.display_name} queued an order to build ${amount} ${amount === 1 ? 'factory' : 'factories'}.`,
      payload: {
        actionQueueId: actionRow.id,
        actionType: 'dev_queue_build_factory',
        buildingKey: 'factory',
        amount,
        requestedTick,
        executeAfterTick,
      },
    });

    await insertSingleRow('multiplayer_audit_log', {
      round_id: round.id,
      player_id: player.id,
      actor_type: 'dev',
      event_type: 'dev_queue_build_factory',
      event_data: {
        round_id: round.id,
        round_key: round.round_key,
        player_id: player.id,
        display_name: player.display_name,
        action_queue_id: actionRow.id,
        action_type: 'dev_queue_build_factory',
        building_key: 'factory',
        amount,
        requested_tick: requestedTick,
        execute_after_tick: executeAfterTick,
      },
    });
  } catch (error) {
    await updateSingleRow('multiplayer_action_queue', {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unexpected queue-build-factory failure.',
      updated_at: nowIso(),
    }, (query) => query.eq('id', actionRow.id)).catch(() => {});
    throw error;
  }

  return {
    round: formatRound(round),
    player: formatPlayer(player),
    previousTick,
    requestedTick,
    executeAfterTick,
    amount,
    action: {
      ...actionRow,
      payload: actionPayload,
      result: null,
    },
  };
}

async function runManualDevTick(tickInput) {
  const round = await fetchSingleRow('multiplayer_rounds', 'id, round_key, round_name, status, current_tick, created_at, updated_at, notes', (query) =>
    query.eq('round_key', tickInput.roundKey)
  );

  if (!round) {
    throw createServiceError(404, 'round_not_found', 'Shared Multiplayer DEV round has not been seeded yet.');
  }

  const previousTick = Number(round.current_tick || 0);
  const nextTick = previousTick + 1;
  const startedAt = nowIso();
  const existingTickLog = await fetchSingleRow(
    'multiplayer_tick_log',
    'id, round_id, tick, status, started_at, completed_at, summary, error_message, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('tick', nextTick)
  );

  let tickLogRow = existingTickLog;
  if (existingTickLog) {
    if (existingTickLog.status === 'running') {
      throw createServiceError(409, 'tick_in_progress', 'A manual DEV tick is already running for the next tick.');
    }

    if (existingTickLog.status === 'succeeded' || existingTickLog.status === 'replayed') {
      return {
        round: formatRound({ ...round, current_tick: nextTick }),
        previousTick,
        processed: {
          total: Number(existingTickLog.summary?.processedTotal ?? existingTickLog.summary?.processed_total ?? 0),
          factoryBuilds: Number(existingTickLog.summary?.factoryBuilds ?? existingTickLog.summary?.factory_builds ?? 0),
        },
      };
    }

    tickLogRow = await updateSingleRow('multiplayer_tick_log', {
      status: 'running',
      started_at: startedAt,
      completed_at: null,
      error_message: null,
      summary: {
        previousTick,
        currentTick: nextTick,
        resumed: true,
      },
      updated_at: startedAt,
    }, (query) => query.eq('id', existingTickLog.id));
  } else {
    tickLogRow = await insertSingleRow('multiplayer_tick_log', {
      round_id: round.id,
      tick: nextTick,
      status: 'running',
      started_at: startedAt,
      completed_at: null,
      summary: {
        previousTick,
        currentTick: nextTick,
        resumed: false,
      },
      error_message: null,
      updated_at: startedAt,
    });
  }

  const queuedActions = await fetchRows(
    'multiplayer_action_queue',
    'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('action_type', 'dev_queue_build_factory').eq('status', 'queued').lte('execute_after_tick', nextTick).order('created_at', { ascending: true })
  );

  let processedTotal = 0;
  let factoryBuilds = 0;
  const processedActionIds = [];
  const failedActionIds = [];

  for (const action of queuedActions) {
    const actionNow = nowIso();
    try {
      const actionAmount = clampDevBuildAmount(action.payload?.amount ?? 1);
      const player = await fetchSingleRow('multiplayer_players', 'id, display_name, tester_label, status, created_from_grant_id, created_at, updated_at, last_seen_at, notes', (query) =>
        query.eq('id', action.player_id)
      );

      if (!player) {
        throw createServiceError(404, 'player_not_found', 'Queued DEV action player was not found.');
      }

      const playerRound = await fetchSingleRow('multiplayer_player_rounds', 'id, player_id, round_id, role, status, joined_at, left_at, created_at, updated_at', (query) =>
        query.eq('round_id', round.id).eq('player_id', player.id).eq('status', 'active')
      );

      if (!playerRound) {
        throw createServiceError(409, 'player_not_joined', `${player.display_name} is not joined to the shared round.`);
      }

      await updateSingleRow('multiplayer_action_queue', {
        status: 'processing',
        updated_at: actionNow,
      }, (query) => query.eq('id', action.id));

      const buildingRow = await fetchSingleRow(
        'multiplayer_player_buildings',
        'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
        (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'factory')
      );
      const oldCount = Math.max(0, Math.floor(Number(buildingRow?.count ?? 0)));
      const newCount = oldCount + actionAmount;
      const processedAt = nowIso();
      const actionResult = {
        actionType: 'dev_queue_build_factory',
        buildingKey: 'factory',
        amount: actionAmount,
        oldCount,
        newCount,
        tick: nextTick,
      };

      await upsertRow('multiplayer_player_buildings', {
        round_id: round.id,
        player_id: player.id,
        building_key: 'factory',
        count: newCount,
        effective_count: newCount,
        updated_at: processedAt,
      }, 'player_id,round_id,building_key');

      await updateSingleRow('multiplayer_action_queue', {
        status: 'processed',
        result: actionResult,
        error_message: null,
        processed_at: processedAt,
        updated_at: processedAt,
      }, (query) => query.eq('id', action.id));

      await insertSingleRow('multiplayer_round_events', {
        round_id: round.id,
        tick: nextTick,
        event_type: 'dev_build_factory_processed',
        visibility: 'public',
        actor_player_id: player.id,
        title: 'Factory order completed',
        body: `${player.display_name} completed an order for ${actionAmount} ${actionAmount === 1 ? 'factory' : 'factories'}.`,
        payload: {
          actionQueueId: action.id,
          ...actionResult,
        },
      });

      await insertSingleRow('multiplayer_audit_log', {
        round_id: round.id,
        player_id: player.id,
        actor_type: 'dev',
        event_type: 'dev_build_factory_processed',
        event_data: {
          round_id: round.id,
          round_key: round.round_key,
          player_id: player.id,
          display_name: player.display_name,
          action_queue_id: action.id,
          action_type: 'dev_queue_build_factory',
          building_key: 'factory',
          amount: actionAmount,
          old_count: oldCount,
          new_count: newCount,
          tick: nextTick,
        },
      });

      processedTotal += 1;
      factoryBuilds += actionAmount;
      processedActionIds.push(action.id);
    } catch (error) {
      failedActionIds.push(action.id);
      await updateSingleRow('multiplayer_action_queue', {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unexpected manual tick failure.',
        updated_at: nowIso(),
      }, (query) => query.eq('id', action.id)).catch(() => {});

      await insertSingleRow('multiplayer_audit_log', {
        round_id: round.id,
        player_id: action.player_id,
        actor_type: 'dev',
        event_type: 'dev_build_factory_failed',
        event_data: {
          round_id: round.id,
          round_key: round.round_key,
          action_queue_id: action.id,
          action_type: 'dev_queue_build_factory',
          requested_tick: action.requested_tick,
          execute_after_tick: action.execute_after_tick,
          error_message: error instanceof Error ? error.message : 'Unexpected manual tick failure.',
        },
      }).catch(() => {});
    }
  }

  const completedAt = nowIso();
  await updateSingleRow('multiplayer_rounds', {
    current_tick: nextTick,
    updated_at: completedAt,
  }, (query) => query.eq('id', round.id));

  const tickSummary = {
    previousTick,
    currentTick: nextTick,
    processedTotal,
    factoryBuilds,
    failedTotal: failedActionIds.length,
    processedActionIds,
    failedActionIds,
  };

  await updateSingleRow('multiplayer_tick_log', {
    status: 'succeeded',
    completed_at: completedAt,
    summary: tickSummary,
    updated_at: completedAt,
  }, (query) => query.eq('id', tickLogRow.id));

  await insertSingleRow('multiplayer_audit_log', {
    round_id: round.id,
    actor_type: 'dev',
    event_type: 'dev_manual_tick',
    event_data: {
      round_id: round.id,
      round_key: round.round_key,
      previous_tick: previousTick,
      current_tick: nextTick,
      processed_total: processedTotal,
      factory_builds: factoryBuilds,
      failed_total: failedActionIds.length,
      tick_log_id: tickLogRow.id,
    },
  });

  return {
    round: formatRound({ ...round, current_tick: nextTick }),
    previousTick,
    processed: {
      total: processedTotal,
      factoryBuilds,
    },
  };
}

async function resetDevProofRound(resetInput) {
  const { round, player } = await loadDevRoundPlayerContext(resetInput);
  const resetAt = nowIso();
  const previousTick = Number(round.current_tick || 0);
  const factoryRow = await fetchSingleRow(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'factory')
  );
  const previousFactoryCount = Math.max(
    0,
    Math.floor(Number(factoryRow?.effective_count ?? factoryRow?.count ?? 0))
  );

  await upsertRow('multiplayer_player_buildings', {
    round_id: round.id,
    player_id: player.id,
    building_key: 'factory',
    count: 0,
    effective_count: 0,
    updated_at: resetAt,
  }, 'player_id,round_id,building_key');

  const queuedActions = await fetchRows(
    'multiplayer_action_queue',
    'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).in('status', ['queued', 'processing']).order('created_at', { ascending: true })
  );
  const cancelledActionIds = [];
  for (const action of queuedActions) {
    await updateSingleRow('multiplayer_action_queue', {
      status: 'cancelled',
      result: null,
      error_message: 'Cancelled by dev proof reset.',
      processed_at: null,
      updated_at: resetAt,
    }, (query) => query.eq('id', action.id));
    cancelledActionIds.push(action.id);
  }

  const tickLogs = await fetchRows(
    'multiplayer_tick_log',
    'id, round_id, tick, status, started_at, completed_at, summary, error_message, created_at, updated_at',
    (query) => query.eq('round_id', round.id).order('tick', { ascending: true })
  );
  const resetTickLogIds = [];
  for (const tickLog of tickLogs) {
    if (Number(tickLog.tick ?? 0) <= 0) {
      continue;
    }

    await updateSingleRow('multiplayer_tick_log', {
      status: 'queued',
      started_at: null,
      completed_at: null,
      summary: {
        ...(tickLog.summary && typeof tickLog.summary === 'object' ? tickLog.summary : {}),
        resetAt,
        resetReason: 'dev_proof_reset',
        previousStatus: tickLog.status || null,
        previousStartedAt: tickLog.started_at || null,
        previousCompletedAt: tickLog.completed_at || null,
      },
      error_message: null,
      updated_at: resetAt,
    }, (query) => query.eq('id', tickLog.id));
    resetTickLogIds.push(tickLog.id);
  }

  await updateSingleRow('multiplayer_rounds', {
    current_tick: 0,
    updated_at: resetAt,
  }, (query) => query.eq('id', round.id));

  await insertSingleRow('multiplayer_round_events', {
    round_id: round.id,
    tick: 0,
    event_type: DEV_PROOF_RESET_EVENT_TYPE,
    visibility: 'public',
    actor_player_id: player.id,
    title: 'Proof state reset',
    body: `${player.display_name} reset the Shared Multiplayer DEV proof state. Queued proof actions were cancelled and the next manual tick will start again at tick 1.`,
    payload: {
      roundKey: round.round_key,
      playerDisplayName: player.display_name,
      previousTick,
      resetTick: 0,
      previousFactoryCount,
      factoryCount: 0,
      cancelledActionCount: cancelledActionIds.length,
      resetTickLogCount: resetTickLogIds.length,
    },
  });

  await insertSingleRow('multiplayer_audit_log', {
    round_id: round.id,
    player_id: player.id,
    actor_type: 'dev',
    event_type: DEV_PROOF_RESET_EVENT_TYPE,
    event_data: {
      round_id: round.id,
      round_key: round.round_key,
      player_id: player.id,
      display_name: player.display_name,
      previous_tick: previousTick,
      reset_tick: 0,
      previous_factory_count: previousFactoryCount,
      reset_factory_count: 0,
      cancelled_action_ids: cancelledActionIds,
      reset_tick_log_ids: resetTickLogIds,
    },
  });

  return {
    round: formatRound({ ...round, current_tick: 0 }),
    player: {
      ...formatPlayer(player),
      factoryCount: 0,
    },
    previousTick,
    cancelledActionCount: cancelledActionIds.length,
    resetTickLogCount: resetTickLogIds.length,
    previousFactoryCount,
  };
}

async function loadDevRoundPlayerContext(actionInput) {
  const round = await fetchSingleRow('multiplayer_rounds', 'id, round_key, round_name, status, current_tick, created_at, updated_at, notes', (query) =>
    query.eq('round_key', actionInput.roundKey)
  );

  if (!round) {
    throw createServiceError(404, 'round_not_found', 'Shared Multiplayer DEV round has not been seeded yet.');
  }

  const player = await fetchSingleRow('multiplayer_players', 'id, display_name, tester_label, status, created_from_grant_id, created_at, updated_at, last_seen_at, notes', (query) =>
    query.eq('display_name', actionInput.displayName)
  );

  if (!player) {
    throw createServiceError(404, 'player_not_found', `DEV player ${actionInput.displayName} was not found in the shared round.`);
  }

  const playerRound = await fetchSingleRow('multiplayer_player_rounds', 'id, player_id, round_id, role, status, joined_at, left_at, created_at, updated_at', (query) =>
    query.eq('round_id', round.id).eq('player_id', player.id).eq('status', 'active')
  );

  if (!playerRound) {
    throw createServiceError(409, 'player_not_joined', `${actionInput.displayName} is not joined to the shared round.`);
  }

  return { round, player, playerRound };
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
    notes: `v0.41.95 dev seed round for ${seedInput.roundKey}`,
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
    notes: `v0.41.95 dev seed player for ${seedInput.roundKey}`,
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

async function updateSingleRow(tableName, values, filterFn) {
  const query = SUPABASE_CLIENT.from(tableName).update(values);
  const filtered = filterFn(query);
  const { data, error } = await filtered.select('*').single();

  if (error) {
    throw Object.assign(new Error(error.message), { code: error.code || 'supabase_update_failed' });
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

function formatActionQueue(action) {
  const payload = action.payload || {};
  const result = action.result || {};
  const amount = Number(result.amount ?? payload.amount ?? null);
  const oldCount = Number(result.oldCount ?? result.old_count ?? payload.oldCount ?? payload.old_count ?? null);
  const newCount = Number(result.newCount ?? result.new_count ?? payload.newCount ?? payload.new_count ?? null);

  return {
    id: action.id,
    actionType: action.action_type,
    status: action.status,
    requestedTick: action.requested_tick,
    executeAfterTick: action.execute_after_tick,
    processedAt: action.processed_at,
    createdAt: action.created_at,
    errorMessage: action.error_message || null,
    resultSummary: action.result ? {
      actionType: result.actionType || result.action_type || action.action_type,
      buildingKey: result.buildingKey || result.building_key || payload.buildingKey || payload.building_key || 'factory',
      amount: Number.isFinite(amount) ? amount : null,
      oldCount: Number.isFinite(oldCount) ? oldCount : null,
      newCount: Number.isFinite(newCount) ? newCount : null,
      tick: Number(result.tick ?? action.execute_after_tick ?? action.requested_tick ?? 0),
    } : null,
  };
}

function formatTickLog(row) {
  return {
    id: row.id,
    tick: row.tick,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: row.summary || null,
    errorMessage: row.error_message || null,
    createdAt: row.created_at,
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
