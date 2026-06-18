const fs = require('fs');
const http = require('http');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { URL } = require('url');

const LOCAL_ENV_PATH = path.join(__dirname, '..', '.env');
const LOCAL_ENV_LOADED = loadLocalEnvFile(LOCAL_ENV_PATH);

const SERVICE_NAME = 'antrophai-invite-token-service';
const SERVICE_VERSION = 'v0.41.84';
const PORT = Number(process.env.PORT || 8787);
const RAW_ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '');
const SUPABASE_URL = normalizeUrl(process.env.SUPABASE_URL || '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TOKEN_HASH_PEPPER = process.env.TOKEN_HASH_PEPPER || '';
const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:4173',
  'http://localhost:4173',
];
const ALLOWED_ORIGINS = new Set(
  [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...splitList(process.env.ALLOWED_ORIGINS),
  ].filter(Boolean)
);

const rateBuckets = new Map();

function loadLocalEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    let key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (!key) {
      continue;
    }

    if (key.startsWith('export ')) {
      key = key.slice(7).trim();
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }

  return true;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function nowIso() {
  return new Date().toISOString();
}

function jsonResponse(res, statusCode, payload, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

function isOriginAllowed(origin) {
  if (!origin) {
    return false;
  }

  if (ALLOWED_ORIGINS.has('*')) {
    return true;
  }

  return ALLOWED_ORIGINS.has(origin);
}

function rateLimitKey(req, routeName) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' && forwarded.length > 0
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || 'unknown';
  return `${routeName}:${ip}`;
}

function allowRequest(req, routeName, limit, windowMs) {
  const key = rateLimitKey(req, routeName);
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  current.count += 1;
  rateBuckets.set(key, current);

  if (current.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

function cleanupRateBuckets() {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}

setInterval(cleanupRateBuckets, 60_000).unref();

function readJsonBody(req, limitBytes = 16_384) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let raw = '';

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(Object.assign(new Error('Request body too large.'), { statusCode: 413, code: 'request_too_large' }));
        req.destroy();
        return;
      }
      raw += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400, code: 'invalid_json' }));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function validateString(value, fieldName, minLength = 1, maxLength = 256) {
  if (typeof value !== 'string') {
    throw Object.assign(new Error(`${fieldName} must be a string.`), { statusCode: 400, code: 'invalid_request' });
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw Object.assign(new Error(`${fieldName} must be between ${minLength} and ${maxLength} characters.`), {
      statusCode: 400,
      code: 'invalid_request',
    });
  }

  return trimmed;
}

function hashToken(rawToken) {
  return createHash('sha256').update(`${TOKEN_HASH_PEPPER}${rawToken}`, 'utf8').digest('hex');
}

function tokenPrefixFromHash(tokenHash) {
  return tokenHash.slice(0, 8);
}

function buildSupabaseHeaders() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseRpc(functionName, body) {
  const headers = buildSupabaseHeaders();
  if (!headers) {
    throw Object.assign(new Error('Supabase is not configured.'), { statusCode: 503, code: 'service_unavailable' });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload.error || payload : {};
    const message = error.message || payload.message || `Supabase RPC ${functionName} failed.`;
    const code = error.code || payload.code || 'service_unavailable';
    throw Object.assign(new Error(message), {
      statusCode: mapErrorCodeToStatus(code, response.status),
      code,
      details: payload,
    });
  }

  if (payload && typeof payload === 'object' && payload.ok === false) {
    const error = payload.error || {};
    throw Object.assign(new Error(error.message || `Supabase RPC ${functionName} returned a failure.`), {
      statusCode: mapErrorCodeToStatus(error.code || 'service_unavailable', response.status),
      code: error.code || 'service_unavailable',
      details: payload,
    });
  }

  return payload;
}

async function supabaseSelectGrant(grantId) {
  const byCurrentGrant = await supabaseSelectGrantByColumn('current_grant_id', grantId);
  if (byCurrentGrant) {
    return byCurrentGrant;
  }

  return supabaseSelectGrantByColumn('grant_id', grantId);
}

async function supabaseSelectGrantByColumn(columnName, grantId) {
  const headers = buildSupabaseHeaders();
  if (!headers) {
    throw Object.assign(new Error('Supabase is not configured.'), { statusCode: 503, code: 'service_unavailable' });
  }

  const query = new URLSearchParams({
    select: 'id,grant_id,current_grant_id,claim_count,tester_label,token_prefix,status,claimed_at,expires_at,revoked_at,last_seen_at,claimed_client_build,min_client_build,created_at',
    [columnName]: `eq.${grantId}`,
    limit: '1',
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/invite_tokens?${query.toString()}`, {
    method: 'GET',
    headers,
  });

  const text = await response.text();
  let payload = [];

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = [];
    }
  }

  if (!response.ok) {
    throw Object.assign(new Error('Supabase grant lookup failed.'), {
      statusCode: mapErrorCodeToStatus('service_unavailable', response.status),
      code: 'service_unavailable',
      details: payload,
    });
  }

  return Array.isArray(payload) ? payload[0] || null : payload;
}

async function supabaseTouchGrant(id, lastSeenAt) {
  const headers = buildSupabaseHeaders();
  if (!headers) {
    return;
  }

  await fetch(`${SUPABASE_URL}/rest/v1/invite_tokens?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ last_seen_at: lastSeenAt }),
  });
}

function mapErrorCodeToStatus(code, fallbackStatus) {
  switch (code) {
    case 'token_invalid':
      return 404;
    case 'token_claimed':
      return 409;
    case 'token_revoked':
      return 403;
    case 'token_expired':
      return 410;
    case 'build_not_allowed':
      return 403;
    case 'rate_limited':
      return 429;
    case 'service_unavailable':
      return 503;
    default:
      return fallbackStatus >= 400 ? fallbackStatus : 500;
  }
}

function makeAccessGrant(row, fallbackGrantId, fallbackTokenHashPrefix) {
  const tokenId = row && row.id != null ? `tok_${row.id}` : null;
  const currentGrantId = row?.current_grant_id || row?.currentGrantId || row?.grant_id || row?.grantId || fallbackGrantId;
  return {
    grantId: currentGrantId,
    currentGrantId,
    tokenId,
    testerLabel: row?.tester_label || null,
    tokenHashPrefix: row?.token_prefix || fallbackTokenHashPrefix,
    issuedAt: row?.claimed_at || row?.created_at || nowIso(),
    expiresAt: row?.expires_at || null,
    accessMode: 'invite-token',
    claimCount: typeof row?.claim_count === 'number' ? row.claim_count : Number(row?.claim_count || 0),
  };
}

async function handleRedeem(req, res, origin) {
  const limit = allowRequest(req, 'redeem', 20, 60_000);
  if (!limit.allowed) {
    jsonResponse(res, 429, {
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Too many invite redemption attempts. Please try again later.',
        retryAfterSeconds: limit.retryAfterSeconds,
      },
    }, origin);
    return;
  }

  const body = await readJsonBody(req);
  const rawToken = validateString(body.token, 'token', 2, 512);
  const clientBuild = validateString(body.clientBuild || 'v0.41.84', 'clientBuild', 1, 64);
  const clientNonce = typeof body.clientNonce === 'string' ? body.clientNonce.trim() : '';
  const testerComment = typeof body.testerComment === 'string' ? body.testerComment.trim() : '';

  const tokenHash = hashToken(rawToken);
  const grantId = `grant_${randomUUID().replace(/-/g, '')}`;
  const rpcPayload = await supabaseRpc('redeem_invite_token', {
    p_token_hash: tokenHash,
    p_grant_id: grantId,
    p_client_build: clientBuild,
  });

  const rpcGrant = rpcPayload && typeof rpcPayload === 'object'
    ? rpcPayload.grant || rpcPayload.accessGrant || rpcPayload
    : {};

  const accessGrant = makeAccessGrant(rpcGrant, grantId, tokenPrefixFromHash(tokenHash));
  jsonResponse(res, 200, {
    ok: true,
    accessGrant,
    meta: {
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      clientBuild,
      clientNonce: clientNonce || undefined,
      testerComment: testerComment || undefined,
    },
  }, origin);
}

async function handleRevalidate(req, res, origin) {
  const limit = allowRequest(req, 'revalidate', 60, 60_000);
  if (!limit.allowed) {
    jsonResponse(res, 429, {
      ok: false,
      grantValid: false,
      error: {
        code: 'rate_limited',
        message: 'Too many revalidation requests. Please try again later.',
        retryAfterSeconds: limit.retryAfterSeconds,
      },
    }, origin);
    return;
  }

  const body = await readJsonBody(req);
  const grantSource = typeof body.grantId === 'string'
    ? body.grantId
    : body.accessGrant && typeof body.accessGrant.grantId === 'string'
      ? body.accessGrant.grantId
      : '';
  const grantId = validateString(grantSource, 'grantId', 4, 256);
  const clientBuildSource = typeof body.clientBuild === 'string'
    ? body.clientBuild
    : body.accessGrant && typeof body.accessGrant.clientBuild === 'string'
      ? body.accessGrant.clientBuild
      : 'v0.41.84';
  const clientBuild = validateString(clientBuildSource, 'clientBuild', 1, 64);

  const row = await supabaseSelectGrant(grantId);
  if (!row) {
    jsonResponse(res, 404, {
      ok: false,
      grantValid: false,
      error: {
        code: 'grant_not_found',
        message: 'Invite grant was not recognised.',
      },
    }, origin);
    return;
  }

  const status = String(row.status || '').toLowerCase();
  const rowGrantId = row.current_grant_id || row.grant_id || '';
  if (status !== 'claimed' || rowGrantId !== grantId || status === 'revoked' || status === 'expired') {
    jsonResponse(res, mapErrorCodeToStatus(`grant_${status || 'invalid'}`, 403), {
      ok: false,
      grantValid: false,
      error: {
        code: status ? `grant_${status}` : 'grant_invalid',
        message: status === 'revoked'
          ? 'This invite grant has been revoked.'
          : status === 'expired'
            ? 'This invite grant has expired.'
            : 'This invite grant is not valid.',
      },
    }, origin);
    return;
  }

  const lastRevalidatedAt = nowIso();
  await supabaseTouchGrant(row.id, lastRevalidatedAt);

  jsonResponse(res, 200, {
    ok: true,
    grantValid: true,
    accessGrant: {
      ...makeAccessGrant(row, grantId, row.token_prefix),
      lastRevalidatedAt,
      clientBuild,
      claimCount: row.claim_count ?? 0,
    },
  }, origin);
}

function handleHealth(res, origin) {
  jsonResponse(res, 200, {
    ok: true,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: process.env.RENDER ? 'production' : 'local',
    localEnvLoaded: LOCAL_ENV_LOADED,
    supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
    allowedOriginsConfigured: Boolean(RAW_ALLOWED_ORIGINS.trim()),
    allowedOriginsCount: ALLOWED_ORIGINS.size,
    timestamp: nowIso(),
  }, origin);
}

function handleNotFound(res, origin) {
  jsonResponse(res, 404, {
    ok: false,
    error: {
      code: 'not_found',
      message: 'Route not found.',
    },
  }, origin);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  try {
    if (requestUrl.pathname === '/health' && req.method === 'GET') {
      handleHealth(res, origin);
      return;
    }

    if (requestUrl.pathname === '/redeem' && req.method === 'POST') {
      await handleRedeem(req, res, origin);
      return;
    }

    if (requestUrl.pathname === '/revalidate' && req.method === 'POST') {
      await handleRevalidate(req, res, origin);
      return;
    }

    handleNotFound(res, origin);
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    const code = error.code || 'service_unavailable';
    jsonResponse(res, statusCode, {
      ok: false,
      error: {
        code,
        message: error.message || 'Invite token service error.',
        details: error.details || undefined,
      },
    }, origin);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`${SERVICE_NAME} ${SERVICE_VERSION} listening on port ${PORT}`);
});
