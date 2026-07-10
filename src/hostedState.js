// Hosted-round state adapters, extracted from App.jsx as-is.
// Pure functions only: they build request bodies for the game-service, normalise
// service responses into the summaries App.jsx stores in React state, and derive
// the read-model snapshot the hosted pages render from. The canonical player id
// and identity always come from the service response / invite grant — never from
// client-editable display names or tester labels.
import { races } from "./gameData.js";
import { cleanSingleLineText } from "./gameMath.js";
import { maskStableIdentifier, MULTIPLAYER_PREVIEW_ROUND_KEY, HOSTED_BUILDING_ORDER, hostedBuildingLabel, HOSTED_SCIENCE_FIELDS, hostedScienceLabel } from "./hostedApi.js";
import { scienceDurationSeconds } from "./gameMath.js";

function raceNameFromKey(key) { return races[key]?.name || "Human"; }

export function buildIdentityFallbackSummary(testerAccessRecord) {
  const accessGrant = testerAccessRecord?.accessGrant || null;
  const testerLabel = cleanSingleLineText(testerAccessRecord?.testerLabel || accessGrant?.testerLabel || "", 80).trim() || null;
  const displayName = cleanSingleLineText(testerLabel || "DEV Invite Tester", 80).trim() || "DEV Invite Tester";
  return {
    grantId: null,
    resolvedFrom: testerAccessRecord?.accessMode === "invite-token" ? "pending-resolution" : "development-fallback",
    roundKey: MULTIPLAYER_PREVIEW_ROUND_KEY,
    roundName: "Shared Multiplayer DEV",
    roundStatus: "draft",
    currentTick: 0,
    playerId: null,
    playerRoundId: null,
    displayName,
    testerLabel,
  };
}
export function buildIdentityRequestBody({ resolvedSummary, testerAccessRecord }) {
  const resolved = resolvedSummary || null;
  const accessGrant = testerAccessRecord?.accessGrant || null;
  const testerLabel = cleanSingleLineText(resolved?.testerLabel || testerAccessRecord?.testerLabel || accessGrant?.testerLabel || "", 80).trim() || null;
  const displayName = cleanSingleLineText(resolved?.displayName || testerLabel || "DEV Invite Tester", 80).trim() || "DEV Invite Tester";
  return {
    roundKey: MULTIPLAYER_PREVIEW_ROUND_KEY,
    grantId: resolved?.grantId || accessGrant?.grantId || accessGrant?.currentGrantId || null,
    testerLabel,
    displayName,
  };
}
export function buildHostedRoundRequestBody({ hostedSummary, testerAccessRecord }) {
  const accessGrant = testerAccessRecord?.accessGrant || null;
  const grantId = cleanSingleLineText(String(hostedSummary?.grantId || accessGrant?.grantId || accessGrant?.currentGrantId || ""), 128).trim() || "";
  return {
    roundKey: MULTIPLAYER_PREVIEW_ROUND_KEY,
    grantId,
  };
}
export function buildQueueBuildOrderBody({ hostedSummary, testerAccessRecord, buildingKey, amount = 1 }) {
  return {
    ...buildHostedRoundRequestBody({ hostedSummary, testerAccessRecord }),
    buildingKey,
    amount,
  };
}
export function buildQueueTrainOrderBody({ hostedSummary, testerAccessRecord, unitSlot, amount = 1 }) {
  return {
    ...buildHostedRoundRequestBody({ hostedSummary, testerAccessRecord }),
    unitSlot,
    amount,
  };
}
export function buildCompleteDueBody({ hostedSummary, testerAccessRecord, screen }) {
  return {
    ...buildHostedRoundRequestBody({ hostedSummary, testerAccessRecord }),
    screen,
  };
}
export function buildQueueExploreBody({ hostedSummary, testerAccessRecord, hours, spend }) {
  return {
    ...buildHostedRoundRequestBody({ hostedSummary, testerAccessRecord }),
    hours,
    spend,
  };
}
// Display-only mirror of the server's explore gain (estimateExploreGain,
// src/App.jsx, scanner bonus 1 — no hosted scanners). The server recomputes and
// locks the authoritative gain at queue time.
export function hostedExploreEstimate(hours, spend, landNow) {
  const h = Math.max(1, Math.floor(Number(hours) || 0));
  const cardFactor = Math.sqrt(Math.max(0.01, (Number(spend) || 0) / 1000000));
  const landPenalty = Math.sqrt(1000 / Math.max(1000, Number(landNow) || 0));
  return Math.max(1, Math.floor(120 * Math.sqrt(h) * cardFactor * landPenalty));
}
export function buildQueueScienceBody({ hostedSummary, testerAccessRecord, field }) {
  return {
    ...buildHostedRoundRequestBody({ hostedSummary, testerAccessRecord }),
    field,
  };
}
export function buildBankActionBody({ hostedSummary, testerAccessRecord, amount }) {
  return {
    ...buildHostedRoundRequestBody({ hostedSummary, testerAccessRecord }),
    amount,
  };
}
// Seven research fields from the hosted science summary, with the reference
// labels and a display-only next-level duration (scienceDurationSeconds,
// src/gameMath.js — quadratic in currentLevel+1 over the lab curve). The server
// recomputes the authoritative duration at queue time from the current level.
export function hostedScienceRows(science, scienceLabs) {
  const levels = science && typeof science === "object" && science.levels && typeof science.levels === "object" ? science.levels : {};
  return HOSTED_SCIENCE_FIELDS.map((field) => {
    const level = Math.max(0, Math.floor(Number(levels[field] ?? 0)));
    return {
      field,
      label: hostedScienceLabel(field),
      level,
      nextLevel: level + 1,
      nextLevelSeconds: scienceDurationSeconds(level, { science_labs: Math.max(0, Math.floor(Number(scienceLabs) || 0)) }),
    };
  });
}
// Six race-agnostic unit slots from the hosted armies summary, labelled with the
// reference unit names for the player's race (races[raceKey] || races.human).
export function hostedArmyRows(armies, raceKey) {
  const race = races[raceKey] || races.human;
  const slots = Array.isArray(armies?.slots) ? armies.slots : [];
  return race.unitStats.map((unit, index) => {
    const slot = slots.find((s) => Number(s.unitSlot) === index + 1) || armies?.byKey?.[`unit_${index + 1}`] || {};
    return {
      unitSlot: index + 1,
      unitKey: `unit_${index + 1}`,
      label: unit.name,
      count: Math.max(0, Math.floor(Number(slot.count ?? 0))),
      trainingCount: Math.max(0, Math.floor(Number(slot.trainingCount ?? 0))),
    };
  });
}
export function hostedBuildingRows(buildings) {
  const byKey = buildings && typeof buildings === "object" && buildings.byKey && typeof buildings.byKey === "object" ? buildings.byKey : {};
  const orderedKeys = [
    ...HOSTED_BUILDING_ORDER.filter((key) => key in byKey),
    ...Object.keys(byKey).filter((key) => !HOSTED_BUILDING_ORDER.includes(key)),
  ];
  return orderedKeys.map((key) => {
    const row = byKey[key] || {};
    return {
      buildingKey: key,
      label: hostedBuildingLabel(key),
      count: Math.max(0, Math.floor(Number(row.count ?? 0))),
      effectiveCount: Math.max(0, Math.floor(Number(row.effectiveCount ?? row.count ?? 0))),
    };
  });
}

export function normaliseHealthSummary(result, responseOk) {
  return {
    reachable: Boolean(responseOk && result?.ok !== false),
    service: result?.service || "antrophai-game-service",
    version: result?.version || null,
    environment: result?.environment || null,
    dbReachable: result?.dbReachable ?? null,
    inviteLedgerReachable: result?.schemaCheck?.invite_tokens?.reachable ?? null,
    devEndpointsEnabled: result?.devEndpointsEnabled ?? null,
    supabaseConfigured: result?.supabaseConfigured ?? null,
    allowedOriginsCount: result?.allowedOriginsCount ?? null,
  };
}
export function normalisePreviewSummary(result) {
  return {
    round: result?.round || null,
    players: Array.isArray(result?.players) ? result.players.map((player) => ({ ...player, factoryCount: Number(player?.factoryCount ?? 0) })) : [],
    recentEvents: Array.isArray(result?.recentEvents) ? result.recentEvents : [],
    recentPublicEvents: Array.isArray(result?.recentPublicEvents) ? result.recentPublicEvents : [],
    recentActions: Array.isArray(result?.recentActions) ? result.recentActions : [],
    recentTickLogs: Array.isArray(result?.recentTickLogs) ? result.recentTickLogs : [],
    actionSummary: result?.actionSummary || null,
    proofBoundary: result?.proofBoundary || null,
    roundSummary: result?.roundSummary || null,
  };
}
export function normaliseHostedRoundSummary(result, grantId) {
  return {
    round: result?.round || null,
    player: result?.player || null,
    playerState: result?.playerState || null,
    buildings: result?.buildings || null,
    armies: result?.armies || null,
    science: result?.science || null,
    actionSummary: result?.actionSummary || null,
    recentEvents: Array.isArray(result?.recentEvents) ? result.recentEvents : [],
    otherPlayers: Array.isArray(result?.otherPlayers) ? result.otherPlayers : [],
    roundSummary: result?.roundSummary || null,
    proofBoundary: result?.proofBoundary || null,
    canonicalState: result?.canonicalState || null,
    accessLinkCreated: Boolean(result?.accessLinkCreated),
    resolvedFrom: result?.resolvedFrom || null,
    grantId: result?.grantId || grantId,
    currentPlayerId: result?.currentPlayerId || result?.player?.id || null,
    currentPlayerSummary: result?.currentPlayerSummary || null,
  };
}
export function normaliseIdentitySummary(identity, { displayName, testerLabel }) {
  return identity ? {
    grantId: identity.grantId || null,
    resolvedFrom: identity.resolvedFrom || "invite_grant",
    roundKey: identity.roundKey || MULTIPLAYER_PREVIEW_ROUND_KEY,
    roundName: identity.roundName || "Shared Multiplayer DEV",
    roundStatus: identity.roundStatus || null,
    currentTick: Number(identity.currentTick ?? 0),
    currentPlayerId: identity.currentPlayerId || identity.playerId || null,
    playerId: identity.playerId || null,
    playerRoundId: identity.playerRoundId || null,
    displayName: identity.displayName || displayName,
    testerLabel: identity.testerLabel || testerLabel,
    requestedDisplayNameIgnored: Boolean(identity.requestedDisplayNameIgnored),
    requestedTesterLabelIgnored: Boolean(identity.requestedTesterLabelIgnored),
  } : null;
}

export function buildHostedShellSnapshot({ hostedRoundState, identitySummary, testerAccessRecord }) {
  const summary = hostedRoundState.summary || null;
  const round = summary?.round || null;
  const player = summary?.player || null;
  const playerState = summary?.playerState || null;
  const buildings = summary?.buildings || null;
  const armies = summary?.armies || null;
  const science = summary?.science || null;
  const actionSummary = summary?.actionSummary || null;
  const recentEvents = Array.isArray(summary?.recentEvents) ? summary.recentEvents : [];
  const otherPlayers = Array.isArray(summary?.otherPlayers) ? summary.otherPlayers : [];
  const roundSummary = summary?.roundSummary || null;
  const proofBoundary = summary?.proofBoundary || null;
  const currentPlayerSummary = summary?.currentPlayerSummary || null;
  const identity = identitySummary || null;
  const hostedGrantId = summary?.grantId || identity?.grantId || testerAccessRecord?.accessGrant?.grantId || testerAccessRecord?.accessGrant?.currentGrantId || "";
  const playerId = identity?.currentPlayerId || identity?.playerId || player?.id || currentPlayerSummary?.playerId || currentPlayerSummary?.id || "";
  const displayName = player?.displayName || currentPlayerSummary?.displayName || identity?.displayName || testerAccessRecord?.testerLabel || "Unknown player";
  const testerLabel = player?.testerLabel || currentPlayerSummary?.testerLabel || identity?.testerLabel || testerAccessRecord?.testerLabel || "";
  const playerLabel = player ? `${displayName}${testerLabel ? ` / ${testerLabel}` : ""}` : "Hosted round not entered yet";
  const raceKey = playerState?.raceKey || playerState?.race || identity?.raceKey || currentPlayerSummary?.raceKey || "human";
  const raceLabel = raceNameFromKey(raceKey);
  const land = Number(playerState?.land ?? currentPlayerSummary?.land ?? 0);
  const power = Number(playerState?.power ?? currentPlayerSummary?.power ?? 0);
  const money = Number(playerState?.money ?? currentPlayerSummary?.money ?? 0);
  const banked = Number(playerState?.banked ?? 0);
  const energy = Number(playerState?.energy ?? 0);
  const food = Number(playerState?.food ?? 0);
  const water = Number(playerState?.water ?? 0);
  const population = Number(playerState?.population ?? 0);
  const currentTick = round?.currentTick ?? roundSummary?.currentTick ?? "-";
  const roundKey = round?.roundKey || MULTIPLAYER_PREVIEW_ROUND_KEY;
  const roundName = round?.roundName || "Shared Multiplayer DEV";
  const roundStatus = roundSummary?.roundStatus || round?.status || "Unknown";
  const buildingRows = hostedBuildingRows(buildings);
  const armyRows = hostedArmyRows(armies, raceKey);
  const scienceLabsCount = Number(buildings?.byKey?.science_labs?.count ?? buildings?.scienceLabs ?? buildings?.science_labs ?? 0);
  const scienceRows = hostedScienceRows(science, scienceLabsCount);
  // Bank cap mirrors the reference calcCaps.bankCap: banks * 250000 * banking bonus.
  const banksCount = Number(buildings?.byKey?.bank?.count ?? buildings?.bank ?? buildings?.banks ?? 0);
  const bankingLevel = Number(science?.levels?.banking ?? 0);
  const bankCap = banksCount * 250000 * (1 + Math.max(0, Math.floor(bankingLevel)) * 0.0005);
  const factoryCount = Number(summary?.factoryCount ?? buildings?.factories ?? buildings?.counts?.factory ?? currentPlayerSummary?.factoryCount ?? 0);
  const queuedCount = Number(summary?.queuedCount ?? actionSummary?.queued ?? currentPlayerSummary?.queuedCount ?? 0);
  const processedCount = Number(summary?.processedCount ?? actionSummary?.processed ?? currentPlayerSummary?.processedCount ?? 0);
  const dueNowCount = Number(actionSummary?.dueNow ?? 0);
  const lastFetchLabel = hostedRoundState.fetchedAt ? new Date(hostedRoundState.fetchedAt).toLocaleString() : "Not entered yet";
  const latestResetAt = proofBoundary?.latestResetAt || roundSummary?.latestResetAt || null;
  const latestResetEvent = proofBoundary?.latestResetEvent || roundSummary?.latestResetEvent || null;
  const latestResetLabel = latestResetAt ? new Date(latestResetAt).toLocaleString() : "No proof reset yet";
  const latestResetEventLabel = latestResetEvent ? `${latestResetEvent.eventType || latestResetEvent.visibility || "Reset event"} · ${latestResetEvent.id ? maskStableIdentifier(latestResetEvent.id) : "unknown"}` : "No reset event yet";
  const otherPlayerSummary = otherPlayers.length ? otherPlayers.slice(0, 4).map((other) => other.displayName || other.testerLabel || maskStableIdentifier(other.id || "") || "Unknown").join(", ") : "None";
  return {
    summary,
    round,
    player,
    playerState,
    buildings,
    armies,
    actionSummary,
    recentEvents,
    otherPlayers,
    roundSummary,
    proofBoundary,
    currentPlayerSummary,
    hostedGrantId,
    playerId,
    displayName,
    testerLabel,
    playerLabel,
    raceKey,
    raceLabel,
    land,
    power,
    money,
    banked,
    bankCap,
    banksCount,
    energy,
    food,
    water,
    population,
    currentTick,
    roundKey,
    roundName,
    roundStatus,
    buildingRows,
    armyRows,
    scienceRows,
    factoryCount,
    queuedCount,
    processedCount,
    dueNowCount,
    lastFetchLabel,
    latestResetAt,
    latestResetEvent,
    latestResetLabel,
    latestResetEventLabel,
    otherPlayerSummary,
    identity,
  };
}
