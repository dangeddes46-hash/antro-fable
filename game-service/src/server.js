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
const SERVICE_VERSION = 'v0.41.90';
const GAME_SERVICE_ENV = process.env.GAME_SERVICE_ENV || 'local';
const PORT = Number(process.env.PORT || 8790);
const RAW_ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '');
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

const app = express();
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, ALLOWED_ORIGINS.has(normalizeText(origin)));
  },
  methods: ['GET', 'OPTIONS'],
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
    notes: 'Read-only game-service skeleton. No gameplay mutations yet.',
    timestamp: nowIso(),
  });
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

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    error: 'not_found',
    message: 'Route not implemented in the v0.41.90 game-service skeleton.',
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
