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
const SERVICE_VERSION = 'v0.43.2';
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
  'invite_tokens',
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
    const inviteTokensCheck = await checkTableReachability('invite_tokens');
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
      dbReachable: dbReachable === null ? null : Boolean(dbReachable && inviteTokensCheck.reachable),
      schemaCheck: {
        multiplayer_rounds: roundCheck,
        invite_tokens: inviteTokensCheck,
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
        invite_tokens: {
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
    notes: 'Dev-only game-service skeleton. Seed/read proof endpoints, the queued-action/manual-tick proof, the proof-reset endpoint, the invite-grant identity resolver, and the hosted-round entry endpoint are temporary scaffolding.',
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

app.post('/api/dev/identity/resolve-player', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev identity resolver.',
        timestamp: nowIso(),
      });
      return;
    }

    const identityInput = normalizeDevIdentityInput(req.body || {});
    if (!identityInput.grantId) {
      res.status(400).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'identity_not_provided',
        message: 'Provide an active grantId to resolve a multiplayer identity.',
        timestamp: nowIso(),
      });
      return;
    }

    const result = await resolveDevPlayerIdentity(identityInput, { requireGrant: true });

    res.status(200).json({
      ok: true,
      roundKey: result.round.round_key,
      grantId: result.grantId || identityInput.grantId,
      accessLinkCreated: Boolean(result.accessLinkCreated),
      currentPlayerId: result.player.id,
      requestedDisplayNameIgnored: Boolean(result.requestedDisplayNameIgnored),
      requestedTesterLabelIgnored: Boolean(result.requestedTesterLabelIgnored),
      identity: {
        grantId: result.grantId || result.accessLink?.grant_id || identityInput.grantId,
        resolvedFrom: result.resolvedFrom,
        roundKey: result.round.round_key,
        roundName: result.round.round_name,
        roundStatus: result.round.status,
        currentTick: Number(result.round.current_tick || 0),
        currentPlayerId: result.player.id,
        playerId: result.player.id,
        displayName: result.player.display_name,
        testerLabel: result.player.tester_label,
        playerRoundId: result.playerRound?.id || null,
        requestedDisplayNameIgnored: Boolean(result.requestedDisplayNameIgnored),
        requestedTesterLabelIgnored: Boolean(result.requestedTesterLabelIgnored),
      },
      round: formatRound(result.round),
      player: {
        ...formatPlayer(result.player),
      },
      message: result.requestedDisplayNameIgnored || result.requestedTesterLabelIgnored
        ? `You are linked as ${result.player.display_name}. Requested labels were ignored in favor of the linked identity.`
        : `You are linked as ${result.player.display_name}.`,
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'resolve_identity_failed');
  }
});

app.post('/api/dev/hosted-round/enter', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the hosted round entry endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const hostedInput = normalizeHostedRoundEntryInput(req.body || {});
    if (!hostedInput.grantId) {
      res.status(400).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'identity_not_provided',
        message: 'Provide an active grantId to enter the hosted DEV round.',
        timestamp: nowIso(),
      });
      return;
    }

    const result = await readHostedRoundEntryState(hostedInput);

    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: GAME_SERVICE_ENV,
      accessLinkCreated: Boolean(result.accessLinkCreated),
      resolvedFrom: result.resolvedFrom,
      grantId: result.grantId,
      currentPlayerId: result.currentPlayerId || result.player?.id || null,
      round: result.round,
      player: result.player,
      playerState: result.playerState,
      buildings: result.buildings,
      armies: result.armies,
      science: result.science,
      factoryCount: result.factoryCount,
      queuedCount: result.queuedCount,
      processedCount: result.processedCount,
      actionSummary: result.actionSummary,
      recentEvents: result.recentEvents,
      otherPlayers: result.otherPlayers,
      roundSummary: result.roundSummary,
      proofBoundary: result.proofBoundary,
      canonicalState: result.canonicalState,
      currentPlayerSummary: result.currentPlayerSummary,
      message: `Hosted DEV round ready for ${result.player?.displayName || 'the selected player'}.`,
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'hosted_round_enter_failed');
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
      proofBoundary: summary.proofBoundary,
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
        buildingKey: result.buildingKey || 'factory',
        amount: result.amount,
        cost: result.cost ?? result.action.payload?.cost ?? null,
        requestedTick: result.requestedTick,
        executeAfterTick: result.executeAfterTick,
        durationTicks: result.durationTicks ?? null,
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
      message: 'Build order queued.',
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
    // Manual DEV ticks must come from a grant-linked identity; identityless
    // requests are rejected rather than run anonymously.
    await resolveDevPlayerIdentity(tickInput, { requireGrant: true });
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

app.post('/api/dev/actions/queue-train-units', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev queue-train-units endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const actionInput = normalizeDevTrainUnitsInput(req.body || {});
    const result = await queueDevTrainAction(actionInput);

    res.status(200).json({
      ok: true,
      action: {
        id: result.action.id,
        type: 'dev_queue_train_units',
        status: result.action.status,
        unitSlot: result.unitSlot,
        unitKey: result.unitKey,
        unitName: result.unitName,
        amount: result.amount,
        cost: result.cost,
        requestedTick: result.requestedTick,
        executeAfterTick: result.executeAfterTick,
        durationTicks: result.durationTicks ?? null,
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
      message: 'Training order queued.',
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'queue_train_units_failed');
  }
});

app.post('/api/dev/actions/queue-explore', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev queue-explore endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const actionInput = normalizeDevExploreInput(req.body || {});
    const result = await queueDevExploreAction(actionInput);

    res.status(200).json({
      ok: true,
      action: {
        id: result.action.id,
        type: 'dev_queue_explore',
        status: result.action.status,
        hours: result.hours,
        spend: result.spend,
        gain: result.gain,
        requestedTick: result.requestedTick,
        executeAfterTick: result.executeAfterTick,
        durationTicks: result.durationTicks ?? null,
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
      message: 'Exploration queued.',
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'queue_explore_failed');
  }
});

app.post('/api/dev/actions/queue-science', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev queue-science endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const actionInput = normalizeDevScienceInput(req.body || {});
    const result = await queueDevScienceAction(actionInput);

    res.status(200).json({
      ok: true,
      action: {
        id: result.action.id,
        type: 'dev_queue_science',
        status: result.action.status,
        field: result.field,
        fromLevel: result.fromLevel,
        toLevel: result.toLevel,
        requestedTick: result.requestedTick,
        executeAfterTick: result.executeAfterTick,
        durationTicks: result.durationTicks ?? null,
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
      message: 'Research order queued.',
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'queue_science_failed');
  }
});

app.post('/api/dev/actions/bank-deposit', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev bank-deposit endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const actionInput = normalizeDevBankInput(req.body || {});
    const result = await bankDepositAction(actionInput);

    res.status(200).json({
      ok: true,
      action: { type: 'dev_bank_deposit', requested: result.requested, deposited: result.deposited, money: result.money, banked: result.banked, bankCap: result.bankCap },
      round: { roundKey: result.round.round_key, currentTick: Number(result.round.current_tick || 0) },
      player: { displayName: result.player.display_name },
      message: `Deposited ${result.deposited} into your banks.`,
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'bank_deposit_failed');
  }
});

app.post('/api/dev/actions/bank-withdraw', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev bank-withdraw endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const actionInput = normalizeDevBankInput(req.body || {});
    const result = await bankWithdrawAction(actionInput);

    res.status(200).json({
      ok: true,
      action: { type: 'dev_bank_withdraw', requested: result.requested, withdrawn: result.withdrawn, money: result.money, banked: result.banked, bankCap: result.bankCap },
      round: { roundKey: result.round.round_key, currentTick: Number(result.round.current_tick || 0) },
      player: { displayName: result.player.display_name },
      message: `Withdrew ${result.withdrawn} from your banks.`,
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'bank_withdraw_failed');
  }
});

app.post('/api/dev/actions/complete-due', requireDevEndpoints, async (req, res) => {
  try {
    if (!SUPABASE_CONFIGURED || !SUPABASE_CLIENT) {
      res.status(503).json({
        ok: false,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        environment: GAME_SERVICE_ENV,
        error: 'supabase_not_configured',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using the dev complete-due endpoint.',
        timestamp: nowIso(),
      });
      return;
    }

    const completeInput = normalizeDevCompleteDueInput(req.body || {});
    // Completion is always scoped to the grant-linked player who visited the
    // screen; identityless requests are rejected.
    const identity = await resolveDevPlayerIdentity(completeInput, { requireGrant: true });
    const result = await completeDueOrdersForPlayer(identity, completeInput.screen);

    res.status(200).json({
      ok: true,
      screen: result.screen,
      completed: {
        total: result.completedTotal,
        actions: result.completedActions,
        failedActionIds: result.failedActionIds,
      },
      round: {
        roundKey: identity.round.round_key,
        currentTick: result.currentTick,
      },
      player: {
        displayName: identity.player.display_name,
      },
      message: result.completedTotal > 0
        ? `${result.completedTotal} finished ${result.completedTotal === 1 ? 'order' : 'orders'} completed.`
        : 'No finished orders were waiting.',
      timestamp: nowIso(),
    });
  } catch (error) {
    sendErrorResponse(res, error, 'complete_due_failed');
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
        resetPlayerCount: result.resetPlayerCount,
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
    if (actionInput.buildingKey !== 'factory') {
      throw createServiceError(400, 'invalid_building_key', 'The legacy immediate build-factory proof supports buildingKey "factory" only. Use the queued build order endpoint for other building types.');
    }
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
    message: 'Route not implemented in the v0.43.1 game-service skeleton.',
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
  const identity = normalizeDevIdentityInput(body);
  return {
    ...identity,
    buildingKey: normalizeDevBuildingKey(body.buildingKey ?? body.building_key),
    amount: clampDevBuildAmount(body.amount),
    idempotencyKey: normalizeText(body.idempotencyKey || body.idempotency_key || ''),
  };
}

function normalizeDevTrainUnitsInput(body) {
  const identity = normalizeDevIdentityInput(body);
  const rawSlot = body.unitSlot ?? body.unit_slot;
  const unitSlot = typeof rawSlot === 'number' ? rawSlot : Number(String(rawSlot ?? '').trim());
  if (!Number.isInteger(unitSlot) || unitSlot < 1 || unitSlot > DEV_UNIT_SLOT_KEYS.length) {
    throw createServiceError(400, 'invalid_unit_slot', `unitSlot must be an integer between 1 and ${DEV_UNIT_SLOT_KEYS.length}.`);
  }
  const rawAmount = body.amount;
  const amount = rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === ''
    ? 1
    : (typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount).trim()));
  if (!Number.isInteger(amount) || amount < 1) {
    throw createServiceError(400, 'invalid_amount', 'Training amount must be a positive integer.');
  }
  return {
    ...identity,
    unitSlot,
    amount,
    idempotencyKey: normalizeText(body.idempotencyKey || body.idempotency_key || ''),
  };
}

function normalizeDevExploreInput(body) {
  const identity = normalizeDevIdentityInput(body);
  const rawHours = body.hours ?? body.exploreHours;
  const hours = typeof rawHours === 'number' ? rawHours : Number(String(rawHours ?? '').trim());
  if (!Number.isInteger(hours) || hours < 1) {
    throw createServiceError(400, 'invalid_hours', 'Explore hours must be a whole number of at least 1.');
  }
  const rawSpend = body.spend ?? body.cards ?? body.money;
  const spend = typeof rawSpend === 'number' ? rawSpend : Number(String(rawSpend ?? '').trim());
  if (!Number.isInteger(spend) || spend < 1) {
    throw createServiceError(400, 'invalid_spend', 'Explore spend must be a positive whole number.');
  }
  return {
    ...identity,
    hours,
    spend,
    idempotencyKey: normalizeText(body.idempotencyKey || body.idempotency_key || ''),
  };
}

function normalizeDevScienceInput(body) {
  const identity = normalizeDevIdentityInput(body);
  const field = normalizeText(String(body.field ?? body.scienceKey ?? body.science_key ?? '')).toLowerCase();
  if (!DEV_SCIENCE_FIELDS.includes(field)) {
    throw createServiceError(400, 'invalid_science_field', `field must be one of: ${DEV_SCIENCE_FIELDS.join(', ')}.`);
  }
  return {
    ...identity,
    field,
    idempotencyKey: normalizeText(body.idempotencyKey || body.idempotency_key || ''),
  };
}

function normalizeDevBankInput(body) {
  const identity = normalizeDevIdentityInput(body);
  const rawAmount = body.amount ?? body.cards ?? body.money;
  const amount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount ?? '').trim());
  // Reference parseQty: only positive integers are valid amounts.
  if (!Number.isInteger(amount) || amount <= 0) {
    throw createServiceError(400, 'invalid_amount', 'Bank amount must be a positive whole number.');
  }
  return { ...identity, amount };
}

function normalizeDevManualTickInput(body) {
  const identity = normalizeDevIdentityInput(body);
  return {
    ...identity,
    roundKey: normalizeText(body.roundKey || DEV_ROUND_DEFAULTS.roundKey),
  };
}

function normalizeDevProofResetInput(body) {
  return normalizeDevIdentityInput(body);
}

function normalizeHostedRoundEntryInput(body) {
  const identity = normalizeDevIdentityInput(body);
  return {
    roundKey: normalizeText(body.roundKey || identity.roundKey || DEV_ROUND_DEFAULTS.roundKey),
    grantId: identity.grantId,
    testerLabel: identity.testerLabel,
    displayName: identity.displayName,
  };
}

function normalizeDevIdentityInput(body) {
  const requestedTesterLabel = normalizeDevTesterLabel(body.testerLabel || body.playerDisplayName || body.displayName || null);
  const requestedDisplayName = normalizeDevDisplayName(body.displayName || body.playerDisplayName || body.testerLabel || '', '');
  return {
    roundKey: normalizeText(body.roundKey || DEV_ROUND_DEFAULTS.roundKey),
    grantId: normalizeText(body.grantId || body.currentGrantId || body.accessGrant?.grantId || body.accessGrant?.currentGrantId || ''),
    testerLabel: requestedTesterLabel,
    displayName: requestedDisplayName || DEV_ROUND_DEFAULTS.displayName,
    requestedTesterLabel,
    requestedDisplayName: requestedDisplayName || null,
    hasRequestedTesterLabel: Boolean(requestedTesterLabel),
    hasRequestedDisplayName: Boolean(requestedDisplayName),
  };
}

function normalizeDevDisplayName(value, fallback = DEV_ROUND_DEFAULTS.displayName) {
  const text = normalizeText(String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' '));
  return text.slice(0, 80) || fallback;
}

function normalizeDevTesterLabel(value, fallback = null) {
  const text = normalizeText(String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' '));
  return text.slice(0, 128) || fallback || null;
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

const DEV_QUEUEABLE_BUILDING_KEYS = ['living_area', 'factory', 'barracks', 'bank', 'science_labs', 'nutrition_suppliers', 'water_purifiers', 'power_plants'];
const DEV_BUILDING_NOUNS = {
  living_area: ['living area', 'living areas'],
  factory: ['factory', 'factories'],
  barracks: ['barracks', 'barracks'],
  bank: ['bank', 'banks'],
  science_labs: ['science lab', 'science labs'],
  nutrition_suppliers: ['nutrition supplier', 'nutrition suppliers'],
  water_purifiers: ['water purifier', 'water purifiers'],
  power_plants: ['power plant', 'power plants'],
};

function devBuildingNoun(buildingKey, amount) {
  const nouns = DEV_BUILDING_NOUNS[buildingKey] || [String(buildingKey).replace(/_/g, ' '), `${String(buildingKey).replace(/_/g, ' ')}s`];
  return amount === 1 ? nouns[0] : nouns[1];
}

// A missing buildingKey stays valid and defaults to 'factory' so the pre-existing
// launcher proof panel (which never sends a buildingKey) keeps working. A PROVIDED
// key that is not one of the five canonical building types is rejected explicitly
// rather than silently coerced to factory.
function normalizeDevBuildingKey(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 'factory';
  }

  const key = normalizeText(String(value)).toLowerCase();
  if (!DEV_QUEUEABLE_BUILDING_KEYS.includes(key)) {
    throw createServiceError(400, 'invalid_building_key', `buildingKey must be one of: ${DEV_QUEUEABLE_BUILDING_KEYS.join(', ')}.`);
  }

  return key;
}

// ── Science reference port ────────────────────────────────────────────────────
// Seven research fields with per-field levels (default 0), stored one row per
// field in multiplayer_player_science, mirroring the buildings/armies row
// pattern. Field list from the local prototype's scienceLevels state (src/App.jsx).
// scienceLevelBonus(level) = 1 + level * 0.0005 (src/gameMath.js).
const DEV_SCIENCE_FIELDS = ['agriculture', 'combat', 'crime', 'housing', 'population', 'banking', 'turrets'];
function scienceLevelBonus(level) {
  return 1 + (Math.max(0, Math.floor(Number(level || 0))) * 0.0005);
}
// Extract a { field: level } map from science rows (raw snake_case or formatted).
function scienceLevelsFromRows(rows = []) {
  const levels = Object.fromEntries(DEV_SCIENCE_FIELDS.map((field) => [field, 0]));
  for (const row of rows) {
    const field = row.science_key ?? row.scienceKey ?? row.field;
    if (field && Object.prototype.hasOwnProperty.call(levels, field)) {
      levels[field] = Math.max(0, Math.floor(Number(row.level ?? 0)));
    }
  }
  return levels;
}

// ── Economy reference port ────────────────────────────────────────────────────
// Faithful port of the local prototype's per-tick economy formulas:
//   applyEconomyTickPure, calcCaps, supportedPopulationCap, productionPerTick,
//   calculateStarvationLoss                                  (src/App.jsx)
//   scienceLevelBonus(level) = 1 + level * 0.0005            (src/gameMath.js)
//   power plant energy = TURRET_CONFIG.powerPlantEnergyPerTick (src/gameData.js)
// Per the reference, each cap/production/growth term takes a SPECIFIC science
// field's bonus (documented per term below), not one blanket bonus. Levels come
// from the player's multiplayer_player_science rows; absent rows read as level 0
// (bonus 1). Server building keys are mapped onto the client building
// vocabulary; building types with no hosted rows contribute zero BY DATA, not by
// reinterpretation. Client fields with no hosted counterpart (rebels, banked,
// protectionHours) evaluate as zero, which makes the bank-interest term zero
// until a hosted banked balance exists.
const ECONOMY_POWER_PLANT_ENERGY_PER_TICK = 50;
// Starting money mirrors the reference round profile whose startingLand matches
// the hosted seed (land 1000): roundProfiles["Intro Game"].startingCards =
// 1,000,000 (src/gameData.js).
const ECONOMY_STARTING_MONEY = 1000000;
const ECONOMY_CLIENT_KEY_BY_SERVER_KEY = {
  living_area: 'living_areas',
  living_areas: 'living_areas',
  factory: 'factories',
  factories: 'factories',
  barracks: 'barracks',
  bank: 'banks',
  banks: 'banks',
  science_lab: 'science_labs',
  science_labs: 'science_labs',
  nutrition_supplier: 'nutrition_suppliers',
  nutrition_suppliers: 'nutrition_suppliers',
  water_purifier: 'water_purifiers',
  water_purifiers: 'water_purifiers',
  power_plant: 'power_plants',
  power_plants: 'power_plants',
  police_station: 'police_stations',
  police_stations: 'police_stations',
  mineral_extractor: 'mineral_extractors',
  mineral_extractors: 'mineral_extractors',
};
// Per-building base costs from the reference buildingOrder (src/gameData.js).
const ECONOMY_BUILDING_COST_BY_CLIENT_KEY = {
  water_purifiers: 250,
  mineral_extractors: 200,
  nutrition_suppliers: 200,
  missile_bases: 5000,
  impact_shields: 35000,
  living_areas: 300,
  police_stations: 500,
  factories: 500,
  blast_shields: 350,
  science_labs: 600,
  spy_stations: 1250,
  barracks: 1000,
  power_plants: 7500,
  turrets: 12500,
  star_wars: 5000,
  banks: 1250,
};

function economyBuildingCounts(buildingRows = []) {
  const counts = {};
  for (const row of buildingRows) {
    const clientKey = ECONOMY_CLIENT_KEY_BY_SERVER_KEY[row.building_key];
    if (!clientKey) continue;
    counts[clientKey] = (counts[clientKey] || 0) + Math.max(0, Math.floor(Number(row.effective_count ?? row.count ?? 0)));
  }
  return counts;
}
// Reference calcCaps (src/App.jsx): each cap takes a specific field's bonus —
// maxPop→housing, maxFed/maxWatered→agriculture, maxPoliced→crime, bankCap→banking.
function economyCalcCaps(b = {}, sci = {}) {
  return {
    maxPop: (b.living_areas || 0) * 150 * scienceLevelBonus(sci.housing),
    maxFed: (b.nutrition_suppliers || 0) * 250 * scienceLevelBonus(sci.agriculture),
    maxWatered: (b.water_purifiers || 0) * 400 * scienceLevelBonus(sci.agriculture),
    maxPoliced: (b.police_stations || 0) * 1000 * scienceLevelBonus(sci.crime),
    bankCap: (b.banks || 0) * 250000 * scienceLevelBonus(sci.banking),
  };
}
function economySupportedPopulationCap(c = {}) {
  return Math.max(0, Math.min(Number(c.maxPop || 0), Number(c.maxFed || 0), Number(c.maxWatered || 0)));
}
// Reference productionPerTick (src/App.jsx): food/water take agriculture; energy
// takes NO science bonus.
function economyProductionPerTick(b = {}, sci = {}) {
  return {
    food: (b.nutrition_suppliers || 0) * 5 * scienceLevelBonus(sci.agriculture),
    water: (b.water_purifiers || 0) * 8 * scienceLevelBonus(sci.agriculture),
    energy: (b.power_plants || 0) * ECONOMY_POWER_PLANT_ENERGY_PER_TICK,
  };
}
function economyStarvationLoss({ pop = 0, supportCap = 0, rawFood = 0, rawWater = 0, consumption = 0, tickEquivalent = 1 }) {
  const currentPop = Math.max(0, Number(pop) || 0);
  if (currentPop <= 0) return 0;
  const ticks = Math.max(0, Number(tickEquivalent) || 0);
  const excess = Math.max(0, currentPop - Math.max(0, Number(supportCap) || 0));
  const supportAttrition = excess * Math.min(1, 0.10 * ticks);
  const denom = Math.max(1, Math.abs(Number(consumption) || 0));
  const foodShortage = rawFood < 0 ? Math.min(1, Math.abs(rawFood) / denom) : 0;
  const waterShortage = rawWater < 0 ? Math.min(1, Math.abs(rawWater) / denom) : 0;
  const shortageSeverity = Math.max(foodShortage, waterShortage);
  const stockpileAttrition = currentPop * shortageSeverity * Math.min(0.25, 0.05 * ticks);
  return Math.min(currentPop, Math.floor(supportAttrition + stockpileAttrition));
}
// Reference applyEconomyTickPure (src/App.jsx): popGain and the pop*2 tax income
// both take the population field's bonus; consumption takes none. Bank interest
// takes the banking field's bonus: interest accrues on the banked balance, the
// portion that fits under the (banking-scaled) bank cap is auto-deposited, and
// the remainder lands in on-hand money.
function computeEconomyTick(stateRow, buildingRows = [], armyRows = [], sci = {}) {
  const b = economyBuildingCounts(buildingRows);
  const c = economyCalcCaps(b, sci);
  const supportCap = economySupportedPopulationCap(c);
  const p = economyProductionPerTick(b, sci);
  const armyUnits = (armyRows || []).reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.count || 0))), 0);
  const currentPop = Math.max(0, Number(stateRow.population || 0));
  const banked = Math.max(0, Number(stateRow.banked || 0));
  const popGain = Math.floor(Math.max(0, supportCap - currentPop - 0) * 0.015 * scienceLevelBonus(sci.population));
  const consumption = Math.floor((currentPop + 0 + armyUnits) * 0.02);
  const rawFood = Number(stateRow.food || 0) + p.food - consumption;
  const rawWater = Number(stateRow.water || 0) + p.water - consumption;
  const interest = Math.floor(banked * 0.0010415 * scienceLevelBonus(sci.banking));
  const toBank = Math.min(Math.max(0, c.bankCap - banked), interest);
  let nextPop = currentPop + popGain;
  const starvationLoss = economyStarvationLoss({ pop: nextPop, supportCap, rawFood, rawWater, consumption, tickEquivalent: 1 });
  nextPop = Math.max(0, nextPop - starvationLoss);
  return {
    population: nextPop,
    money: Number(stateRow.money || 0) + currentPop * 2 * scienceLevelBonus(sci.population) + (interest - toBank),
    banked: banked + toBank,
    food: Math.max(0, rawFood),
    water: Math.max(0, rawWater),
    energy: Math.max(0, Number(stateRow.energy || 0) + p.energy),
    starvationLoss,
  };
}
function devBuildingCost(buildingKey, amount) {
  const clientKey = ECONOMY_CLIENT_KEY_BY_SERVER_KEY[buildingKey] || buildingKey;
  const unitCost = ECONOMY_BUILDING_COST_BY_CLIENT_KEY[clientKey];
  if (!Number.isFinite(unitCost)) {
    throw createServiceError(400, 'invalid_building_key', `No reference cost exists for buildingKey "${buildingKey}".`);
  }
  return unitCost * Math.max(1, Math.floor(Number(amount) || 1));
}

// ── Order timing reference port ───────────────────────────────────────────────
// One hosted round tick represents 30 in-game minutes = 1800 game-seconds, the
// same tick base the local prototype uses (src/gameMath.js SCIENCE_TICK_SECONDS
// and dueGameTicks). Order durations come from the reference formulas:
//   constructionDurationSeconds(cost, buildings, allocation)   (src/gameMath.js)
//   CONSTRUCTION_FACTORY_CURVE                                 (src/gameMath.js)
// The hosted round has no factory-allocation state, so the reference client
// default (construction: "100") applies and every factory counts toward the
// curve. Speed factors and species construction bonuses are not hosted state
// and stay at their neutral reference values (factor 1 / multiplier 1).
const ORDER_TICK_GAME_SECONDS = 1800;
const ORDER_CONSTRUCTION_FACTORY_CURVE = [
  [0, 1],
  [500, 3],
  [1000, 5],
  [2000, 9],
  [4000, 13],
  [8000, 19],
  [16000, 25],
  [32000, 33],
];
function orderConstructionFactoryMultiplier(factories) {
  const effective = Math.max(0, Number(factories) || 0);
  if (effective <= 0) return 1;
  for (let i = 1; i < ORDER_CONSTRUCTION_FACTORY_CURVE.length; i += 1) {
    const [prevFactories, prevMultiplier] = ORDER_CONSTRUCTION_FACTORY_CURVE[i - 1];
    const [nextFactories, nextMultiplier] = ORDER_CONSTRUCTION_FACTORY_CURVE[i];
    if (effective <= nextFactories) {
      const span = nextFactories - prevFactories;
      const progress = span > 0 ? (effective - prevFactories) / span : 0;
      return prevMultiplier + ((nextMultiplier - prevMultiplier) * progress);
    }
  }
  const [lastFactories, lastMultiplier] = ORDER_CONSTRUCTION_FACTORY_CURVE[ORDER_CONSTRUCTION_FACTORY_CURVE.length - 1];
  return lastMultiplier + ((effective - lastFactories) / 8000);
}
function orderConstructionDurationSeconds(cost, factories) {
  return (Number(cost) || 0) / 4 / orderConstructionFactoryMultiplier(factories);
}
function orderTicksFromGameSeconds(seconds) {
  return Math.max(1, Math.ceil((Number(seconds) || 0) / ORDER_TICK_GAME_SECONDS));
}

// ── Training reference port ───────────────────────────────────────────────────
// Verbatim from src/gameData.js `races`: per-race maxTrain (the per-order
// training cap without speed minerals — src/speciesBonuses.js
// effectiveMaxTrainForRow base) and the six unit classes with off/def/cost.
// Army storage is race-agnostic slot rows (unit_1..unit_6); the race is resolved
// at read time from multiplayer_player_state.race_key with the reference
// fallback (races[raceKey] || races.human). returning_count is dormant: combat
// returns survivors immediately in this game's model, so it belongs to the
// future combat slice and stays zero here.
const DEV_UNIT_SLOT_KEYS = ['unit_1', 'unit_2', 'unit_3', 'unit_4', 'unit_5', 'unit_6'];
const DEV_RACE_UNIT_STATS = {
  lithi: { name: "Li'thi", maxTrain: 1999, unitStats: [
    { name: 'Laveti', off: 3, def: 3, cost: 6 }, { name: "Orph'irges", off: 8, def: 6, cost: 14 }, { name: 'Missile tanks', off: 241, def: 220, cost: 461 }, { name: 'Soul Divers', off: 165, def: 180, cost: 345 }, { name: 'Incabusers', off: 267, def: 292, cost: 559 }, { name: 'Black parroths', off: 686, def: 661, cost: 1347 },
  ] },
  human: { name: 'Human', maxTrain: 1299, unitStats: [
    { name: 'Troopers', off: 2, def: 2, cost: 4 }, { name: 'Laser Tanks', off: 117, def: 128, cost: 245 }, { name: 'Missile Forces', off: 17, def: 17, cost: 34 }, { name: 'Shuttles', off: 328, def: 310, cost: 638 }, { name: 'Star cruisers', off: 645, def: 662, cost: 1307 }, { name: 'Air forces', off: 399, def: 448, cost: 847 },
  ] },
  zarth: { name: 'Zarth', maxTrain: 2499, unitStats: [
    { name: 'Nemesi', off: 4, def: 4, cost: 8 }, { name: 'Flying parroths', off: 25, def: 23, cost: 48 }, { name: 'Zolanith', off: 53, def: 48, cost: 101 }, { name: 'Poiteruns', off: 249, def: 215, cost: 464 }, { name: 'Zovotor', off: 264, def: 238, cost: 502 }, { name: "P'inska", off: 331, def: 293, cost: 624 },
  ] },
  trysaur: { name: 'Trysaur', maxTrain: 1749, unitStats: [
    { name: 'Arphages', off: 3, def: 3, cost: 6 }, { name: "In'aburs", off: 132, def: 136, cost: 268 }, { name: 'Implatinons', off: 113, def: 110, cost: 223 }, { name: 'Fortavi', off: 227, def: 221, cost: 448 }, { name: 'Pascortha', off: 187, def: 197, cost: 384 }, { name: 'Silvato', off: 839, def: 822, cost: 1661 },
  ] },
  relu: { name: "Re'lu", maxTrain: 2499, unitStats: [
    { name: 'Ithica', off: 9, def: 8, cost: 17 }, { name: "Posi'stra", off: 40, def: 38, cost: 78 }, { name: "Eph'fo", off: 108, def: 110, cost: 218 }, { name: 'Ahtribio', off: 231, def: 225, cost: 456 }, { name: 'Aourthi', off: 269, def: 268, cost: 537 }, { name: "Pa'sik", off: 568, def: 559, cost: 1127 },
  ] },
};
function devRaceUnitStats(raceKey) {
  return DEV_RACE_UNIT_STATS[normalizeText(String(raceKey || '')).toLowerCase()] || DEV_RACE_UNIT_STATS.human;
}
function orderBarracksTrainingMultiplier(barracks) {
  const b = Math.max(0, Number(barracks) || 0);
  if (b <= 1000) return 1 + b / 1000;
  if (b <= 4000) return 2 + ((b - 1000) / 3000) * 2;
  return 4;
}
// trainingDurationSeconds (src/gameMath.js) with the species/speed-mineral
// divider at its neutral reference value 1 (no hosted species bonuses yet).
function orderTrainingDurationSeconds(cost, barracks) {
  const fullSpeedSeconds = ((Number(cost) || 0) / 10862.90322580645) * 60;
  return fullSpeedSeconds * (4 / orderBarracksTrainingMultiplier(barracks));
}

// ── Explore reference port ────────────────────────────────────────────────────
// estimateExploreGain (src/App.jsx): gain = max(1, floor(120 * sqrt(hours) *
// sqrt(max(0.01, spend/1,000,000)) * sqrt(1000 / max(1000, land)) * scannerBonus)).
// Scanners are not hosted state; scannerExploreMultiplier (src/App.jsx) returns
// exactly 1 at zero scanners, so the bonus term is 1 BY DATA, not by
// reinterpretation. Explore duration is hours * 3600 game-seconds (local
// startExplore: finishAt = now + realMillisecondsForGameSeconds(hours * 3600)).
// The local single-order-at-a-time rule is not enforced hosted-side, matching
// the stacking behaviour already established for build and training orders.
function orderExploreGain(hours, spend, landNow) {
  const h = Math.max(1, Math.floor(Number(hours) || 0));
  const cardFactor = Math.sqrt(Math.max(0.01, spend / 1000000));
  const landPenalty = Math.sqrt(1000 / Math.max(1000, landNow));
  const scannerBonus = 1;
  return Math.max(1, Math.floor(120 * Math.sqrt(h) * cardFactor * landPenalty * scannerBonus));
}

// ── Science duration reference port ───────────────────────────────────────────
// scienceDurationSeconds / scienceLabMultiplier and their constants, verbatim
// from src/gameMath.js. Research has NO card cost (local startScienceResearch
// logs "spent 0 cards"); the only gate is science_labs > 0 and one order per
// field. Duration depends on the field's CURRENT level (research goes to
// currentLevel + 1). Science labs use the same 0/1k/4k curve as barracks.
const SCIENCE_TICK_SECONDS = 1800;
const SCIENCE_IG_TARGET_LEVEL = 180;
const SCIENCE_IG_TARGET_TICKS = 90 * 24 * 2;
const SCIENCE_IG_SUM_SQUARES = SCIENCE_IG_TARGET_LEVEL * (SCIENCE_IG_TARGET_LEVEL + 1) * (2 * SCIENCE_IG_TARGET_LEVEL + 1) / 6;
const SCIENCE_QUADRATIC_TICK_COEFFICIENT = (SCIENCE_IG_TARGET_TICKS * 4) / SCIENCE_IG_SUM_SQUARES;
function orderScienceLabMultiplier(scienceLabs) {
  const labs = Math.max(0, Number(scienceLabs) || 0);
  if (labs <= 1000) return 1 + labs / 1000;
  if (labs <= 4000) return 2 + ((labs - 1000) / 3000) * 2;
  return 4;
}
function orderScienceDurationSeconds(currentLevel, scienceLabs) {
  const nextLevel = Math.max(1, Math.floor(Number(currentLevel || 0)) + 1);
  const baselineTicks = SCIENCE_QUADRATIC_TICK_COEFFICIENT * nextLevel * nextLevel;
  return Math.max(1, Math.floor((baselineTicks * SCIENCE_TICK_SECONDS) / orderScienceLabMultiplier(scienceLabs)));
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
  const science = await getOrCreatePlayerScience(round.row.id, player.row.id);
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
  const activeAccessLinks = playerIds.length > 0
    ? await fetchRows(
        'multiplayer_player_access_links',
        'id, player_id, access_type, invite_token_id, grant_id, token_hash_prefix, provider, status, issued_at, revoked_at, created_at, updated_at, notes',
        (query) => query.in('player_id', playerIds).eq('status', 'active').order('created_at', { ascending: true }).order('id', { ascending: true })
      )
    : [];
  const states = playerIds.length > 0
    ? await fetchRows(
        'multiplayer_player_state',
        'id, player_id, round_id, tick, state_version, race_key, land, power, money, banked, energy, food, water, population, created_at, updated_at',
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
  const science = playerIds.length > 0
    ? await fetchRows(
        'multiplayer_player_science',
        'id, player_id, round_id, science_key, level, created_at, updated_at',
        (query) => query.eq('round_id', round.id).in('player_id', playerIds)
      )
    : [];
  const latestResetEvent = await fetchSingleRow(
    'multiplayer_round_events',
    'id, round_id, tick, event_type, visibility, actor_player_id, target_player_id, alliance_id, title, body, payload, created_at',
    (query) => query.eq('round_id', round.id).eq('event_type', DEV_PROOF_RESET_EVENT_TYPE).order('created_at', { ascending: false })
  );
  const proofBoundaryAt = latestResetEvent?.created_at || null;
  const isVisibleAfterBoundary = (createdAt) => isAfterProofBoundary(createdAt, proofBoundaryAt);
  const actionRows = await fetchRows(
    'multiplayer_action_queue',
    'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
    (query) => query.eq('round_id', round.id).order('created_at', { ascending: false })
  );
  const visibleActionRows = actionRows.filter((row) => isVisibleAfterBoundary(row.created_at));
  const recentActions = visibleActionRows.slice(0, 8);
  const tickLogs = await fetchRows(
    'multiplayer_tick_log',
    'id, round_id, tick, status, started_at, completed_at, summary, error_message, created_at, updated_at',
    (query) => query.eq('round_id', round.id).order('tick', { ascending: false })
  );
  const recentTickLogs = tickLogs.filter((row) => isVisibleAfterBoundary(row.created_at)).slice(0, 5);
  const events = await fetchRows(
    'multiplayer_round_events',
    'id, round_id, tick, event_type, visibility, actor_player_id, target_player_id, alliance_id, title, body, payload, created_at',
    (query) => query.eq('round_id', round.id).eq('visibility', 'public').order('created_at', { ascending: false })
  );
  const recentEvents = events.filter((row) => isVisibleAfterBoundary(row.created_at)).slice(0, 5);

  const stateByPlayerId = new Map(states.map((state) => [state.player_id, state]));
  const buildingsByPlayerId = groupRowsByKey(buildings, 'player_id');
  const armiesByPlayerId = groupRowsByKey(armies, 'player_id');
  const scienceByPlayerId = groupRowsByKey(science, 'player_id');
  const accessLinkByPlayerId = new Map(activeAccessLinks.map((link) => [link.player_id, link]));
  const actionsByPlayerId = groupRowsByKey(visibleActionRows, 'player_id');
  const canonicalActionRows = accessLinkByPlayerId.size > 0
    ? visibleActionRows.filter((row) => accessLinkByPlayerId.has(row.player_id))
    : visibleActionRows;
  const actionSummary = summarizeActionQueueRows(canonicalActionRows, round.current_tick);
  const formattedPlayers = players
    .map((player) => ({
      id: player.id,
      displayName: player.display_name,
      testerLabel: player.tester_label,
      grantId: accessLinkByPlayerId.get(player.id)?.grant_id || player.created_from_grant_id || null,
      accessLinkId: accessLinkByPlayerId.get(player.id)?.id || null,
      isGrantLinked: Boolean(accessLinkByPlayerId.get(player.id)),
      identityScope: accessLinkByPlayerId.get(player.id) ? 'canonical' : player.created_from_grant_id ? 'legacy' : 'diagnostic',
      queuedCount: (() => {
        const playerActionSummary = summarizeActionQueueRows(actionsByPlayerId.get(player.id) || [], round.current_tick);
        return playerActionSummary.queued + playerActionSummary.processing;
      })(),
      processedCount: (() => {
        const playerActionSummary = summarizeActionQueueRows(actionsByPlayerId.get(player.id) || [], round.current_tick);
        return playerActionSummary.processed;
      })(),
      state: formatState(stateByPlayerId.get(player.id)),
      buildings: formatBuildingRows(buildingsByPlayerId.get(player.id) || []),
      armies: formatArmyRows(armiesByPlayerId.get(player.id) || []),
      science: formatScienceRows(scienceByPlayerId.get(player.id) || []),
      factoryCount: canonicalCountFromRows((buildingsByPlayerId.get(player.id) || []).filter((row) => row.building_key === 'factory')),
    }))
    .sort((left, right) => {
      const leftCanonical = left.isGrantLinked ? 0 : 1;
      const rightCanonical = right.isGrantLinked ? 0 : 1;
      if (leftCanonical !== rightCanonical) {
        return leftCanonical - rightCanonical;
      }

      const leftTick = left.state?.tick ?? 0;
      const rightTick = right.state?.tick ?? 0;
      if (rightTick !== leftTick) {
        return rightTick - leftTick;
      }

      return left.displayName.localeCompare(right.displayName);
    });
  const canonicalPlayers = formattedPlayers.filter((player) => player.isGrantLinked);
  const totalFactoryCount = (canonicalPlayers.length > 0 ? canonicalPlayers : formattedPlayers).reduce((sum, player) => sum + Number(player.factoryCount || 0), 0);
  const recentPublicEventTitles = recentEvents.slice(0, 3).map((event) => event.title || event.event_type || 'Event');

  return {
    round: formatRound(round),
    players: formattedPlayers,
    recentActions: recentActions.map(formatActionQueue),
    recentTickLogs: recentTickLogs.map(formatTickLog),
    recentPublicEvents: recentEvents.map(formatEvent),
    recentEvents: recentEvents.map(formatEvent),
    actionSummary,
    proofBoundary: {
      latestResetAt: proofBoundaryAt,
      latestResetEvent: latestResetEvent ? formatEvent(latestResetEvent) : null,
    },
    roundSummary: {
      roundKey: round.round_key,
      roundName: round.round_name,
      roundStatus: round.status,
      currentTick: Number(round.current_tick || 0),
      playerCount: formattedPlayers.length,
      canonicalPlayerCount: canonicalPlayers.length,
      legacyPlayerCount: Math.max(0, formattedPlayers.length - canonicalPlayers.length),
      factoryCount: totalFactoryCount,
      queuedCount: actionSummary.queued,
      processedCount: actionSummary.processed,
      latestResetAt: proofBoundaryAt,
      latestResetEventId: latestResetEvent?.id || null,
      recentEventTitles: recentPublicEventTitles,
    },
  };
}

async function readHostedRoundEntryState(hostedInput) {
  const identity = await resolveDevPlayerIdentity(hostedInput, { requireGrant: true });
  const summary = await readDevRoundSummary(identity.round.round_key);

  if (!summary) {
    throw createServiceError(404, 'round_not_found', 'Shared Multiplayer DEV round has not been seeded yet.');
  }

  const currentPlayer = summary.players.find((player) => player.id === identity.player.id) || null;
  const boundaryAt = summary.proofBoundary?.latestResetAt || null;
  const actionRows = await fetchRows(
    'multiplayer_action_queue',
    'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
    (query) => query.eq('round_id', identity.round.id).eq('player_id', identity.player.id).order('created_at', { ascending: false })
  );
  const visibleActionRows = actionRows.filter((row) => isAfterProofBoundary(row.created_at, boundaryAt));
  const actionSummary = summarizeActionQueueRows(visibleActionRows, Number(identity.round.current_tick || 0));
  const currentPlayerState = normalizeHostedPlayerState(currentPlayer?.state);
  const currentPlayerBuildings = normalizeHostedBuildingSummary(currentPlayer?.buildings || []);
  const currentPlayerArmies = normalizeHostedArmySummary(currentPlayer?.armies || []);
  const currentPlayerScience = normalizeHostedScienceSummary(currentPlayer?.science || []);
  const currentPlayerFactoryCount = Math.max(0, Math.floor(Number(currentPlayerBuildings.counts.factory || 0)));
  const currentPlayerQueuedCount = Math.max(0, Math.floor(Number(actionSummary.queued + actionSummary.processing || 0)));
  const currentPlayerProcessedCount = Math.max(0, Math.floor(Number(actionSummary.processed || 0)));
  const currentPlayerSummary = currentPlayer ? compactHostedPlayerSummary(currentPlayer) : {
    id: identity.player.id,
    displayName: identity.player.display_name,
    testerLabel: identity.player.tester_label,
    playerRoundId: identity.playerRound?.id || null,
    grantId: identity.grantId || null,
    accessLinkId: identity.accessLink?.id || null,
    identityScope: 'canonical',
    isGrantLinked: true,
    currentTick: Number(identity.round.current_tick || 0),
    raceKey: currentPlayerState.raceKey,
    land: currentPlayerState.land,
    power: currentPlayerState.power,
    factoryCount: currentPlayerFactoryCount,
    queuedCount: currentPlayerQueuedCount,
    processedCount: currentPlayerProcessedCount,
  };
  if (currentPlayerSummary && !currentPlayerSummary.playerRoundId) {
    currentPlayerSummary.playerRoundId = identity.playerRound?.id || currentPlayer?.playerRoundId || currentPlayer?.player_round_id || null;
  }
  currentPlayerSummary.factoryCount = currentPlayerFactoryCount;
  currentPlayerSummary.queuedCount = currentPlayerQueuedCount;
  currentPlayerSummary.processedCount = currentPlayerProcessedCount;

  return {
    grantId: identity.grantId || hostedInput.grantId,
    currentPlayerId: identity.currentPlayerId || identity.player.id,
    resolvedFrom: identity.resolvedFrom,
    accessLinkCreated: Boolean(identity.accessLinkCreated),
    round: formatRound(identity.round),
    player: formatPlayer(identity.player),
    playerState: currentPlayerState,
    buildings: currentPlayerBuildings,
    armies: currentPlayerArmies,
    science: currentPlayerScience,
    factoryCount: currentPlayerFactoryCount,
    queuedCount: currentPlayerQueuedCount,
    processedCount: currentPlayerProcessedCount,
    actionSummary: {
      total: actionSummary.total,
      queued: actionSummary.queued + actionSummary.processing,
      queuedRows: actionSummary.queued,
      processing: actionSummary.processing,
      processed: actionSummary.processed,
      dueNow: actionSummary.dueNow,
      failed: actionSummary.failed,
      cancelled: actionSummary.cancelled,
      unknown: actionSummary.unknown,
    },
    recentEvents: summary.recentEvents,
    otherPlayers: summary.players
      .filter((player) => player.id !== identity.player.id)
      .map(compactHostedPlayerSummary),
    roundSummary: summary.roundSummary,
    proofBoundary: summary.proofBoundary,
    canonicalState: {
      round: formatRound(identity.round),
      player: formatPlayer(identity.player),
      currentPlayerId: identity.currentPlayerId || identity.player.id,
      playerState: currentPlayerState,
      buildings: currentPlayerBuildings,
      armies: currentPlayerArmies,
      science: currentPlayerScience,
      actionSummary: {
        total: actionSummary.total,
        queued: actionSummary.queued + actionSummary.processing,
        queuedRows: actionSummary.queued,
        processing: actionSummary.processing,
        processed: actionSummary.processed,
        dueNow: actionSummary.dueNow,
      },
      otherPlayers: summary.players
        .filter((player) => player.id !== identity.player.id)
        .map(compactHostedPlayerSummary),
      currentTick: Number(identity.round.current_tick || 0),
      roundSummary: summary.roundSummary,
    },
    currentPlayerSummary,
  };
}

function isAfterProofBoundary(createdAt, boundaryAt) {
  if (!boundaryAt) {
    return true;
  }

  return compareIsoTimestamps(createdAt, boundaryAt) >= 0;
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

function compareIsoTimestamps(left, right) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) {
    return 0;
  }

  if (!Number.isFinite(leftTime)) {
    return -1;
  }

  if (!Number.isFinite(rightTime)) {
    return 1;
  }

  if (leftTime === rightTime) {
    return 0;
  }

  return leftTime > rightTime ? 1 : -1;
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

  const buildingRows = await fetchRows(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'factory')
  );
  const oldCount = canonicalCountFromRows(buildingRows);
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
  // Queued canonical build orders must belong to a grant-linked player. Requests
  // without an identity are rejected instead of being attributed to the default
  // DEV proof player.
  const identity = await resolveDevPlayerIdentity(actionInput, { requireGrant: true });
  const { round, player } = identity;

  const buildingKey = actionInput.buildingKey || 'factory';
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
        buildingKey: existingAction.payload?.buildingKey || existingAction.payload?.building_key || 'factory',
        action: formatActionQueue(existingAction),
      };
    }
  }

  const previousTick = Number(round.current_tick || 0);
  const requestedTick = previousTick;
  const amount = actionInput.amount;

  // Build orders debit the reference building cost at queue time, mirroring the
  // local prototype, which charges Cardisium when construction starts.
  const cost = devBuildingCost(buildingKey, amount);

  // Real construction duration from the reference formula: factories assigned to
  // construction (hosted default: all of them) accelerate the build. The order
  // becomes due ("finished") once the round reaches executeAfterTick, but it is
  // only applied when the player visits the Build screen (complete-due).
  const factoryRows = await fetchRows(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'factory')
  );
  const factoryCount = canonicalCountFromRows(factoryRows);
  const durationSeconds = orderConstructionDurationSeconds(cost, factoryCount);
  const durationTicks = orderTicksFromGameSeconds(durationSeconds);
  const executeAfterTick = previousTick + durationTicks;
  const stateResult = await getOrCreatePlayerState(round.id, player.id);
  const stateRow = stateResult.row;
  const availableMoney = Number(stateRow.money || 0);
  if (availableMoney < cost) {
    throw createServiceError(400, 'insufficient_funds', `Not enough money for that build order: it costs ${cost} and ${availableMoney} is available.`);
  }
  const debitedAt = nowIso();
  await updateSingleRow('multiplayer_player_state', {
    money: availableMoney - cost,
    state_version: Number(stateRow.state_version || 0) + 1,
    updated_at: debitedAt,
  }, (query) => query.eq('id', stateRow.id));
  const refundDebit = async () => {
    const freshState = await fetchSingleRow(
      'multiplayer_player_state',
      'id, player_id, round_id, state_version, money, created_at, updated_at',
      (query) => query.eq('id', stateRow.id)
    ).catch(() => null);
    if (!freshState) return;
    await updateSingleRow('multiplayer_player_state', {
      money: Number(freshState.money || 0) + cost,
      state_version: Number(freshState.state_version || 0) + 1,
      updated_at: nowIso(),
    }, (query) => query.eq('id', stateRow.id)).catch(() => {});
  };

  const actionPayload = {
    buildingKey,
    amount,
    cost,
  };
  const queuedAt = nowIso();
  let actionRow;
  try {
    actionRow = await insertSingleRow('multiplayer_action_queue', {
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
  } catch (error) {
    await refundDebit();
    throw error;
  }

  try {
    await insertSingleRow('multiplayer_round_events', {
      round_id: round.id,
      tick: requestedTick,
      event_type: 'dev_order_queued',
      visibility: 'public',
      actor_player_id: player.id,
      title: 'Build order queued',
      body: `${player.display_name} queued an order to build ${amount} ${devBuildingNoun(buildingKey, amount)}.`,
      payload: {
        actionQueueId: actionRow.id,
        actionType: 'dev_queue_build_factory',
        buildingKey,
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
        building_key: buildingKey,
        amount,
        cost,
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
    await refundDebit();
    throw error;
  }

  return {
    round: formatRound(round),
    player: formatPlayer(player),
    previousTick,
    requestedTick,
    executeAfterTick,
    durationTicks,
    amount,
    buildingKey,
    cost,
    action: {
      ...actionRow,
      payload: actionPayload,
      result: null,
    },
  };
}

async function queueDevTrainAction(actionInput) {
  // Training orders must belong to a grant-linked player, like build orders.
  const identity = await resolveDevPlayerIdentity(actionInput, { requireGrant: true });
  const { round, player } = identity;

  const unitSlot = actionInput.unitSlot;
  const unitKey = DEV_UNIT_SLOT_KEYS[unitSlot - 1];
  const amount = actionInput.amount;
  const idempotencyKey = actionInput.idempotencyKey || null;
  if (idempotencyKey) {
    const existingAction = await fetchSingleRow(
      'multiplayer_action_queue',
      'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('action_type', 'dev_queue_train_units').eq('idempotency_key', idempotencyKey)
    );

    if (existingAction) {
      return {
        round: formatRound(round),
        player: formatPlayer(player),
        previousTick: Number(round.current_tick || 0),
        requestedTick: Number(existingAction.requested_tick ?? round.current_tick ?? 0),
        executeAfterTick: Number(existingAction.execute_after_tick ?? Number(round.current_tick || 0) + 1),
        durationTicks: null,
        amount: Number(existingAction.payload?.amount ?? amount),
        unitSlot: Number(existingAction.payload?.unitSlot ?? unitSlot),
        unitKey: existingAction.payload?.unitKey || unitKey,
        unitName: existingAction.payload?.unitName || null,
        cost: Number(existingAction.payload?.cost ?? 0),
        action: formatActionQueue(existingAction),
      };
    }
  }

  const previousTick = Number(round.current_tick || 0);
  const requestedTick = previousTick;

  // Race resolves at read time from canonical state; costs/caps come from the
  // reference unit tables for that race.
  const stateResult = await getOrCreatePlayerState(round.id, player.id);
  const stateRow = stateResult.row;
  const race = devRaceUnitStats(stateRow.race_key);
  if (amount > race.maxTrain) {
    throw createServiceError(400, 'train_cap_exceeded', `Training orders for ${race.name} are capped at ${race.maxTrain} units per order.`);
  }
  const unit = race.unitStats[unitSlot - 1];
  const cost = unit.cost * amount;
  const availableMoney = Number(stateRow.money || 0);
  if (availableMoney < cost) {
    throw createServiceError(400, 'insufficient_funds', `Not enough money for that training order: it costs ${cost} and ${availableMoney} is available.`);
  }

  // Real training duration from the reference formula: barracks accelerate it.
  const barracksRows = await fetchRows(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'barracks')
  );
  const barracksCount = canonicalCountFromRows(barracksRows);
  const durationSeconds = orderTrainingDurationSeconds(cost, barracksCount);
  const durationTicks = orderTicksFromGameSeconds(durationSeconds);
  const executeAfterTick = previousTick + durationTicks;

  const debitedAt = nowIso();
  await updateSingleRow('multiplayer_player_state', {
    money: availableMoney - cost,
    state_version: Number(stateRow.state_version || 0) + 1,
    updated_at: debitedAt,
  }, (query) => query.eq('id', stateRow.id));
  const refundDebit = async () => {
    const freshState = await fetchSingleRow(
      'multiplayer_player_state',
      'id, player_id, round_id, state_version, money, created_at, updated_at',
      (query) => query.eq('id', stateRow.id)
    ).catch(() => null);
    if (!freshState) return;
    await updateSingleRow('multiplayer_player_state', {
      money: Number(freshState.money || 0) + cost,
      state_version: Number(freshState.state_version || 0) + 1,
      updated_at: nowIso(),
    }, (query) => query.eq('id', stateRow.id)).catch(() => {});
  };

  // Pending training is visible immediately via training_count on the slot row;
  // the standing count only moves when the finished order is completed on the
  // Barracks screen.
  const unitRow = await fetchSingleRow(
    'multiplayer_player_armies',
    'id, player_id, round_id, unit_key, count, training_count, returning_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('unit_key', unitKey)
  );
  const existingCount = Math.max(0, Math.floor(Number(unitRow?.count ?? 0)));
  const existingTraining = Math.max(0, Math.floor(Number(unitRow?.training_count ?? 0)));
  const existingReturning = Math.max(0, Math.floor(Number(unitRow?.returning_count ?? 0)));
  await upsertRow('multiplayer_player_armies', {
    round_id: round.id,
    player_id: player.id,
    unit_key: unitKey,
    count: existingCount,
    training_count: existingTraining + amount,
    returning_count: existingReturning,
    updated_at: debitedAt,
  }, 'player_id,round_id,unit_key');
  const rollbackTraining = async () => {
    const freshRow = await fetchSingleRow(
      'multiplayer_player_armies',
      'id, player_id, round_id, unit_key, count, training_count, returning_count, created_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('unit_key', unitKey)
    ).catch(() => null);
    if (!freshRow) return;
    await upsertRow('multiplayer_player_armies', {
      round_id: round.id,
      player_id: player.id,
      unit_key: unitKey,
      count: Math.max(0, Math.floor(Number(freshRow.count || 0))),
      training_count: Math.max(0, Math.floor(Number(freshRow.training_count || 0)) - amount),
      returning_count: Math.max(0, Math.floor(Number(freshRow.returning_count || 0))),
      updated_at: nowIso(),
    }, 'player_id,round_id,unit_key').catch(() => {});
  };

  const actionPayload = {
    unitSlot,
    unitKey,
    unitName: unit.name,
    raceKey: normalizeText(String(stateRow.race_key || 'human')).toLowerCase() || 'human',
    amount,
    cost,
  };
  const queuedAt = nowIso();
  let actionRow;
  try {
    actionRow = await insertSingleRow('multiplayer_action_queue', {
      round_id: round.id,
      player_id: player.id,
      action_type: 'dev_queue_train_units',
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
  } catch (error) {
    await rollbackTraining();
    await refundDebit();
    throw error;
  }

  try {
    await insertSingleRow('multiplayer_round_events', {
      round_id: round.id,
      tick: requestedTick,
      event_type: 'dev_order_queued',
      visibility: 'public',
      actor_player_id: player.id,
      title: 'Training order queued',
      body: `${player.display_name} queued training for ${amount} ${unit.name}.`,
      payload: {
        actionQueueId: actionRow.id,
        actionType: 'dev_queue_train_units',
        ...actionPayload,
        requestedTick,
        executeAfterTick,
      },
    });

    await insertSingleRow('multiplayer_audit_log', {
      round_id: round.id,
      player_id: player.id,
      actor_type: 'dev',
      event_type: 'dev_queue_train_units',
      event_data: {
        round_id: round.id,
        round_key: round.round_key,
        player_id: player.id,
        display_name: player.display_name,
        action_queue_id: actionRow.id,
        action_type: 'dev_queue_train_units',
        unit_slot: unitSlot,
        unit_key: unitKey,
        amount,
        cost,
        requested_tick: requestedTick,
        execute_after_tick: executeAfterTick,
      },
    });
  } catch (error) {
    await updateSingleRow('multiplayer_action_queue', {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unexpected queue-train-units failure.',
      updated_at: nowIso(),
    }, (query) => query.eq('id', actionRow.id)).catch(() => {});
    await rollbackTraining();
    await refundDebit();
    throw error;
  }

  return {
    round: formatRound(round),
    player: formatPlayer(player),
    previousTick,
    requestedTick,
    executeAfterTick,
    durationTicks,
    amount,
    unitSlot,
    unitKey,
    unitName: unit.name,
    cost,
    action: {
      ...actionRow,
      payload: actionPayload,
      result: null,
    },
  };
}

async function queueDevExploreAction(actionInput) {
  // Explorations must belong to a grant-linked player, like build and training.
  const identity = await resolveDevPlayerIdentity(actionInput, { requireGrant: true });
  const { round, player } = identity;

  const hours = actionInput.hours;
  const spend = actionInput.spend;
  const idempotencyKey = actionInput.idempotencyKey || null;
  if (idempotencyKey) {
    const existingAction = await fetchSingleRow(
      'multiplayer_action_queue',
      'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('action_type', 'dev_queue_explore').eq('idempotency_key', idempotencyKey)
    );

    if (existingAction) {
      return {
        round: formatRound(round),
        player: formatPlayer(player),
        previousTick: Number(round.current_tick || 0),
        requestedTick: Number(existingAction.requested_tick ?? round.current_tick ?? 0),
        executeAfterTick: Number(existingAction.execute_after_tick ?? Number(round.current_tick || 0) + 1),
        durationTicks: null,
        hours: Number(existingAction.payload?.hours ?? hours),
        spend: Number(existingAction.payload?.spend ?? spend),
        gain: Number(existingAction.payload?.gain ?? 0),
        action: formatActionQueue(existingAction),
      };
    }
  }

  const previousTick = Number(round.current_tick || 0);
  const requestedTick = previousTick;

  // Reference validation order (local startExplore): affordability first, then
  // the land-doubling guard. The gain locks in at queue time from current land.
  const stateResult = await getOrCreatePlayerState(round.id, player.id);
  const stateRow = stateResult.row;
  const availableMoney = Number(stateRow.money || 0);
  if (availableMoney < spend) {
    throw createServiceError(400, 'insufficient_funds', `Not enough money for that exploration: it costs ${spend} and ${availableMoney} is available.`);
  }
  const landAtQueue = Math.max(0, Number(stateRow.land || 0));
  const gain = orderExploreGain(hours, spend, Math.max(1, landAtQueue));
  if (gain > landAtQueue) {
    throw createServiceError(400, 'explore_gain_exceeds_land', `Explore rejected: estimated return ${gain} land would more than double your empire. Maximum allowed return is your existing land: ${landAtQueue}.`);
  }

  const durationSeconds = hours * 3600;
  const durationTicks = orderTicksFromGameSeconds(durationSeconds);
  const executeAfterTick = previousTick + durationTicks;

  const debitedAt = nowIso();
  await updateSingleRow('multiplayer_player_state', {
    money: availableMoney - spend,
    state_version: Number(stateRow.state_version || 0) + 1,
    updated_at: debitedAt,
  }, (query) => query.eq('id', stateRow.id));
  const refundDebit = async () => {
    const freshState = await fetchSingleRow(
      'multiplayer_player_state',
      'id, player_id, round_id, state_version, money, created_at, updated_at',
      (query) => query.eq('id', stateRow.id)
    ).catch(() => null);
    if (!freshState) return;
    await updateSingleRow('multiplayer_player_state', {
      money: Number(freshState.money || 0) + spend,
      state_version: Number(freshState.state_version || 0) + 1,
      updated_at: nowIso(),
    }, (query) => query.eq('id', stateRow.id)).catch(() => {});
  };

  const actionPayload = {
    hours,
    spend,
    gain,
    landAtQueue,
  };
  const queuedAt = nowIso();
  let actionRow;
  try {
    actionRow = await insertSingleRow('multiplayer_action_queue', {
      round_id: round.id,
      player_id: player.id,
      action_type: 'dev_queue_explore',
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
  } catch (error) {
    await refundDebit();
    throw error;
  }

  try {
    await insertSingleRow('multiplayer_round_events', {
      round_id: round.id,
      tick: requestedTick,
      event_type: 'dev_order_queued',
      visibility: 'public',
      actor_player_id: player.id,
      title: 'Exploration queued',
      body: `${player.display_name} spent ${spend} money and sent scouts out to explore for ${hours} ${hours === 1 ? 'hour' : 'hours'}.`,
      payload: {
        actionQueueId: actionRow.id,
        actionType: 'dev_queue_explore',
        ...actionPayload,
        requestedTick,
        executeAfterTick,
      },
    });

    await insertSingleRow('multiplayer_audit_log', {
      round_id: round.id,
      player_id: player.id,
      actor_type: 'dev',
      event_type: 'dev_queue_explore',
      event_data: {
        round_id: round.id,
        round_key: round.round_key,
        player_id: player.id,
        display_name: player.display_name,
        action_queue_id: actionRow.id,
        action_type: 'dev_queue_explore',
        hours,
        spend,
        gain,
        land_at_queue: landAtQueue,
        requested_tick: requestedTick,
        execute_after_tick: executeAfterTick,
      },
    });
  } catch (error) {
    await updateSingleRow('multiplayer_action_queue', {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unexpected queue-explore failure.',
      updated_at: nowIso(),
    }, (query) => query.eq('id', actionRow.id)).catch(() => {});
    await refundDebit();
    throw error;
  }

  return {
    round: formatRound(round),
    player: formatPlayer(player),
    previousTick,
    requestedTick,
    executeAfterTick,
    durationTicks,
    hours,
    spend,
    gain,
    action: {
      ...actionRow,
      payload: actionPayload,
      result: null,
    },
  };
}

async function queueDevScienceAction(actionInput) {
  // Research orders must belong to a grant-linked player, like build/train/explore.
  const identity = await resolveDevPlayerIdentity(actionInput, { requireGrant: true });
  const { round, player } = identity;

  const field = actionInput.field;
  const idempotencyKey = actionInput.idempotencyKey || null;
  if (idempotencyKey) {
    const existingAction = await fetchSingleRow(
      'multiplayer_action_queue',
      'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('action_type', 'dev_queue_science').eq('idempotency_key', idempotencyKey)
    );

    if (existingAction) {
      return {
        round: formatRound(round),
        player: formatPlayer(player),
        previousTick: Number(round.current_tick || 0),
        requestedTick: Number(existingAction.requested_tick ?? round.current_tick ?? 0),
        executeAfterTick: Number(existingAction.execute_after_tick ?? Number(round.current_tick || 0) + 1),
        durationTicks: null,
        field: existingAction.payload?.field || field,
        fromLevel: Number(existingAction.payload?.fromLevel ?? 0),
        toLevel: Number(existingAction.payload?.toLevel ?? 0),
        action: formatActionQueue(existingAction),
      };
    }
  }

  const previousTick = Number(round.current_tick || 0);
  const requestedTick = previousTick;

  // Requirement: at least one completed science lab (local startScienceResearch).
  const labRows = await fetchRows(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'science_labs')
  );
  const scienceLabs = canonicalCountFromRows(labRows);
  if (scienceLabs <= 0) {
    throw createServiceError(400, 'no_science_labs', 'You have no completed Science Labs.');
  }

  // Single-order-PER-FIELD: reject a second concurrent order for the same field
  // so its level cannot double-increment from a stale baseline. Other fields may
  // research concurrently.
  const inFlight = await fetchRows(
    'multiplayer_action_queue',
    'id, player_id, round_id, action_type, status, payload, created_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('action_type', 'dev_queue_science').in('status', ['queued', 'processing'])
  );
  if (inFlight.some((row) => (row.payload?.field || null) === field)) {
    throw createServiceError(409, 'research_already_running', `A ${field} research order is already running.`);
  }

  // Duration depends on the field's CURRENT level (research targets currentLevel + 1).
  await getOrCreatePlayerScience(round.id, player.id);
  const scienceRows = await fetchRows(
    'multiplayer_player_science',
    'id, player_id, round_id, science_key, level, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id)
  );
  const currentLevels = scienceLevelsFromRows(scienceRows);
  const fromLevel = Math.max(0, Math.floor(Number(currentLevels[field] || 0)));
  const toLevel = fromLevel + 1;
  const durationSeconds = orderScienceDurationSeconds(fromLevel, scienceLabs);
  const durationTicks = orderTicksFromGameSeconds(durationSeconds);
  const executeAfterTick = previousTick + durationTicks;

  // Research has no card cost — nothing to debit.
  const actionPayload = {
    field,
    fromLevel,
    toLevel,
  };
  const queuedAt = nowIso();
  const actionRow = await insertSingleRow('multiplayer_action_queue', {
    round_id: round.id,
    player_id: player.id,
    action_type: 'dev_queue_science',
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
      title: 'Research order queued',
      body: `${player.display_name} started ${field} research to level ${toLevel}.`,
      payload: {
        actionQueueId: actionRow.id,
        actionType: 'dev_queue_science',
        ...actionPayload,
        requestedTick,
        executeAfterTick,
      },
    });

    await insertSingleRow('multiplayer_audit_log', {
      round_id: round.id,
      player_id: player.id,
      actor_type: 'dev',
      event_type: 'dev_queue_science',
      event_data: {
        round_id: round.id,
        round_key: round.round_key,
        player_id: player.id,
        display_name: player.display_name,
        action_queue_id: actionRow.id,
        action_type: 'dev_queue_science',
        field,
        from_level: fromLevel,
        to_level: toLevel,
        requested_tick: requestedTick,
        execute_after_tick: executeAfterTick,
      },
    });
  } catch (error) {
    await updateSingleRow('multiplayer_action_queue', {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unexpected queue-science failure.',
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
    durationTicks,
    field,
    fromLevel,
    toLevel,
    action: {
      ...actionRow,
      payload: actionPayload,
      result: null,
    },
  };
}

// Reference calcCaps.bankCap (src/App.jsx): banks * 250000 * banking-science bonus.
function bankCapacityFor(banksCount, bankingLevel) {
  return Math.max(0, Number(banksCount) || 0) * 250000 * scienceLevelBonus(bankingLevel);
}

// Reads the player's banks count and banking science level to derive bank cap.
async function loadBankContext(round, player) {
  const stateResult = await getOrCreatePlayerState(round.id, player.id);
  const stateRow = stateResult.row;
  const bankRows = await fetchRows(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', 'bank')
  );
  const banksCount = canonicalCountFromRows(bankRows);
  await getOrCreatePlayerScience(round.id, player.id);
  const scienceRows = await fetchRows(
    'multiplayer_player_science',
    'id, player_id, round_id, science_key, level, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id)
  );
  const bankingLevel = scienceLevelsFromRows(scienceRows).banking;
  return { stateRow, banksCount, bankCap: bankCapacityFor(banksCount, bankingLevel) };
}

// Instant Bank deposit — NOT a due-order. Port of depositBankAmount (src/App.jsx):
// requires banks, money on hand and free capacity; deposits the clamped amount
// immediately (money -> banked).
async function bankDepositAction(actionInput) {
  const identity = await resolveDevPlayerIdentity(actionInput, { requireGrant: true });
  const { round, player } = identity;
  const amount = actionInput.amount;
  const { stateRow, banksCount, bankCap } = await loadBankContext(round, player);
  const money = Math.max(0, Number(stateRow.money || 0));
  const banked = Math.max(0, Number(stateRow.banked || 0));
  if (banksCount <= 0) {
    throw createServiceError(400, 'no_banks', 'You have no completed Banks.');
  }
  if (money <= 0) {
    throw createServiceError(400, 'insufficient_funds', 'You have no money on hand to deposit.');
  }
  const space = Math.max(0, bankCap - banked);
  if (space <= 0) {
    throw createServiceError(400, 'banks_full', 'Your banks are full.');
  }
  const actual = Math.min(amount, money, space);
  if (actual <= 0) {
    throw createServiceError(400, 'insufficient_funds', 'No valid amount can be deposited.');
  }
  const newMoney = money - actual;
  const newBanked = banked + actual;
  const at = nowIso();
  await updateSingleRow('multiplayer_player_state', {
    money: newMoney,
    banked: newBanked,
    state_version: Number(stateRow.state_version || 0) + 1,
    updated_at: at,
  }, (query) => query.eq('id', stateRow.id));

  await insertSingleRow('multiplayer_round_events', {
    round_id: round.id,
    tick: Number(round.current_tick || 0),
    event_type: 'dev_bank_deposit',
    visibility: 'public',
    actor_player_id: player.id,
    title: 'Bank deposit',
    body: `${player.display_name} deposited ${actual} into their banks.`,
    payload: { actionType: 'dev_bank_deposit', amount: actual, money: newMoney, banked: newBanked, bankCap },
  }).catch(() => {});
  await insertSingleRow('multiplayer_audit_log', {
    round_id: round.id,
    player_id: player.id,
    actor_type: 'dev',
    event_type: 'dev_bank_deposit',
    event_data: { round_id: round.id, round_key: round.round_key, player_id: player.id, display_name: player.display_name, requested: amount, deposited: actual, money: newMoney, banked: newBanked, bank_cap: bankCap },
  }).catch(() => {});

  return { round, player, requested: amount, deposited: actual, money: newMoney, banked: newBanked, bankCap };
}

// Instant Bank withdraw — port of withdrawBankAmount (src/App.jsx): clamps to the
// banked balance and moves it back to money immediately.
async function bankWithdrawAction(actionInput) {
  const identity = await resolveDevPlayerIdentity(actionInput, { requireGrant: true });
  const { round, player } = identity;
  const amount = actionInput.amount;
  const { stateRow, bankCap } = await loadBankContext(round, player);
  const money = Math.max(0, Number(stateRow.money || 0));
  const banked = Math.max(0, Number(stateRow.banked || 0));
  if (banked <= 0) {
    throw createServiceError(400, 'no_banked_funds', 'You have no banked money to withdraw.');
  }
  const actual = Math.min(amount, banked);
  if (actual <= 0) {
    throw createServiceError(400, 'no_banked_funds', 'No valid amount can be withdrawn.');
  }
  const newMoney = money + actual;
  const newBanked = banked - actual;
  const at = nowIso();
  await updateSingleRow('multiplayer_player_state', {
    money: newMoney,
    banked: newBanked,
    state_version: Number(stateRow.state_version || 0) + 1,
    updated_at: at,
  }, (query) => query.eq('id', stateRow.id));

  await insertSingleRow('multiplayer_round_events', {
    round_id: round.id,
    tick: Number(round.current_tick || 0),
    event_type: 'dev_bank_withdraw',
    visibility: 'public',
    actor_player_id: player.id,
    title: 'Bank withdrawal',
    body: `${player.display_name} withdrew ${actual} from their banks.`,
    payload: { actionType: 'dev_bank_withdraw', amount: actual, money: newMoney, banked: newBanked, bankCap },
  }).catch(() => {});
  await insertSingleRow('multiplayer_audit_log', {
    round_id: round.id,
    player_id: player.id,
    actor_type: 'dev',
    event_type: 'dev_bank_withdraw',
    event_data: { round_id: round.id, round_key: round.round_key, player_id: player.id, display_name: player.display_name, requested: amount, withdrawn: actual, money: newMoney, banked: newBanked, bank_cap: bankCap },
  }).catch(() => {});

  return { round, player, requested: amount, withdrawn: actual, money: newMoney, banked: newBanked, bankCap };
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

  // Ticks no longer apply queued orders. An order whose execute_after_tick has
  // been reached is "finished" (actionSummary.dueNow) but only applies when the
  // player visits the matching screen and the complete-due endpoint runs —
  // mirroring the local prototype, where finished orders wait for a page visit.
  const processedTotal = 0;
  const factoryBuilds = 0;
  const processedActionIds = [];
  const failedActionIds = [];

  // Economy runs after queued-action processing so completed builds are counted
  // before production, matching the client ordering (order completion is applied
  // before elapsed production in the local prototype's page update).
  const economy = await applyEconomyTickForRound(round, nextTick);

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
    economyPlayersProcessed: economy.playersProcessed,
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
    economy: {
      playersProcessed: economy.playersProcessed,
    },
  };
}

// ── Generic due-order completion ──────────────────────────────────────────────
// Shared mechanism for every duration-based order type (build now, training in
// this pass, science/explore later): orders queue with a real duration in ticks,
// count as "finished" once the round reaches execute_after_tick, and are applied
// only when the owning player visits the matching screen. Appliers receive the
// due action and mutate canonical state; registration is by action_type.
const DEV_SCREEN_ACTION_TYPES = {
  build: ['dev_queue_build_factory'],
  barracks: ['dev_queue_train_units'],
  explore: ['dev_queue_explore'],
  science: ['dev_queue_science'],
};

function normalizeDevCompleteDueInput(body) {
  const identity = normalizeDevIdentityInput(body);
  const screen = normalizeText(String(body.screen || '')).toLowerCase();
  if (!DEV_SCREEN_ACTION_TYPES[screen]) {
    throw createServiceError(400, 'invalid_screen', `screen must be one of: ${Object.keys(DEV_SCREEN_ACTION_TYPES).join(', ')}.`);
  }
  return { ...identity, screen };
}

async function applyDueBuildOrder({ round, player, action, appliedAtTick }) {
  const actionAmount = clampDevBuildAmount(action.payload?.amount ?? 1);
  const actionBuildingKey = normalizeDevBuildingKey(action.payload?.buildingKey ?? action.payload?.building_key);
  const buildingRows = await fetchRows(
    'multiplayer_player_buildings',
    'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('building_key', actionBuildingKey)
  );
  const oldCount = canonicalCountFromRows(buildingRows);
  const newCount = oldCount + actionAmount;
  const processedAt = nowIso();
  const actionResult = {
    actionType: 'dev_queue_build_factory',
    buildingKey: actionBuildingKey,
    amount: actionAmount,
    oldCount,
    newCount,
    tick: appliedAtTick,
  };

  await upsertRow('multiplayer_player_buildings', {
    round_id: round.id,
    player_id: player.id,
    building_key: actionBuildingKey,
    count: newCount,
    effective_count: newCount,
    updated_at: processedAt,
  }, 'player_id,round_id,building_key');

  return {
    actionResult,
    eventType: 'dev_build_factory_processed',
    eventTitle: `${devBuildingNoun(actionBuildingKey, 1).charAt(0).toUpperCase()}${devBuildingNoun(actionBuildingKey, 1).slice(1)} order completed`,
    eventBody: `${player.display_name} completed an order for ${actionAmount} ${devBuildingNoun(actionBuildingKey, actionAmount)}.`,
    auditData: {
      building_key: actionBuildingKey,
      amount: actionAmount,
      old_count: oldCount,
      new_count: newCount,
    },
  };
}

async function applyDueTrainOrder({ round, player, action, appliedAtTick }) {
  const unitSlot = Math.max(1, Math.min(DEV_UNIT_SLOT_KEYS.length, Math.floor(Number(action.payload?.unitSlot || 1))));
  const unitKey = action.payload?.unitKey || DEV_UNIT_SLOT_KEYS[unitSlot - 1];
  const amount = Math.max(0, Math.floor(Number(action.payload?.amount || 0)));
  const unitName = action.payload?.unitName || unitKey;
  const unitRow = await fetchSingleRow(
    'multiplayer_player_armies',
    'id, player_id, round_id, unit_key, count, training_count, returning_count, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('unit_key', unitKey)
  );
  const oldCount = Math.max(0, Math.floor(Number(unitRow?.count ?? 0)));
  const oldTraining = Math.max(0, Math.floor(Number(unitRow?.training_count ?? 0)));
  const returningCount = Math.max(0, Math.floor(Number(unitRow?.returning_count ?? 0)));
  const newCount = oldCount + amount;
  const processedAt = nowIso();
  const actionResult = {
    actionType: 'dev_queue_train_units',
    unitSlot,
    unitKey,
    unitName,
    amount,
    oldCount,
    newCount,
    tick: appliedAtTick,
  };

  await upsertRow('multiplayer_player_armies', {
    round_id: round.id,
    player_id: player.id,
    unit_key: unitKey,
    count: newCount,
    training_count: Math.max(0, oldTraining - amount),
    returning_count: returningCount,
    updated_at: processedAt,
  }, 'player_id,round_id,unit_key');

  return {
    actionResult,
    eventType: 'dev_train_units_processed',
    eventTitle: 'Training order completed',
    eventBody: `${player.display_name} completed training for ${amount} ${unitName}.`,
    auditData: {
      unit_slot: unitSlot,
      unit_key: unitKey,
      amount,
      old_count: oldCount,
      new_count: newCount,
    },
  };
}

async function applyDueExploreOrder({ round, player, action, appliedAtTick }) {
  const gain = Math.max(0, Math.floor(Number(action.payload?.gain || 0)));
  const stateRow = await fetchSingleRow(
    'multiplayer_player_state',
    'id, player_id, round_id, tick, state_version, race_key, land, power, money, banked, energy, food, water, population, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id)
  );
  if (!stateRow) {
    throw createServiceError(404, 'player_state_not_found', 'Player state was not found for that exploration.');
  }
  const oldLand = Math.max(0, Number(stateRow.land || 0));
  const newLand = oldLand + gain;
  const processedAt = nowIso();
  const actionResult = {
    actionType: 'dev_queue_explore',
    hours: Number(action.payload?.hours || 0),
    spend: Number(action.payload?.spend || 0),
    gain,
    oldLand,
    newLand,
    tick: appliedAtTick,
  };

  await updateSingleRow('multiplayer_player_state', {
    land: newLand,
    state_version: Number(stateRow.state_version || 0) + 1,
    updated_at: processedAt,
  }, (query) => query.eq('id', stateRow.id));

  return {
    actionResult,
    eventType: 'dev_explore_processed',
    eventTitle: 'Exploration completed',
    eventBody: `${player.display_name}'s scouts returned and found ${gain} land.`,
    auditData: {
      hours: actionResult.hours,
      spend: actionResult.spend,
      gain,
      old_land: oldLand,
      new_land: newLand,
    },
  };
}

async function applyDueScienceOrder({ round, player, action, appliedAtTick }) {
  const field = action.payload?.field;
  if (!DEV_SCIENCE_FIELDS.includes(field)) {
    throw createServiceError(400, 'invalid_science_field', `Unknown research field "${field}".`);
  }
  const scienceRow = await fetchSingleRow(
    'multiplayer_player_science',
    'id, player_id, round_id, science_key, level, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).eq('science_key', field)
  );
  // Reference completeScienceResearch: level = current level + 1. Single-order-
  // per-field guarantees the current level still equals the queued fromLevel.
  const oldLevel = Math.max(0, Math.floor(Number(scienceRow?.level ?? 0)));
  const newLevel = oldLevel + 1;
  const processedAt = nowIso();
  const actionResult = {
    actionType: 'dev_queue_science',
    field,
    oldLevel,
    newLevel,
    tick: appliedAtTick,
  };

  await upsertRow('multiplayer_player_science', {
    round_id: round.id,
    player_id: player.id,
    science_key: field,
    level: newLevel,
    updated_at: processedAt,
  }, 'player_id,round_id,science_key');

  return {
    actionResult,
    eventType: 'dev_science_processed',
    eventTitle: 'Research completed',
    eventBody: `${player.display_name} completed ${field} research to level ${newLevel}.`,
    auditData: {
      field,
      old_level: oldLevel,
      new_level: newLevel,
    },
  };
}

const DEV_ORDER_APPLIERS = {
  dev_queue_build_factory: applyDueBuildOrder,
  dev_queue_train_units: applyDueTrainOrder,
  dev_queue_explore: applyDueExploreOrder,
  dev_queue_science: applyDueScienceOrder,
};

async function completeDueOrdersForPlayer(identity, screen) {
  const round = identity.round;
  const player = identity.player;
  const actionTypes = DEV_SCREEN_ACTION_TYPES[screen];
  const currentTick = Number(round.current_tick || 0);

  const playerRound = await fetchSingleRow('multiplayer_player_rounds', 'id, player_id, round_id, role, status, joined_at, left_at, created_at, updated_at', (query) =>
    query.eq('round_id', round.id).eq('player_id', player.id).eq('status', 'active')
  );
  if (!playerRound) {
    throw createServiceError(409, 'player_not_joined', `${player.display_name} is not joined to the shared round.`);
  }

  const dueActions = await fetchRows(
    'multiplayer_action_queue',
    'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('player_id', player.id).in('action_type', actionTypes).eq('status', 'queued').lte('execute_after_tick', currentTick).order('created_at', { ascending: true })
  );

  let completedTotal = 0;
  const completedActions = [];
  const failedActionIds = [];

  for (const action of dueActions) {
    try {
      const applier = DEV_ORDER_APPLIERS[action.action_type];
      if (!applier) {
        throw createServiceError(500, 'applier_missing', `No completion applier is registered for ${action.action_type}.`);
      }

      await updateSingleRow('multiplayer_action_queue', {
        status: 'processing',
        updated_at: nowIso(),
      }, (query) => query.eq('id', action.id));

      const applied = await applier({ round, player, action, appliedAtTick: currentTick });
      const processedAt = nowIso();

      await updateSingleRow('multiplayer_action_queue', {
        status: 'processed',
        result: applied.actionResult,
        error_message: null,
        processed_at: processedAt,
        updated_at: processedAt,
      }, (query) => query.eq('id', action.id));

      await insertSingleRow('multiplayer_round_events', {
        round_id: round.id,
        tick: currentTick,
        event_type: applied.eventType,
        visibility: 'public',
        actor_player_id: player.id,
        title: applied.eventTitle,
        body: applied.eventBody,
        payload: {
          actionQueueId: action.id,
          ...applied.actionResult,
        },
      });

      await insertSingleRow('multiplayer_audit_log', {
        round_id: round.id,
        player_id: player.id,
        actor_type: 'dev',
        event_type: applied.eventType,
        event_data: {
          round_id: round.id,
          round_key: round.round_key,
          player_id: player.id,
          display_name: player.display_name,
          action_queue_id: action.id,
          action_type: action.action_type,
          tick: currentTick,
          ...applied.auditData,
        },
      });

      completedTotal += 1;
      completedActions.push({ id: action.id, actionType: action.action_type, result: applied.actionResult });
    } catch (error) {
      failedActionIds.push(action.id);
      await updateSingleRow('multiplayer_action_queue', {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unexpected completion failure.',
        updated_at: nowIso(),
      }, (query) => query.eq('id', action.id)).catch(() => {});

      await insertSingleRow('multiplayer_audit_log', {
        round_id: round.id,
        player_id: action.player_id,
        actor_type: 'dev',
        event_type: 'dev_order_completion_failed',
        event_data: {
          round_id: round.id,
          round_key: round.round_key,
          action_queue_id: action.id,
          action_type: action.action_type,
          requested_tick: action.requested_tick,
          execute_after_tick: action.execute_after_tick,
          error_message: error instanceof Error ? error.message : 'Unexpected completion failure.',
        },
      }).catch(() => {});
    }
  }

  return {
    screen,
    currentTick,
    completedTotal,
    completedActions,
    failedActionIds,
  };
}

async function applyEconomyTickForRound(round, nextTick) {
  const activePlayerRounds = await fetchRows(
    'multiplayer_player_rounds',
    'id, player_id, round_id, role, status, joined_at, left_at, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('status', 'active').order('created_at', { ascending: true })
  );

  let playersProcessed = 0;
  for (const playerRound of activePlayerRounds) {
    const stateRow = await fetchSingleRow(
      'multiplayer_player_state',
      'id, player_id, round_id, tick, state_version, race_key, land, power, money, banked, energy, food, water, population, created_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', playerRound.player_id)
    );
    if (!stateRow) continue;

    const buildingRows = await fetchRows(
      'multiplayer_player_buildings',
      'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', playerRound.player_id)
    );
    const armyRows = await fetchRows(
      'multiplayer_player_armies',
      'id, player_id, round_id, unit_key, count, training_count, returning_count',
      (query) => query.eq('round_id', round.id).eq('player_id', playerRound.player_id)
    );
    const scienceRows = await fetchRows(
      'multiplayer_player_science',
      'id, player_id, round_id, science_key, level, created_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', playerRound.player_id)
    );

    const next = computeEconomyTick(stateRow, buildingRows, armyRows, scienceLevelsFromRows(scienceRows));
    await updateSingleRow('multiplayer_player_state', {
      population: next.population,
      money: next.money,
      banked: next.banked,
      food: next.food,
      water: next.water,
      energy: next.energy,
      tick: nextTick,
      state_version: Number(stateRow.state_version || 0) + 1,
      updated_at: nowIso(),
    }, (query) => query.eq('id', stateRow.id));
    playersProcessed += 1;
  }

  return { playersProcessed };
}

async function resetDevProofRound(resetInput) {
  // Proof resets affect every active player in the round, so they must come
  // from a grant-linked identity; identityless requests are rejected.
  const identity = await resolveDevPlayerIdentity(resetInput, { requireGrant: true });
  const { round, player } = identity;
  const resetAt = nowIso();
  const previousTick = Number(round.current_tick || 0);
  const activePlayerRounds = await fetchRows(
    'multiplayer_player_rounds',
    'id, player_id, round_id, role, status, joined_at, left_at, created_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('status', 'active').order('created_at', { ascending: true })
  );
  const playerIds = activePlayerRounds.map((row) => row.player_id);
  const players = playerIds.length > 0
    ? await fetchRows(
        'multiplayer_players',
        'id, display_name, tester_label, status, created_from_grant_id, created_at, updated_at, last_seen_at, notes',
        (query) => query.in('id', playerIds)
      )
    : [player];
  const previousFactoryCounts = new Map();

  for (const currentPlayer of players) {
    const factoryRow = await fetchSingleRow(
      'multiplayer_player_buildings',
      'id, player_id, round_id, building_key, count, effective_count, created_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', currentPlayer.id).eq('building_key', 'factory')
    );
    const previousFactoryCount = Math.max(0, Math.floor(Number(factoryRow?.effective_count ?? factoryRow?.count ?? 0)));
    previousFactoryCounts.set(currentPlayer.id, previousFactoryCount);
    // Post-generalization, the proof reset zeroes every canonical building type,
    // not just factories, and re-seeds the player economy state to its
    // reference starting values.
    for (const buildingKey of DEV_QUEUEABLE_BUILDING_KEYS) {
      await upsertRow('multiplayer_player_buildings', {
        round_id: round.id,
        player_id: currentPlayer.id,
        building_key: buildingKey,
        count: 0,
        effective_count: 0,
        updated_at: resetAt,
      }, 'player_id,round_id,building_key');
    }

    const stateRow = await fetchSingleRow(
      'multiplayer_player_state',
      'id, player_id, round_id, tick, state_version, race_key, land, power, money, banked, energy, food, water, population, created_at, updated_at',
      (query) => query.eq('round_id', round.id).eq('player_id', currentPlayer.id)
    );
    if (stateRow) {
      await updateSingleRow('multiplayer_player_state', {
        money: ECONOMY_STARTING_MONEY,
        banked: 0,
        population: 0,
        food: 0,
        water: 0,
        energy: 0,
        tick: 0,
        state_version: Number(stateRow.state_version || 0) + 1,
        updated_at: resetAt,
      }, (query) => query.eq('id', stateRow.id));
    }

    // Reset every research field back to level 0.
    for (const field of DEV_SCIENCE_FIELDS) {
      await upsertRow('multiplayer_player_science', {
        round_id: round.id,
        player_id: currentPlayer.id,
        science_key: field,
        level: 0,
        updated_at: resetAt,
      }, 'player_id,round_id,science_key');
    }
  }

  const queuedActions = await fetchRows(
    'multiplayer_action_queue',
    'id, round_id, player_id, action_type, status, requested_tick, execute_after_tick, payload, result, error_message, idempotency_key, created_at, processed_at, updated_at',
    (query) => query.eq('round_id', round.id).eq('action_type', 'dev_queue_build_factory').in('status', ['queued', 'processing']).order('created_at', { ascending: true })
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
    body: `${player.display_name} reset the Shared Multiplayer DEV proof state for all active players in the round. Queued proof actions were cancelled and the next manual tick will start again at tick 1.`,
    payload: {
      roundKey: round.round_key,
      playerDisplayName: player.display_name,
      previousTick,
      resetTick: 0,
      resetPlayerCount: players.length,
      playerDisplayNames: players.map((entry) => entry.display_name),
      previousFactoryCounts: Object.fromEntries(previousFactoryCounts.entries()),
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
      reset_player_count: players.length,
      previous_factory_counts: Object.fromEntries(previousFactoryCounts.entries()),
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
    resetPlayerCount: players.length,
    previousFactoryCount: previousFactoryCounts.get(player.id) || 0,
  };
}

async function loadDevRoundPlayerContext(actionInput) {
  const identity = await resolveDevPlayerIdentity(actionInput, { requireGrant: false });
  return {
    round: identity.round,
    player: identity.player,
    playerRound: identity.playerRound,
    accessLink: identity.accessLink,
    resolvedFrom: identity.resolvedFrom,
  };
}

async function resolvePlayerFromGrant(grantId, roundKey, identityInput = {}) {
  const normalizedGrantId = normalizeText(grantId || '');
  const normalizedRoundKey = normalizeText(roundKey || DEV_ROUND_DEFAULTS.roundKey);

  if (!normalizedGrantId) {
    throw createServiceError(400, 'identity_not_provided', 'Provide an active grantId to resolve a multiplayer identity.');
  }

  if (!normalizedRoundKey) {
    throw createServiceError(400, 'round_not_provided', 'Provide a roundKey to resolve a multiplayer identity.');
  }

  const round = await fetchSingleRow('multiplayer_rounds', 'id, round_key, round_name, status, current_tick, created_at, updated_at, notes', (query) =>
    query.eq('round_key', normalizedRoundKey)
  );

  if (!round) {
    throw createServiceError(404, 'round_not_found', 'Shared Multiplayer DEV round has not been seeded yet.');
  }

  const playerColumns = 'id, display_name, tester_label, status, created_from_invite_token_id, created_from_grant_id, created_at, updated_at, last_seen_at, notes';
  const accessLinkColumns = 'id, player_id, access_type, invite_token_id, grant_id, token_hash_prefix, provider, status, issued_at, revoked_at, created_at, updated_at, notes';
  let accessLink = await fetchSingleRow(
    'multiplayer_player_access_links',
    accessLinkColumns,
    (query) => query.eq('grant_id', normalizedGrantId).eq('status', 'active').order('created_at', { ascending: true }).order('id', { ascending: true })
  );
  let accessLinkCreated = false;
  let player = null;
  let resolvedFrom = 'access_link';

  if (accessLink) {
    player = await fetchSingleRow(
      'multiplayer_players',
      playerColumns,
      (query) => query.eq('id', accessLink.player_id)
    );

    if (!player) {
      const grantLookup = await fetchInviteGrantByGrantId(normalizedGrantId);
      const inviteGrant = grantLookup.row;
      const labels = inviteGrant
        ? resolveInviteGrantLabels(inviteGrant, identityInput)
        : {
            displayName: normalizeDevDisplayName(identityInput.displayName || identityInput.testerLabel || DEV_ROUND_DEFAULTS.displayName),
            testerLabel: normalizeDevTesterLabel(identityInput.testerLabel || identityInput.displayName || null),
          };
      const playerResult = await getOrCreateInviteGrantPlayer(round.id, {
        grantId: normalizedGrantId,
        roundKey: normalizedRoundKey,
        displayName: labels.displayName,
        testerLabel: labels.testerLabel,
      });
      player = playerResult.row;
      resolvedFrom = playerResult.created ? 'invite_grant_created' : 'invite_grant';
      const touchedAt = nowIso();
      await updateSingleRow('multiplayer_player_access_links', {
        player_id: player.id,
        updated_at: touchedAt,
      }, (query) => query.eq('id', accessLink.id)).catch(() => {});
    }
  }

  if (!player) {
    const inviteGrantLookup = await fetchInviteGrantByGrantId(normalizedGrantId);
    const inviteGrant = inviteGrantLookup.row;

    if (!inviteGrant) {
      throw createServiceError(404, 'invite_grant_not_found', 'No invite grant was found for that grant id.');
    }

    if (!isInviteGrantActive(inviteGrant)) {
      throw createServiceError(404, 'invite_grant_not_active', 'The invite grant is not active.');
    }

    const inviteLabels = resolveInviteGrantLabels(inviteGrant, identityInput);
    const playerResult = await getOrCreateInviteGrantPlayer(round.id, {
      grantId: normalizedGrantId,
      roundKey: normalizedRoundKey,
      displayName: inviteLabels.displayName,
      testerLabel: inviteLabels.testerLabel,
    });
    player = playerResult.row;
    resolvedFrom = playerResult.created ? 'invite_grant_created' : 'invite_grant';

    const accessLinkResult = await getOrCreateInviteGrantAccessLink(round.id, player.id, normalizedGrantId, inviteGrant);
    accessLink = accessLinkResult.row;
    accessLinkCreated = accessLinkResult.created;
  }

  if (!player) {
    throw createServiceError(404, 'player_not_found', 'The player linked to that access grant was not found.');
  }

  const impersonationFlags = resolveIdentityOverrideFlags(identityInput, player);
  const playerRound = await getOrCreatePlayerRound(round.id, player.id);
  await getOrCreatePlayerState(round.id, player.id);
  await getOrCreatePlayerBuildings(round.id, player.id);
  await getOrCreatePlayerArmies(round.id, player.id);
  await getOrCreatePlayerScience(round.id, player.id);

  const touchedAt = nowIso();
  await updateSingleRow('multiplayer_players', {
    last_seen_at: touchedAt,
    updated_at: touchedAt,
  }, (query) => query.eq('id', player.id)).catch(() => {});

  if (accessLink) {
    await updateSingleRow('multiplayer_player_access_links', {
      updated_at: touchedAt,
    }, (query) => query.eq('id', accessLink.id)).catch(() => {});
  }

  return {
    round,
    player,
    playerRound,
    accessLink,
    accessLinkCreated,
    resolvedFrom,
    grantId: normalizedGrantId,
    currentPlayerId: player.id,
    requestedDisplayNameIgnored: impersonationFlags.requestedDisplayNameIgnored,
    requestedTesterLabelIgnored: impersonationFlags.requestedTesterLabelIgnored,
  };
}

async function resolveDevPlayerIdentity(identityInput, options = {}) {
  const grantId = normalizeText(identityInput.grantId || '');
  if (options.requireGrant && !grantId) {
    throw createServiceError(400, 'identity_not_provided', 'Provide an active grantId to resolve a multiplayer identity.');
  }
  if (grantId) {
    return resolvePlayerFromGrant(grantId, identityInput.roundKey || DEV_ROUND_DEFAULTS.roundKey, identityInput);
  }

  const round = await fetchSingleRow('multiplayer_rounds', 'id, round_key, round_name, status, current_tick, created_at, updated_at, notes', (query) =>
    query.eq('round_key', identityInput.roundKey)
  );

  if (!round) {
    throw createServiceError(404, 'round_not_found', 'Shared Multiplayer DEV round has not been seeded yet.');
  }

  const displayName = normalizeDevDisplayName(identityInput.displayName || identityInput.testerLabel || DEV_ROUND_DEFAULTS.displayName);
  const testerLabel = normalizeDevTesterLabel(identityInput.testerLabel || null);
  let accessLink = null;
  let accessLinkCreated = false;
  let player = null;
  let resolvedFrom = 'display_name';

  player = await fetchSingleRow(
    'multiplayer_players',
    'id, display_name, tester_label, status, created_from_invite_token_id, created_from_grant_id, created_at, updated_at, last_seen_at, notes',
    (query) => query.eq('display_name', displayName).eq('status', 'active')
  );

  if (player) {
    resolvedFrom = 'display_name';
  } else if (testerLabel) {
    player = await fetchSingleRow(
      'multiplayer_players',
      'id, display_name, tester_label, status, created_from_invite_token_id, created_from_grant_id, created_at, updated_at, last_seen_at, notes',
      (query) => query.eq('tester_label', testerLabel).eq('status', 'active')
    );

    if (player) {
      resolvedFrom = 'tester_label';
    }
  }

  if (!player && options.createIfMissing) {
    const created = await getOrCreateDevPlayer(round.id, {
      ...DEV_ROUND_DEFAULTS,
      displayName,
      testerLabel: testerLabel || DEV_ROUND_DEFAULTS.testerLabel,
    });
    player = created.row;
    resolvedFrom = 'created';
  }

  if (!player) {
    throw createServiceError(404, 'player_not_found', `DEV player ${displayName} was not found in the shared round.`);
  }

  const impersonationFlags = resolveIdentityOverrideFlags(identityInput, player);
  const playerRound = await getOrCreatePlayerRound(round.id, player.id);
  await getOrCreatePlayerState(round.id, player.id);
  await getOrCreatePlayerBuildings(round.id, player.id);
  await getOrCreatePlayerArmies(round.id, player.id);
  await getOrCreatePlayerScience(round.id, player.id);

  const touchedAt = nowIso();
  await updateSingleRow('multiplayer_players', {
    last_seen_at: touchedAt,
    updated_at: touchedAt,
  }, (query) => query.eq('id', player.id)).catch(() => {});

  if (accessLink) {
    await updateSingleRow('multiplayer_player_access_links', {
      updated_at: touchedAt,
    }, (query) => query.eq('id', accessLink.id)).catch(() => {});
  }

  return {
    round,
    player,
    playerRound,
    accessLink,
    accessLinkCreated,
    resolvedFrom,
    grantId: identityInput.grantId || accessLink?.grant_id || null,
    currentPlayerId: player.id,
    requestedDisplayNameIgnored: impersonationFlags.requestedDisplayNameIgnored,
    requestedTesterLabelIgnored: impersonationFlags.requestedTesterLabelIgnored,
  };
}

async function fetchInviteGrantByGrantId(grantId) {
  const columns = 'id, grant_id, current_grant_id, claim_count, tester_label, token_prefix, status, claimed_at, revoked_at, expires_at, last_seen_at, claimed_client_build, min_client_build, created_at, updated_at';
  const byCurrentGrantId = await fetchSingleRow(
    'invite_tokens',
    columns,
    (query) => query.eq('current_grant_id', grantId)
  );

  if (byCurrentGrantId) {
    return {
      row: byCurrentGrantId,
      matchedOn: 'current_grant_id',
    };
  }

  const byGrantId = await fetchSingleRow(
    'invite_tokens',
    columns,
    (query) => query.eq('grant_id', grantId)
  );

  if (byGrantId) {
    return {
      row: byGrantId,
      matchedOn: 'grant_id',
    };
  }

  return {
    row: null,
    matchedOn: null,
  };
}

function isInviteGrantActive(inviteGrant) {
  const status = String(inviteGrant?.status || '').trim().toLowerCase();
  const claimCount = Math.max(0, Math.floor(Number(inviteGrant?.claim_count || 0)));
  return (status === 'claimed' || status === 'active' || status === 'used') && claimCount > 0;
}

function resolveIdentityOverrideFlags(identityInput, player) {
  const requestedDisplayName = normalizeDevDisplayName(identityInput?.requestedDisplayName || identityInput?.displayName || identityInput?.testerLabel || '');
  const requestedTesterLabel = normalizeDevTesterLabel(identityInput?.requestedTesterLabel || identityInput?.testerLabel || identityInput?.displayName || null);
  const linkedDisplayName = normalizeDevDisplayName(player?.display_name || requestedDisplayName);
  const linkedTesterLabel = normalizeDevTesterLabel(player?.tester_label || null);
  const displayNameMatches = requestedDisplayName && (requestedDisplayName === linkedDisplayName || requestedDisplayName === linkedTesterLabel);
  const testerLabelMatches = requestedTesterLabel && (requestedTesterLabel === linkedTesterLabel || requestedTesterLabel === linkedDisplayName);

  return {
    requestedDisplayNameIgnored: Boolean(identityInput?.hasRequestedDisplayName && requestedDisplayName && !displayNameMatches),
    requestedTesterLabelIgnored: Boolean(identityInput?.hasRequestedTesterLabel && requestedTesterLabel && !testerLabelMatches),
  };
}

function resolveInviteGrantLabels(inviteGrant, identityInput = {}) {
  const authoritativeTesterLabel = normalizeDevTesterLabel(inviteGrant?.tester_label || null);
  const requestedTesterLabel = normalizeDevTesterLabel(identityInput.requestedTesterLabel || identityInput.testerLabel || identityInput.displayName);
  const requestedDisplayName = normalizeDevDisplayName(identityInput.requestedDisplayName || identityInput.displayName || identityInput.testerLabel);
  const testerLabel = authoritativeTesterLabel || requestedTesterLabel || requestedDisplayName;
  const displayName = authoritativeTesterLabel || requestedDisplayName || testerLabel;
  return {
    testerLabel: normalizeDevTesterLabel(testerLabel),
    displayName: normalizeDevDisplayName(displayName),
  };
}

async function getOrCreateInviteGrantPlayer(roundId, identityInput) {
  const grantId = normalizeText(identityInput.grantId || '');
  const displayName = normalizeDevDisplayName(identityInput.displayName || identityInput.testerLabel || DEV_ROUND_DEFAULTS.displayName);
  const testerLabel = normalizeDevTesterLabel(identityInput.testerLabel || identityInput.displayName || null);
  const playerColumns = 'id, display_name, tester_label, status, created_from_invite_token_id, created_from_grant_id, created_at, updated_at, last_seen_at, notes';

  const byGrantId = await fetchRows(
    'multiplayer_players',
    playerColumns,
    (query) => query.eq('created_from_grant_id', grantId).order('created_at', { ascending: true }).order('id', { ascending: true })
  );

  if (byGrantId.length > 0) {
    return {
      row: byGrantId[0],
      created: false,
    };
  }

  const inserted = await insertSingleRow('multiplayer_players', {
    display_name: displayName,
    tester_label: testerLabel,
    status: 'active',
    created_from_grant_id: grantId,
    notes: `v0.43.1 invite grant player for ${identityInput.roundKey || DEV_ROUND_DEFAULTS.roundKey}`,
  });

  return {
    row: inserted,
    created: true,
  };
}

async function getOrCreateInviteGrantAccessLink(roundId, playerId, grantId, inviteGrant) {
  const columns = 'id, player_id, access_type, invite_token_id, grant_id, token_hash_prefix, provider, status, issued_at, revoked_at, created_at, updated_at, notes';
  const existing = await fetchSingleRow(
    'multiplayer_player_access_links',
    columns,
    (query) => query.eq('grant_id', grantId).eq('status', 'active')
  );

  if (existing) {
    return {
      row: existing,
      created: false,
    };
  }

  try {
    const inserted = await insertSingleRow('multiplayer_player_access_links', {
      player_id: playerId,
      access_type: 'invite-token',
      invite_token_id: null,
      grant_id: grantId,
      token_hash_prefix: normalizeText(inviteGrant?.token_prefix || '') || null,
      provider: 'antrophai-token-service',
      status: 'active',
      issued_at: inviteGrant?.claimed_at || nowIso(),
      revoked_at: null,
      notes: `Linked automatically from invite grant for round ${roundId}.`,
    });

    return {
      row: inserted,
      created: true,
    };
  } catch (error) {
    if (error && typeof error === 'object' && (error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate'))) {
      const retry = await fetchSingleRow(
        'multiplayer_player_access_links',
        columns,
        (query) => query.eq('grant_id', grantId).eq('status', 'active')
      );

      if (retry) {
        return {
          row: retry,
          created: false,
        };
      }
    }

    throw error;
  }
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
    notes: `v0.43.1 dev seed round for ${seedInput.roundKey}`,
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
    notes: `v0.43.1 dev seed player for ${seedInput.roundKey}`,
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
    'id, player_id, round_id, tick, state_version, race_key, land, power, money, banked, energy, food, water, population, created_at, updated_at',
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
    money: ECONOMY_STARTING_MONEY,
    banked: 0,
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
  const missingRows = expectedRows.filter((row) => !existingKeys.has(row.building_key));

  await Promise.all(
    missingRows.map((row) =>
      insertSingleRow('multiplayer_player_buildings', {
        round_id: roundId,
        player_id: playerId,
        building_key: row.building_key,
        count: row.count,
        effective_count: row.count,
      })
    )
  );

  return {
    created: missingRows.length > 0,
  };
}

async function getOrCreatePlayerArmies(roundId, playerId) {
  // Six race-agnostic unit slots; the race resolves at read time from
  // multiplayer_player_state.race_key. Legacy infantry/defense rows from the
  // earlier proof are left in place and ignored by slot-based readers.
  const expectedRows = DEV_UNIT_SLOT_KEYS.map((unitKey) => ({ unit_key: unitKey, count: 0 }));
  const existing = await fetchRows('multiplayer_player_armies', 'id, player_id, round_id, unit_key, count, training_count, returning_count, created_at, updated_at', (query) =>
    query.eq('round_id', roundId).eq('player_id', playerId)
  );
  const existingKeys = new Set(existing.map((row) => row.unit_key));
  // Only create rows that are missing. Upserting the full expected set here
  // overwrote existing army counts with zero on every hosted entry.
  const missingRows = expectedRows.filter((row) => !existingKeys.has(row.unit_key));

  await Promise.all(
    missingRows.map((row) =>
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
    created: missingRows.length > 0,
  };
}

async function getOrCreatePlayerScience(roundId, playerId) {
  // One row per research field (level 0), mirroring the buildings row pattern.
  // Only missing rows are created so existing levels are never overwritten.
  const existing = await fetchRows('multiplayer_player_science', 'id, player_id, round_id, science_key, level, created_at, updated_at', (query) =>
    query.eq('round_id', roundId).eq('player_id', playerId)
  );
  const existingKeys = new Set(existing.map((row) => row.science_key));
  const missingRows = DEV_SCIENCE_FIELDS.filter((field) => !existingKeys.has(field));

  await Promise.all(
    missingRows.map((field) =>
      insertSingleRow('multiplayer_player_science', {
        round_id: roundId,
        player_id: playerId,
        science_key: field,
        level: 0,
      })
    )
  );

  return {
    created: missingRows.length > 0,
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
    banked: state.banked,
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

function formatScienceRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    scienceKey: row.science_key,
    level: row.level,
  }));
}

function normalizeHostedScienceSummary(rows = []) {
  const levels = scienceLevelsFromRows(rows);
  const byKey = Object.fromEntries(DEV_SCIENCE_FIELDS.map((field) => [field, { level: levels[field] }]));
  return {
    rows: formatScienceRows(rows),
    fields: DEV_SCIENCE_FIELDS.map((field) => ({ scienceKey: field, level: levels[field] })),
    byKey,
    levels,
  };
}

function normalizeHostedPlayerState(state) {
  return {
    id: state?.id || null,
    tick: Number(state?.tick ?? state?.stateTick ?? state?.currentTick ?? 0),
    stateVersion: Number(state?.stateVersion ?? state?.state_version ?? 0),
    raceKey: state?.raceKey || state?.race_key || 'unknown',
    land: Number(state?.land ?? 0),
    power: Number(state?.power ?? 0),
    money: Number(state?.money ?? 0),
    banked: Number(state?.banked ?? 0),
    energy: Number(state?.energy ?? 0),
    food: Number(state?.food ?? 0),
    water: Number(state?.water ?? 0),
    population: Number(state?.population ?? 0),
  };
}

function normalizeHostedBuildingSummary(rows = []) {
  const grouped = groupRowsByKey(rows, 'building_key');
  const summaryForKey = (key) => {
    const count = canonicalCountFromRows(grouped.get(key) || []);
    const effectiveCount = count;
    return {
      count,
      effectiveCount,
    };
  };

  const counts = {
    livingArea: summaryForKey('living_area').count,
    factory: summaryForKey('factory').effectiveCount,
    barracks: summaryForKey('barracks').count,
    bank: summaryForKey('bank').count,
    scienceLabs: summaryForKey('science_labs').count,
    nutritionSuppliers: summaryForKey('nutrition_suppliers').count,
    waterPurifiers: summaryForKey('water_purifiers').count,
    powerPlants: summaryForKey('power_plants').count,
  };

  return {
    rows: formatBuildingRows(rows),
    byKey: {
      living_area: summaryForKey('living_area'),
      factory: summaryForKey('factory'),
      barracks: summaryForKey('barracks'),
      bank: summaryForKey('bank'),
      science_labs: summaryForKey('science_labs'),
      nutrition_suppliers: summaryForKey('nutrition_suppliers'),
      water_purifiers: summaryForKey('water_purifiers'),
      power_plants: summaryForKey('power_plants'),
    },
    counts,
    livingArea: counts.livingArea,
    factory: counts.factory,
    factories: counts.factory,
    barracks: counts.barracks,
    bank: counts.bank,
    banks: counts.bank,
    scienceLabs: counts.scienceLabs,
    science_labs: counts.scienceLabs,
  };
}

function normalizeHostedArmySummary(rows = []) {
  const grouped = groupRowsByKey(rows, 'unit_key');
  const summaryForKey = (key) => {
    const row = (grouped.get(key) || [null])[0];
    const count = Math.max(0, Math.floor(Number(row?.count ?? 0)));
    // Rows arrive either raw (snake_case) or pre-formatted (camelCase, via
    // formatArmyRows) depending on the caller, matching canonicalCountFromRows.
    const trainingCount = Math.max(0, Math.floor(Number(row?.training_count ?? row?.trainingCount ?? 0)));
    const returningCount = Math.max(0, Math.floor(Number(row?.returning_count ?? row?.returningCount ?? 0)));
    return {
      count,
      trainingCount,
      returningCount,
    };
  };

  const slots = DEV_UNIT_SLOT_KEYS.map((unitKey, index) => ({
    unitSlot: index + 1,
    unitKey,
    ...summaryForKey(unitKey),
  }));

  return {
    rows: formatArmyRows(rows),
    slots,
    byKey: {
      infantry: summaryForKey('infantry'),
      defense: summaryForKey('defense'),
      ...Object.fromEntries(slots.map((slot) => [slot.unitKey, { count: slot.count, trainingCount: slot.trainingCount, returningCount: slot.returningCount }])),
    },
    counts: {
      infantry: summaryForKey('infantry').count,
      defense: summaryForKey('defense').count,
      training: summaryForKey('infantry').trainingCount + summaryForKey('defense').trainingCount,
      returning: summaryForKey('infantry').returningCount + summaryForKey('defense').returningCount,
    },
    infantry: summaryForKey('infantry').count,
    defense: summaryForKey('defense').count,
    training: summaryForKey('infantry').trainingCount + summaryForKey('defense').trainingCount,
    returning: summaryForKey('infantry').returningCount + summaryForKey('defense').returningCount,
  };
}

function compactHostedPlayerSummary(player = {}) {
  return {
    id: player.id,
    displayName: player.displayName || player.display_name || 'Unknown player',
    testerLabel: player.testerLabel || player.tester_label || null,
    playerRoundId: player.playerRoundId || player.player_round_id || null,
    grantId: player.grantId || player.grant_id || player.createdFromGrantId || player.created_from_grant_id || null,
    accessLinkId: player.accessLinkId || player.access_link_id || null,
    identityScope: player.identityScope || null,
    isGrantLinked: Boolean(player.isGrantLinked),
    currentTick: Number(player.state?.tick ?? player.currentTick ?? 0),
    raceKey: player.state?.raceKey || player.state?.race_key || 'unknown',
    land: Number(player.state?.land ?? 0),
    power: Number(player.state?.power ?? 0),
    factoryCount: Math.max(0, Math.floor(Number(player.factoryCount ?? 0))),
    queuedCount: Math.max(0, Math.floor(Number(player.queuedCount ?? 0))),
    processedCount: Math.max(0, Math.floor(Number(player.processedCount ?? 0))),
  };
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

function canonicalCountFromRows(rows = []) {
  return rows.reduce((max, row) => {
    const value = Math.max(0, Math.floor(Number(row?.effective_count ?? row?.effectiveCount ?? row?.count ?? 0)));
    return value > max ? value : max;
  }, 0);
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
  const camelKeyName = keyName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  return rows.reduce((map, row) => {
    const key = row[keyName] ?? row[camelKeyName];
    const bucket = map.get(key) || [];
    bucket.push(row);
    map.set(key, bucket);
    return map;
  }, new Map());
}
