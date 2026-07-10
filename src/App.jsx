import React, { useEffect, useMemo, useRef, useState } from "react";
import { Panel, OldTable, TextInput, MenuButton } from "./components/shared.jsx";
import { libraryArtManifest } from "./libraryArtManifest.js";
import { storyArtManifest, modernSpeciesBonusCards } from "./storyArtManifest.js";
import { chooseSpeciesManifest } from "./chooseSpeciesManifest.js";
import { recordsManifest } from "./recordsManifest.js";
import { recordsFeaturedManifest } from "./recordsFeaturedManifest.js";
import { getLabel } from "./terminologyLabels.js";
import { raceArchivePages, archiveRaceOrder, sharedArchiveGalleries } from "./raceArchiveData.js";

import { buildingOrder, races, libraryKeyFromName, libraryStatusLabel, mineralOrder, shopPrices, shopItemOrder, day1Build, roundProfiles, TURRET_CONFIG } from "./gameData.js";
import { prototypeChangelog } from "./changelog.js";
import { navIconByPage } from "./navIcons.jsx";
import { GAME_TOTAL_TICKS, GAME_TOTAL_GAME_MS, accountRounds, speciesTraits, SAVE_KEY, ROUND_SLOT_PREFIX, ROUND_SLOT_INDEX_KEY, ROUND_SLOT_CURRENT_KEY, roundSlotSaveKey, canonicalRoundKeyForSlot, normaliseRoundSlotEntry, makeRoundSlotKey, defaultRoundSlotLabel, roundProfileForKey, roundSpeedForKey, roundStartTimestampForKey, roundClockSnapshot, formatRoundClock } from "./roundSlots.js";
import { REPORT_WORDING_MODE, REPORT_WORDING_MODES, REPORT_WORDING_MODE_NOTES, normaliseReportTextMode, reportOpeningLine, reportTurretDisabledLine, reportTurretNoEnergyLine, reportTurretFireLine, reportUnitExchangeLine, reportPlayerSummaryLine, reportBotSummaryLine, reportProtectionExperienceLine, transformClassicReportTextForMode } from "./reportWording.js";
import { TRYSAUR_WAR_DRUM_MAX_USES, speciesBonusesEnabled, raceKeyForEntity, normaliseSpeciesProgress, humanConstructionSpeedMultiplier, trysaurWarDrumProgress, trainingSpeedDivider, lithiTrainCapMultiplierForRow, effectiveMaxTrainForRow, effectiveMaxTrainByRow, reluReviveMultiplier, zarthMiningMultiplier, completedSpeedTrainCounter, shouldAwardTrysaurWarDrums, awardCompletedTrysaurWarDrums } from "./speciesBonuses.js";
import { fmt, safeDisplay, compactFmt, parseQty, TEXT_LIMITS, cleanSingleLineText, cleanMultiLineText, cleanStoredName, clampTextInput, clampPercentInput, allocationIsValid, emptyBuildings, emptyMinerals, emptyBuildForm, scienceLevelBonus, sciencePercent, totalBuildings, reservedBuildLand, totalEmpireLand, buildCost, constructionFactoryMultiplier, constructionDurationSeconds, normaliseBuildSpeedFactor, buildSpeedMultiplier, speedFactorBuildCost, speedFactorBuildSeconds, barracksTrainingMultiplier, trainingDurationSeconds, SCIENCE_TICK_SECONDS, SCIENCE_IG_TARGET_TICKS, scienceLabMultiplier, scienceDurationSeconds, armyPower, publicPowerForEmpire, stackNames } from "./gameMath.js";
import { INVITE_TOKEN_SERVICE_URL, INVITE_TOKEN_SERVICE_HOST, GAME_SERVICE_URL, MULTIPLAYER_PREVIEW_ROUND_KEY, HOSTED_QUEUE_BUILD_ENDPOINT, HOSTED_QUEUE_TRAIN_ENDPOINT, HOSTED_QUEUE_EXPLORE_ENDPOINT, HOSTED_QUEUE_SCIENCE_ENDPOINT, HOSTED_BANK_DEPOSIT_ENDPOINT, HOSTED_BANK_WITHDRAW_ENDPOINT, HOSTED_COMPLETE_DUE_ENDPOINT, hostedScienceLabel, hostedBuildingLabel, fetchGameServiceHealth, fetchDevRoundSummary, postHostedRoundEnter, postResolvePlayerIdentity, postDevAction, postInviteTokenRedeem, makeInviteTokenClientNonce, inviteTokenFailureMessage, maskStableIdentifier, hostedGameServiceFailureMessage, multiplayerPreviewFailureMessage, multiplayerIdentityFailureMessage, multiplayerDevActionFailureMessage, hostedRoundFailureMessage } from "./hostedApi.js";
import { safeParseSave, safeLoadStorageKey, safeLoadSave, safeWriteStorageKey, safeWriteSave, safeDeleteStorageKey, safeLoadRoundSlot, safeWriteRoundSlot, safeReadRoundSlotIndex, safeWriteRoundSlotIndex, upsertRoundSlotIndexEntry, safeDeleteRoundSlot, normaliseAccessGrant, safeLoadTesterAccess, safeWriteTesterAccess, safeClearTesterAccess, testerAccessRecordForCode, testerAccessModeLabel } from "./localSaveStore.js";
import { buildIdentityFallbackSummary, buildIdentityRequestBody, buildHostedRoundRequestBody, buildQueueBuildOrderBody, buildQueueTrainOrderBody, buildCompleteDueBody, buildQueueExploreBody, hostedExploreEstimate, buildQueueScienceBody, buildBankActionBody, normaliseHealthSummary, normalisePreviewSummary, normaliseHostedRoundSummary, normaliseIdentitySummary, buildHostedShellSnapshot } from "./hostedState.js";

const navItems = [
  { originalLabel: "Alliances", key: "alliances" }, { originalLabel: "Bank", key: "bank" }, { originalLabel: "Barracks", key: "barracks" }, { originalLabel: "Disband", key: "disband" }, { originalLabel: "Battle Log", key: "battlelog" }, { originalLabel: "Bonus", key: "bonus" }, { originalLabel: "Build", key: "build" }, { originalLabel: "Destroy", key: "destroy" }, { originalLabel: "Explore", key: "explore" }, { originalLabel: "Factories", key: "factories" }, { originalLabel: "Market", key: "market" }, { originalLabel: "Messages", key: "messages" }, { originalLabel: "Missiles", key: "missiles" }, { originalLabel: "Mines", key: "mines" }, { originalLabel: "News", key: "news" }, { originalLabel: "Online", key: "online" }, { originalLabel: "Rankings", key: "rankings" }, { originalLabel: "Science Labs", key: "science" }, { originalLabel: "Search", key: "search" }, { originalLabel: "Shops", key: "shops" }, { originalLabel: "Spy Center", key: "spy" }, { originalLabel: "Status", key: "status" }, { originalLabel: "To Do", key: "todo" }, { originalLabel: "War", key: "war" },
];
const PROTOTYPE_VERSION = "v0.43.1";
const ADMIN_ROUND_SLOT_KEY = "admin-start-local";

const DISPLAY_MODEL_DEFAULT = "hybrid";
const DISPLAY_MODEL_OPTIONS = {
  hybrid: {
    label: "Hybrid AntrophAI",
    short: "Race-flavoured names with familiar functional anchors.",
    help: "Uses AntrophAI species vocabulary while keeping the game's original functions easy to recognise.",
    labelMode: "modern",
    requiresAdmin: false,
  },
  modern: {
    label: "Modern AntrophAI",
    short: "Full AntrophAI wording and species-flavoured interface language.",
    help: "Uses the strongest AntrophAI vocabulary. Best once you know the icon language and page positions.",
    labelMode: "modern",
    requiresAdmin: false,
  },
  classic: {
    label: "Classic Labels",
    short: "Original-style functional names with the modern interface.",
    help: "Keeps familiar page names while retaining the AntrophAI rebuild and modern UI layer.",
    labelMode: "classic",
    requiresAdmin: false,
  },
  retro: {
    label: "Retro Mode",
    short: "Old-player/reference presentation.",
    help: "Provides a more old-style reference experience for testing, preservation, and trusted old-player access.",
    labelMode: "classic",
    requiresAdmin: true,
  },
};
const ADMIN_ACCESS_PASSWORD = "antrophai";
const RETRO_WORDING_PASSWORD = "admin1661";
const GLW_LAUNCHER_SLOT_KEY = makeRoundSlotKey("glw");
const INTRO_LAUNCHER_SLOT_KEY = makeRoundSlotKey("intro");
function normaliseDisplayModel(value) {
  return DISPLAY_MODEL_OPTIONS[value] ? value : DISPLAY_MODEL_DEFAULT;
}
function displayLabelModeFor(value) {
  return DISPLAY_MODEL_OPTIONS[normaliseDisplayModel(value)]?.labelMode || "modern";
}

function adminRoundDisplayName(name = "") {
  const clean = cleanSingleLineText(String(name || "").replace(/^Admin\s+/i, ""), TEXT_LIMITS.gameName) || "Round";
  return `Admin ${clean}`;
}
function effectiveConstructionSeconds(baseCost, speedFactor = 1, buildings = {}, allocation = {}, entity = {}, mode = REPORT_WORDING_MODE) {
  return speedFactorBuildSeconds(baseCost, speedFactor, buildings, allocation) / humanConstructionSpeedMultiplier(entity, mode);
}

const BATTLE_DEDUPE_BUCKET_MS = 60 * 1000;
const BATTLE_DEDUPE_KEEP_MS = 2 * 60 * 60 * 1000;
const SNAPSHOT_PREFIX = `${SAVE_KEY}-snapshot-`;
const REWIND_KEY = `${SAVE_KEY}-rewind-before-advance`;
const ALLIANCE_MEMBER_LIMIT = 25;
const ALLIANCE_BANK_COST = 1250;
const ALLIANCE_BANK_CAPACITY = 250000;
const ALLIANCE_MEMBER_FACTORIES = 1000;
const SPEED_TRAIN_MINERALS = ["Endaurios", "Armidi"];
const SCANNER_MINERALS = ["Arthok", "Phorfirum", "Tyron", "Chrophat", "Feronga"];
const LRC_MINERALS = mineralOrder.filter((m) => !SPEED_TRAIN_MINERALS.includes(m) && !SCANNER_MINERALS.includes(m));
const BOT_DIFFICULTY_PROFILES = {
  "Kindly": { label: "Kindly - bots sleep hard", offlineFactor: 0.35, attackChance: 0.10, growthFactor: 0.75 },
  "Normal": { label: "Normal - old-player rhythm", offlineFactor: 0.65, attackChance: 0.18, growthFactor: 1.00 },
  "Veteran": { label: "Veteran - fewer wasted windows", offlineFactor: 0.90, attackChance: 0.28, growthFactor: 1.18 },
  "Vicious": { label: "Vicious - rough playtest bots", offlineFactor: 1.20, attackChance: 0.42, growthFactor: 1.38 },
};
const BOT_DOCTRINES = {
  sixBleeder: "Six-bleeder: uses 6s up front when they bloat after full trains",
  grinder: "Grinder: builds deep 1s/2s and becomes robust over time",
  reluBalanced: "Re'lu balanced: relies on few truly weak rows",
  pRoller: "P-roller / retal farmer: banks scrupulously and invites bad attacks",
  killStack: "Kill stack opportunist: attacks hard only when rows look exposed",
  naive: "Naive veteran myth: protects 6s too much and gets farmable",
  random: "Random/noisy: makes human-looking strange choices",
};
const NEXUS_SCANNER_MINERALS = SCANNER_MINERALS;
const NEXUS_SPEED_MINERALS = SPEED_TRAIN_MINERALS;
const NEXUS_MINERALS = [...NEXUS_SCANNER_MINERALS, ...NEXUS_SPEED_MINERALS];
const LRC_CARD_QUOTA = 1000000000;
const LRC_MINERAL_QUOTA = 25000;
const LRC_CONSTRUCTION_SECONDS = 48 * 60 * 60;
const LRC_BASE_DAMAGE_PERCENT = 10;
const LRC_SHOT_BASE_COUNT = 10;
const LRC_SHOT_INTERVAL_GAME_SECONDS = 60 * 60;
const MINERAL_RESERVE_PER_LAND = 10000;
const LAND_POWER_VALUE = 1;
const MISSILE_BASES_PER_MISSILE = 20;
const MISSILE_LAUNCH_ENERGY_COST = 10000;
function missileCapacityForBuildings(buildings = {}) {
  const effectiveBases = Math.min(4000, Math.max(0, Number(buildings.missile_bases || 0)));
  return Math.floor(effectiveBases / MISSILE_BASES_PER_MISSILE);
}


const REVIVE_IDEAL_POWER_PER_LAND = 1000;
const REVIVE_CURVE_POINTS = [
  [0, 0.75],
  [20, 0.75],
  [50, 0.725],
  [80, 0.675],
  [130, 0.625],
  [200, 0.575],
  [300, 0.50],
  [500, 0.10],
];
const REVIVE_RACE_ADVANTAGES = {
  relu: ["trysaur", "human"],
  lithi: ["relu", "zarth"],
  zarth: ["relu"],
  human: ["zarth", "lithi"],
  trysaur: ["lithi", "human", "zarth"],
};
function normaliseRaceKey(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
}
function raceHasReviveAdvantage(advantagedRace, disadvantagedRace) {
  const ar = normaliseRaceKey(advantagedRace);
  const dr = normaliseRaceKey(disadvantagedRace);
  return Boolean(REVIVE_RACE_ADVANTAGES[ar]?.includes(dr));
}
function revivePercentFromPowerPerLand(powerPerLand) {
  const ppl = Number(powerPerLand || 0);
  const distance = Math.abs(ppl - REVIVE_IDEAL_POWER_PER_LAND);

  for (let i = 1; i < REVIVE_CURVE_POINTS.length; i += 1) {
    const [d0, r0] = REVIVE_CURVE_POINTS[i - 1];
    const [d1, r1] = REVIVE_CURVE_POINTS[i];
    if (distance <= d1) {
      if (d1 === d0) return r1;
      const t = (distance - d0) / (d1 - d0);
      return r0 + t * (r1 - r0);
    }
  }

  return REVIVE_CURVE_POINTS[REVIVE_CURVE_POINTS.length - 1][1];
}
function reviveRaceCapFor({ race, opponentRace, role } = {}) {
  if (!race || !opponentRace || !role) return { raceReviveCap: null, raceReviveCapReason: null, raceDisadvantaged: false };
  const disadvantaged = role === "attacker"
    ? raceHasReviveAdvantage(opponentRace, race)
    : raceHasReviveAdvantage(opponentRace, race);
  if (!disadvantaged) return { raceReviveCap: null, raceReviveCapReason: null, raceDisadvantaged: false };
  if (role === "attacker") return { raceReviveCap: 0.675, raceReviveCapReason: "attacking-against-race-advantage", raceDisadvantaged: true };
  if (role === "defender") return { raceReviveCap: 0.625, raceReviveCapReason: "defending-against-race-advantage", raceDisadvantaged: true };
  return { raceReviveCap: null, raceReviveCapReason: null, raceDisadvantaged: false };
}
function reviveStatsFor(entity = {}, roundSettings = {}, context = {}) {
  const mode = String(roundSettings.revives || "").toLowerCase();
  const raceKey = entity.race || entity.raceKey || "human";
  const totalLand = Math.max(1, totalEmpireLand(entity));
  const startPower = Math.max(0, armyPower(raceKey, entity.startArmy || entity.army || []));
  const powerPerLand = startPower / totalLand;
  const reviveDistanceFromIdeal = Math.abs(powerPerLand - REVIVE_IDEAL_POWER_PER_LAND);
  const baseRevivePercent = revivePercentFromPowerPerLand(powerPerLand);
  const cap = reviveRaceCapFor({ race: raceKey, opponentRace: context.opponentRace, role: context.role });
  let revivePercent = cap.raceReviveCap == null ? baseRevivePercent : Math.min(baseRevivePercent, cap.raceReviveCap);
  if (mode.includes("no revives")) revivePercent = 0;
  if (mode.includes("10%")) revivePercent = 0.10;
  const speciesReviveMultiplier = reluReviveMultiplier(entity, context.wordingMode);
  revivePercent *= speciesReviveMultiplier;
  return { revivePowerPerLand: powerPerLand, reviveDistanceFromIdeal, baseRevivePercent, speciesReviveMultiplier, ...cap, revivePercent };
}
function revivePercentFor(entity = {}, roundSettings = {}) {
  return reviveStatsFor(entity, roundSettings).revivePercent;
}
function applyBattleRevives(combatant = {}, roundSettings = {}, context = {}) {
  const r = races[combatant.race] || races.human;
  const killedRows = combatant.killedRows || [0,0,0,0,0,0];
  const reviveStats = reviveStatsFor(combatant, roundSettings, context);
  const pct = reviveStats.revivePercent;
  const finalArmy = (combatant.army || [0,0,0,0,0,0]).map((q, i) => Math.max(0, Math.floor(Number(q || 0))) + Math.floor((killedRows[i] || 0) * pct));
  const lineByClass = new Map();
  killedRows.forEach((killed, i) => {
    const killedQty = Math.max(0, Math.floor(Number(killed || 0)));
    if (killedQty <= 0) return;
    const revived = Math.floor(killedQty * pct);
    if (revived <= 0) return;
    const pctLabel = Math.round(killedQty > 0 ? revived / killedQty * 100 : 0);
    lineByClass.set(i + 1, `${fmt(revived)} ${r.units[i][0]} of ${combatant.name}'s army survive after the battle! (${pctLabel}% revives)`);
  });
  const orderedClasses = Array.isArray(combatant.stack) && combatant.stack.length ? combatant.stack : [1,2,3,4,5,6];
  const emitted = new Set();
  const lines = [];
  orderedClasses.forEach((unitClass) => {
    if (lineByClass.has(unitClass) && !emitted.has(unitClass)) {
      lines.push(lineByClass.get(unitClass));
      emitted.add(unitClass);
    }
  });
  [1,2,3,4,5,6].forEach((unitClass) => {
    if (lineByClass.has(unitClass) && !emitted.has(unitClass)) lines.push(lineByClass.get(unitClass));
  });
  return { army: finalArmy, lines, ...reviveStats };
}
function cloneArmy(army = []) {
  return [0,1,2,3,4,5].map((i) => Math.max(0, Math.floor(Number((army || [])[i] || 0))));
}
function armyAuditLabel(army = []) {
  return `[${cloneArmy(army).map((n) => fmt(n)).join(", ")}]`;
}
function combatantAuditSnapshot(combatant = {}) {
  const raceKey = combatant.race || combatant.raceKey || "human";
  const army = cloneArmy(combatant.army || []);
  const startArmy = cloneArmy(combatant.startArmy || combatant.army || []);
  const killedRows = cloneArmy(combatant.killedRows || []);
  return {
    name: combatant.name || "Unknown",
    race: raceKey,
    stack: [...(combatant.stack || [1,2,3,4,5,6])],
    army,
    startArmy,
    killedRows,
    power: armyPower(raceKey, army),
    startPower: armyPower(raceKey, startArmy),
    land: totalEmpireLand(combatant)
  };
}
function makeCombatAudit({ source = "unknown", now = Date.now(), reportId = "", attacker, defender, attackerBefore, defenderBefore, attackerAfterRows, defenderAfterRows, attackerAfterRevives, defenderAfterRevives, attackerRevivePercent = 0, defenderRevivePercent = 0, attackerBaseRevivePercent = 0, defenderBaseRevivePercent = 0, attackerRaceReviveCap = null, defenderRaceReviveCap = null, attackerRaceReviveCapReason = null, defenderRaceReviveCapReason = null, attackerRaceDisadvantaged = false, defenderRaceDisadvantaged = false, attackerRevivePowerPerLand = 0, defenderRevivePowerPerLand = 0, attackerReviveDistanceFromIdeal = 0, defenderReviveDistanceFromIdeal = 0, attackerLossPower = 0, defenderLossPower = 0, attackerLossPct = 0, defenderLossPct = 0, attackerWon = false, retal = false, botRunId = null, botAttemptIndex = null, retalRecord = null, turretAudit = null, round = {} }) {
  return {
    schemaVersion: "combat-audit-v1",
    prototypeVersion: PROTOTYPE_VERSION,
    source,
    reportId,
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    round,
    botRunId,
    botAttemptIndex,
    retal,
    retalRecordId: retalRecord?.id || null,
    retalSourceReportId: retalRecord?.sourceReportId || null,
    retalSourceKey: retalRecord ? retalDedupeKey(retalRecord) : null,
    result: { attackerWon, attackerLossPower, defenderLossPower, attackerLossPct, defenderLossPct },
    turretAudit,
    attacker: {
      before: attackerBefore,
      afterRowsBeforeRevives: attackerAfterRows,
      killedRows: cloneArmy(attacker?.killedRows || []),
      revivePowerPerLand: attackerRevivePowerPerLand,
      reviveDistanceFromIdeal: attackerReviveDistanceFromIdeal,
      baseRevivePercent: attackerBaseRevivePercent,
      raceReviveCap: attackerRaceReviveCap,
      raceReviveCapReason: attackerRaceReviveCapReason,
      raceDisadvantaged: attackerRaceDisadvantaged,
      revivePercent: attackerRevivePercent,
      afterRevives: attackerAfterRevives
    },
    defender: {
      before: defenderBefore,
      afterRowsBeforeRevives: defenderAfterRows,
      killedRows: cloneArmy(defender?.killedRows || []),
      revivePowerPerLand: defenderRevivePowerPerLand,
      reviveDistanceFromIdeal: defenderReviveDistanceFromIdeal,
      baseRevivePercent: defenderBaseRevivePercent,
      raceReviveCap: defenderRaceReviveCap,
      raceReviveCapReason: defenderRaceReviveCapReason,
      raceDisadvantaged: defenderRaceDisadvantaged,
      revivePercent: defenderRevivePercent,
      afterRevives: defenderAfterRevives
    }
  };
}
function appendCombatAuditLines(lines, audit) {
  if (!audit) return;
  const a = audit.attacker;
  const d = audit.defender;
  const capLabel = (side) => side.raceReviveCap == null ? "none" : `${(side.raceReviveCap * 100).toFixed(1)}% ${side.raceReviveCapReason}`;
  lines.push({ kind: "audit", text: `Combat audit ${audit.reportId}: ${a.before.name} army ${armyAuditLabel(a.before.army)} -> rows ${armyAuditLabel(a.afterRowsBeforeRevives.army)} -> revives ${armyAuditLabel(a.afterRevives.army)}; killed ${armyAuditLabel(a.killedRows)}; revive ${(a.revivePercent * 100).toFixed(1)}% at ${Number(a.revivePowerPerLand || 0).toFixed(1)} P/L (${Number(a.reviveDistanceFromIdeal || 0).toFixed(1)} from ideal); base ${(Number(a.baseRevivePercent || 0) * 100).toFixed(1)}%; race cap ${capLabel(a)}.` });
  lines.push({ kind: "audit", text: `Combat audit ${audit.reportId}: ${d.before.name} army ${armyAuditLabel(d.before.army)} -> rows ${armyAuditLabel(d.afterRowsBeforeRevives.army)} -> revives ${armyAuditLabel(d.afterRevives.army)}; killed ${armyAuditLabel(d.killedRows)}; revive ${(d.revivePercent * 100).toFixed(1)}% at ${Number(d.revivePowerPerLand || 0).toFixed(1)} P/L (${Number(d.reviveDistanceFromIdeal || 0).toFixed(1)} from ideal); base ${(Number(d.baseRevivePercent || 0) * 100).toFixed(1)}%; race cap ${capLabel(d)}.` });
  if (audit.turretAudit) {
    const t = audit.turretAudit;
    lines.push({ kind: "audit", text: `Turret audit ${audit.reportId}: disabled=${Boolean(t.disabled)}; defenderTurrets=${fmt(t.defenderTurrets || 0)}; fired=${fmt(t.turretsFired || 0)}; energy ${fmt(t.energyConsumed || 0)} / ${fmt(t.availableEnergy || 0)} at ${Number(t.energyPerShot || 0).toFixed(2)} per shot; killRate ${(Number(t.killRate || 0) * 100).toFixed(2)}%; damage ${fmt(t.damagePower || 0)}; disableCost ${fmt(t.disableCost || 0)}.` });
  }
}
function lastSeenSortValue(label) {
  const text = String(label || "").toLowerCase();
  if (text === "now") return 0;
  const n = Number((text.match(/\d+/) || [999999])[0]);
  if (text.includes("hour")) return n * 60;
  if (text.includes("day")) return n * 1440;
  return Number.isFinite(n) ? n : 999999;
}
function compareText(a, b) { return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true }); }
function minutesFromLastSeenLabel(label) { return lastSeenSortValue(label); }
function lastSeenLabelFromAt(lastSeenAt, now = Date.now()) {
  if (!lastSeenAt) return "Unknown";
  const minutes = Math.max(0, Math.floor((now - Number(lastSeenAt)) / 60000));
  if (minutes <= 0) return "Now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
function normaliseOpponentPresence(op, now = Date.now()) {
  const normalisedRecords = normalisePlayerRecords(op);
  if (op.lastSeenAt) return { ...op, ...normalisedRecords, totalExperience: op.totalExperience ?? op.experience ?? 0 };
  const minutes = minutesFromLastSeenLabel(op.lastSeen);
  const safeMinutes = Number.isFinite(minutes) ? minutes : 60;
  return { ...op, ...normalisedRecords, totalExperience: op.totalExperience ?? op.experience ?? 0, lastSeenAt: now - safeMinutes * 60000 };
}
function normalisePlayerRecords(entity = {}) {
  const experience = Number(entity.experience || 0);
  const speciesProgress = normaliseSpeciesProgress(entity);
  return {
    experience,
    totalExperience: Number(entity.totalExperience ?? experience),
    roundWins: Number(entity.roundWins || 0),
    roundLosses: Number(entity.roundLosses || 0),
    totalWins: Number(entity.totalWins ?? entity.roundWins ?? 0),
    totalLosses: Number(entity.totalLosses ?? entity.roundLosses ?? 0),
    ...speciesProgress,
  };
}
function battleRecordPatch(entity = {}, won = false) {
  const records = normalisePlayerRecords(entity);
  return {
    roundWins: records.roundWins + (won ? 1 : 0),
    roundLosses: records.roundLosses + (won ? 0 : 1),
    totalWins: records.totalWins + (won ? 1 : 0),
    totalLosses: records.totalLosses + (won ? 0 : 1),
  };
}
function winLossRecordLabel(entity = {}) {
  const r = normalisePlayerRecords(entity);
  return `${fmt(r.roundWins)}/${fmt(r.roundLosses)} (${fmt(r.totalWins)}/${fmt(r.totalLosses)})`;
}
function experienceRecordLabel(entity = {}) {
  const r = normalisePlayerRecords(entity);
  return `${fmt(r.experience)} (${fmt(r.totalExperience)})`;
}
function fixedRaceForBotName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (n === "laser tank") return "human";
  if (n === "soccer_09" || n === "dead man walking") return "lithi";
  if (n === "cowpie") return "trysaur";
  if (n === "131") return "zarth";
  return null;
}
function raceNameFromKey(key) { return races[key]?.name || "Human"; }
function roundRaceForBot(op, profileName = "Intro Game") {
  const fixed = fixedRaceForBotName(op.name);
  if (fixed) return fixed;
  const seed = Math.abs(Number(op.id) || String(op.name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const pools = profileName === "Godlike Warfare"
    ? ["lithi", "relu", "trysaur", "zarth", "human", "lithi", "relu", "trysaur"]
    : profileName === "Turbo Game"
      ? ["human", "zarth", "trysaur", "lithi", "relu", "human", "zarth"]
      : ["human", "zarth", "trysaur", "lithi", "relu"];
  return pools[seed % pools.length];
}
function durationHms(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h} hours, ${m} minutes and ${sec} seconds`;
}
function compactHms(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function compactDdhhmmFromMs(ms) {
  const totalMinutes = Math.max(0, Math.floor((Number(ms) || 0) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function gameMsFromRealMs(realMs, speed = 1) { return Math.max(0, Number(realMs) || 0) * Math.max(0.001, Number(speed) || 1); }
function realMsFromGameMs(gameMs, speed = 1) { return Math.max(0, Number(gameMs) || 0) / Math.max(0.001, Number(speed) || 1); }
function staticFinishMessage(label, finishAt, now = Date.now()) {
  const total = Math.max(0, Math.floor(((Number(finishAt) || now) - now) / 1000));
  return `Your ${label} will be finished in ${durationHms(total)}.`;
}
function newsText(entry) { return typeof entry === "object" && entry !== null ? safeDisplay(entry.text) : safeDisplay(entry); }
function newsCreatedAt(entry) { return typeof entry === "object" && entry !== null && entry.createdAt ? Number(entry.createdAt) : null; }
function newsType(entry) { return typeof entry === "object" && entry !== null && entry.type ? entry.type : null; }
function newsTimeLabel(entry) { const t = newsCreatedAt(entry); if (!t) return "--:--:--"; return new Date(t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function makeNewsEntry(text, type = null, createdAt = Date.now()) { return { text: safeDisplay(text), type, createdAt }; }
function armyRows(raceKey, army = []) { const r = races[raceKey] || races.human; const total = armyPower(raceKey, army); return r.units.map(([name, cost], i) => { const number = army[i] || 0; const power = number * cost; return { unitClass: i + 1, name, number, cost, power, percent: total > 0 ? (power / total) * 100 : 0 }; }); }
function calcCaps(b = {}, sci = {}) { return { maxPop: (b.living_areas || 0) * 150 * scienceLevelBonus(sci.housing), maxFed: (b.nutrition_suppliers || 0) * 250 * scienceLevelBonus(sci.agriculture), maxWatered: (b.water_purifiers || 0) * 400 * scienceLevelBonus(sci.agriculture), maxPoliced: (b.police_stations || 0) * 1000 * scienceLevelBonus(sci.crime), bankCap: (b.banks || 0) * 250000 * scienceLevelBonus(sci.banking) }; }
function supportedPopulationCap(c = {}) { return Math.max(0, Math.min(Number(c.maxPop || 0), Number(c.maxFed || 0), Number(c.maxWatered || 0))); }
function productionPerTick(b = {}, sci = {}) { return { food: (b.nutrition_suppliers || 0) * 5 * scienceLevelBonus(sci.agriculture), water: (b.water_purifiers || 0) * 8 * scienceLevelBonus(sci.agriculture), energy: (b.power_plants || 0) * TURRET_CONFIG.powerPlantEnergyPerTick }; }
function calculateStarvationLoss({ pop = 0, supportCap = 0, rawFood = 0, rawWater = 0, consumption = 0, tickEquivalent = 1 }) {
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
function starvationRiskLabel(entity = {}, caps = {}) {
  const supportCap = supportedPopulationCap(caps);
  if ((entity.pop || 0) > supportCap) return `Over support by ${fmt((entity.pop || 0) - supportCap)}`;
  if ((entity.food || 0) <= 0 || (entity.water || 0) <= 0) return "Stockpile empty";
  return "None";
}
function oldTime(seconds) { const m = Math.floor(Math.max(0, Number(seconds) || 0) / 60); return `${Math.floor(m / 60)} hours and ${m % 60} minutes`; }
function remainingTimeLabel(finishAt, now = Date.now()) { if (!finishAt) return "None"; const s = Math.max(0, (finishAt - now) / 1000); return s <= 0 ? "Complete on next page request" : oldTime(s); }
function isFinishDue(finishAt, now = Date.now()) { return Boolean(finishAt && now >= finishAt); }
function dueNextStepLabel(order, pageLabel, actionLabel, now = Date.now()) { if (!order) return "None"; return isFinishDue(order.finishAt, now) ? `${actionLabel} ready - click ${pageLabel}` : "Waiting"; }
function dueGameTicks(realElapsedSeconds, gameSpeed) { return Math.floor((Math.max(0, realElapsedSeconds) * Math.max(0.001, Number(gameSpeed) || 1)) / 1800); }
function tickEquivalentForElapsed(realElapsedSeconds, gameSpeed) { return (Math.max(0, realElapsedSeconds) * Math.max(0.001, Number(gameSpeed) || 1)) / 1800; }
function sortByPowerDesc(players) { return [...players].sort((a, b) => b.power - a.power); }
function calculateAttackProtectionHours(percentKilled) { const pct = Math.max(0, Number(percentKilled) || 0); return 2 + pct * 0.1; }
function calculateLandSpoils(defenderLand, defenderLossPercent, defenderPower = null) { if (defenderLossPercent <= 0) return 0; const land = Math.max(0, Number(defenderLand) || 0); if (Number.isFinite(Number(defenderPower)) && Number(defenderPower) > 0) { const powerLost = Number(defenderPower) * defenderLossPercent / 100; return Math.max(1, Math.min(Math.floor(land * 0.08), Math.floor(powerLost / 10000))); } return Math.max(1, Math.floor(land * Math.min(0.02, defenderLossPercent / 10000))); }
function scannerExploreMultiplier(entity = {}) {
  const empireLand = Math.max(1, totalEmpireLand(entity));
  const scannerPctOfLand = Math.max(0, Number(entity.scanners || 0)) / empireLand * 100;
  const curve = [
    [0, 1],
    [0.2, 1.9],
    [1, 3.25],
    [5, 7.75],
    [10, 10]
  ];
  if (scannerPctOfLand <= 0) return 1;
  for (let i = 1; i < curve.length; i += 1) {
    const [x0, y0] = curve[i - 1];
    const [x1, y1] = curve[i];
    if (scannerPctOfLand <= x1) {
      const t = (scannerPctOfLand - x0) / Math.max(0.0001, x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return 10;
}
function applyFlatLandLoss(entity = {}, requestedLandLoss = 0) {
  const loss = Math.max(0, Math.floor(Number(requestedLandLoss || 0)));
  const buildings = { ...emptyBuildings(), ...(entity.buildings || {}) };
  const freeLandBefore = Math.max(0, Math.floor(Number(entity.freeLand || 0)));
  const freeLandLost = Math.min(freeLandBefore, loss);
  const buildingLandNeeded = Math.max(0, loss - freeLandLost);
  const builtLand = totalBuildings(buildings);
  const buildingLandLost = Math.min(buildingLandNeeded, builtLand);
  const destroyed = Object.fromEntries(buildingOrder.map(([key]) => [key, 0]));

  if (buildingLandLost > 0 && builtLand > 0) {
    if (buildingLandLost >= builtLand) {
      buildingOrder.forEach(([key]) => {
        const amount = Math.max(0, Math.floor(Number(buildings[key] || 0)));
        destroyed[key] = amount;
        buildings[key] = 0;
      });
    } else {
      const rate = buildingLandLost / builtLand;
      let assigned = 0;
      const fractional = [];
      buildingOrder.forEach(([key], index) => {
        const available = Math.max(0, Math.floor(Number(buildings[key] || 0)));
        const raw = available * rate;
        const base = Math.min(available, Math.floor(raw));
        destroyed[key] = base;
        assigned += base;
        fractional.push({ key, index, fraction: raw - base, available });
      });
      let remaining = buildingLandLost - assigned;
      fractional
        .sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index))
        .forEach(({ key, available }) => {
          if (remaining <= 0) return;
          const spare = Math.max(0, available - destroyed[key]);
          if (spare <= 0) return;
          const take = Math.min(spare, remaining);
          destroyed[key] += take;
          remaining -= take;
        });
      // Final guard in building order, in case all fractional remainders were zero.
      if (remaining > 0) {
        buildingOrder.forEach(([key]) => {
          if (remaining <= 0) return;
          const available = Math.max(0, Math.floor(Number(buildings[key] || 0)));
          const spare = Math.max(0, available - destroyed[key]);
          const take = Math.min(spare, remaining);
          destroyed[key] += take;
          remaining -= take;
        });
      }
      buildingOrder.forEach(([key]) => {
        buildings[key] = Math.max(0, Math.floor(Number(buildings[key] || 0)) - destroyed[key]);
      });
    }
  }

  const actualLandLost = freeLandLost + totalBuildings(destroyed);
  const nextEntity = { ...entity, freeLand: Math.max(0, freeLandBefore - freeLandLost), buildings };
  const destroyedRows = buildingOrder.map(([key, label]) => [label, destroyed[key] || 0]);
  const destroyedSummary = destroyedRows.map(([label, amount]) => `${fmt(amount)} ${label}`).join(", ");
  return { entity: nextEntity, actualLandLost, freeLandLost, buildingLandLost: totalBuildings(destroyed), destroyed, destroyedRows, destroyedSummary };
}
function landLossReportLine(name, landLossResult) {
  if (!landLossResult || !landLossResult.buildingLandLost) return null;
  const rows = (landLossResult.destroyedRows || []).map(([label, amount]) => `${fmt(amount)} ${label}`);
  return `${name}'s buildings destroyed to clear captured land:\n${rows.join("\n")}`;
}
function protectionHoursFromUntil(entity = {}, now = Date.now()) {
  const until = Number(entity.protectionUntil || 0);
  return until > now ? (until - now) / 3600000 : 0;
}
function effectiveProtectionHours(entity = {}, now = Date.now()) {
  return Math.max(Number(entity.protectionHours || 0), protectionHoursFromUntil(entity, now));
}

function clearAttackProtection(entity = {}) {
  return {
    ...entity,
    protectionHours: 0,
    protectionUntil: 0,
  };
}
function isAttackProtected(entity = {}) { return effectiveProtectionHours(entity) > 0; }
function openProtectionLabel() { return <span className="text-green-400">Open</span>; }
function protectionLabel(entity = {}) { const h = effectiveProtectionHours(entity); return h > 0 ? `Protected: ${h.toFixed(2)} hours` : openProtectionLabel(); }
function protectionValueLabel(entity = {}) { const h = effectiveProtectionHours(entity); return h > 0 ? `${h.toFixed(2)} hours` : openProtectionLabel(); }
function protectionShort(entity = {}) { const h = effectiveProtectionHours(entity); return h > 0 ? `${h.toFixed(2)}h` : openProtectionLabel(); }
function decayProtection(entity = {}, tickEquivalent = 0) {
  const nextHours = Math.max(0, Number(entity.protectionHours || 0) - 0.5 * tickEquivalent);
  return { ...entity, protectionHours: nextHours };
}
function normaliseAlliance(allianceLike) { if (!allianceLike) return null; const legacyLrc = allianceLike.lrcQuota || allianceLike.lrcStockpile || { cards: 0, minerals: emptyMinerals() }; return { ...allianceLike, createdByPlayer: Boolean(allianceLike.createdByPlayer), viceLeader: allianceLike.viceLeader || null, memberLimit: allianceLike.memberLimit || ALLIANCE_MEMBER_LIMIT, members: Array.isArray(allianceLike.members) ? allianceLike.members : [], bankLand: allianceLike.bankLand || 0, allianceBanks: allianceLike.allianceBanks || 0, bankedCards: allianceLike.bankedCards || 0, bankOrder: allianceLike.bankOrder || null, nexusMinerals: { ...emptyMinerals(), ...(allianceLike.nexusMinerals || {}) }, nexusLedger: allianceLike.nexusLedger || {}, lrcQuota: { cards: legacyLrc.cards || 0, minerals: { ...emptyMinerals(), ...(legacyLrc.minerals || {}) } }, lrcConstructionFinishAt: Number(allianceLike.lrcConstructionFinishAt || 0), lrcTargetType: allianceLike.lrcTargetType || "alliance", lrcTargetName: allianceLike.lrcTargetName || "", lrcShotsFired: Math.max(0, Math.floor(Number(allianceLike.lrcShotsFired || 0))), lrcStatus: allianceLike.lrcStatus || "Not started", lrcLockedUntil: Number(allianceLike.lrcLockedUntil || 0), lrcLockReason: allianceLike.lrcLockReason || "" }; }
function lrcQuotaComplete(allianceLike) { const a = normaliseAlliance(allianceLike); const q = a.lrcQuota || { cards: 0, minerals: emptyMinerals() }; const mins = { ...emptyMinerals(), ...(q.minerals || {}) }; return (q.cards || 0) >= LRC_CARD_QUOTA && LRC_MINERALS.every((m) => (mins[m] || 0) >= LRC_MINERAL_QUOTA); }
function lrcReadyToFire(allianceLike, now = Date.now()) { const a = normaliseAlliance(allianceLike); return lrcQuotaComplete(a) && !a.lrcConstructionFinishAt; }
function lrcConstructionActive(allianceLike, now = Date.now()) { const a = normaliseAlliance(allianceLike); return Boolean(a.lrcConstructionFinishAt && a.lrcConstructionFinishAt > now); }
function allianceBankCapacity(allianceLike) { return (allianceLike?.allianceBanks || 0) * ALLIANCE_BANK_CAPACITY; }
function allianceBankStockLabel(allianceLike) { return `${compactFmt(allianceLike?.bankedCards || 0)}/${compactFmt(allianceBankCapacity(allianceLike))}`; }
function allianceLandFreeLabel(totalLand, freeLand) { return `${fmt(totalLand || 0)}/${fmt(freeLand || 0)}`; }
function allianceMemberRoleSuffix(playerName, alliance) { if (isAllianceLeader(playerName, alliance)) return "leader"; if (isAllianceViceLeader(playerName, alliance)) return "co-lead"; return ""; }
function diplomacyStateClass(state) { const s = String(state || "Neutral").toLowerCase(); if (s.includes("war")) return "text-red-300"; if (s.includes("allied") || s.includes("ally")) return "text-green-300"; return "text-orange-400"; }
function allianceLrcStatusLabel(allianceLike, now = Date.now()) {
  const a = normaliseAlliance(allianceLike);
  const quota = a.lrcQuota || { cards: 0, minerals: emptyMinerals() };
  const mins = { ...emptyMinerals(), ...(quota.minerals || {}) };
  const cardsRemaining = Math.max(0, LRC_CARD_QUOTA - (quota.cards || 0));
  const mineralRemaining = LRC_MINERALS.filter((m) => Math.max(0, LRC_MINERAL_QUOTA - (mins[m] || 0)) > 0);
  if (String(a.lrcStatus || "").toLowerCase().includes("firing")) return "Firing";
  if (lrcConstructionActive(a, now)) return "Building";
  if (lrcReadyToFire(a, now)) return "Ready to fire";
  if (cardsRemaining > 0 && mineralRemaining.length > 0) return "Donate to build";
  if (cardsRemaining > 0) return "Cardisium only required";
  if (mineralRemaining.length === 1) return `${mineralRemaining[0]} only required`;
  if (mineralRemaining.length > 1) return "Minerals only required";
  return "Ready to fire";
}
function allianceReservedBankLand(allianceLike) { return allianceLike?.bankOrder ? parseQty(allianceLike.bankOrder.quantity) : 0; }
function allianceTotalLand(allianceLike) { return (allianceLike?.bankLand || 0) + (allianceLike?.allianceBanks || 0) + allianceReservedBankLand(allianceLike); }
function allianceEffectiveFactories(allianceLike) { return (allianceLike?.members?.length || 0) * ALLIANCE_MEMBER_FACTORIES; }
function normaliseAllianceBankSpeedFactor(value) { const n = parseQty(value); return Math.max(1, Math.min(99, n || 1)); }
function allianceBankBuildSeconds(quantity, speedFactor, allianceLike) { const q = parseQty(quantity); const speed = normaliseAllianceBankSpeedFactor(speedFactor); const factories = Math.max(1, allianceEffectiveFactories(allianceLike)); const baseSeconds = q * ALLIANCE_BANK_COST / 4; return baseSeconds / speed / Math.max(1, factories / 1000); }
function allianceBankBuildCost(quantity, speedFactor) { return parseQty(quantity) * ALLIANCE_BANK_COST * normaliseAllianceBankSpeedFactor(speedFactor); }
function isAllianceLeader(playerName, alliance) { return Boolean(alliance && alliance.leader === playerName); }
function isAllianceViceLeader(playerName, alliance) { return Boolean(alliance && alliance.viceLeader === playerName); }
function isAllianceAdmin(playerName, alliance) { return isAllianceLeader(playerName, alliance) || isAllianceViceLeader(playerName, alliance); }
function allianceMemberRole(playerName, alliance) { if (isAllianceLeader(playerName, alliance)) return "Leader"; if (isAllianceViceLeader(playerName, alliance)) return "Co-Leader"; return "Member"; }
function canRenameAlliance(playerName, alliance) { return isAllianceLeader(playerName, alliance); }
function canKickAllianceMember(actorName, targetName, alliance) { if (!alliance || actorName === targetName) return false; if (isAllianceLeader(actorName, alliance)) return targetName !== alliance.leader; if (isAllianceViceLeader(actorName, alliance)) return targetName !== alliance.leader && targetName !== alliance.viceLeader; return false; }
function diplomacyKey(type, name) { return `${type}:${name}`; }
function warPairKey(a, b) { return [a, b].sort().join("|"); }
function prettySide(key) { if (!key) return "Unknown"; const [type, ...rest] = String(key).split(":"); return `${type === "alliance" ? "Alliance" : "Player"}: ${rest.join(":")}`; }
function canSetAllianceViceLeader(actorName, targetName, alliance) { return Boolean(alliance && isAllianceLeader(actorName, alliance) && targetName !== alliance.leader); }
function killRateKey(ar, ac, dr, dc) { return `${ar}:${ac}->${dr}:${dc}`; }
const raceAdvantageScores = {
  relu: { trysaur: 5, human: 3 },
  lithi: { relu: 5, zarth: 5 },
  zarth: { relu: 3, lithi: 3 },
  human: { zarth: 2, lithi: 2 },
  trysaur: { lithi: 2, human: 1, zarth: 1 },
};
const advantageBands = {
  5: [0.24, 0.45],
  3: [0.24, 0.30],
  2: [0.22, 0.28],
  1: [0.20, 0.22],
};
const reverseDisadvantageBands = {
  5: [0.08, 0.16],
  3: [0.10, 0.18],
  2: [0.12, 0.20],
  1: [0.14, 0.20],
};
const knownKillRates = {
  [killRateKey("lithi", 5, "relu", 3)]: { rate: 0.25, source: "known/user-supplied", note: "Incabusers on Eph'fo should be around 25%; within Li'thi +5 vs Re'lu band." },
};
const specialKillRates = {
  [killRateKey("lithi", 1, "human", 6)]: { rate: 0.04, source: "special-case inferred", note: "Preserves the remembered Li'thi trouble into Human Air Forces." },
  [killRateKey("lithi", 2, "human", 6)]: { rate: 0.04, source: "special-case inferred", note: "Preserves the remembered Li'thi trouble into Human Air Forces." },
  [killRateKey("lithi", 3, "human", 6)]: { rate: 0.05, source: "special-case inferred", note: "Preserves the remembered Li'thi trouble into Human Air Forces; old notes suggested the bugged value was nearer 1% and should be around 5%." },
  [killRateKey("lithi", 4, "human", 6)]: { rate: 0.05, source: "special-case inferred", note: "Preserves the remembered Li'thi trouble into Human Air Forces." },
  [killRateKey("lithi", 5, "human", 6)]: { rate: 0.06, source: "special-case inferred", note: "Preserves the remembered Li'thi trouble into Human Air Forces without treating it as a known exact value." },
  [killRateKey("lithi", 6, "human", 6)]: { rate: 0.08, source: "special-case inferred", note: "Black parroths still struggle into Human Air Forces, but less than lower Li'thi rows." },
};

const lithiKillRates = {
  [killRateKey("lithi", 1, "lithi", 1)]: { rate: 0.180000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "lithi", 1)]: { rate: 0.220500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "lithi", 1)]: { rate: 0.234000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "lithi", 1)]: { rate: 0.157000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "lithi", 1)]: { rate: 0.193500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "lithi", 1)]: { rate: 0.207000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "lithi", 2)]: { rate: 0.180600, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "lithi", 2)]: { rate: 0.120200, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "lithi", 2)]: { rate: 0.150400, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "lithi", 2)]: { rate: 0.241000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "lithi", 2)]: { rate: 0.090000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "lithi", 2)]: { rate: 0.210800, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "lithi", 3)]: { rate: 0.138000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "lithi", 3)]: { rate: 0.149750, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "lithi", 3)]: { rate: 0.161500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "lithi", 3)]: { rate: 0.173250, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "lithi", 3)]: { rate: 0.223000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "lithi", 3)]: { rate: 0.185000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "lithi", 4)]: { rate: 0.207000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "lithi", 4)]: { rate: 0.155000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "lithi", 4)]: { rate: 0.165400, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "lithi", 4)]: { rate: 0.186200, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "lithi", 4)]: { rate: 0.196600, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "lithi", 4)]: { rate: 0.175800, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "lithi", 5)]: { rate: 0.168000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "lithi", 5)]: { rate: 0.359000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "lithi", 5)]: { rate: 0.164000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "lithi", 5)]: { rate: 0.176000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "lithi", 5)]: { rate: 0.180000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "lithi", 5)]: { rate: 0.172000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "lithi", 6)]: { rate: 0.163800, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "lithi", 6)]: { rate: 0.156000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "lithi", 6)]: { rate: 0.171600, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "lithi", 6)]: { rate: 0.187200, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "lithi", 6)]: { rate: 0.195000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "lithi", 6)]: { rate: 0.179400, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "human", 1)]: { rate: 0.090000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "human", 1)]: { rate: 0.205000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "human", 1)]: { rate: 0.116250, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "human", 1)]: { rate: 0.125000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "human", 1)]: { rate: 0.098750, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "human", 1)]: { rate: 0.107500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "human", 2)]: { rate: 0.074000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "human", 2)]: { rate: 0.094000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "human", 2)]: { rate: 0.142000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "human", 2)]: { rate: 0.110000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "human", 2)]: { rate: 0.158000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "human", 2)]: { rate: 0.126000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "human", 3)]: { rate: 0.102000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "human", 3)]: { rate: 0.087000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "human", 3)]: { rate: 0.117500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "human", 3)]: { rate: 0.133000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "human", 3)]: { rate: 0.164000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "human", 3)]: { rate: 0.148500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "human", 4)]: { rate: 0.077000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "human", 4)]: { rate: 0.092400, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "human", 4)]: { rate: 0.107800, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "human", 4)]: { rate: 0.123200, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "human", 4)]: { rate: 0.154000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "human", 4)]: { rate: 0.138600, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "human", 5)]: { rate: 0.155000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "human", 5)]: { rate: 0.162000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "human", 5)]: { rate: 0.141000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "human", 5)]: { rate: 0.148000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "human", 5)]: { rate: 0.169000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "human", 5)]: { rate: 0.176000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "human", 6)]: { rate: 0.052667, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "human", 6)]: { rate: 0.005900, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "human", 6)]: { rate: 0.000800, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "human", 6)]: { rate: 0.011000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "human", 6)]: { rate: 0.136000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "human", 6)]: { rate: 0.094333, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "zarth", 1)]: { rate: 0.245800, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "zarth", 1)]: { rate: 0.309000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "zarth", 1)]: { rate: 0.293200, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "zarth", 1)]: { rate: 0.230000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "zarth", 1)]: { rate: 0.277400, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "zarth", 1)]: { rate: 0.261600, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "zarth", 2)]: { rate: 0.292200, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "zarth", 2)]: { rate: 0.309000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "zarth", 2)]: { rate: 0.225000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "zarth", 2)]: { rate: 0.241800, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "zarth", 2)]: { rate: 0.275400, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "zarth", 2)]: { rate: 0.258600, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "zarth", 3)]: { rate: 0.303000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "zarth", 3)]: { rate: 0.390000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "zarth", 3)]: { rate: 0.288000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "zarth", 3)]: { rate: 0.273000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "zarth", 3)]: { rate: 0.258000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "zarth", 3)]: { rate: 0.243000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "zarth", 4)]: { rate: 0.258000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "zarth", 4)]: { rate: 0.233000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "zarth", 4)]: { rate: 0.290000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "zarth", 4)]: { rate: 0.242000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "zarth", 4)]: { rate: 0.224000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "zarth", 4)]: { rate: 0.274000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "zarth", 5)]: { rate: 0.452000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "zarth", 5)]: { rate: 0.233500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "zarth", 5)]: { rate: 0.278000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "zarth", 5)]: { rate: 0.249000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "zarth", 5)]: { rate: 0.307000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "zarth", 5)]: { rate: 0.218000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "zarth", 6)]: { rate: 0.374000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "zarth", 6)]: { rate: 0.254667, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "zarth", 6)]: { rate: 0.244000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "zarth", 6)]: { rate: 0.260000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "zarth", 6)]: { rate: 0.317000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "zarth", 6)]: { rate: 0.249333, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "trysaur", 1)]: { rate: 0.135000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "trysaur", 1)]: { rate: 0.146600, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "trysaur", 1)]: { rate: 0.181400, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "trysaur", 1)]: { rate: 0.158200, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "trysaur", 1)]: { rate: 0.193000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "trysaur", 1)]: { rate: 0.169800, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "trysaur", 2)]: { rate: 0.123000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "trysaur", 2)]: { rate: 0.103000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "trysaur", 2)]: { rate: 0.183000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "trysaur", 2)]: { rate: 0.163000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "trysaur", 2)]: { rate: 0.216000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "trysaur", 2)]: { rate: 0.143000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "trysaur", 3)]: { rate: 0.115000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "trysaur", 3)]: { rate: 0.120000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "trysaur", 3)]: { rate: 0.164000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "trysaur", 3)]: { rate: 0.186000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "trysaur", 3)]: { rate: 0.208000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "trysaur", 3)]: { rate: 0.142000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "trysaur", 4)]: { rate: 0.134000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "trysaur", 4)]: { rate: 0.144000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "trysaur", 4)]: { rate: 0.159500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "trysaur", 4)]: { rate: 0.190500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "trysaur", 4)]: { rate: 0.206000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "trysaur", 4)]: { rate: 0.175000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "trysaur", 5)]: { rate: 0.138000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "trysaur", 5)]: { rate: 0.133000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "trysaur", 5)]: { rate: 0.161500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "trysaur", 5)]: { rate: 0.173250, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "trysaur", 5)]: { rate: 0.185000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "trysaur", 5)]: { rate: 0.149750, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "trysaur", 6)]: { rate: 0.149000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "trysaur", 6)]: { rate: 0.107000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "trysaur", 6)]: { rate: 0.156250, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "trysaur", 6)]: { rate: 0.170750, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "trysaur", 6)]: { rate: 0.163500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "trysaur", 6)]: { rate: 0.178000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "relu", 1)]: { rate: 0.204000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "relu", 1)]: { rate: 0.219000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "relu", 1)]: { rate: 0.246500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "relu", 1)]: { rate: 0.232750, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "relu", 1)]: { rate: 0.274000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "relu", 1)]: { rate: 0.260250, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "relu", 2)]: { rate: 0.215333, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "relu", 2)]: { rate: 0.201000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "relu", 2)]: { rate: 0.229667, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "relu", 2)]: { rate: 0.244000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "relu", 2)]: { rate: 0.301000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "relu", 2)]: { rate: 0.378000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "relu", 3)]: { rate: 0.300750, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 2, "relu", 3)]: { rate: 0.420000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "relu", 3)]: { rate: 0.255000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "relu", 3)]: { rate: 0.285500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "relu", 3)]: { rate: 0.316000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "relu", 3)]: { rate: 0.270250, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 1, "relu", 4)]: { rate: 0.205000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "relu", 4)]: { rate: 0.234000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "relu", 4)]: { rate: 0.268667, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "relu", 4)]: { rate: 0.286000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 5, "relu", 4)]: { rate: 0.251333, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "relu", 4)]: { rate: 0.341000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "relu", 5)]: { rate: 0.113000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "relu", 5)]: { rate: 0.207000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 3, "relu", 5)]: { rate: 0.272250, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 4, "relu", 5)]: { rate: 0.228750, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "relu", 5)]: { rate: 0.250500, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 6, "relu", 5)]: { rate: 0.294000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 1, "relu", 6)]: { rate: 0.160000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 2, "relu", 6)]: { rate: 0.186000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 3, "relu", 6)]: { rate: 0.264000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 4, "relu", 6)]: { rate: 0.212000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
  [killRateKey("lithi", 5, "relu", 6)]: { rate: 0.363000, source: "known/lithi.txt", note: "Li'thi attacking value derived from player-made lithi.txt destruction table." },
  [killRateKey("lithi", 6, "relu", 6)]: { rate: 0.238000, source: "interpolated/lithi.txt hierarchy", note: "Li'thi attacking value interpolated between visible lithi.txt anchor percentages using the listed hierarchy." },
};
const reluKillRates = {
  [killRateKey("relu", 1, "human", 1)]: { rate: 0.190588235294118, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "human", 1)]: { rate: 0.184615376769231, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "human", 1)]: { rate: 0.214678899082569, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "human", 1)]: { rate: 0.197368421052632, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "human", 1)]: { rate: 0.201117318435754, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "human", 1)]: { rate: 0.191659272404614, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "human", 2)]: { rate: 0.259411764705882, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "human", 2)]: { rate: 0.226154267051282, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "human", 2)]: { rate: 0.222522935779817, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "human", 2)]: { rate: 0.241776315789474, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "human", 2)]: { rate: 0.225837988826816, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "human", 2)]: { rate: 0.195652173913044, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "human", 3)]: { rate: 0.27, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "human", 3)]: { rate: 0.23538472174359, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "human", 3)]: { rate: 0.210550458715596, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "human", 3)]: { rate: 0.268421052631579, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "human", 3)]: { rate: 0.227932960893855, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "human", 3)]: { rate: 0.244365572315883, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "human", 4)]: { rate: 0.337764705882353, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "human", 4)]: { rate: 0.220848125102564, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "human", 4)]: { rate: 0.263394495412844, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "human", 4)]: { rate: 0.251842105263158, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "human", 4)]: { rate: 0.256625698324022, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "human", 4)]: { rate: 0.2547471162378, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "human", 5)]: { rate: 0.345970588235294, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "human", 5)]: { rate: 0.301609536628205, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "human", 5)]: { rate: 0.188861865720183, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "human", 5)]: { rate: 0.206368421052632, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "human", 5)]: { rate: 0.240930968342644, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "human", 5)]: { rate: 0.203534940820763, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "human", 6)]: { rate: 0.313888235294118, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "human", 6)]: { rate: 0.293194924705128, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "human", 6)]: { rate: 0.244775229357798, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "human", 6)]: { rate: 0.250756578947368, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "human", 6)]: { rate: 0.212932960893855, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "human", 6)]: { rate: 0.27055900621118, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "trysaur", 1)]: { rate: 0.285882352941177, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "trysaur", 1)]: { rate: 0.276923065153846, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "trysaur", 1)]: { rate: 0.247706422018349, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "trysaur", 1)]: { rate: 0.236842105263158, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "trysaur", 1)]: { rate: 0.251396648044693, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "trysaur", 1)]: { rate: 0.239574090505768, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "trysaur", 2)]: { rate: 0.283764705882353, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "trysaur", 2)]: { rate: 0.309230030512821, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "trysaur", 2)]: { rate: 0.221284403669725, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "trysaur", 2)]: { rate: 0.264473684210526, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "trysaur", 2)]: { rate: 0.269497206703911, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "trysaur", 2)]: { rate: 0.214019520851819, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "trysaur", 3)]: { rate: 0.283341176470588, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "trysaur", 3)]: { rate: 0.308769805423077, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "trysaur", 3)]: { rate: 0.276192660550459, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "trysaur", 3)]: { rate: 0.264078947368421, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "trysaur", 3)]: { rate: 0.239195530726257, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "trysaur", 3)]: { rate: 0.267125110913931, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "trysaur", 4)]: { rate: 0.284611764705882, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "trysaur", 4)]: { rate: 0.258460918153846, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "trysaur", 4)]: { rate: 0.277431192660551, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "trysaur", 4)]: { rate: 0.265263157894737, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "trysaur", 4)]: { rate: 0.255284916201117, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "trysaur", 4)]: { rate: 0.214658385093168, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "trysaur", 5)]: { rate: 0.284611764705882, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "trysaur", 5)]: { rate: 0.265844765538462, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "trysaur", 5)]: { rate: 0.285357798165138, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "trysaur", 5)]: { rate: 0.27284355031579, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "trysaur", 5)]: { rate: 0.257430167597765, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "trysaur", 5)]: { rate: 0.214658385093168, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "trysaur", 6)]: { rate: 0.263805882352941, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "trysaur", 6)]: { rate: 0.306649965628205, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "trysaur", 6)]: { rate: 0.274293577981651, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "trysaur", 6)]: { rate: 0.262263157894737, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "trysaur", 6)]: { rate: 0.334055865921788, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "trysaur", 6)]: { rate: 0.265288376220053, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "lithi", 1)]: { rate: 0.158823529411765, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "lithi", 1)]: { rate: 0.173076923076923, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "lithi", 1)]: { rate: 0.148623876743119, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "lithi", 1)]: { rate: 0.177631578947368, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "lithi", 1)]: { rate: 0.172960893854749, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "lithi", 1)]: { rate: 0.182076308784383, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "lithi", 2)]: { rate: 0.148235294117647, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "lithi", 2)]: { rate: 0.161538488820513, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "lithi", 2)]: { rate: 0.144495378550459, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "lithi", 2)]: { rate: 0.165789473684211, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "lithi", 2)]: { rate: 0.140782122905028, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "lithi", 2)]: { rate: 0.167701863354037, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "lithi", 3)]: { rate: 0.122029411764706, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "lithi", 3)]: { rate: 0.127660870602564, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "lithi", 3)]: { rate: 0.114192633059633, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "lithi", 3)]: { rate: 0.114644479532895, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "lithi", 3)]: { rate: 0.14988938547486, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "lithi", 3)]: { rate: 0.128850931677019, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "lithi", 4)]: { rate: 0.116894117647059, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "lithi", 4)]: { rate: 0.144900030961538, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "lithi", 4)]: { rate: 0.128188041743119, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "lithi", 4)]: { rate: 0.136184210526316, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "lithi", 4)]: { rate: 0.127206703910615, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "lithi", 4)]: { rate: 0.110204081632653, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "lithi", 5)]: { rate: 0.118376470588235, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "lithi", 5)]: { rate: 0.128997498833333, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "lithi", 5)]: { rate: 0.138467856573395, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "lithi", 5)]: { rate: 0.11033135866886, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "lithi", 5)]: { rate: 0.140530726256983, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "lithi", 5)]: { rate: 0.111601597160603, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "lithi", 6)]: { rate: 0.114098823529412, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "lithi", 6)]: { rate: 0.152316670423077, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "lithi", 6)]: { rate: 0.111220152591743, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "lithi", 6)]: { rate: 0.154192026401316, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "lithi", 6)]: { rate: 0.13545251396648, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "lithi", 6)]: { rate: 0.10756876663709, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "zarth", 1)]: { rate: 0.152470588235294, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "zarth", 1)]: { rate: 0.147692303928205, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "zarth", 1)]: { rate: 0.132110091743119, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "zarth", 1)]: { rate: 0.142105263157895, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "zarth", 1)]: { rate: 0.134078212290503, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "zarth", 1)]: { rate: 0.146938775510204, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "zarth", 2)]: { rate: 0.142305882352941, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "zarth", 2)]: { rate: 0.132922854769231, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "zarth", 2)]: { rate: 0.158532072440367, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "zarth", 2)]: { rate: 0.113684210526316, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "zarth", 2)]: { rate: 0.120670391061453, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "zarth", 2)]: { rate: 0.13416149068323, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "zarth", 3)]: { rate: 0.106941176470588, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "zarth", 3)]: { rate: 0.139846414115385, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "zarth", 3)]: { rate: 0.125091743119266, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "zarth", 3)]: { rate: 0.139539473684211, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "zarth", 3)]: { rate: 0.135418994413408, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "zarth", 3)]: { rate: 0.12905057675244, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "zarth", 4)]: { rate: 0.122823529411765, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "zarth", 4)]: { rate: 0.107076715466667, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "zarth", 4)]: { rate: 0.114935779816514, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "zarth", 4)]: { rate: 0.137368421052632, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "zarth", 4)]: { rate: 0.124424581005587, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "zarth", 4)]: { rate: 0.133804178172138, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "zarth", 5)]: { rate: 0.111621176470588, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "zarth", 5)]: { rate: 0.139014657358974, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "zarth", 5)]: { rate: 0.116060654513761, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "zarth", 5)]: { rate: 0.118894736842105, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "zarth", 5)]: { rate: 0.126201117318436, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "zarth", 5)]: { rate: 0.128283939662822, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "zarth", 6)]: { rate: 0.132141176470588, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "zarth", 6)]: { rate: 0.1439997208, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "zarth", 6)]: { rate: 0.128807339449541, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "zarth", 6)]: { rate: 0.110842105263158, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "zarth", 6)]: { rate: 0.125497206703911, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "zarth", 6)]: { rate: 0.124578527062999, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "relu", 1)]: { rate: 0.18, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "relu", 1)]: { rate: 0.196153879282051, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "relu", 1)]: { rate: 0.187155963302752, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "relu", 1)]: { rate: 0.195678947368421, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "relu", 1)]: { rate: 0.189944134078212, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "relu", 1)]: { rate: 0.190062111801242, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "relu", 2)]: { rate: 0.165176470588235, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "relu", 2)]: { rate: 0.180000336, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "relu", 2)]: { rate: 0.171959376055046, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "relu", 2)]: { rate: 0.179605263157895, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "relu", 2)]: { rate: 0.174301675977654, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "relu", 2)]: { rate: 0.174409937888199, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "relu", 3)]: { rate: 0.173117647058824, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "relu", 3)]: { rate: 0.188653396179487, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "relu", 3)]: { rate: 0.18, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "relu", 3)]: { rate: 0.18819615725, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "relu", 3)]: { rate: 0.18268156424581, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "relu", 3)]: { rate: 0.182795031055901, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "relu", 4)]: { rate: 0.16416, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "relu", 4)]: { rate: 0.179945685230769, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "relu", 4)]: { rate: 0.17206880333945, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "relu", 4)]: { rate: 0.18, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "relu", 4)]: { rate: 0.174554240625698, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "relu", 4)]: { rate: 0.174793256433008, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "relu", 5)]: { rate: 0.170576470588235, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "relu", 5)]: { rate: 0.185886274576923, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "relu", 5)]: { rate: 0.177357798165138, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "relu", 5)]: { rate: 0.185476973684211, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "relu", 5)]: { rate: 0.18, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "relu", 5)]: { rate: 0.180111801242236, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 1, "relu", 6)]: { rate: 0.167061176470588, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 2, "relu", 6)]: { rate: 0.184651248833333, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 3, "relu", 6)]: { rate: 0.176806753270642, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 4, "relu", 6)]: { rate: 0.18506020154386, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 5, "relu", 6)]: { rate: 0.179811872007449, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
  [killRateKey("relu", 6, "relu", 6)]: { rate: 0.18, source: "known/ReluPro.xls", note: "Re'lu attacking table from ReluPro.xls Sheet2 Percentage of Power, derived from the workbook KILL RATES matrix." },
};
function unitPairPosition(attackerClass, defenderClass) {
  const a = Math.max(1, Math.min(6, Number(attackerClass || 1)));
  const d = Math.max(1, Math.min(6, Number(defenderClass || 1)));
  const attackerWeight = (a - 1) / 5;
  const defenderWeight = (d - 1) / 5;
  const shape = 0.48 + attackerWeight * 0.34 + defenderWeight * 0.18 + (((a * 7 + d * 3) % 5) - 2) * 0.035;
  return Math.max(0.03, Math.min(0.97, shape));
}
function rateFromBand(band, attackerClass, defenderClass) {
  const [lo, hi] = band;
  const t = unitPairPosition(attackerClass, defenderClass);
  return lo + (hi - lo) * t;
}
function killRateInfo(ar, ac, dr, dc) {
  const key = killRateKey(ar, ac, dr, dc);
  if (lithiKillRates[key]) return { ...lithiKillRates[key], key };
  if (knownKillRates[key]) return { ...knownKillRates[key], key };
  if (specialKillRates[key]) return { ...specialKillRates[key], key };
  if (reluKillRates[key]) return { ...reluKillRates[key], key };
  if (ar === dr) {
    return { rate: rateFromBand([0.18, 0.22], ac, dc), source: "same-race inferred", note: "Same-race fights are currently modelled in the remembered 18-22% band.", key };
  }
  const direct = raceAdvantageScores[ar]?.[dr];
  if (direct) {
    return { rate: rateFromBand(advantageBands[direct], ac, dc), source: `inferred from race advantage +${direct}`, note: `Race-level rule: ${races[ar]?.name || ar} focuses on ${races[dr]?.name || dr} (+${direct}).`, key };
  }
  const inverse = raceAdvantageScores[dr]?.[ar];
  if (inverse) {
    return { rate: rateFromBand(reverseDisadvantageBands[inverse], ac, dc), source: `inferred disadvantage vs opponent +${inverse}`, note: `No direct bonus; ${races[dr]?.name || dr} has the remembered advantage over ${races[ar]?.name || ar}.`, key };
  }
  return { rate: rateFromBand([0.16, 0.20], ac, dc), source: "neutral inferred", note: "No remembered race-focus rule applies; using a neutral inferred band rather than the old flat 20% placeholder.", key };
}
function combatScienceBonus(level = 0) { return Math.max(0, Number(level || 0)) / 100; }
function turretScienceLevel(entity = {}) {
  return Math.max(0, Number(entity?.scienceLevels?.turrets ?? entity?.turretScienceLevel ?? 0));
}
function turretDisableCostPerTurret(level = 0) {
  return Math.max(TURRET_CONFIG.disableFloorCostPerTurret, TURRET_CONFIG.disableBaseCostPerTurret * Math.pow(TURRET_CONFIG.disableLevel60Multiplier, Math.max(0, Number(level || 0))));
}
function turretEnergyPerShot(level = 0) {
  return Math.max(TURRET_CONFIG.energyFloorPerShot, TURRET_CONFIG.baseEnergyPerShot * Math.pow(TURRET_CONFIG.energyLevel60Multiplier, Math.max(0, Number(level || 0))));
}
function turretDisableCostForTarget(target = {}, attackerScienceLevels = {}) {
  const turrets = Math.max(0, Math.floor(Number(target?.buildings?.turrets || 0)));
  const level = Math.max(0, Number(attackerScienceLevels?.turrets || 0));
  return Math.floor(turrets * turretDisableCostPerTurret(level));
}
function deterministicBattleFraction(seed = "") {
  let h = 2166136261;
  const text = String(seed || "");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 9999;
}
function turretVarianceMultiplier(seed = "") {
  return 1 - TURRET_CONFIG.variance + deterministicBattleFraction(seed) * TURRET_CONFIG.variance * 2;
}
function applyTurretVolley(defender, attacker, { now = Date.now(), reportId = "", disabled = false, disableCost = 0, textMode = REPORT_WORDING_MODE } = {}, lines = []) {
  const defenderTurrets = Math.max(0, Math.floor(Number(defender?.buildings?.turrets || 0)));
  const availableEnergy = Math.max(0, Math.floor(Number(defender?.energy || 0)));
  const scienceLevel = turretScienceLevel(defender);
  const energyPerShot = turretEnergyPerShot(scienceLevel);
  const affordableShots = energyPerShot > 0 ? Math.floor(availableEnergy / energyPerShot) : defenderTurrets;
  const turretsFired = disabled ? 0 : Math.min(defenderTurrets, affordableShots);
  const energyConsumed = Math.floor(turretsFired * energyPerShot);
  const variance = turretVarianceMultiplier(`${reportId}:${defender?.name || "defender"}:turrets:${now}`);
  const killRate = TURRET_CONFIG.baseKillRate * variance;
  let remainingDamage = Math.floor(turretsFired * TURRET_CONFIG.powerPerTurret * killRate);
  let damagePower = 0;
  const rowKills = [0,0,0,0,0,0];
  const targetLines = [];

  if (energyConsumed > 0) defender.energy = Math.max(0, availableEnergy - energyConsumed);

  if (disabled) {
    if (defenderTurrets > 0) lines.push(reportTurretDisabledLine(textMode, attacker.name, defender.name, defenderTurrets, disableCost));
  } else if (defenderTurrets > 0 && turretsFired <= 0) {
    lines.push(reportTurretNoEnergyLine(textMode, defender.name, defenderTurrets));
  } else if (turretsFired > 0) {
    const race = races[attacker.race] || races.human;
    attacker.killedRows = attacker.killedRows || [0,0,0,0,0,0];
    const orderedClasses = Array.isArray(attacker.stack) && attacker.stack.length ? attacker.stack : [1,2,3,4,5,6];
    for (const unitClass of orderedClasses) {
      if (remainingDamage <= 0) break;
      const unitIndex = unitClass - 1;
      const unitStats = race.unitStats[unitIndex];
      if (!unitStats) continue;
      const currentUnits = Math.max(0, Math.floor(Number(attacker.army[unitIndex] || 0)));
      if (currentUnits <= 0) continue;
      const killed = Math.min(currentUnits, Math.floor(remainingDamage / unitStats.cost));
      if (killed <= 0) break;
      const rowDamage = killed * unitStats.cost;
      attacker.army[unitIndex] = currentUnits - killed;
      attacker.killedRows[unitIndex] += killed;
      rowKills[unitIndex] += killed;
      damagePower += rowDamage;
      targetLines.push(`${fmt(killed)} ${unitStats.name}`);
      const rowCleared = killed >= currentUnits;
      remainingDamage = rowCleared ? remainingDamage - rowDamage : 0;
      if (!rowCleared) break;
    }
    lines.push(reportTurretFireLine(textMode, defender.name, turretsFired, energyConsumed, damagePower, targetLines));
  }

  return {
    disabled,
    disableCost,
    defenderTurrets,
    availableEnergy,
    scienceLevel,
    energyPerShot,
    turretsFired,
    energyConsumed,
    baseKillRate: TURRET_CONFIG.baseKillRate,
    variance,
    killRate,
    damagePower,
    rowKills,
    remainingDamage
  };
}
function getK(ar, ac, dr, dc, combatLevel = 0) { const info = killRateInfo(ar, ac, dr, dc); return info.rate * (1 + combatScienceBonus(combatLevel)); }
function applyEconomyTickPure(base, sci = {}) {
  const b = base.buildings || emptyBuildings();
  const c = calcCaps(b, sci);
  const supportCap = supportedPopulationCap(c);
  const p = productionPerTick(b, sci);
  const armyUnits = (base.army || []).reduce((a, n) => a + n, 0);
  const currentPop = Math.max(0, base.pop || 0);
  const popGain = Math.floor(Math.max(0, supportCap - currentPop - (base.rebels || 0)) * 0.015 * scienceLevelBonus(sci.population));
  const consumption = Math.floor((currentPop + (base.rebels || 0) + armyUnits) * 0.02);
  const rawFood = (base.food || 0) + p.food - consumption;
  const rawWater = (base.water || 0) + p.water - consumption;
  const interest = Math.floor((base.banked || 0) * 0.0010415 * scienceLevelBonus(sci.banking));
  const toBank = Math.min(Math.max(0, c.bankCap - (base.banked || 0)), interest);
  let nextPop = currentPop + popGain;
  const starvationLoss = calculateStarvationLoss({ pop: nextPop, supportCap, rawFood, rawWater, consumption, tickEquivalent: 1 });
  nextPop = Math.max(0, nextPop - starvationLoss);
  return { ...base, pop: nextPop, cards: (base.cards || 0) + currentPop * 2 * scienceLevelBonus(sci.population) + (interest - toBank), banked: (base.banked || 0) + toBank, food: Math.max(0, rawFood), water: Math.max(0, rawWater), energy: Math.max(0, (base.energy || 0) + p.energy), protectionHours: Math.max(0, (base.protectionHours || 0) - 0.5), lastStarvationLoss: starvationLoss };
}
function applyElapsedProductionPure(base, tickEquivalent, mineAllocationArg, factoryAllocationArg, sci = {}) {
  const b = base.buildings || emptyBuildings();
  const c = calcCaps(b, sci);
  const supportCap = supportedPopulationCap(c);
  const prod = productionPerTick(b, sci);
  const armyUnits = (base.army || []).reduce((a, n) => a + n, 0);
  const ticks = Math.max(0, Number(tickEquivalent) || 0);
  const currentPop = Math.max(0, base.pop || 0);
  const popGain = Math.max(0, supportCap - currentPop - (base.rebels || 0)) * 0.015 * ticks * scienceLevelBonus(sci.population);
  const consumption = (currentPop + (base.rebels || 0) + armyUnits) * 0.02 * ticks;
  const rawFood = (base.food || 0) + prod.food * ticks - consumption;
  const rawWater = (base.water || 0) + prod.water * ticks - consumption;
  const bankInterest = (base.banked || 0) * 0.0010415 * ticks * scienceLevelBonus(sci.banking);
  const toBank = Math.min(Math.max(0, c.bankCap - (base.banked || 0)), bankInterest);
  let nextPop = Math.min(supportCap, currentPop + popGain);
  const starvationLoss = calculateStarvationLoss({ pop: nextPop, supportCap, rawFood, rawWater, consumption, tickEquivalent: ticks });
  nextPop = Math.max(0, nextPop - starvationLoss);
  let next = { ...base, pop: nextPop, cards: (base.cards || 0) + currentPop * 2 * ticks * scienceLevelBonus(sci.population) + (bankInterest - toBank), banked: (base.banked || 0) + toBank, food: Math.max(0, rawFood), water: Math.max(0, rawWater), energy: Math.max(0, (base.energy || 0) + prod.energy * ticks), protectionHours: Math.max(0, (base.protectionHours || 0) - 0.5 * ticks), lastStarvationLoss: starvationLoss };
  const race = races[next.race] || races.lithi;
  const mineTotal = race.mineableMinerals.map((m) => parseQty(mineAllocationArg[m])).reduce((a, b2) => a + b2, 0);
  if (mineTotal === 100 && (b.mineral_extractors || 0) > 0) {
    const totalMined = b.mineral_extractors * 13 * ticks * zarthMiningMultiplier(base, sci?.wordingMode || REPORT_WORDING_MODE);
    const mined = Object.fromEntries(race.mineableMinerals.map((m) => [m, totalMined * parseQty(mineAllocationArg[m]) / 100]));
    next = { ...next, minerals: Object.fromEntries(mineralOrder.map((m) => [m, ((next.minerals || {})[m] || 0) + (mined[m] || 0)])) };
  }
  const factoryTotal = Object.values(factoryAllocationArg).map(parseQty).reduce((a, b2) => a + b2, 0);
  if (factoryTotal === 100 && (b.factories || 0) > 0) {
    const scannerCapacity = b.factories * parseQty(factoryAllocationArg.scanners) / 100 * 0.25 * ticks;
    const missilesBuilt = b.factories * parseQty(factoryAllocationArg.missiles) / 100 * 0.005 * ticks;
    const missileCap = missileCapacityForBuildings(b);
    const affordable = Math.min(scannerCapacity, Math.floor((next.cards || 0) / 10000));
    next = { ...next, cards: next.cards - affordable * 10000, scanners: (next.scanners || 0) + affordable, missiles: Math.min(missileCap, (next.missiles || 0) + missilesBuilt) };
  }
  return next;
}
function shiftFinishAt(order, realMs) { return order?.finishAt ? { ...order, finishAt: order.finishAt - realMs } : order; }

function runSelfTests() { const tests = []; const assert = (name, condition) => tests.push({ name, passed: Boolean(condition) }); assert("Day 1 build costs 310,000", buildCost(day1Build) === 310000); assert("Compact format handles K", compactFmt(249000) === "249K"); assert("LRC minerals exclude scanner and speed-train minerals", !LRC_MINERALS.includes("Arthok") && !LRC_MINERALS.includes("Endaurios") && LRC_MINERALS.includes("Aldora")); assert("Compact format handles M", compactFmt(1250000) === "1.3M"); assert("Safe display handles objects", safeDisplay({ a: 1 }).includes("a")); assert("Unknown mineral placeholder shop price is 33,333", shopPrices.Aldora === 33333); assert("Shop sells food, water and energy", shopPrices.Food === 40 && shopPrices.Water === 2 && shopPrices.Energy === 3333); assert("Allocation clamp limits percentages", clampPercentInput("150") === "100"); assert("Factories assigned to construction accelerate build time", constructionDurationSeconds(400, { factories: 100 }, { construction: "100" }) < constructionDurationSeconds(400, {}, { construction: "100" })); assert("Build speed factor clamps to 1-9", normaliseBuildSpeedFactor("99") === 9 && normaliseBuildSpeedFactor("0") === 1); assert("Build speed factor curve hits x1 baseline", buildSpeedMultiplier("1") === 1); assert("Science labs match barracks-style curve", scienceLabMultiplier({ science_labs: 0 }) === 1 && scienceLabMultiplier({ science_labs: 1000 }) === 2 && scienceLabMultiplier({ science_labs: 4000 }) === 4); assert("Science curve calibrates high-lab level 1-180 to about 4320 x1 ticks", Math.abs(Array.from({ length: 180 }, (_, i) => scienceDurationSeconds(i, { science_labs: 4000 }) / SCIENCE_TICK_SECONDS).reduce((a, b) => a + b, 0) - SCIENCE_IG_TARGET_TICKS) < 2);
  assert("Build speed factor curve hits x3 double speed", buildSpeedMultiplier("3") === 2);
  assert("Build speed factor curve hits x6 quadruple speed", buildSpeedMultiplier("6") === 4);
  assert("Build speed factor trades cost for curved time", speedFactorBuildCost(1000, "3") === 3000 && speedFactorBuildSeconds(1000, "3") === speedFactorBuildSeconds(1000, "1") / 2); assert("Barracks training curve hits baseline/half/full points", barracksTrainingMultiplier({ barracks: 0 }) === 1 && barracksTrainingMultiplier({ barracks: 1000 }) === 2 && barracksTrainingMultiplier({ barracks: 4000 }) === 4); assert("Factories not assigned to construction do not accelerate build time", constructionDurationSeconds(400, { factories: 100 }, { construction: "0" }) === constructionDurationSeconds(400, {}, { construction: "100" })); assert("4k construction factories halve build time", Math.abs(constructionDurationSeconds(4000, { factories: 4000 }, { construction: "100" }) - 500) < 0.0001); assert("40k construction factories reduce build time to 25%", Math.abs(constructionDurationSeconds(4000, { factories: 40000 }, { construction: "100" }) - 250) < 0.0001); assert("Day 1 build uses 1,000 land", totalBuildings(day1Build) === 1000); assert("Li'thi full max train power is 5,461,268", races.lithi.maxTrain * races.lithi.units.reduce((s, [, c]) => s + c, 0) === 5461268); assert("Human full max train power is 3,994,425", races.human.maxTrain * races.human.units.reduce((s, [, c]) => s + c, 0) === 3994425); assert("Zarth full max train power is 4,365,753", races.zarth.maxTrain * races.zarth.units.reduce((s, [, c]) => s + c, 0) === 4365753); assert("Trysaur full max train power is 5,229,510", races.trysaur.maxTrain * races.trysaur.units.reduce((s, [, c]) => s + c, 0) === 5229510); assert("Re'lu full max train power is 6,080,067", races.relu.maxTrain * races.relu.units.reduce((s, [, c]) => s + c, 0) === 6080067); assert("Attack protection has 2h base", calculateAttackProtectionHours(0) === 2); assert("Attack protection adds 6 minutes per 1% damage", Math.abs(calculateAttackProtectionHours(23) - 4.3) < 0.0001);
  assert("100% damage gives 12h protection", calculateAttackProtectionHours(100) === 12); assert("Land spoils are positive on wins", calculateLandSpoils(10000, 10) > 0);
  assert("Human modern construction bonus is 5% faster", Math.abs(effectiveConstructionSeconds(1000, 1, { factories: 0 }, { construction: "100" }, { race: "human" }, "modern") - constructionDurationSeconds(1000, { factories: 0 }, { construction: "100" }) / 1.05) < 0.0001);
  assert("Trysaur war drums reach x3 speed-mineral training at cap", Math.abs(trainingSpeedDivider({ race: "trysaur", trainingSpeedOrdersCompleted: 500 }, true, "modern") - 3) < 0.0001);
  assert("Li'thi speed-mineral row caps expand by tier", effectiveMaxTrainForRow("lithi", 0, { entity: { race: "lithi" }, useSpeedMinerals: true, mode: "modern" }) === 19990 && effectiveMaxTrainForRow("lithi", 2, { entity: { race: "lithi" }, useSpeedMinerals: true, mode: "modern" }) === 7996 && effectiveMaxTrainForRow("lithi", 5, { entity: { race: "lithi" }, useSpeedMinerals: true, mode: "modern" }) === 3998);
  assert("Re'lu modern revive bonus multiplies final revive by 10%", Math.abs(reviveStatsFor({ race: "relu", army: [1000,0,0,0,0,0], startArmy: [1000,0,0,0,0,0], freeLand: 100, buildings: emptyBuildings() }, { revives: "Full revive system" }, { wordingMode: "modern" }).speciesReviveMultiplier - 1.1) < 0.0001);
  assert("Zarth modern mining bonus adds 20% output", Math.abs(applyElapsedProductionPure({ race: "zarth", pop: 0, rebels: 0, food: 0, water: 0, energy: 0, cards: 0, banked: 0, protectionHours: 0, army: [0,0,0,0,0,0], minerals: emptyMinerals(), scanners: 0, missiles: 0, buildings: { ...emptyBuildings(), mineral_extractors: 25 } }, 1, { Aldora: "20", Ontigro: "20", Tyron: "20", Arthok: "20", Positronium: "20" }, { construction: "100", scanners: "0", missiles: "0" }, { wordingMode: "modern" }).minerals.Aldora - 78) < 0.0001);
  assert("Protected players are recognised", isAttackProtected({ protectionHours: 0.5 }) === true);
  assert("Unprotected players are recognised", isAttackProtected({ protectionHours: 0 }) === false);
  assert("Recent attack block is enforced", isRecentAttackBlocked({ lastAttackedAt: Date.now() }, roundProfiles["Godlike Warfare"], Date.now()) === true);
  assert("Central attack legality blocks protected target", canAttackEntity({ name: "A", raceKey: "lithi", army: [0,0,0,0,0,1000] }, { name: "B", raceKey: "relu", army: [0,0,0,0,0,1000], protectionHours: 1 }, roundProfiles["Godlike Warfare"], Date.now()).ok === false); assert("Clearing attack protection removes both legacy hours and timestamp protection", effectiveProtectionHours(clearAttackProtection({ protectionHours: 1, protectionUntil: Date.now() + 3600000 }), Date.now()) === 0);
  assert("Alliance leader can kick ordinary member", canKickAllianceMember("A", "B", { leader: "A", viceLeader: "C", members: ["A", "B", "C"] }) === true);
  assert("Alliance vice cannot kick leader", canKickAllianceMember("C", "A", { leader: "A", viceLeader: "C", members: ["A", "B", "C"] }) === false);
  assert("Alliance vice can kick ordinary member", canKickAllianceMember("C", "B", { leader: "A", viceLeader: "C", members: ["A", "B", "C"] }) === true);
  assert("Diplomacy key helper is stable", diplomacyKey("alliance", "Old Guard") === "alliance:Old Guard");
  assert("War pair key ignores direction", warPairKey("player:A", "alliance:B") === warPairKey("alliance:B", "player:A"));
  assert("Protection decays by half an hour per full tick equivalent", decayProtection({ protectionHours: 2 }, 1).protectionHours === 1.5); assert("Old time formats Day 1 correctly", oldTime(77500) === "21 hours and 31 minutes"); assert("Due finish labels expose ready orders", dueNextStepLabel({ finishAt: Date.now() - 1 }, "Barracks", "Training") === "Training ready - click Barracks"); assert("Rankings sort descending", sortByPowerDesc([{ power: 1 }, { power: 3 }, { power: 2 }])[0].power === 3); assert("Reserved build land keeps total land stable", totalEmpireLand({ freeLand: 0, buildings: {}, buildOrder: { build: day1Build } }) === 1000); assert("Turbo tick conversion at speed 50", dueGameTicks(36, 50) === 1); assert("Fractional elapsed production changes DB before a full tick", applyElapsedProductionPure({ race: "lithi", pop: 0, rebels: 0, food: 0, water: 0, energy: 0, cards: 0, banked: 0, protectionHours: 0, army: [0,0,0,0,0,0], minerals: emptyMinerals(), scanners: 0, missiles: 0, buildings: { ...emptyBuildings(), living_areas: 100, nutrition_suppliers: 100, water_purifiers: 100, mineral_extractors: 25 } }, 0.1, { Hitera: "20", Feronga: "20", Antoria: "20", Sophitor: "20", Armidi: "20" }, { construction: "100", scanners: "0", missiles: "0" }).pop > 0); assert("Population grows when Living Areas exist", applyEconomyTickPure({ pop: 0, rebels: 0, food: 0, water: 0, energy: 0, cards: 0, banked: 0, protectionHours: 0, army: [0,0,0,0,0,0], buildings: { ...emptyBuildings(), living_areas: 100, nutrition_suppliers: 100, water_purifiers: 100 } }).pop > 0); assert("Admin time skip is literal real time, not multiplied by GLW speed", compactHms((20 * 60 * 1000) / 1000) === "00:20:00"); assert("Admin one-tick skip follows current round speed", compactHms((30 * 60 * 1000 / 4) / 1000) === "00:07:30"); assert("GLW recent-hit lockout is 7m30s real", compactHms(recentAttackBlockMsForSettings(roundProfiles["Godlike Warfare"]) / 1000) === "00:07:30"); assert("GLW retal window is 30m real", compactHms(retalWindowMsForSettings(roundProfiles["Godlike Warfare"]) / 1000) === "00:30:00"); assert("Admin shift can overshoot orders into due state", isFinishDue(shiftFinishAt({ finishAt: Date.now() + 60000 }, 60 * 1000).finishAt, Date.now()) === true); assert("Turret science reaches intended floors at level 60", Math.floor(turretDisableCostPerTurret(60)) === 10000 && Math.floor(turretEnergyPerShot(60)) === 50); return tests; }

function retalWindowMsForSettings(settings) {
  const speed = Math.max(1, Number(settings?.gameSpeed || 1));
  return Math.floor((2 * 60 * 60 * 1000) / speed);
}
function recentAttackBlockMsForSettings(settings) {
  const speed = Math.max(1, Number(settings?.gameSpeed || 1));
  return Math.floor((30 * 60 * 1000) / speed);
}
function recentAttackUntil(entity = {}, settings, now = Date.now()) {
  const last = Number(entity.lastAttackedAt || 0);
  if (!last) return 0;
  return last + recentAttackBlockMsForSettings(settings);
}
function isRecentAttackBlocked(entity = {}, settings, now = Date.now()) {
  return recentAttackUntil(entity, settings, now) > now;
}
function canAttackEntity(attacker, target, settings, now = Date.now(), options = {}) {
  if (!attacker || !target || target.name === attacker.name) return { ok: false, reason: "invalid target" };
  const hasRetal = Boolean(options.hasRetal);
  if (!hasRetal && effectiveProtectionHours(target, now) > 0) return { ok: false, reason: "target is under protection" };
  const recentUntil = recentAttackUntil(target, settings, now);
  // Old Antro-style retals can bypass power range / normal protection,
  // but they still must respect the global recent-hit lockout.
  if (recentUntil > now) return { ok: false, reason: `target was recently attacked; wait ${remainingTimeLabel(recentUntil, now)}` };
  const aRace = attacker.raceKey || attacker.race;
  const tRace = target.raceKey || target.race;
  const aP = armyPower(aRace, attacker.army || []);
  const tP = armyPower(tRace, target.army || []);
  if (aP < 500000) return { ok: false, reason: "attacker below 500,000 power" };
  if (tP < 500000) return { ok: false, reason: "target below 500,000 power" };
  if (!hasRetal) {
    const min = Math.floor(aP * 2 / 3);
    const max = Math.floor(aP * 1.5);
    if (tP < min || tP > max) return { ok: false, reason: "target outside attack range" };
  }
  return { ok: true, reason: hasRetal ? "retal attack allowed" : "attack allowed", attackerPower: aP, targetPower: tP };
}
function retalSourceKeyFrom({ sourceReportId = null, holder = "", target = "", createdAt = 0, id = null }) {
  if (sourceReportId) return `report:${sourceReportId}`;
  if (id) return `id:${id}`;
  return `legacy:${createdAt || 0}:${holder || ""}:${target || ""}`;
}
function normaliseRetalRecord(record) {
  if (!record) return record;
  return { ...record, sourceKey: record.sourceKey || retalSourceKeyFrom(record) };
}
function retalDedupeKey(record) {
  const r = normaliseRetalRecord(record);
  if (!r) return "";
  if (r.sourceReportId) return retalSourceKeyFrom(r);
  return r.sourceKey || retalSourceKeyFrom(r);
}
function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}
function maxTimestamp(...values) {
  const nums = values.map((value) => Number(value || 0)).filter((value) => value > 0);
  return nums.length ? Math.max(...nums) : null;
}
function minTimestamp(...values) {
  const nums = values.map((value) => Number(value || 0)).filter((value) => value > 0);
  return nums.length ? Math.min(...nums) : null;
}
function mergeRetalRecordState(a, b) {
  const left = normaliseRetalRecord(a) || {};
  const right = normaliseRetalRecord(b) || {};
  const usedLeft = Number(left.usedAt || 0);
  const usedRight = Number(right.usedAt || 0);
  const usedRecord = usedRight >= usedLeft ? right : left;
  const usedAt = maxTimestamp(left.usedAt, right.usedAt);
  const leftActive = Boolean(left.activatedAt && left.expiresAt);
  const rightActive = Boolean(right.activatedAt && right.expiresAt);
  const identityRecord = usedAt ? usedRecord : (rightActive && !leftActive ? right : left);
  return {
    ...left,
    ...right,
    id: firstDefined(identityRecord.id, left.id, right.id),
    sourceKey: firstDefined(identityRecord.sourceKey, left.sourceKey, right.sourceKey),
    sourceReportId: firstDefined(identityRecord.sourceReportId, left.sourceReportId, right.sourceReportId),
    holder: firstDefined(left.holder, right.holder),
    holderAlliance: firstDefined(left.holderAlliance, right.holderAlliance, "None"),
    target: firstDefined(left.target, right.target),
    targetAlliance: firstDefined(left.targetAlliance, right.targetAlliance, "None"),
    createdAt: minTimestamp(left.createdAt, right.createdAt) || firstDefined(left.createdAt, right.createdAt),
    activatedAt: maxTimestamp(left.activatedAt, right.activatedAt),
    expiresAt: maxTimestamp(left.expiresAt, right.expiresAt),
    waitingForNextSeenAfter: minTimestamp(left.waitingForNextSeenAfter, right.waitingForNextSeenAfter) || firstDefined(left.waitingForNextSeenAfter, right.waitingForNextSeenAfter),
    usedAt,
    usedByReportId: usedAt ? firstDefined(usedRecord.usedByReportId, left.usedByReportId, right.usedByReportId) : null,
    usedWon: usedAt ? Boolean(firstDefined(usedRecord.usedWon, left.usedWon, right.usedWon)) : firstDefined(left.usedWon, right.usedWon)
  };
}
function markRetalRecordServed(records = [], usedRecord, usedAt, usedByReportId, usedWon) {
  const key = retalDedupeKey(usedRecord);
  const id = usedRecord?.id;
  return (records || []).map((record) => {
    const r = normaliseRetalRecord(record);
    const sameSource = key && retalDedupeKey(r) === key;
    const sameId = id && r?.id === id;
    return sameSource || sameId ? { ...r, usedAt, usedByReportId, usedWon: Boolean(usedWon) } : r;
  });
}
function retalRecordForSourceReport(records = [], reportId) {
  const key = reportId ? `report:${reportId}` : "";
  const matches = (records || []).map(normaliseRetalRecord).filter((record) => record && (record.sourceReportId === reportId || record.sourceKey === key));
  return matches.find((record) => record.usedAt) || matches.find((record) => record.activatedAt && record.expiresAt) || matches[0] || null;
}
function makeRetalRecord({ holder, holderAlliance = "None", target, targetAlliance = "None", createdAt = Date.now(), sourceReportId = null, sourceKey = null, activatedAt = null, expiresAt = null, waitingForNextSeenAfter = null }) {
  const id = `retal-${createdAt}-${holder}-${target}-${Math.floor(Math.random() * 100000)}`;
  return {
    id,
    holder,
    holderAlliance: holderAlliance || "None",
    target,
    targetAlliance: targetAlliance || "None",
    createdAt,
    activatedAt,
    expiresAt,
    waitingForNextSeenAfter,
    usedAt: null,
    usedByReportId: null,
    usedWon: null,
    sourceKey: sourceKey || retalSourceKeyFrom({ sourceReportId, holder, target, createdAt, id }),
    sourceReportId
  };
}
function makeGrievanceRecord({ holder, holderType = "player", target, targetType = "player", score = 1, reason = "battle", createdAt = Date.now() }) {
  return {
    id: `grievance-${createdAt}-${holderType}-${holder}-${targetType}-${target}-${Math.floor(Math.random() * 100000)}`,
    holder,
    holderType,
    target,
    targetType,
    score,
    reason,
    createdAt,
    lastAt: createdAt
  };
}
function isRetalActive(r, now) {
  return r && !r.usedAt && r.activatedAt && r.expiresAt && now <= r.expiresAt;
}
function retalMatches(r, holderName, targetName, now) {
  return r && r.holder === holderName && r.target === targetName && isRetalActive(r, now);
}
function activeRetalCountdownLabel(r, now = Date.now()) {
  if (!r || !r.expiresAt) return "";
  return compactHms(Math.max(0, Math.ceil((Number(r.expiresAt) - now) / 1000)));
}
function botRetalShouldActivate(holder, now = Date.now(), retalRecord = null) {
  if (!holder || holder.isPlayer || holder.botAsleep) return false;
  const mustBeAfter = Number(retalRecord?.waitingForNextSeenAfter || retalRecord?.createdAt || 0);
  const checkInAt = Number(holder.lastBotCheckInAt || 0);
  const seenAt = Number(holder.lastSeenAt || 0);
  // Waiting bot retals should start only after a genuine bot check-in that occurred
  // after the attack which created the retal. A stale/reconstructed Last Seen label is not enough.
  if (mustBeAfter) {
    if (checkInAt > mustBeAfter && checkInAt <= now) return true;
    return false;
  }
  return Boolean(seenAt && seenAt >= now - 2 * 60 * 1000);
}
function mergeRetalRecords(primary = [], secondary = []) {
  const out = [];
  const indexByKey = new Map();
  [...primary, ...secondary].forEach((r) => {
    if (!r) return;
    const normalized = normaliseRetalRecord(r);
    const key = retalDedupeKey(normalized);
    if (indexByKey.has(key)) {
      const index = indexByKey.get(key);
      out[index] = mergeRetalRecordState(out[index], normalized);
      return;
    }
    indexByKey.set(key, out.length);
    out.push(normalized);
  });
  return out.slice(0, 200);
}
function grievanceScoreFor(records, holderName, holderAlliance, targetName, targetAlliance) {
  const hAlliance = holderAlliance && holderAlliance !== "None" ? holderAlliance : null;
  const tAlliance = targetAlliance && targetAlliance !== "None" ? targetAlliance : null;
  return (records || []).reduce((sum, g) => {
    const holderMatch = (g.holderType === "player" && g.holder === holderName) || (g.holderType === "alliance" && hAlliance && g.holder === hAlliance);
    const targetMatch = (g.targetType === "player" && g.target === targetName) || (g.targetType === "alliance" && tAlliance && g.target === tAlliance);
    return holderMatch && targetMatch ? sum + Number(g.score || 0) : sum;
  }, 0);
}
function decayGrievanceRecords(records, now) {
  const maxAge = 48 * 60 * 60 * 1000;
  return (records || [])
    .map((g) => ({ ...g, score: Number(g.score || 0) * Math.pow(0.5, Math.max(0, now - (g.lastAt || g.createdAt || now)) / maxAge) }))
    .filter((g) => g.score >= 0.1);
}



const GLW_LATE_BOT_SEEDS = [
  { name: "Asterion", raceKey: "zarth", land: 82000, power: 66000000, role: "Major land winner, stretched but frightening" },
  { name: "Vale Regent", raceKey: "human", land: 74000, power: 82000000, role: "Dominant balanced threat" },
  { name: "Relu Vey", raceKey: "relu", land: 68000, power: 71000000, role: "Strong resilient empire" },
  { name: "Thornwake", raceKey: "trysaur", land: 61000, power: 49000000, role: "Recently gained too much land" },
  { name: "Glass Tyrant", raceKey: "lithi", land: 56000, power: 69000000, role: "Dense high-power predator" },
  { name: "Black Orchard", raceKey: "lithi", land: 59000, power: 43000000, role: "Won land, now thin" },
  { name: "Ash Column", raceKey: "zarth", land: 54000, power: 35000000, role: "Big land grab, barely in revive band" },
  { name: "Banquet King", raceKey: "human", land: 51000, power: 39000000, role: "Economic winner, vulnerable" },
  { name: "Mire Crown", raceKey: "trysaur", land: 47000, power: 30000000, role: "Overextended after raids" },
  { name: "Silent Estate", raceKey: "relu", land: 45000, power: 37000000, role: "Stable but still stretched" },
  { name: "Iron Orchard", raceKey: "human", land: 39000, power: 39500000, role: "Clean revive shape" },
  { name: "Pale Engine", raceKey: "zarth", land: 37000, power: 34000000, role: "Plausible peer rival" },
  { name: "Moth Senate", raceKey: "lithi", land: 36000, power: 42000000, role: "Dense, dangerous peer" },
  { name: "Red Quarry", raceKey: "trysaur", land: 34000, power: 31000000, role: "Slightly wounded but viable" },
  { name: "Candle Host", raceKey: "relu", land: 32000, power: 36000000, role: "Lost some land, still strong" },
  { name: "Grey Foundry", raceKey: "human", land: 30000, power: 29000000, role: "Balanced mid-rank account" },
  { name: "Salt Warden", raceKey: "zarth", land: 28000, power: 38000000, role: "Lost land, army still dense" },
  { name: "Violet Maw", raceKey: "lithi", land: 26000, power: 34000000, role: "Hard defensive target" },
  { name: "Old Furnace", raceKey: "human", land: 25000, power: 30000000, role: "Recovering after a hit" },
  { name: "Rootbreaker", raceKey: "trysaur", land: 23000, power: 28000000, role: "Dangerous compact army" },
  { name: "Relu Ash", raceKey: "relu", land: 22000, power: 31000000, role: "Slightly above band, resilient but awkward" },
  { name: "Hollow Bank", raceKey: "human", land: 19000, power: 15000000, role: "Damaged but still alive" },
  { name: "Split Hive", raceKey: "lithi", land: 17000, power: 10000000, role: "Below revive band, vulnerable" },
  { name: "Dead Orchard", raceKey: "relu", land: 15000, power: 13000000, role: "Small but not dead" },
  { name: "Cracked Bell", raceKey: "zarth", land: 13000, power: 6500000, role: "Collapsed after hits" },
  { name: "Bone Ledger", raceKey: "trysaur", land: 11000, power: 8000000, role: "Low reward but plausible target" },
  { name: "Empty Crown", raceKey: "human", land: 9000, power: 4000000, role: "Almost farm state" },
  { name: "Copper Saint", raceKey: "relu", land: 42000, power: 58000000, role: "High power, land-poor edge case" },
  { name: "Glass Orchard", raceKey: "lithi", land: 41000, power: 24000000, role: "Rich land, weak army" },
  { name: "War Psalm", raceKey: "trysaur", land: 29000, power: 47000000, role: "Too dense, dangerous but revive-inefficient" },
  { name: "Low Parliament", raceKey: "human", land: 33000, power: 18000000, role: "Economically alive, militarily thin" },
  { name: "Quiet Knife", raceKey: "zarth", land: 21000, power: 23000000, role: "Small assassin-style account" },
];

function glwArmyForPower(raceKey, targetPower) {
  const race = races[raceKey] || races.human;
  const weights = [0.06, 0.08, 0.13, 0.19, 0.23, 0.31];
  return weights.map((weight, index) => Math.max(0, Math.floor((targetPower * weight) / Math.max(1, race.units[index]?.[1] || 1))));
}

function glwBuildingsForLand(land, index = 0) {
  const b = emptyBuildings();
  const serious = land >= 22000;
  b.barracks = serious ? 4000 : Math.max(1200, Math.min(3000, Math.floor(land * 0.16)));
  b.science_labs = serious ? 4500 : Math.max(1200, Math.min(3500, Math.floor(land * 0.18)));
  b.mineral_extractors = Math.floor(land * (0.04 + ((index % 3) * 0.005)));
  b.factories = Math.min(7500, Math.max(800, Math.floor(land * (land > 50000 ? 0.09 : 0.11))));
  const targetUnused = Math.floor(land * (land > 50000 ? 0.12 : land < 18000 ? 0.08 : 0.05));
  let remaining = Math.max(0, land - targetUnused - totalBuildings(b));
  b.banks = Math.floor(remaining * (land > 45000 ? 0.45 : 0.38));
  remaining = Math.max(0, land - targetUnused - totalBuildings(b));
  b.living_areas = Math.floor(remaining * 0.42);
  b.nutrition_suppliers = Math.floor(remaining * 0.18);
  b.water_purifiers = Math.floor(remaining * 0.18);
  b.police_stations = Math.floor(remaining * 0.08);
  remaining = Math.max(0, land - targetUnused - totalBuildings(b));
  b.banks += Math.max(0, remaining);
  return b;
}

function makeGlwLateOpponent(seed, index = 0, now = Date.now()) {
  const buildings = glwBuildingsForLand(seed.land, index);
  const freeLand = Math.max(0, seed.land - totalBuildings(buildings));
  const army = glwArmyForPower(seed.raceKey, seed.power);
  return normaliseOpponentPresence({
    id: 900000 + index,
    name: seed.name,
    race: raceNameFromKey(seed.raceKey),
    raceKey: seed.raceKey,
    alliance: index % 5 === 0 ? "Old Guard" : index % 5 === 1 ? "Fed Council" : index % 5 === 2 ? "Orange Dawn" : index % 5 === 3 ? "Brave New World" : "None",
    freeLand,
    cards: Math.floor(12000000 + seed.land * 700),
    banked: Math.floor((buildings.banks || 0) * 250000),
    pop: Math.floor((buildings.living_areas || 0) * 115),
    rebels: 0,
    food: Math.floor((buildings.nutrition_suppliers || 0) * 150),
    water: Math.floor((buildings.water_purifiers || 0) * 240),
    energy: Math.floor(80000 + seed.land * 1.5),
    scanners: 0,
    missiles: Math.floor(index % 4 === 0 ? 120 : 40),
    experience: Math.floor(1000 + index * 210),
    totalExperience: Math.floor(1200 + index * 240),
    roundWins: Math.floor(2 + index % 9),
    roundLosses: Math.floor(index % 6),
    totalWins: Math.floor(4 + index % 11),
    totalLosses: Math.floor(index % 7),
    trainingSpeedOrdersCompleted: seed.raceKey === "trysaur" ? 180 : 0,
    minerals: emptyMinerals(),
    buildings,
    army,
    stack: [6, 5, 4, 3, 2, 1],
    buildOrder: null,
    exploreOrder: null,
    trainOrder: null,
    protectionHours: 0,
    protectionUntil: 0,
    lastAttackedAt: now - (index + 3) * 11 * 60000,
    powerOffset: 0,
    lastBotUpdatedAt: now,
    lastSeenAt: now - ((index * 7) % 59) * 60000,
    lastSeen: lastSeenLabelFromAt(now - ((index * 7) % 59) * 60000, now),
    lastBotCheckInAt: now - 5 * 60000,
    botOnlineUntil: now + 10 * 60 * 1000,
    botRoundSurgeUntil: now + 2 * 60 * 60 * 1000,
    botAsleep: false,
    botBuildOrder: null,
    botTrainOrder: null,
    lastBotAction: seed.role,
    lastBotCompleted: "Late-war seed state.",
  });
}

export default function App() {
  const [page, setPage] = useState("status");
  const [hydrated, setHydrated] = useState(false);
  const [testerAccessRecord, setTesterAccessRecord] = useState(() => safeLoadTesterAccess());
  const [testerAccessDraft, setTesterAccessDraft] = useState("");
  const [testerAccessCommentDraft, setTesterAccessCommentDraft] = useState("");
  const [testerAccessError, setTesterAccessError] = useState("");
  const [testerAccessSubmitting, setTesterAccessSubmitting] = useState(false);
  const [multiplayerHealthState, setMultiplayerHealthState] = useState({ loading: false, error: "", fetchedAt: null, summary: null });
  const [multiplayerPreviewState, setMultiplayerPreviewState] = useState({ loading: false, error: "", fetchedAt: null, summary: null });
  const [multiplayerIdentityState, setMultiplayerIdentityState] = useState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
  const [multiplayerDevActionState, setMultiplayerDevActionState] = useState({ loading: false, error: "", lastActionAt: null, lastActionType: null, lastActionResult: null, lastActionMessage: null });
  const [hostedRoundState, setHostedRoundState] = useState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
  const [activeGameMode, setActiveGameMode] = useState("local");
  const [hostedDiagnosticsOpen, setHostedDiagnosticsOpen] = useState(false);
  // Hosted-only exploration drafts (same defaults as the local Explore page).
  // Deliberately NOT part of currentSavePayload/autosave: hosted UI state never
  // enters browser-local saves.
  const [hostedExploreHours, setHostedExploreHours] = useState("24");
  const [hostedExploreSpend, setHostedExploreSpend] = useState("1000000");
  const [hostedBankAmount, setHostedBankAmount] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [displayModel, setDisplayModel] = useState(DISPLAY_MODEL_DEFAULT);
  const [glwSeedMode, setGlwSeedMode] = useState("late");
  const [glwRaceRegistered, setGlwRaceRegistered] = useState(false);
  const [retroWordingPasswordDraft, setRetroWordingPasswordDraft] = useState("");
  const [retroWordingError, setRetroWordingError] = useState("");
  const [reportTextMode, setReportTextMode] = useState(REPORT_WORDING_MODE);
  const [showAdminAccessModal, setShowAdminAccessModal] = useState(false);
  const [adminPasswordDraft, setAdminPasswordDraft] = useState("");
  const [adminAccessError, setAdminAccessError] = useState("");
  const [showRetroConfirmModal, setShowRetroConfirmModal] = useState(false);
  const [retroConfirmedThisSession, setRetroConfirmedThisSession] = useState(false);
  const [log, setLog] = useState(["Welcome to AntrophAI. Your empire awaits orders."]);
  const [worldReports, setWorldReports] = useState([]);
  const [newsDraft, setNewsDraft] = useState("");
  const [buildForm, setBuildForm] = useState(emptyBuildForm());
  const [trainForm, setTrainForm] = useState(["", "", "", "", "", ""]);
  const [disbandForm, setDisbandForm] = useState(["", "", "", "", "", ""]);
  const [destroyForm, setDestroyForm] = useState(emptyBuildForm());
  const [mineAllocation, setMineAllocation] = useState({ Hitera: "20", Feronga: "20", Antoria: "20", Sophitor: "20", Armidi: "20" });
  const [factoryAllocation, setFactoryAllocation] = useState({ construction: "100", scanners: "0", missiles: "0" });
  const [buildSpeedFactor, setBuildSpeedFactor] = useState("1");
  const [useBarracksSpeedMinerals, setUseBarracksSpeedMinerals] = useState(false);
  const [pageCompletionNotice, setPageCompletionNotice] = useState(null);
  const [bankAmount, setBankAmount] = useState("");
  const [scienceField, setScienceField] = useState("agriculture");
  const [scienceOrder, setScienceOrder] = useState(null);
  const [scienceLevels, setScienceLevels] = useState({ agriculture: 0, combat: 0, crime: 0, housing: 0, population: 0, banking: 0, turrets: 0 });
  const [roundProfile, setRoundProfile] = useState("Godlike Warfare");
  const [roundSettings, setRoundSettings] = useState(roundProfiles["Godlike Warfare"]);
  const [gameName, setGameName] = useState("Godlike Warfare");
  const [roundStartedAt, setRoundStartedAt] = useState(() => roundStartTimestampForKey("glw"));
  const [shopMineral, setShopMineral] = useState("Arthok");
  const [shopQty, setShopQty] = useState("");
  const [marketMineral, setMarketMineral] = useState("Feronga");
  const [marketQty, setMarketQty] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [marketBuyQty, setMarketBuyQty] = useState("");
  const [missileQty, setMissileQty] = useState("");
  const [messageTo, setMessageTo] = useState("Randy");
  const [messageBody, setMessageBody] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTargetName, setSelectedTargetName] = useState("Randy");
  const [disableTargetTurrets, setDisableTargetTurrets] = useState(false);
  const [profileName, setProfileName] = useState("SONAR");
  const [allianceProfileName, setAllianceProfileName] = useState("Human Shield");
  const [spyTarget, setSpyTarget] = useState("Randy");
  const [spyCount, setSpyCount] = useState("");
  const [mercCount, setMercCount] = useState("");
  const [spies, setSpies] = useState(0);
  const [mercenaries, setMercenaries] = useState(0);
  const [spyReports, setSpyReports] = useState([]);
  const [allianceName, setAllianceName] = useState("");
  const [alliance, setAlliance] = useState(null);
  const [shareAllianceProfile, setShareAllianceProfile] = useState(false);
  const [allianceShareEnabledMembers, setAllianceShareEnabledMembers] = useState([]);
  const [allianceAnnouncementDraft, setAllianceAnnouncementDraft] = useState("");
  const [allianceSubPage, setAllianceSubPage] = useState("main");
  const [todoSubPage, setTodoSubPage] = useState("todo");
  const [selectedHelpRace, setSelectedHelpRace] = useState("lithi");
  const [selectedArchivePlateIndex, setSelectedArchivePlateIndex] = useState(null);
  const [selectedArchiveGallery, setSelectedArchiveGallery] = useState("archivePlates");
  const [selectedHelpBuilding, setSelectedHelpBuilding] = useState("turrets");
  const [selectedBattleOutcome, setSelectedBattleOutcome] = useState("90_100");
  const [libraryImageViewer, setLibraryImageViewer] = useState(null);
  const [selectedChangelogVersion, setSelectedChangelogVersion] = useState(PROTOTYPE_VERSION);
  const [donateAllianceLandAmount, setDonateAllianceLandAmount] = useState("");
  const [allianceBankBuildQty, setAllianceBankBuildQty] = useState("");
  const [allianceBankSpeedFactor, setAllianceBankSpeedFactor] = useState("1");
  const [allianceBankDepositAmount, setAllianceBankDepositAmount] = useState("");
  const [lrcCardsAmount, setLrcCardsAmount] = useState("");
  const [lrcEnergyAmount, setLrcEnergyAmount] = useState("");
  const [lrcMineralName, setLrcMineralName] = useState("Arthok");
  const [lrcMineralAmount, setLrcMineralAmount] = useState("");
  const [lrcTargetType, setLrcTargetType] = useState("alliance");
  const [lrcTargetName, setLrcTargetName] = useState("");
  const [activeLrcSequence, setActiveLrcSequence] = useState(null);
  const [exploreHours, setExploreHours] = useState("24");
  const [exploreCards, setExploreCards] = useState("1000000");
  const [newsFilter, setNewsFilter] = useState("All");
  const [newsPage, setNewsPage] = useState(1);
  const [debugComment, setDebugComment] = useState("");
  const [battleLogPage, setBattleLogPage] = useState(1);
  const [battleLogOpponent, setBattleLogOpponent] = useState("All opponents");
  const [pageFlash, setPageFlash] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState("Normal");
  const [onlineSort, setOnlineSort] = useState({ key: "lastSeen", dir: "asc" });
  const [snapshotTick, setSnapshotTick] = useState(0);
  const [nexusMineralName, setNexusMineralName] = useState("Arthok");
  const [nexusMineralAmount, setNexusMineralAmount] = useState("");
  const [demoMemberName, setDemoMemberName] = useState("Randy");
  const [diplomacyTargetType, setDiplomacyTargetType] = useState("alliance");
  const [diplomacyTargetName, setDiplomacyTargetName] = useState("Old Guard");
  const [activeWars, setActiveWars] = useState([]);
  const [alliedStatuses, setAlliedStatuses] = useState([]);
  const [diplomacyRequests, setDiplomacyRequests] = useState([]);
  const [retalRecords, setRetalRecords] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [battleReport, setBattleReport] = useState([]);
  const [lastUpdateSummary, setLastUpdateSummary] = useState("No page-request update has run yet.");
  const [displayNow, setDisplayNow] = useState(Date.now());
  const [rankingSorts, setRankingSorts] = useState([{ key: "power", dir: "desc" }]);
  const [selfTests] = useState(runSelfTests());
  const [outgoingMissiles, setOutgoingMissiles] = useState([]);
  const [incomingMissiles, setIncomingMissiles] = useState([]);
  const [messages, setMessages] = useState([{ id: 1, direction: "inbox", from: "Randy", to: "SONAR", body: "Nice stack. Shame about the Air Forces.", read: false }, { id: 2, direction: "inbox", from: "System", to: "SONAR", body: "Welcome to AntrophAI.", read: true }]);
  const [messagePopup, setMessagePopup] = useState(null);
  const [warInlineNotice, setWarInlineNotice] = useState(null);
  const warInlineNoticeTimeoutsRef = useRef([]);
  const [expandedMessageId, setExpandedMessageId] = useState(null);
  const [playerNameDraft, setPlayerNameDraft] = useState("");
  const [playerNameSetupComplete, setPlayerNameSetupComplete] = useState(false);
  const [entryStage, setEntryStage] = useState("account");
  const [selectedRoundKey, setSelectedRoundKey] = useState("intro");
  const [selectedSpeciesKey, setSelectedSpeciesKey] = useState("lithi");
  const [activeRoundSlotKey, setActiveRoundSlotKey] = useState("glw-local");
  const [roundSlotIndex, setRoundSlotIndex] = useState([]);
  const [saveExportText, setSaveExportText] = useState("");
  const [saveImportDraft, setSaveImportDraft] = useState("");
  const [roundSelectTab, setRoundSelectTab] = useState("rounds");
  const [marketOrders, setMarketOrders] = useState([]);
  const [processedBattleKeys, setProcessedBattleKeys] = useState([]);
  const processedBattleKeysRef = useRef([]);
  const processedMissileImpactIdsRef = useRef([]);
  const [player, setPlayer] = useState({ id: 1, name: "SONAR", race: "lithi", freeLand: 50000, cards: 10000000, banked: 0, pop: 0, rebels: 0, food: 0, water: 0, energy: 0, scanners: 0, missiles: 0, experience: 0, totalExperience: 0, roundWins: 0, roundLosses: 0, totalWins: 0, totalLosses: 0, trainingSpeedOrdersCompleted: 0, minerals: emptyMinerals(), buildings: emptyBuildings(), army: [0, 0, 0, 0, 0, 0], stack: [6, 3, 4, 2, 1, 5], buildOrder: null, exploreOrder: null, trainOrder: null, bonusClaimed: false, protectionHours: 0, lastUpdatedAt: Date.now() });
  const activeReportTextMode = displayModel === "retro" ? "classic" : "modern";
  const identityWordMode = displayLabelModeFor(displayModel === "retro" ? "retro" : DISPLAY_MODEL_DEFAULT);
  const activeSpeciesSkinKey = entryStage === "species" ? selectedSpeciesKey : player.race;
  const labelFor = (key, labelType = "resources") => getLabel(key, { race: player.race, wordingMode: identityWordMode, labelType });
  const speciesDisplayLabel = () => identityWordMode === "classic" ? "Race" : "Species";
  const resourceLabel = (key) => labelFor(key, "resources");
  const mineralLabel = (key) => labelFor(key, "minerals");
  const buildingLabel = (key) => labelFor(key, "buildings");
  const pageLabel = (key) => labelFor(key, "pages");
  const actionLabel = (key) => labelFor(key, "actions");
  const currencyLabel = resourceLabel("cards");
  const shopItemLabel = (key) => ["Food", "Water", "Energy"].includes(key) ? resourceLabel(String(key).toLowerCase()) : mineralLabel(key);
  const [demoOpponents, setDemoOpponents] = useState([
    { id: 154, name: "gohan", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 27826, pop: 1744704, cards: 62135414, experience: 3699, protectionHours: 0, lastSeen: "17 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11631, nutrition_suppliers: 1742, water_purifiers: 3674, police_stations: 1051, blast_shields: 2, turrets: 56 }, army: [16438, 9040, 7397, 5260, 3616, 2630], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1575041 },
    { id: 666, name: "Randy", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 250000, pop: 9000000, cards: 125000000, experience: 1162, protectionHours: 0, lastSeen: "25 minutes ago", buildings: { ...emptyBuildings(), living_areas: 60000, nutrition_suppliers: 25000, water_purifiers: 22000, police_stations: 7000, blast_shields: 1200, turrets: 250 }, army: [90000, 49500, 40500, 28800, 19800, 14400], stack: [6, 4, 5, 2, 3, 1], powerOffset: 210000000 },
    { id: 953, name: "huh?", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 1732, pop: 506541, cards: 26164941, experience: 5049, protectionHours: 0, lastSeen: "45 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3376, nutrition_suppliers: 3592, water_purifiers: 2042, police_stations: 149, blast_shields: 26, turrets: 57 }, army: [23338, 12835, 10502, 7468, 5134, 3734], stack: [5, 6, 4, 2, 3, 1], powerOffset: 1053498 },
    { id: 1108, name: "E.S.A.", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 33287, pop: 1609874, cards: 42684862, experience: 4655, protectionHours: 0, lastSeen: "40 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10732, nutrition_suppliers: 3760, water_purifiers: 1320, police_stations: 769, blast_shields: 40, turrets: 18 }, army: [9945, 5469, 4475, 3182, 2187, 1591], stack: [1, 2, 6, 5, 3, 4], powerOffset: 2315646 },
    { id: 1199, name: "i dont know", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 13415, pop: 1083241, cards: 46245187, experience: 986, protectionHours: 0, lastSeen: "37 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7221, nutrition_suppliers: 800, water_purifiers: 3266, police_stations: 646, blast_shields: 123, turrets: 55 }, army: [14569, 8012, 6556, 4662, 3205, 2331], stack: [6, 3, 4, 2, 1, 5], powerOffset: 919506 },
    { id: 1382, name: "jam2yoyo", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 88890, pop: 896064, cards: 60735083, experience: 6866, protectionHours: 0, lastSeen: "52 minutes ago", buildings: { ...emptyBuildings(), living_areas: 5973, nutrition_suppliers: 846, water_purifiers: 2669, police_stations: 496, blast_shields: 206, turrets: 8 }, army: [11107, 6108, 4998, 3554, 2443, 1777], stack: [1, 6, 5, 4, 3, 2], powerOffset: 732761 },
    { id: 1819, name: "sheffron1", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 60246, pop: 429576, cards: 61319036, experience: 6441, protectionHours: 0, lastSeen: "39 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2863, nutrition_suppliers: 3829, water_purifiers: 4422, police_stations: 787, blast_shields: 205, turrets: 5 }, army: [19366, 10651, 8714, 6197, 4260, 3098], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1074298 },
    { id: 1945, name: "freak", race: "Trysaur", raceKey: "trysaur", alliance: "Kobra Kai", freeLand: 55351, pop: 652665, cards: 16285924, experience: 6654, protectionHours: 0, lastSeen: "31 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4351, nutrition_suppliers: 3061, water_purifiers: 3170, police_stations: 199, blast_shields: 106, turrets: 15 }, army: [9777, 5377, 4399, 3128, 2150, 1564], stack: [6, 4, 5, 2, 3, 1], powerOffset: 1249622 },
    { id: 1984, name: "aragorn", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 48848, pop: 1056424, cards: 52491800, experience: 5432, protectionHours: 0, lastSeen: "18 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7042, nutrition_suppliers: 1813, water_purifiers: 3200, police_stations: 154, blast_shields: 124, turrets: 45 }, army: [10529, 5790, 4738, 3369, 2316, 1684], stack: [5, 6, 4, 2, 3, 1], powerOffset: 1424427 },
    { id: 2864, name: "Gump", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 220000, pop: 8200000, cards: 105000000, experience: 6746, protectionHours: 0, lastSeen: "6 minutes ago", buildings: { ...emptyBuildings(), living_areas: 55000, nutrition_suppliers: 23000, water_purifiers: 21000, police_stations: 6500, blast_shields: 1000, turrets: 220 }, army: [85000, 46750, 38250, 27200, 18700, 13600], stack: [1, 2, 6, 5, 3, 4], powerOffset: 185000000 },
    { id: 4771, name: "alpha centauri", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 34351, pop: 1201788, cards: 9496417, experience: 2442, protectionHours: 0, lastSeen: "14 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8011, nutrition_suppliers: 2182, water_purifiers: 105, police_stations: 994, blast_shields: 29, turrets: 15 }, army: [1961, 1078, 882, 627, 431, 313], stack: [6, 3, 4, 2, 1, 5], powerOffset: 1870688 },
    { id: 5181, name: "umm ok", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 24364, pop: 402637, cards: 64156426, experience: 4634, protectionHours: 0, lastSeen: "50 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2684, nutrition_suppliers: 1872, water_purifiers: 4316, police_stations: 1155, blast_shields: 24, turrets: 31 }, army: [9502, 5226, 4275, 3040, 2090, 1520], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1925375 },
    { id: 5727, name: "jadzit", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 81427, pop: 836094, cards: 5812937, experience: 3350, protectionHours: 0, lastSeen: "14 minutes ago", buildings: { ...emptyBuildings(), living_areas: 5573, nutrition_suppliers: 3687, water_purifiers: 4430, police_stations: 186, blast_shields: 394, turrets: 48 }, army: [20330, 11181, 9148, 6505, 4472, 3252], stack: [6, 5, 4, 2, 3, 1], powerOffset: 2161631 },
    { id: 7048, name: "Dot 7048", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 67479, pop: 1460264, cards: 26084383, experience: 4980, protectionHours: 0, lastSeen: "1 minutes ago", buildings: { ...emptyBuildings(), living_areas: 9735, nutrition_suppliers: 2846, water_purifiers: 3671, police_stations: 1055, blast_shields: 94, turrets: 18 }, army: [6811, 3746, 3064, 2179, 1498, 1089], stack: [6, 4, 5, 2, 3, 1], powerOffset: 974940 },
    { id: 7321, name: "Smokey", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 56730, pop: 965559, cards: 50044758, experience: 2151, protectionHours: 0, lastSeen: "43 minutes ago", buildings: { ...emptyBuildings(), living_areas: 6437, nutrition_suppliers: 2314, water_purifiers: 293, police_stations: 484, blast_shields: 113, turrets: 51 }, army: [22125, 12168, 9956, 7080, 4867, 3540], stack: [5, 6, 4, 2, 3, 1], powerOffset: 2205537 },
    { id: 8021, name: "Granbretan", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 56662, pop: 926471, cards: 62728528, experience: 3075, protectionHours: 0, lastSeen: "36 minutes ago", buildings: { ...emptyBuildings(), living_areas: 6176, nutrition_suppliers: 1606, water_purifiers: 3211, police_stations: 375, blast_shields: 280, turrets: 26 }, army: [17456, 9600, 7855, 5585, 3840, 2792], stack: [1, 2, 6, 5, 3, 4], powerOffset: 2130033 },
    { id: 8230, name: "TeC", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 72819, pop: 1654561, cards: 21679506, experience: 4071, protectionHours: 0, lastSeen: "20 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11030, nutrition_suppliers: 1553, water_purifiers: 1419, police_stations: 126, blast_shields: 95, turrets: 33 }, army: [13017, 7159, 5857, 4165, 2863, 2082], stack: [6, 3, 4, 2, 1, 5], powerOffset: 864397 },
    { id: 8296, name: "mages of death", race: "Trysaur", raceKey: "trysaur", alliance: "Kobra Kai", freeLand: 67300, pop: 1652825, cards: 62491629, experience: 7042, protectionHours: 0, lastSeen: "56 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11018, nutrition_suppliers: 219, water_purifiers: 4487, police_stations: 888, blast_shields: 39, turrets: 45 }, army: [22944, 12619, 10324, 7342, 5047, 3671], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1056883 },
    { id: 8442, name: "grisham", race: "Li'thi", raceKey: "lithi", alliance: "Orange Dawn", freeLand: 5200000, pop: 300000000, cards: 80000000, experience: 5694, protectionHours: 0, lastSeen: "40 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2000000, nutrition_suppliers: 900000, water_purifiers: 850000, police_stations: 120000, blast_shields: 300, turrets: 30 }, army: [5000, 2750, 2250, 1600, 1100, 800], stack: [6, 5, 4, 2, 3, 1], powerOffset: 5000000 },
    { id: 8447, name: "lothlorien", race: "Re'lu", raceKey: "relu", alliance: "None", freeLand: 40298, pop: 562048, cards: 57675782, experience: 887, protectionHours: 0, lastSeen: "1 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3746, nutrition_suppliers: 2740, water_purifiers: 3534, police_stations: 731, blast_shields: 192, turrets: 45 }, army: [4379, 2408, 1970, 1401, 963, 700], stack: [6, 4, 5, 2, 3, 1], powerOffset: 2098705 },
    { id: 8594, name: "Laser Tank", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 63143, pop: 516976, cards: 61715172, experience: 7228, protectionHours: 0, lastSeen: "43 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3446, nutrition_suppliers: 3424, water_purifiers: 1928, police_stations: 813, blast_shields: 336, turrets: 37 }, army: [16806, 9243, 7562, 5377, 3697, 2688], stack: [5, 6, 4, 2, 3, 1], powerOffset: 1054596 },
    { id: 8743, name: "Unknown 8743", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 1904, pop: 1407089, cards: 46604468, experience: 2020, protectionHours: 0, lastSeen: "3 minutes ago", buildings: { ...emptyBuildings(), living_areas: 9380, nutrition_suppliers: 4027, water_purifiers: 920, police_stations: 231, blast_shields: 396, turrets: 25 }, army: [11244, 6184, 5059, 3598, 2473, 1799], stack: [1, 2, 6, 5, 3, 4], powerOffset: 147963 },
    { id: 9035, name: "xecutioner", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 34283, pop: 1599467, cards: 34614680, experience: 6491, protectionHours: 0, lastSeen: "45 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10663, nutrition_suppliers: 2976, water_purifiers: 842, police_stations: 297, blast_shields: 136, turrets: 42 }, army: [13887, 7637, 6249, 4443, 3055, 2221], stack: [6, 3, 4, 2, 1, 5], powerOffset: 865007 },
    { id: 9104, name: "millenium", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 70513, pop: 243294, cards: 42459993, experience: 6302, protectionHours: 0, lastSeen: "57 minutes ago", buildings: { ...emptyBuildings(), living_areas: 1621, nutrition_suppliers: 1657, water_purifiers: 3455, police_stations: 254, blast_shields: 275, turrets: 19 }, army: [20879, 11483, 9395, 6681, 4593, 3340], stack: [1, 6, 5, 4, 3, 2], powerOffset: 271090 },
    { id: 9411, name: "gavin", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 12751, pop: 1789748, cards: 45789717, experience: 1128, protectionHours: 0, lastSeen: "6 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11931, nutrition_suppliers: 2310, water_purifiers: 2296, police_stations: 1124, blast_shields: 168, turrets: 17 }, army: [7056, 3880, 3175, 2257, 1552, 1128], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1350929 },
    { id: 10166, name: "fred", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 44927, pop: 308875, cards: 56312788, experience: 4258, protectionHours: 0, lastSeen: "34 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2059, nutrition_suppliers: 3297, water_purifiers: 4197, police_stations: 951, blast_shields: 77, turrets: 4 }, army: [3016, 1658, 1357, 965, 663, 482], stack: [6, 4, 5, 2, 3, 1], powerOffset: 1655654 },
    { id: 10465, name: "rainofterror", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 39287, pop: 1674907, cards: 52693968, experience: 3734, protectionHours: 0, lastSeen: "50 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11166, nutrition_suppliers: 3834, water_purifiers: 4217, police_stations: 1190, blast_shields: 215, turrets: 31 }, army: [1024, 563, 460, 327, 225, 163], stack: [5, 6, 4, 2, 3, 1], powerOffset: 101938 },
    { id: 11250, name: "bobsville", race: "Re'lu", raceKey: "relu", alliance: "Brave New World", freeLand: 4700000, pop: 360000000, cards: 90000000, experience: 4139, protectionHours: 0, lastSeen: "38 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2400000, nutrition_suppliers: 1050000, water_purifiers: 950000, police_stations: 150000, blast_shields: 250, turrets: 30 }, army: [4500, 2475, 2025, 1440, 990, 720], stack: [1, 2, 6, 5, 3, 4], powerOffset: 4500000 },
    { id: 11840, name: "the chosen one", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 14624, pop: 367331, cards: 13682003, experience: 3916, protectionHours: 0, lastSeen: "6 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2448, nutrition_suppliers: 3428, water_purifiers: 2511, police_stations: 386, blast_shields: 240, turrets: 39 }, army: [569, 312, 256, 182, 125, 91], stack: [6, 3, 4, 2, 1, 5], powerOffset: 492433 },
    { id: 12472, name: "vegeto", race: "Re'lu", raceKey: "relu", alliance: "None", freeLand: 85921, pop: 1642568, cards: 30297039, experience: 1798, protectionHours: 0, lastSeen: "26 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10950, nutrition_suppliers: 3459, water_purifiers: 4389, police_stations: 224, blast_shields: 216, turrets: 18 }, army: [12535, 6894, 5640, 4011, 2757, 2005], stack: [1, 6, 5, 4, 3, 2], powerOffset: 2219096 },
    { id: 14428, name: "lonhorn", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 66894, pop: 1563634, cards: 52964241, experience: 3417, protectionHours: 0, lastSeen: "45 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10424, nutrition_suppliers: 3317, water_purifiers: 2621, police_stations: 366, blast_shields: 358, turrets: 15 }, army: [16911, 9301, 7609, 5411, 3720, 2705], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1240841 },
    { id: 15534, name: "tightseal", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 13093, pop: 1359999, cards: 41961435, experience: 4842, protectionHours: 0, lastSeen: "45 minutes ago", buildings: { ...emptyBuildings(), living_areas: 9066, nutrition_suppliers: 1973, water_purifiers: 3990, police_stations: 921, blast_shields: 22, turrets: 35 }, army: [15764, 8670, 7093, 5044, 3468, 2522], stack: [6, 4, 5, 2, 3, 1], powerOffset: 1780228 },
    { id: 15539, name: "super saiyans", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 30237, pop: 844412, cards: 48473264, experience: 5224, protectionHours: 0, lastSeen: "24 minutes ago", buildings: { ...emptyBuildings(), living_areas: 5629, nutrition_suppliers: 2331, water_purifiers: 1957, police_stations: 517, blast_shields: 104, turrets: 19 }, army: [4628, 2545, 2082, 1480, 1018, 740], stack: [5, 6, 4, 2, 3, 1], powerOffset: 767836 },
    { id: 15914, name: "lookslikeuranus", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 23683, pop: 929885, cards: 26686997, experience: 4169, protectionHours: 0, lastSeen: "39 minutes ago", buildings: { ...emptyBuildings(), living_areas: 6199, nutrition_suppliers: 1851, water_purifiers: 2363, police_stations: 768, blast_shields: 115, turrets: 29 }, army: [8307, 4568, 3738, 2658, 1827, 1329], stack: [1, 2, 6, 5, 3, 4], powerOffset: 473096 },
    { id: 15953, name: "krusher", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 21692, pop: 670632, cards: 50940700, experience: 2018, protectionHours: 0, lastSeen: "6 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4470, nutrition_suppliers: 3281, water_purifiers: 1745, police_stations: 213, blast_shields: 333, turrets: 16 }, army: [7603, 4181, 3421, 2432, 1672, 1216], stack: [6, 3, 4, 2, 1, 5], powerOffset: 440249 },
    { id: 16287, name: "Tibike77", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 35848, pop: 369701, cards: 17294041, experience: 5637, protectionHours: 0, lastSeen: "38 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2464, nutrition_suppliers: 2273, water_purifiers: 1240, police_stations: 221, blast_shields: 21, turrets: 10 }, army: [7044, 3874, 3169, 2254, 1549, 1127], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1010185 },
    { id: 17291, name: "aces", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 56977, pop: 1167857, cards: 14980749, experience: 2771, protectionHours: 0, lastSeen: "45 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7785, nutrition_suppliers: 427, water_purifiers: 4485, police_stations: 378, blast_shields: 17, turrets: 41 }, army: [8272, 4549, 3722, 2647, 1819, 1323], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1717099 },
    { id: 17449, name: "BooferBill", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 12000, pop: 410000, cards: 6500000, experience: 2343, protectionHours: 0, lastSeen: "31 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2200, nutrition_suppliers: 1350, water_purifiers: 850, police_stations: 420, blast_shields: 120, turrets: 10 }, army: [14000, 7700, 6300, 4480, 3080, 2240], stack: [6, 4, 5, 2, 3, 1], powerOffset: 1200000 },
    { id: 17483, name: "total annihilation", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 20963, pop: 559684, cards: 48920656, experience: 7067, protectionHours: 0, lastSeen: "56 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3731, nutrition_suppliers: 2191, water_purifiers: 4339, police_stations: 382, blast_shields: 240, turrets: 45 }, army: [982, 540, 441, 314, 216, 157], stack: [5, 6, 4, 2, 3, 1], powerOffset: 780624 },
    { id: 17986, name: "upward thrust", race: "Re'lu", raceKey: "relu", alliance: "None", freeLand: 80203, pop: 511293, cards: 14440462, experience: 1663, protectionHours: 0, lastSeen: "41 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3408, nutrition_suppliers: 4492, water_purifiers: 2934, police_stations: 1043, blast_shields: 60, turrets: 45 }, army: [17540, 9647, 7893, 5612, 3858, 2806], stack: [1, 2, 6, 5, 3, 4], powerOffset: 1661779 },
    { id: 18415, name: "musky", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 32056, pop: 1238308, cards: 676819, experience: 3085, protectionHours: 0, lastSeen: "43 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8255, nutrition_suppliers: 3585, water_purifiers: 4005, police_stations: 863, blast_shields: 238, turrets: 19 }, army: [8627, 4744, 3882, 2760, 1897, 1380], stack: [6, 3, 4, 2, 1, 5], powerOffset: 156876 },
    { id: 18879, name: "cowpie", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 11693, pop: 817450, cards: 50046004, experience: 5233, protectionHours: 0, lastSeen: "29 minutes ago", buildings: { ...emptyBuildings(), living_areas: 5449, nutrition_suppliers: 4128, water_purifiers: 4099, police_stations: 148, blast_shields: 249, turrets: 4 }, army: [12168, 6692, 5475, 3893, 2676, 1946], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1512119 },
    { id: 18887, name: "seal", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 20803, pop: 975124, cards: 48099775, experience: 3145, protectionHours: 0, lastSeen: "42 minutes ago", buildings: { ...emptyBuildings(), living_areas: 6500, nutrition_suppliers: 1818, water_purifiers: 1909, police_stations: 381, blast_shields: 144, turrets: 54 }, army: [6534, 3593, 2940, 2090, 1437, 1045], stack: [6, 5, 4, 2, 3, 1], powerOffset: 743416 },
    { id: 20876, name: "popeyes fed.", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 87956, pop: 1006518, cards: 42014512, experience: 4948, protectionHours: 0, lastSeen: "4 minutes ago", buildings: { ...emptyBuildings(), living_areas: 6710, nutrition_suppliers: 1571, water_purifiers: 3778, police_stations: 547, blast_shields: 147, turrets: 34 }, army: [9404, 5172, 4231, 3009, 2068, 1504], stack: [6, 4, 5, 2, 3, 1], powerOffset: 806750 },
    { id: 21654, name: "unikiller", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 76626, pop: 1209662, cards: 57535313, experience: 4361, protectionHours: 0, lastSeen: "48 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8064, nutrition_suppliers: 3280, water_purifiers: 890, police_stations: 488, blast_shields: 117, turrets: 50 }, army: [17205, 9462, 7742, 5505, 3785, 2752], stack: [5, 6, 4, 2, 3, 1], powerOffset: 1792395 },
    { id: 21700, name: "raf", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 23887, pop: 1217486, cards: 11548443, experience: 6625, protectionHours: 0, lastSeen: "59 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8116, nutrition_suppliers: 1590, water_purifiers: 416, police_stations: 1185, blast_shields: 16, turrets: 27 }, army: [15065, 8285, 6779, 4820, 3314, 2410], stack: [1, 2, 6, 5, 3, 4], powerOffset: 988222 },
    { id: 23455, name: "sniper fox", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 7370, pop: 312372, cards: 55404077, experience: 7696, protectionHours: 0, lastSeen: "47 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2082, nutrition_suppliers: 1273, water_purifiers: 3915, police_stations: 896, blast_shields: 199, turrets: 22 }, army: [1654, 909, 744, 529, 363, 264], stack: [6, 3, 4, 2, 1, 5], powerOffset: 1059292 },
    { id: 24408, name: "covin", race: "Trysaur", raceKey: "trysaur", alliance: "Kobra Kai", freeLand: 87835, pop: 190019, cards: 4491314, experience: 824, protectionHours: 0, lastSeen: "13 minutes ago", buildings: { ...emptyBuildings(), living_areas: 1266, nutrition_suppliers: 1421, water_purifiers: 1738, police_stations: 527, blast_shields: 317, turrets: 10 }, army: [7018, 3859, 3158, 2245, 1543, 1122], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1803360 },
    { id: 25201, name: "dead man walking", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 77413, pop: 194815, cards: 53907268, experience: 6897, protectionHours: 0, lastSeen: "52 minutes ago", buildings: { ...emptyBuildings(), living_areas: 1298, nutrition_suppliers: 4237, water_purifiers: 549, police_stations: 460, blast_shields: 209, turrets: 20 }, army: [9123, 5017, 4105, 2919, 2007, 1459], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1501548 },
    { id: 26066, name: "AMD", race: "Re'lu", raceKey: "relu", alliance: "None", freeLand: 74518, pop: 1495611, cards: 19254504, experience: 671, protectionHours: 0, lastSeen: "6 minutes ago", buildings: { ...emptyBuildings(), living_areas: 9970, nutrition_suppliers: 4233, water_purifiers: 4152, police_stations: 519, blast_shields: 308, turrets: 38 }, army: [821, 451, 369, 262, 180, 131], stack: [6, 4, 5, 2, 3, 1], powerOffset: 2082992 },
    { id: 26563, name: "killpone", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 51527, pop: 1220403, cards: 37077125, experience: 2130, protectionHours: 0, lastSeen: "49 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8136, nutrition_suppliers: 4129, water_purifiers: 1004, police_stations: 892, blast_shields: 364, turrets: 26 }, army: [12527, 6889, 5637, 4008, 2755, 2004], stack: [5, 6, 4, 2, 3, 1], powerOffset: 22482 },
    { id: 26800, name: "soccer_09", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 89609, pop: 213454, cards: 10320855, experience: 355, protectionHours: 0, lastSeen: "26 minutes ago", buildings: { ...emptyBuildings(), living_areas: 1423, nutrition_suppliers: 4979, water_purifiers: 76, police_stations: 1001, blast_shields: 90, turrets: 16 }, army: [19677, 10822, 8854, 6296, 4328, 3148], stack: [1, 2, 6, 5, 3, 4], powerOffset: 2352121 },
    { id: 27024, name: "dead mafia!", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 60616, pop: 1071813, cards: 58269803, experience: 107, protectionHours: 0, lastSeen: "2 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7145, nutrition_suppliers: 4808, water_purifiers: 4075, police_stations: 779, blast_shields: 10, turrets: 37 }, army: [15504, 8527, 6976, 4961, 3410, 2480], stack: [6, 3, 4, 2, 1, 5], powerOffset: 915395 },
    { id: 29332, name: "gR8", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 5937, pop: 1623845, cards: 51400342, experience: 7943, protectionHours: 0, lastSeen: "38 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10825, nutrition_suppliers: 3064, water_purifiers: 774, police_stations: 1130, blast_shields: 137, turrets: 27 }, army: [22814, 12547, 10266, 7300, 5019, 3650], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1100163 },
    { id: 31579, name: "Falcon", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 58690, pop: 698961, cards: 63905702, experience: 6821, protectionHours: 0, lastSeen: "26 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4659, nutrition_suppliers: 1436, water_purifiers: 216, police_stations: 612, blast_shields: 67, turrets: 36 }, army: [24419, 13430, 10988, 7814, 5372, 3907], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1494865 },
    { id: 35060, name: "MOC", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 59645, pop: 696832, cards: 45782380, experience: 4879, protectionHours: 0, lastSeen: "40 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4645, nutrition_suppliers: 312, water_purifiers: 219, police_stations: 874, blast_shields: 110, turrets: 41 }, army: [640, 352, 288, 204, 140, 102], stack: [6, 4, 5, 2, 3, 1], powerOffset: 1267888 },
    { id: 36651, name: "devastator", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 88472, pop: 1401158, cards: 7827621, experience: 5039, protectionHours: 0, lastSeen: "11 minutes ago", buildings: { ...emptyBuildings(), living_areas: 9341, nutrition_suppliers: 366, water_purifiers: 4238, police_stations: 581, blast_shields: 16, turrets: 39 }, army: [21040, 11572, 9468, 6732, 4628, 3366], stack: [5, 6, 4, 2, 3, 1], powerOffset: 1739926 },
    { id: 38675, name: "kyouteki", race: "Trysaur", raceKey: "trysaur", alliance: "Kobra Kai", freeLand: 83874, pop: 912376, cards: 28790737, experience: 7849, protectionHours: 0, lastSeen: "33 minutes ago", buildings: { ...emptyBuildings(), living_areas: 6082, nutrition_suppliers: 3545, water_purifiers: 2664, police_stations: 782, blast_shields: 386, turrets: 23 }, army: [12361, 6798, 5562, 3955, 2719, 1977], stack: [1, 2, 6, 5, 3, 4], powerOffset: 1089834 },
    { id: 39979, name: "poliwog", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 44077, pop: 728474, cards: 11953175, experience: 426, protectionHours: 0, lastSeen: "20 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4856, nutrition_suppliers: 1883, water_purifiers: 343, police_stations: 69, blast_shields: 361, turrets: 11 }, army: [18404, 10122, 8281, 5889, 4048, 2944], stack: [6, 3, 4, 2, 1, 5], powerOffset: 600150 },
    { id: 48071, name: "DragonLilly", race: "Re'lu", raceKey: "relu", alliance: "Orange Dawn", freeLand: 36000, pop: 1200000, cards: 32000000, experience: 380, protectionHours: 0, lastSeen: "35 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8000, nutrition_suppliers: 5000, water_purifiers: 3100, police_stations: 1200, blast_shields: 300, turrets: 40 }, army: [30000, 16500, 13500, 9600, 6600, 4800], stack: [1, 6, 5, 4, 3, 2], powerOffset: 3800000 },
    { id: 52074, name: "nightcrawler", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 32675, pop: 536534, cards: 50842103, experience: 7079, protectionHours: 0, lastSeen: "16 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3576, nutrition_suppliers: 3790, water_purifiers: 3859, police_stations: 226, blast_shields: 179, turrets: 13 }, army: [11177, 6147, 5029, 3576, 2458, 1788], stack: [6, 5, 4, 2, 3, 1], powerOffset: 2060531 },
    { id: 53347, name: "compu", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 84266, pop: 56318, cards: 12958540, experience: 7526, protectionHours: 0, lastSeen: "14 minutes ago", buildings: { ...emptyBuildings(), living_areas: 375, nutrition_suppliers: 832, water_purifiers: 3383, police_stations: 780, blast_shields: 94, turrets: 31 }, army: [17046, 9375, 7670, 5454, 3750, 2727], stack: [6, 4, 5, 2, 3, 1], powerOffset: 496389 },
    { id: 54004, name: "ThaJuggla19", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 54286, pop: 457699, cards: 40377567, experience: 1674, protectionHours: 0, lastSeen: "3 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3051, nutrition_suppliers: 3806, water_purifiers: 1486, police_stations: 1070, blast_shields: 258, turrets: 41 }, army: [11621, 6391, 5229, 3718, 2556, 1859], stack: [5, 6, 4, 2, 3, 1], powerOffset: 854279 },
    { id: 55126, name: "hustla", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 87785, pop: 1063074, cards: 56802782, experience: 800, protectionHours: 0, lastSeen: "41 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7087, nutrition_suppliers: 552, water_purifiers: 1430, police_stations: 1139, blast_shields: 186, turrets: 56 }, army: [23027, 12664, 10362, 7368, 5065, 3684], stack: [1, 2, 6, 5, 3, 4], powerOffset: 134340 },
    { id: 55621, name: "alienation", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 6596, pop: 1543057, cards: 11911998, experience: 2621, protectionHours: 0, lastSeen: "29 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10287, nutrition_suppliers: 297, water_purifiers: 308, police_stations: 1169, blast_shields: 177, turrets: 39 }, army: [22597, 12428, 10168, 7231, 4971, 3615], stack: [6, 3, 4, 2, 1, 5], powerOffset: 2026339 },
    { id: 59001, name: "Pacman", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 77067, pop: 605991, cards: 25278917, experience: 634, protectionHours: 0, lastSeen: "38 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4039, nutrition_suppliers: 4971, water_purifiers: 2442, police_stations: 25, blast_shields: 72, turrets: 43 }, army: [22587, 12422, 10164, 7227, 4969, 3613], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1360444 },
    { id: 59110, name: "mine", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 48203, pop: 1369293, cards: 45880018, experience: 6405, protectionHours: 0, lastSeen: "44 minutes ago", buildings: { ...emptyBuildings(), living_areas: 9128, nutrition_suppliers: 1245, water_purifiers: 2201, police_stations: 858, blast_shields: 17, turrets: 59 }, army: [19060, 10483, 8577, 6099, 4193, 3049], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1644242 },
    { id: 60202, name: "paradice", race: "Trysaur", raceKey: "trysaur", alliance: "Kobra Kai", freeLand: 44567, pop: 1211933, cards: 51934527, experience: 554, protectionHours: 0, lastSeen: "44 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8079, nutrition_suppliers: 951, water_purifiers: 3028, police_stations: 969, blast_shields: 289, turrets: 11 }, army: [7993, 4396, 3596, 2557, 1758, 1278], stack: [6, 4, 5, 2, 3, 1], powerOffset: 1951976 },
    { id: 60584, name: "raze", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 41113, pop: 1719190, cards: 5981831, experience: 3314, protectionHours: 0, lastSeen: "42 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11461, nutrition_suppliers: 4886, water_purifiers: 4402, police_stations: 486, blast_shields: 108, turrets: 32 }, army: [24083, 13245, 10837, 7706, 5298, 3853], stack: [5, 6, 4, 2, 3, 1], powerOffset: 1123394 },
    { id: 60719, name: "falcon13", race: "Re'lu", raceKey: "relu", alliance: "None", freeLand: 56242, pop: 1165821, cards: 46855527, experience: 4470, protectionHours: 0, lastSeen: "38 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7772, nutrition_suppliers: 1459, water_purifiers: 1167, police_stations: 895, blast_shields: 27, turrets: 49 }, army: [9956, 5475, 4480, 3185, 2190, 1592], stack: [1, 2, 6, 5, 3, 4], powerOffset: 2023701 },
    { id: 61284, name: "JYD", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 72734, pop: 704241, cards: 16235782, experience: 5458, protectionHours: 0, lastSeen: "42 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4694, nutrition_suppliers: 2831, water_purifiers: 4385, police_stations: 143, blast_shields: 72, turrets: 20 }, army: [23171, 12744, 10426, 7414, 5097, 3707], stack: [6, 3, 4, 2, 1, 5], powerOffset: 2313962 },
    { id: 61788, name: "blacknight", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 38091, pop: 1293599, cards: 41263297, experience: 1528, protectionHours: 0, lastSeen: "19 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8623, nutrition_suppliers: 908, water_purifiers: 3103, police_stations: 90, blast_shields: 398, turrets: 57 }, army: [10642, 5853, 4788, 3405, 2341, 1702], stack: [1, 6, 5, 4, 3, 2], powerOffset: 39524 },
    { id: 62428, name: "Rainbow Warrior", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 60455, pop: 1102527, cards: 6486381, experience: 1260, protectionHours: 0, lastSeen: "15 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7350, nutrition_suppliers: 3664, water_purifiers: 969, police_stations: 1161, blast_shields: 283, turrets: 3 }, army: [17930, 9861, 8068, 5737, 3944, 2868], stack: [6, 5, 4, 2, 3, 1], powerOffset: 71606 },
    { id: 62782, name: "del", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 6527, pop: 176222, cards: 26961519, experience: 3197, protectionHours: 0, lastSeen: "36 minutes ago", buildings: { ...emptyBuildings(), living_areas: 1174, nutrition_suppliers: 2759, water_purifiers: 611, police_stations: 501, blast_shields: 307, turrets: 59 }, army: [10387, 5712, 4674, 3323, 2285, 1661], stack: [6, 4, 5, 2, 3, 1], powerOffset: 2017176 },
    { id: 63810, name: "JYD's bro (James)", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 50749, pop: 116181, cards: 40124854, experience: 195, protectionHours: 0, lastSeen: "4 minutes ago", buildings: { ...emptyBuildings(), living_areas: 774, nutrition_suppliers: 408, water_purifiers: 2176, police_stations: 1084, blast_shields: 371, turrets: 55 }, army: [9505, 5227, 4277, 3041, 2091, 1520], stack: [5, 6, 4, 2, 3, 1], powerOffset: 746872 },
    { id: 64094, name: "someone", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 16658, pop: 961565, cards: 42829897, experience: 7633, protectionHours: 0, lastSeen: "24 minutes ago", buildings: { ...emptyBuildings(), living_areas: 6410, nutrition_suppliers: 2604, water_purifiers: 2021, police_stations: 1066, blast_shields: 360, turrets: 38 }, army: [14660, 8063, 6597, 4691, 3225, 2345], stack: [1, 2, 6, 5, 3, 4], powerOffset: 1377902 },
    { id: 64360, name: "Kayron", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 55601, pop: 1703995, cards: 59193014, experience: 685, protectionHours: 0, lastSeen: "7 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11359, nutrition_suppliers: 2869, water_purifiers: 2768, police_stations: 664, blast_shields: 319, turrets: 58 }, army: [19447, 10695, 8751, 6223, 4278, 3111], stack: [6, 3, 4, 2, 1, 5], powerOffset: 189987 },
    { id: 65055, name: "turok", race: "Trysaur", raceKey: "trysaur", alliance: "Kobra Kai", freeLand: 52188, pop: 1424705, cards: 20931789, experience: 5970, protectionHours: 0, lastSeen: "10 minutes ago", buildings: { ...emptyBuildings(), living_areas: 9498, nutrition_suppliers: 2161, water_purifiers: 233, police_stations: 645, blast_shields: 94, turrets: 23 }, army: [7542, 4148, 3393, 2413, 1659, 1206], stack: [1, 6, 5, 4, 3, 2], powerOffset: 880493 },
    { id: 65878, name: "randy (65878)", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 38262, pop: 1054874, cards: 41233909, experience: 835, protectionHours: 0, lastSeen: "53 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7032, nutrition_suppliers: 3026, water_purifiers: 3059, police_stations: 668, blast_shields: 218, turrets: 60 }, army: [6469, 3557, 2911, 2070, 1423, 1035], stack: [6, 5, 4, 2, 3, 1], powerOffset: 1618936 },
    { id: 67889, name: "Ahh! Kobras", race: "Re'lu", raceKey: "relu", alliance: "None", freeLand: 36425, pop: 1534106, cards: 42900517, experience: 930, protectionHours: 0, lastSeen: "57 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10227, nutrition_suppliers: 1279, water_purifiers: 507, police_stations: 746, blast_shields: 193, turrets: 37 }, army: [8844, 4864, 3979, 2830, 1945, 1415], stack: [6, 4, 5, 2, 3, 1], powerOffset: 2407628 },
    { id: 70122, name: "dew69", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 66215, pop: 1103419, cards: 2934086, experience: 4029, protectionHours: 0, lastSeen: "13 minutes ago", buildings: { ...emptyBuildings(), living_areas: 7356, nutrition_suppliers: 3083, water_purifiers: 2611, police_stations: 657, blast_shields: 91, turrets: 51 }, army: [4843, 2663, 2179, 1549, 1065, 774], stack: [5, 6, 4, 2, 3, 1], powerOffset: 524500 },
    { id: 71862, name: "serendetia", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 39538, pop: 1316883, cards: 14874260, experience: 7977, protectionHours: 0, lastSeen: "5 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8779, nutrition_suppliers: 1533, water_purifiers: 4228, police_stations: 1154, blast_shields: 301, turrets: 48 }, army: [16105, 8857, 7247, 5153, 3543, 2576], stack: [1, 2, 6, 5, 3, 4], powerOffset: 1958635 },
    { id: 72950, name: "JYD's son", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 71423, pop: 1767672, cards: 23430335, experience: 1327, protectionHours: 0, lastSeen: "3 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11784, nutrition_suppliers: 284, water_purifiers: 1967, police_stations: 646, blast_shields: 379, turrets: 17 }, army: [14962, 8229, 6732, 4787, 3291, 2393], stack: [6, 3, 4, 2, 1, 5], powerOffset: 1940227 },
    { id: 74293, name: "mountin2", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 62575, pop: 1243206, cards: 15103802, experience: 5536, protectionHours: 0, lastSeen: "45 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8288, nutrition_suppliers: 4041, water_purifiers: 3913, police_stations: 1195, blast_shields: 299, turrets: 60 }, army: [3642, 2003, 1638, 1165, 801, 582], stack: [1, 6, 5, 4, 3, 2], powerOffset: 1169409 },
    { id: 74489, name: "Pink Panther", race: "Re'lu", raceKey: "relu", alliance: "Night Patrol", freeLand: 41816, pop: 1311604, cards: 41992330, experience: 7751, protectionHours: 0, lastSeen: "9 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8744, nutrition_suppliers: 884, water_purifiers: 663, police_stations: 772, blast_shields: 53, turrets: 23 }, army: [11679, 6423, 5255, 3737, 2569, 1868], stack: [6, 5, 4, 2, 3, 1], powerOffset: 25527 },
    { id: 77017, name: "thugsrus", race: "Human", raceKey: "human", alliance: "Laser Union", freeLand: 49820, pop: 867530, cards: 44569498, experience: 4960, protectionHours: 0, lastSeen: "34 minutes ago", buildings: { ...emptyBuildings(), living_areas: 5783, nutrition_suppliers: 2825, water_purifiers: 779, police_stations: 231, blast_shields: 391, turrets: 28 }, army: [10264, 5645, 4618, 3284, 2258, 1642], stack: [6, 4, 5, 2, 3, 1], powerOffset: 1386537 },
    { id: 80404, name: "131", race: "Zarth", raceKey: "zarth", alliance: "Fed Council", freeLand: 65349, pop: 336987, cards: 53503413, experience: 1892, protectionHours: 0, lastSeen: "51 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2246, nutrition_suppliers: 63, water_purifiers: 917, police_stations: 226, blast_shields: 85, turrets: 14 }, army: [11573, 6365, 5207, 3703, 2546, 1851], stack: [5, 6, 4, 2, 3, 1], powerOffset: 589976 },
    { id: 82314, name: "Dave", race: "Trysaur", raceKey: "trysaur", alliance: "Kobra Kai", freeLand: 86399, pop: 485747, cards: 36485503, experience: 4240, protectionHours: 0, lastSeen: "13 minutes ago", buildings: { ...emptyBuildings(), living_areas: 3238, nutrition_suppliers: 1119, water_purifiers: 2433, police_stations: 96, blast_shields: 206, turrets: 18 }, army: [20638, 11350, 9287, 6604, 4540, 3302], stack: [1, 2, 6, 5, 3, 4], powerOffset: 2482827 },
    { id: 83925, name: "Fester", race: "Li'thi", raceKey: "lithi", alliance: "Lothlorien", freeLand: 70027, pop: 1555667, cards: 10288512, experience: 4347, protectionHours: 0, lastSeen: "28 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10371, nutrition_suppliers: 4914, water_purifiers: 1863, police_stations: 1048, blast_shields: 265, turrets: 30 }, army: [3755, 2065, 1689, 1201, 826, 600], stack: [6, 3, 4, 2, 1, 5], powerOffset: 1962636 },
    { id: 88691, name: "thugs wife", race: "Re'lu", raceKey: "relu", alliance: "None", freeLand: 78465, pop: 1339864, cards: 23324121, experience: 7438, protectionHours: 0, lastSeen: "11 minutes ago", buildings: { ...emptyBuildings(), living_areas: 8932, nutrition_suppliers: 1831, water_purifiers: 1750, police_stations: 1184, blast_shields: 225, turrets: 1 }, army: [13800, 7590, 6210, 4416, 3036, 2208], stack: [1, 6, 5, 4, 3, 2], powerOffset: 671468 },
    { id: 89800, name: "JYD's bro (2nd acct)", race: "Human", raceKey: "human", alliance: "Human Shield", freeLand: 25648, pop: 654078, cards: 55111357, experience: 3555, protectionHours: 0, lastSeen: "44 minutes ago", buildings: { ...emptyBuildings(), living_areas: 4360, nutrition_suppliers: 4361, water_purifiers: 1903, police_stations: 605, blast_shields: 221, turrets: 35 }, army: [1871, 1029, 841, 598, 411, 299], stack: [6, 5, 4, 2, 3, 1], powerOffset: 534185 },
    { id: 90181, name: "James' wife", race: "Zarth", raceKey: "zarth", alliance: "Old Guard", freeLand: 78833, pop: 1562596, cards: 52396484, experience: 3176, protectionHours: 0, lastSeen: "29 minutes ago", buildings: { ...emptyBuildings(), living_areas: 10417, nutrition_suppliers: 4169, water_purifiers: 171, police_stations: 555, blast_shields: 276, turrets: 1 }, army: [9403, 5171, 4231, 3008, 2068, 1504], stack: [6, 4, 5, 2, 3, 1], powerOffset: 228495 },
    { id: 91956, name: "synthetic (internetdrunk)", race: "Trysaur", raceKey: "trysaur", alliance: "Orange Dawn", freeLand: 37056, pop: 362365, cards: 55757175, experience: 7890, protectionHours: 0, lastSeen: "6 minutes ago", buildings: { ...emptyBuildings(), living_areas: 2415, nutrition_suppliers: 4993, water_purifiers: 1321, police_stations: 376, blast_shields: 36, turrets: 52 }, army: [13605, 7482, 6122, 4353, 2993, 2176], stack: [5, 6, 4, 2, 3, 1], powerOffset: 557574 },
    { id: 92479, name: "holy ghost (sniper fox's gf)", race: "Li'thi", raceKey: "lithi", alliance: "Brave New World", freeLand: 74341, pop: 1741009, cards: 5052324, experience: 5376, protectionHours: 0, lastSeen: "51 minutes ago", buildings: { ...emptyBuildings(), living_areas: 11606, nutrition_suppliers: 4765, water_purifiers: 2383, police_stations: 942, blast_shields: 105, turrets: 4 }, army: [6498, 3573, 2924, 2079, 1429, 1039], stack: [1, 2, 6, 5, 3, 4], powerOffset: 1963045 }
  ]);

  useEffect(() => { const timer = window.setInterval(() => setDisplayNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (!outgoingMissiles.some((o) => o.arrivesAt && displayNow >= o.arrivesAt) && !incomingMissiles.some((o) => o.arrivesAt && displayNow >= o.arrivesAt)) return;
    setPlayer((current) => processArrivedMissiles(displayNow, current).player);
  }, [displayNow, hydrated, outgoingMissiles, incomingMissiles]);
  useEffect(() => {
    if (!hydrated || !activeLrcSequence || activeLrcSequence.status === "complete") return;
    if (displayNow >= Number(activeLrcSequence.nextShotAt || 0)) processDueLrcShots(displayNow);
  }, [displayNow, hydrated, activeLrcSequence]);
  useEffect(() => () => {
    warInlineNoticeTimeoutsRef.current.forEach((id) => clearTimeout(id));
    warInlineNoticeTimeoutsRef.current = [];
  }, []);


  function enableAdminAccess() {
    const supplied = adminPasswordDraft.trim().toLowerCase();
    if (supplied !== ADMIN_ACCESS_PASSWORD) {
      setAdminAccessError("Admin access was not enabled. Check the password and try again.");
      return;
    }
    setAdminMode(true);
    setShowAdminAccessModal(false);
    setAdminPasswordDraft("");
    setAdminAccessError("");
    addLog("Admin access enabled.", "Admin");
  }
  function disableAdminAccess() {
    setAdminMode(false);
    if (displayModel === "retro") setDisplayModel(DISPLAY_MODEL_DEFAULT);
    addLog("Admin access disabled.", "Admin");
    if (page === "admin") setPage("status");
  }
  function requestAdminAccess() {
    setAdminPasswordDraft("");
    setAdminAccessError("");
    setShowAdminAccessModal(true);
  }

  function unlockRetroWording() {
    if (retroWordingPasswordDraft.trim() !== RETRO_WORDING_PASSWORD) {
      setRetroWordingError("Retro wording remains locked.");
      return;
    }
    setDisplayModel("retro");
    setRetroWordingPasswordDraft("");
    setRetroWordingError("");
    addLog("Retro wording unlocked for this local build.", "Display");
  }
  function lockHybridWording() {
    setDisplayModel(DISPLAY_MODEL_DEFAULT);
    setRetroWordingPasswordDraft("");
    setRetroWordingError("");
    addLog("Hybrid wording restored.", "Display");
  }
  function resetGlwLauncher(mode = "start", slotKey = GLW_LAUNCHER_SLOT_KEY, roundKey = "glw") {
    const requestedRoundKey = accountRounds.some((round) => round.key === roundKey) ? roundKey : "glw";
    const requestedRound = accountRounds.find((round) => round.key === requestedRoundKey) || accountRounds[0];
    const profileName = requestedRound?.profileName || (requestedRoundKey === "intro" ? "Intro Game" : "Godlike Warfare");
    const isLateRound = requestedRoundKey === "glw" && mode === "late";
    setGlwSeedMode(isLateRound ? "late" : "start");
    setGlwRaceRegistered(false);
    setPlayerNameSetupComplete(false);
    setEntryStage("glw");
    setSelectedRoundKey(requestedRoundKey);
    setSelectedSpeciesKey("lithi");
    setPlayerNameDraft("SONAR");
    setActiveRoundSlotKey(slotKey || null);
    setAlliance(null);
    setAllianceShareEnabledMembers([]);
    setActiveWars([]);
    setAlliedStatuses([]);
    setDiplomacyRequests([]);
    setActiveLrcSequence(null);
    try { if (typeof window !== "undefined") { if (slotKey) window.localStorage.setItem(ROUND_SLOT_CURRENT_KEY, slotKey); else window.localStorage.removeItem(ROUND_SLOT_CURRENT_KEY); } } catch {}
    setRoundProfile(profileName);
    setRoundSettings(roundProfiles[profileName] || roundProfiles["Godlike Warfare"]);
    setGameName(requestedRoundKey === "intro" ? "Intro Game Test Round" : (isLateRound ? "Late War Test Round" : "GLW Test Round"));
    setPage("status");
    addLog(`${requestedRoundKey === "intro" ? "Intro Game" : isLateRound ? "Late-war Godlike Warfare" : "Godlike Warfare"} reset selected. Choose species to enter.`, "War");
  }
  function currentLauncherSlotExists() {
    if (!activeRoundSlotKey) return false;
    if (safeLoadRoundSlot(activeRoundSlotKey)) return true;
    if (activeRoundSlotKey === "glw-local" && safeLoadSave()) return true;
    return liveRoundSlotIndex(roundSlotIndex).some((slot) => slot?.slotKey === activeRoundSlotKey);
  }
  function startIntroGameSlot(mode = "start") {
    if (currentLauncherSlotExists()) saveActiveRoundSlot();
    resetGlwLauncher(mode, makeRoundSlotKey("intro"), "intro");
  }
  function launcherRoundShortLabelForKey(roundKey = "") {
    if (roundKey === "intro") return "IG";
    if (roundKey === "glw") return "GLW";
    if (roundKey === "admin-start") return "ADM";
    return "Slot";
  }
  function launcherRoundNameForKey(roundKey = "") {
    return defaultRoundSlotLabel(roundKey) || (roundKey === "admin-start" ? "Admin Round" : "Prototype Round");
  }
  function launcherRoundTitleForKey(roundKey = "") {
    return `${launcherRoundShortLabelForKey(roundKey)} — ${launcherRoundNameForKey(roundKey)}`;
  }
  function launcherRoundSettingsSummary(roundKey = "", settings = null) {
    const profileName = roundProfileForKey(roundKey);
    const resolved = settings || roundProfiles[profileName] || roundSettings || {};
    return {
      profileName,
      gameSpeed: Number(resolved.gameSpeed || 0) || null,
      exploreEnabled: resolved.exploreEnabled !== false,
      revives: resolved.revives || null,
    };
  }
  function chooseDisplayModel(model) {
    const normalised = normaliseDisplayModel(model);
    if (normalised === "retro") return;
    setDisplayModel(DISPLAY_MODEL_DEFAULT);
    addLog(`Display model set to ${DISPLAY_MODEL_OPTIONS[DISPLAY_MODEL_DEFAULT].label}.`, "Display");
  }
  function confirmRetroMode() {
    setRetroConfirmedThisSession(true);
    setShowRetroConfirmModal(false);
    setDisplayModel("retro");
    addLog("Retro Mode selected for this session.", "Display");
  }
  function renderAdminAccessModal() {
    if (!showAdminAccessModal) return null;
    return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-[min(92vw,520px)] border border-orange-700 bg-black p-4 shadow-2xl">
        <div className="text-xl font-bold text-orange-200 mb-2">Admin Access</div>
        <p className="text-sm text-orange-200 leading-relaxed mb-3">Admin access enables reference tools and restricted display modes, including Retro Mode where available.</p>
        <p className="text-sm text-orange-500 leading-relaxed mb-4">This area is intended for project administration, testing, and old-player reference use.</p>
        <label className="block text-orange-300 mb-1">Admin password</label>
        <input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-2 mb-2" type="password" value={adminPasswordDraft} onChange={(e) => { setAdminPasswordDraft(e.target.value); setAdminAccessError(""); }} onKeyDown={(e) => { if (e.key === "Enter") enableAdminAccess(); }} autoFocus />
        {adminAccessError ? <div className="text-sm text-red-300 mb-3">{adminAccessError}</div> : null}
        <div className="flex gap-2 flex-wrap mt-3"><button className="classic-btn antro-action-btn" onClick={enableAdminAccess}>Enable Admin Access</button><button className="classic-btn antro-action-btn" onClick={() => { setShowAdminAccessModal(false); setAdminPasswordDraft(""); setAdminAccessError(""); }}>Cancel</button></div>
      </div>
    </div>;
  }
  function renderRetroModeConfirmModal() {
    if (!showRetroConfirmModal) return null;
    return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-[min(92vw,520px)] border border-orange-700 bg-black p-4 shadow-2xl">
        <div className="text-xl font-bold text-orange-200 mb-2">Retro Mode</div>
        <p className="text-sm text-orange-200 leading-relaxed mb-3">Retro Mode is provided for reference, testing, and trusted old-player familiarity.</p>
        <p className="text-sm text-orange-500 leading-relaxed mb-4">It is not the main AntrophAI presentation and is not intended for public-facing release.</p>
        <div className="flex gap-2 flex-wrap mt-3"><button className="classic-btn antro-action-btn" onClick={confirmRetroMode}>Enter Retro Mode</button><button className="classic-btn antro-action-btn" onClick={() => setShowRetroConfirmModal(false)}>Stay in AntrophAI Mode</button></div>
      </div>
    </div>;
  }

  function currentSavePayload() { return { saveStateVersion: PROTOTYPE_VERSION, savedAt: Date.now(), activeRoundSlotKey, playerNameSetupComplete, entryStage, selectedRoundKey, selectedSpeciesKey, glwSeedMode, glwRaceRegistered, page, adminMode, displayModel, reportTextMode, log, worldReports, buildForm, trainForm, mineAllocation, factoryAllocation, buildSpeedFactor, useBarracksSpeedMinerals, pageCompletionNotice, scienceOrder, scienceLevels, roundProfile, roundSettings, gameName, roundStartedAt, selectedTargetName, disableTargetTurrets, spyTarget, spies, mercenaries, alliance, shareAllianceProfile, allianceShareEnabledMembers, allianceAnnouncementDraft, allianceSubPage, donateAllianceLandAmount, allianceBankBuildQty, allianceBankSpeedFactor, allianceBankDepositAmount, lrcCardsAmount, lrcEnergyAmount, lrcMineralName, lrcMineralAmount, lrcTargetType, lrcTargetName, activeLrcSequence, exploreHours, exploreCards, newsFilter, newsPage, battleLogPage, battleLogOpponent, botDifficulty, onlineSort, nexusMineralName, nexusMineralAmount, demoMemberName, diplomacyTargetType, diplomacyTargetName, activeWars, alliedStatuses, diplomacyRequests, retalRecords, grievances, battleReport, lastUpdateSummary, outgoingMissiles, incomingMissiles, messages, marketOrders, processedBattleKeys, player, demoOpponents }; }

  function applySavedState(saved = {}) { if (saved.playerNameSetupComplete !== undefined) setPlayerNameSetupComplete(Boolean(saved.playerNameSetupComplete)); if (saved.entryStage) setEntryStage(saved.entryStage); if (saved.selectedRoundKey) setSelectedRoundKey(saved.selectedRoundKey); if (saved.selectedSpeciesKey) setSelectedSpeciesKey(saved.selectedSpeciesKey); if (saved.glwSeedMode) setGlwSeedMode(saved.glwSeedMode === "start" ? "start" : "late"); if (saved.glwRaceRegistered !== undefined) setGlwRaceRegistered(Boolean(saved.glwRaceRegistered)); else if (saved.playerNameSetupComplete) setGlwRaceRegistered(true); else if (saved.player?.name && cleanStoredName(saved.player.name, "SONAR") !== "SONAR") setPlayerNameSetupComplete(true); if (saved.page) setPage(saved.page); if (saved.adminMode !== undefined) setAdminMode(Boolean(saved.adminMode)); if (saved.displayModel !== undefined) setDisplayModel(normaliseDisplayModel(saved.displayModel)); if (saved.reportTextMode !== undefined) setReportTextMode(normaliseReportTextMode(saved.reportTextMode)); if (saved.log) setLog(saved.log); if (saved.worldReports) setWorldReports(saved.worldReports); if (saved.buildForm) setBuildForm({ ...emptyBuildForm(), ...saved.buildForm }); if (saved.trainForm) setTrainForm(saved.trainForm); if (saved.mineAllocation) setMineAllocation(saved.mineAllocation); if (saved.factoryAllocation) setFactoryAllocation(saved.factoryAllocation); if (saved.buildSpeedFactor !== undefined) setBuildSpeedFactor(saved.buildSpeedFactor); if (saved.useBarracksSpeedMinerals !== undefined) setUseBarracksSpeedMinerals(Boolean(saved.useBarracksSpeedMinerals)); if (saved.pageCompletionNotice !== undefined) setPageCompletionNotice(saved.pageCompletionNotice); if (saved.scienceOrder !== undefined) setScienceOrder(saved.scienceOrder); if (saved.scienceLevels) setScienceLevels(saved.scienceLevels); if (saved.roundProfile) setRoundProfile(saved.roundProfile); if (saved.roundSettings) setRoundSettings(saved.roundSettings); if (saved.gameName) setGameName(saved.gameName); if (saved.roundStartedAt) setRoundStartedAt(Number(saved.roundStartedAt) || Date.now()); if (saved.selectedTargetName) setSelectedTargetName(saved.selectedTargetName); if (saved.disableTargetTurrets !== undefined) setDisableTargetTurrets(Boolean(saved.disableTargetTurrets)); if (saved.spyTarget) setSpyTarget(saved.spyTarget); if (saved.spies !== undefined) setSpies(saved.spies); if (saved.mercenaries !== undefined) setMercenaries(saved.mercenaries); if (saved.alliance !== undefined) setAlliance(normaliseAlliance(saved.alliance)); if (saved.shareAllianceProfile !== undefined) setShareAllianceProfile(Boolean(saved.shareAllianceProfile)); if (saved.allianceShareEnabledMembers) setAllianceShareEnabledMembers(saved.allianceShareEnabledMembers); if (saved.allianceAnnouncementDraft !== undefined) setAllianceAnnouncementDraft(saved.allianceAnnouncementDraft); if (saved.allianceSubPage) setAllianceSubPage(saved.allianceSubPage); if (saved.donateAllianceLandAmount !== undefined) setDonateAllianceLandAmount(saved.donateAllianceLandAmount); if (saved.allianceBankBuildQty !== undefined) setAllianceBankBuildQty(saved.allianceBankBuildQty); if (saved.allianceBankSpeedFactor !== undefined) setAllianceBankSpeedFactor(saved.allianceBankSpeedFactor); if (saved.allianceBankDepositAmount !== undefined) setAllianceBankDepositAmount(saved.allianceBankDepositAmount); if (saved.lrcCardsAmount !== undefined) setLrcCardsAmount(saved.lrcCardsAmount); if (saved.lrcEnergyAmount !== undefined) setLrcEnergyAmount(saved.lrcEnergyAmount); if (saved.lrcMineralName) setLrcMineralName(saved.lrcMineralName); if (saved.lrcMineralAmount !== undefined) setLrcMineralAmount(saved.lrcMineralAmount); if (saved.lrcTargetType) setLrcTargetType(saved.lrcTargetType); if (saved.lrcTargetName !== undefined) setLrcTargetName(saved.lrcTargetName); if (saved.activeLrcSequence !== undefined) setActiveLrcSequence(saved.activeLrcSequence); if (saved.exploreHours !== undefined) setExploreHours(saved.exploreHours); if (saved.exploreCards !== undefined) setExploreCards(saved.exploreCards); if (saved.newsFilter) setNewsFilter(saved.newsFilter); if (saved.newsPage) setNewsPage(saved.newsPage); if (saved.battleLogPage) setBattleLogPage(saved.battleLogPage); if (saved.battleLogOpponent) setBattleLogOpponent(saved.battleLogOpponent); if (saved.botDifficulty) setBotDifficulty(saved.botDifficulty); if (saved.onlineSort) setOnlineSort(saved.onlineSort); if (saved.nexusMineralName) setNexusMineralName(saved.nexusMineralName); if (saved.nexusMineralAmount !== undefined) setNexusMineralAmount(saved.nexusMineralAmount); if (saved.demoMemberName) setDemoMemberName(saved.demoMemberName); if (saved.diplomacyTargetType) setDiplomacyTargetType(saved.diplomacyTargetType); if (saved.diplomacyTargetName) setDiplomacyTargetName(saved.diplomacyTargetName); if (saved.activeWars) setActiveWars(saved.activeWars); if (saved.alliedStatuses) setAlliedStatuses(saved.alliedStatuses); if (saved.diplomacyRequests) setDiplomacyRequests(saved.diplomacyRequests); if (saved.retalRecords) setRetalRecords(mergeRetalRecords(saved.retalRecords, [])); if (saved.grievances) setGrievances(saved.grievances); if (saved.battleReport) setBattleReport(saved.battleReport); if (saved.lastUpdateSummary) setLastUpdateSummary(saved.lastUpdateSummary); if (saved.outgoingMissiles) setOutgoingMissiles(saved.outgoingMissiles); if (saved.incomingMissiles) setIncomingMissiles(saved.incomingMissiles); if (saved.messages) setMessages(saved.messages); if (saved.marketOrders) setMarketOrders(saved.marketOrders); if (saved.processedBattleKeys) { const keys = (saved.processedBattleKeys || []).map(normaliseBattleDedupeEntry).filter(Boolean).slice(0, 120); processedBattleKeysRef.current = keys; setProcessedBattleKeys(keys); } if (saved.player) setPlayer({ ...saved.player, ...normalisePlayerRecords(saved.player), buildings: { ...emptyBuildings(), ...(saved.player.buildings || {}) }, minerals: { ...emptyMinerals(), ...(saved.player.minerals || {}) }, lastUpdatedAt: saved.player.lastUpdatedAt || Date.now(), race: races[saved.player.race] ? saved.player.race : "lithi", name: cleanStoredName(saved.player.name, "SONAR") }); if (saved.demoOpponents) setDemoOpponents(saved.demoOpponents.map((op) => normaliseOpponentPresence({ ...op, ...normaliseSpeciesProgress(op), raceKey: op.name === "Boof" ? "zarth" : op.name === "DragonLilly" ? "relu" : op.name === "Achilles" ? "trysaur" : op.raceKey, buildings: { ...emptyBuildings(), ...(op.buildings || {}) } }))); }

  function resetToFreshRound(roundKey = "glw") {
    const now = Date.now();
    const requestedRound = accountRounds.find((round) => round.key === roundKey) || accountRounds[0];
    const isAdminRound = requestedRound?.key === "admin-start";
    const profileName = isAdminRound ? (roundProfile || "Godlike Warfare") : (requestedRound?.profileName || (requestedRound?.key === "intro" ? "Intro Game" : "Godlike Warfare"));
    const profile = isAdminRound ? { ...(roundSettings || roundProfiles[profileName] || roundProfiles["Godlike Warfare"]) } : (roundProfiles[profileName] || roundProfiles["Godlike Warfare"]);
    const activeGameName = isAdminRound ? (cleanSingleLineText(gameName || profileName, TEXT_LIMITS.gameName) || profileName) : profileName;
    const isLateRound = requestedRound?.key === "glw" && glwSeedMode === "late";
    const l = parseQty(profile.startingLand);
    const c = parseQty(profile.startingCards);
    const seededStartAt = isAdminRound ? now : (isLateRound ? now - ((GAME_TOTAL_GAME_MS * 0.75) / roundSpeedForKey("glw")) : now);
    setPlayerNameSetupComplete(true);
    setEntryStage("game");
    setSelectedRoundKey(requestedRound?.key || "glw");
    setPage("status");
    if (!isAdminRound) setAdminMode(false);
    setReportTextMode(REPORT_WORDING_MODE);
    setRoundProfile(profileName);
    setRoundSettings(profile);
    setGameName(activeGameName);
    setRoundStartedAt(seededStartAt);
    setBuildForm(emptyBuildForm());
    setTrainForm(["", "", "", "", "", ""]);
    setDisbandForm(["", "", "", "", "", ""]);
    setDestroyForm(emptyBuildForm());
    setScienceOrder(null);
    setScienceLevels({ agriculture: 0, combat: 0, crime: 0, housing: 0, population: 0, banking: 0, turrets: 0 });
    setWorldReports([]);
    setMarketOrders([]);
    setRetalRecords([]);
    setGrievances([]);
    setBattleReport([]);
    setOutgoingMissiles([]);
    setIncomingMissiles([]);
    setAlliance(null);
    setShareAllianceProfile(false);
    setAllianceShareEnabledMembers([]);
    setAllianceAnnouncementDraft("");
    setAllianceSubPage("main");
    setDonateAllianceLandAmount("");
    setAllianceBankBuildQty("");
    setAllianceBankSpeedFactor("1");
    setAllianceBankDepositAmount("");
    setLrcCardsAmount("");
    setLrcEnergyAmount("");
    setLrcMineralName(LRC_MINERALS[0]);
    setLrcMineralAmount("");
    setLrcTargetType("alliance");
    setLrcTargetName("");
    setActiveLrcSequence(null);
    setNexusMineralName(NEXUS_MINERALS[0]);
    setNexusMineralAmount("");
    setDemoMemberName("");
    setDiplomacyTargetType("alliance");
    setDiplomacyTargetName("");
    setActiveWars([]);
    setAlliedStatuses([]);
    setDiplomacyRequests([]);
    setProcessedBattleKeys([]);
    processedBattleKeysRef.current = [];
    setLog([makeNewsEntry(`New ${activeGameName} round slot started: ${fmt(l)} free land and ${fmt(c)} ${currencyLabel}.`, "War", now)]);
    setMessages([{ id: 1, direction: "inbox", from: "System", to: cleanStoredName(player.name, "SONAR"), body: `Welcome to ${activeGameName}.`, read: true }]);
    setPlayer((old) => {
      const raceKey = races[selectedSpeciesKey] ? selectedSpeciesKey : (races[old.race] ? old.race : "lithi");
      const lateBuildings = { ...emptyBuildings(), banks: 20000, factories: 5000, barracks: 4000, science_labs: 4500 };
      return isLateRound
        ? { ...old, name: cleanStoredName(playerNameDraft || old.name, "SONAR"), race: raceKey, alliance: "None", freeLand: 1500, cards: 10000000, banked: 20000 * 250000, pop: 0, rebels: 0, food: 0, water: 0, energy: 0, scanners: 0, missiles: 0, experience: 2800, roundWins: 0, roundLosses: 0, trainingSpeedOrdersCompleted: raceKey === "trysaur" ? 180 : 0, minerals: emptyMinerals(), buildings: lateBuildings, army: [0,0,0,0,0,0], buildOrder: null, exploreOrder: null, trainOrder: null, protectionHours: 0, protectionUntil: 0, lastAttackedAt: now - 2 * 60 * 60 * 1000, lastUpdatedAt: now }
        : { ...old, name: cleanStoredName(playerNameDraft || old.name, "SONAR"), race: raceKey, alliance: "None", freeLand: l, cards: c, banked: 0, pop: 0, rebels: 0, food: 0, water: 0, energy: 0, scanners: 0, missiles: 0, experience: 0, roundWins: 0, roundLosses: 0, trainingSpeedOrdersCompleted: 0, minerals: emptyMinerals(), buildings: emptyBuildings(), army: [0,0,0,0,0,0], buildOrder: null, exploreOrder: null, trainOrder: null, protectionHours: 0, protectionUntil: 0, lastAttackedAt: 0, lastUpdatedAt: now };
    });
    setDemoOpponents((ops) => {
      if (isLateRound) return GLW_LATE_BOT_SEEDS.map((seed, idx) => makeGlwLateOpponent(seed, idx, now));
      return ops.map((op, idx) => {
        const rk = roundRaceForBot(op, profileName);
        return normaliseOpponentPresence({ ...op, raceKey: rk, race: raceNameFromKey(rk), freeLand: l, cards: c, banked: 0, pop: 0, rebels: 0, food: 0, water: 0, energy: 0, scanners: 0, missiles: 0, experience: 0, totalExperience: op.totalExperience ?? op.experience ?? 0, roundWins: 0, roundLosses: 0, totalWins: op.totalWins ?? op.roundWins ?? 0, totalLosses: op.totalLosses ?? op.roundLosses ?? 0, trainingSpeedOrdersCompleted: 0, minerals: emptyMinerals(), buildings: emptyBuildings(), army: [0,0,0,0,0,0], buildOrder: null, exploreOrder: null, trainOrder: null, protectionHours: 0, protectionUntil: 0, lastAttackedAt: 0, powerOffset: 0, lastBotUpdatedAt: now, lastSeenAt: now - ((Number(op.id) || 0) % 5) * 60000, lastSeen: lastSeenLabelFromAt(now - ((Number(op.id) || 0) % 5) * 60000, now), lastBotCheckInAt: 0, botOnlineUntil: now + 10 * 60 * 1000, botRoundSurgeUntil: now + 2 * 60 * 60 * 1000, botAsleep: false, botBuildOrder: null, botTrainOrder: null, lastBotAction: "Round start: waiting for first action.", lastBotCompleted: "None yet" });
      });
    });
  }

  function roundSlotPayload(slotKey = activeRoundSlotKey) {
    const payload = currentSavePayload();
    const roundKey = canonicalRoundKeyForSlot({ slotKey, roundKey: selectedRoundKey, roundName: gameName, roundProfile });
    return {
      ...payload,
      activeRoundSlotKey: slotKey,
      selectedRoundKey: roundKey,
      playerNameSetupComplete: true,
      entryStage: "game",
      page: entryStage === "game" ? page : "status",
      savedAt: Date.now()
    };
  }

  function liveRoundSlotIndex(index = roundSlotIndex) {
    return (Array.isArray(index) ? index : []).filter((slot) => slot?.slotKey && safeLoadRoundSlot(slot.slotKey)).map(normaliseRoundSlotEntry);
  }
  function isSnapshotSlot(slot = {}) {
    const label = String(slot?.label || slot?.roundName || "");
    return slot?.slotKind === "snapshot" || label.toLowerCase().startsWith("saved state");
  }
  function slotDisplayName(slot = {}) {
    return slot?.label || slot?.roundName || slot?.slotKey || "Local save";
  }
  function slotMetaLine(slot = {}) {
    const species = races[slot?.speciesKey]?.name || raceNameFromKey(slot?.speciesKey);
    return `${slot?.playerName || "Unknown"} · ${species} · ${slot?.savedAt ? new Date(slot.savedAt).toLocaleString() : "not yet stamped"}`;
  }
  function roundSpeedForSavedSlot(roundKey = "intro", slotPayload = null, slot = null) {
    const direct = Number(slotPayload?.roundSettings?.gameSpeed);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const profile = slotPayload?.roundProfile || slot?.roundProfile;
    const profileSpeed = Number(roundProfiles[profile]?.gameSpeed);
    if (Number.isFinite(profileSpeed) && profileSpeed > 0) return profileSpeed;
    return roundSpeedForKey(roundKey);
  }

  function saveActiveRoundSlot(label = null) {
    const slotKey = activeRoundSlotKey || "glw-local";
    const roundKey = canonicalRoundKeyForSlot({ slotKey, roundKey: selectedRoundKey, roundName: gameName, roundProfile });
    const payload = roundSlotPayload(slotKey);
    safeWriteSave({ ...currentSavePayload(), selectedRoundKey: roundKey, savedAt: Date.now() });
    safeWriteRoundSlot(slotKey, { ...payload, selectedRoundKey: roundKey });
    try { if (typeof window !== "undefined") window.localStorage.setItem(ROUND_SLOT_CURRENT_KEY, slotKey); } catch {}
    const entry = { slotKey, label: label || gameName || defaultRoundSlotLabel(roundKey), roundKey, roundName: gameName || roundProfile || defaultRoundSlotLabel(roundKey), roundStartedAt, playerName: cleanStoredName(player.name, "SONAR"), speciesKey: player.race, land: totalEmpireLand(player), power: publicPowerForEmpire(player), version: PROTOTYPE_VERSION, savedAt: Date.now() };
    const nextIndex = upsertRoundSlotIndexEntry(liveRoundSlotIndex(roundSlotIndex), entry);
    setRoundSlotIndex(nextIndex);
    safeWriteRoundSlotIndex(nextIndex);
    return payload;
  }

  function switchRoundSlot(slotKey) {
    if (!slotKey) return;
    const saved = safeLoadRoundSlot(slotKey);
    if (!saved) {
      const nextIndex = (roundSlotIndex || []).filter((slot) => slot?.slotKey !== slotKey);
      setRoundSlotIndex(nextIndex);
      safeWriteRoundSlotIndex(nextIndex);
      addLog(`Save slot ${slotKey} was listed but no longer exists. Removed stale registration record.`);
      setPlayerNameSetupComplete(false);
      setEntryStage("species");
      setPage("status");
      return;
    }
    if (slotKey === activeRoundSlotKey) {
      applySavedState(saved);
      setSelectedRoundKey(canonicalRoundKeyForSlot({ ...saved, slotKey }));
      setEntryStage("game");
      setPlayerNameSetupComplete(true);
      setPage(saved.page && saved.page !== "rounds" ? saved.page : "status");
      return;
    }
    saveActiveRoundSlot();
    setActiveRoundSlotKey(slotKey);
    try { if (typeof window !== "undefined") window.localStorage.setItem(ROUND_SLOT_CURRENT_KEY, slotKey); } catch {}
    applySavedState(saved);
    setSelectedRoundKey(canonicalRoundKeyForSlot({ ...saved, slotKey }));
    setEntryStage("game");
    setPlayerNameSetupComplete(true);
    setPage(saved.page && saved.page !== "rounds" ? saved.page : "status");
    setLastUpdateSummary(`Loaded round slot ${slotKey}.`);
    setRoundSlotIndex(liveRoundSlotIndex(safeReadRoundSlotIndex()));
  }

  function startNewRoundSlot(roundKey = selectedRoundKey) {
    const requestedRoundKey = accountRounds.some((round) => round.key === roundKey) ? roundKey : "intro";
    if (requestedRoundKey === "admin-start") {
      if (activeRoundSlotKey && activeRoundSlotKey !== ADMIN_ROUND_SLOT_KEY) saveActiveRoundSlot();
      safeDeleteRoundSlot(ADMIN_ROUND_SLOT_KEY);
      try { if (typeof window !== "undefined" && window.localStorage.getItem(ROUND_SLOT_CURRENT_KEY) === ADMIN_ROUND_SLOT_KEY) window.localStorage.removeItem(ROUND_SLOT_CURRENT_KEY); } catch {}
      setSelectedRoundKey("admin-start");
      setSelectedSpeciesKey("lithi");
      setPlayerNameDraft("SONAR");
      setPlayerNameSetupComplete(false);
      setEntryStage("species");
      setPage("status");
      const nextIndex = liveRoundSlotIndex(roundSlotIndex).filter((slot) => slot?.slotKey !== ADMIN_ROUND_SLOT_KEY);
      setRoundSlotIndex(nextIndex);
      safeWriteRoundSlotIndex(nextIndex);
      setLastUpdateSummary("Admin round slot cleared. Choose species/name to create the new admin round.");
      return;
    }
    saveActiveRoundSlot();
    const slotKey = makeRoundSlotKey(requestedRoundKey);
    setActiveRoundSlotKey(slotKey);
    try { if (typeof window !== "undefined") window.localStorage.setItem(ROUND_SLOT_CURRENT_KEY, slotKey); } catch {}
    resetToFreshRound(requestedRoundKey);
    setSelectedRoundKey(requestedRoundKey);
    const entry = { slotKey, label: defaultRoundSlotLabel(requestedRoundKey), roundKey: requestedRoundKey, roundName: defaultRoundSlotLabel(requestedRoundKey), playerName: cleanStoredName(player.name, "SONAR"), speciesKey: selectedSpeciesKey || player.race, version: PROTOTYPE_VERSION, savedAt: Date.now() };
    const nextIndex = upsertRoundSlotIndexEntry(roundSlotIndex, entry);
    setRoundSlotIndex(nextIndex);
    safeWriteRoundSlotIndex(nextIndex);
  }

  function saveCurrentStateAsNewSlot() {
    const roundKey = canonicalRoundKeyForSlot({ slotKey: activeRoundSlotKey, roundKey: selectedRoundKey, roundName: gameName, roundProfile });
    const slotKey = makeRoundSlotKey(roundKey || "saved");
    const stamp = new Date().toLocaleString();
    const payload = { ...currentSavePayload(), activeRoundSlotKey: slotKey, selectedRoundKey: roundKey, entryStage: "game", playerNameSetupComplete: true, page: entryStage === "game" ? page : "status", savedAt: Date.now() };
    safeWriteRoundSlot(slotKey, payload);
    const entry = { slotKey, slotKind: "snapshot", label: `Saved state ${stamp}`, roundKey, roundName: gameName || roundProfile || defaultRoundSlotLabel(roundKey), roundStartedAt, playerName: cleanStoredName(player.name, "SONAR"), speciesKey: player.race, land: totalEmpireLand(player), power: publicPowerForEmpire(player), version: PROTOTYPE_VERSION, savedAt: Date.now() };
    const nextIndex = upsertRoundSlotIndexEntry(liveRoundSlotIndex(roundSlotIndex), entry);
    setRoundSlotIndex(nextIndex);
    safeWriteRoundSlotIndex(nextIndex);
    setLastUpdateSummary(`Created snapshot ${slotKey}.`);
  }

  function loadRoundSlotIntoAdmin(slotKey) {
    if (!slotKey) return;
    const saved = safeLoadRoundSlot(slotKey);
    if (!saved) return setLastUpdateSummary("Load into admin failed: selected save was missing.");
    if (activeRoundSlotKey !== ADMIN_ROUND_SLOT_KEY) saveActiveRoundSlot();
    const adminPayload = { ...saved, activeRoundSlotKey: ADMIN_ROUND_SLOT_KEY, selectedRoundKey: "admin-start", entryStage: "game", playerNameSetupComplete: true, savedAt: Date.now() };
    safeWriteRoundSlot(ADMIN_ROUND_SLOT_KEY, adminPayload);
    setActiveRoundSlotKey(ADMIN_ROUND_SLOT_KEY);
    try { if (typeof window !== "undefined") window.localStorage.setItem(ROUND_SLOT_CURRENT_KEY, ADMIN_ROUND_SLOT_KEY); } catch {}
    applySavedState(adminPayload);
    setSelectedRoundKey("admin-start");
    setEntryStage("game");
    setPlayerNameSetupComplete(true);
    setPage(adminPayload.page && adminPayload.page !== "rounds" ? adminPayload.page : "status");
    const loadedAdminRoundName = adminPayload.gameName || adminPayload.roundProfile || "Admin Round";
    const entry = { slotKey: ADMIN_ROUND_SLOT_KEY, label: adminRoundDisplayName(loadedAdminRoundName), roundKey: "admin-start", roundName: loadedAdminRoundName, roundStartedAt: adminPayload.roundStartedAt, playerName: cleanStoredName(adminPayload.player?.name, "SONAR"), speciesKey: adminPayload.player?.race || "lithi", land: totalEmpireLand(adminPayload.player || {}), power: publicPowerForEmpire(adminPayload.player || {}), version: PROTOTYPE_VERSION, savedAt: Date.now() };
    const nextIndex = upsertRoundSlotIndexEntry(liveRoundSlotIndex(roundSlotIndex), entry);
    setRoundSlotIndex(nextIndex);
    safeWriteRoundSlotIndex(nextIndex);
    setLastUpdateSummary(`Loaded ${slotKey} into the Admin Round slot.`);
  }

  function exportCurrentSave() {
    const payload = saveActiveRoundSlot();
    setSaveExportText(JSON.stringify({ exportType: "AntrophAI local round save", exportedAt: Date.now(), payload }, null, 2));
  }

  function importSaveAsNewSlot() {
    const parsed = safeParseSave(saveImportDraft);
    const payload = parsed?.payload || parsed;
    if (!payload || typeof payload !== "object" || !payload.player) { setLastUpdateSummary("Import failed: pasted text was not an AntrophAI save payload."); return; }
    saveActiveRoundSlot();
    const slotKey = makeRoundSlotKey(payload.selectedRoundKey || "import");
    safeWriteRoundSlot(slotKey, { ...payload, activeRoundSlotKey: slotKey, savedAt: Date.now() });
    setActiveRoundSlotKey(slotKey);
    try { if (typeof window !== "undefined") window.localStorage.setItem(ROUND_SLOT_CURRENT_KEY, slotKey); } catch {}
    applySavedState(payload);
    setEntryStage("game");
    setPage(payload.page || "status");
    const entry = { slotKey, label: payload.gameName || payload.roundProfile || "Imported round", roundKey: payload.selectedRoundKey || "import", roundName: payload.gameName || payload.roundProfile || "Imported round", playerName: cleanStoredName(payload.player?.name, "SONAR"), speciesKey: payload.player?.race || "lithi", land: totalEmpireLand(payload.player || {}), power: publicPowerForEmpire(payload.player || {}), version: payload.saveStateVersion || "imported", savedAt: Date.now() };
    const nextIndex = upsertRoundSlotIndexEntry(roundSlotIndex, entry);
    setRoundSlotIndex(nextIndex);
    safeWriteRoundSlotIndex(nextIndex);
    setSaveImportDraft("");
    setLastUpdateSummary(`Imported save into new round slot ${slotKey}.`);
  }

  function removeRoundSlotFromIndex(slotKey) {
    const nextIndex = roundSlotIndex.filter((slot) => slot?.slotKey !== slotKey);
    setRoundSlotIndex(nextIndex);
    safeWriteRoundSlotIndex(nextIndex);
  }
  function deleteSnapshotSlot(slotKey) {
    if (!slotKey || !confirm("Delete this saved snapshot? The live round autosave is not affected.")) return;
    safeDeleteRoundSlot(slotKey);
    removeRoundSlotFromIndex(slotKey);
    setLastUpdateSummary("Deleted saved snapshot.");
  }
  function resetLiveRoundSlot(slotKey) {
    if (!slotKey || !confirm("Reset this live round autosave in this browser? Export or create a snapshot first if you want to keep it.")) return;
    safeDeleteRoundSlot(slotKey);
    removeRoundSlotFromIndex(slotKey);
    if (slotKey === activeRoundSlotKey) setLastUpdateSummary("Reset the active live round autosave. The current in-memory round remains open until you load another slot or reload.");
    else setLastUpdateSummary("Reset live round autosave.");
  }
  function clearTesterAccess() {
    safeClearTesterAccess();
    setTesterAccessRecord(null);
    setTesterAccessDraft("");
    setTesterAccessCommentDraft("");
    setTesterAccessError("");
    setTesterAccessSubmitting(false);
    setMultiplayerHealthState({ loading: false, error: "", fetchedAt: null, summary: null });
    setMultiplayerPreviewState({ loading: false, error: "", fetchedAt: null, summary: null });
    setMultiplayerIdentityState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
    setMultiplayerDevActionState({ loading: false, error: "", lastActionAt: null, lastActionType: null, lastActionResult: null, lastActionMessage: null });
    setHostedRoundState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
  }
  function multiplayerIdentityFallbackSummary() {
    return buildIdentityFallbackSummary(testerAccessRecord);
  }
  function multiplayerIdentityRequestBody() {
    return buildIdentityRequestBody({ resolvedSummary: multiplayerIdentityState.summary, testerAccessRecord });
  }
  function hostedRoundRequestBody() {
    return buildHostedRoundRequestBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord });
  }
  async function refreshMultiplayerHealth() {
    if (multiplayerHealthState.loading) return;
    if (!GAME_SERVICE_URL) {
      setMultiplayerHealthState({ loading: false, error: hostedGameServiceFailureMessage(), fetchedAt: Date.now(), summary: null });
      return;
    }

    setMultiplayerHealthState((prev) => ({ ...prev, loading: true, error: "" }));
    const fetchedAt = Date.now();
    try {
      const { response, result } = await fetchGameServiceHealth();
      const summary = normaliseHealthSummary(result, response.ok);

      setMultiplayerHealthState({
        loading: false,
        error: response.ok ? "" : hostedGameServiceFailureMessage(),
        fetchedAt,
        summary,
      });
    } catch {
      setMultiplayerHealthState({
        loading: false,
        error: hostedGameServiceFailureMessage(),
        fetchedAt,
        summary: null,
      });
    }
  }
  async function refreshMultiplayerPreview() {
    if (multiplayerPreviewState.loading) return;
    if (!testerAccessRecord?.accepted) return;
    if (!GAME_SERVICE_URL) {
      setMultiplayerPreviewState({ loading: false, error: multiplayerPreviewFailureMessage(503, "service_unavailable"), fetchedAt: Date.now(), summary: null });
      return;
    }

    setMultiplayerPreviewState((prev) => ({ ...prev, loading: true, error: "" }));
    const fetchedAt = Date.now();
    try {
      const { response, result } = await fetchDevRoundSummary(MULTIPLAYER_PREVIEW_ROUND_KEY);

      if (!response.ok || result?.ok === false) {
        const errorCode = result?.error || null;
        const errorMessage = multiplayerPreviewFailureMessage(response.status, errorCode);
        setMultiplayerPreviewState({ loading: false, error: errorMessage, fetchedAt, summary: null });
        return;
      }

      const summary = normalisePreviewSummary(result);
      setMultiplayerPreviewState({ loading: false, error: "", fetchedAt, summary });
    } catch (error) {
      setMultiplayerPreviewState({ loading: false, error: multiplayerPreviewFailureMessage(503, "service_unavailable"), fetchedAt, summary: null });
    }
  }
  async function refreshHostedDevRound({ forceEnter = false } = {}) {
    if (hostedRoundState.loading) return;
    if (!testerAccessRecord?.accepted) {
      setHostedRoundState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
      return null;
    }

    const accessGrant = testerAccessRecord?.accessGrant || null;
    const grantId = cleanSingleLineText(String(accessGrant?.grantId || accessGrant?.currentGrantId || ""), 128).trim() || "";
    if (testerAccessRecord?.accessMode !== "invite-token" || !grantId) {
      const message = "Redeem a real invite token before entering a hosted round.";
      setHostedRoundState({
        loading: false,
        error: forceEnter ? message : "",
        message: "",
        fetchedAt: Date.now(),
        summary: null,
      });
      return null;
    }

    if (!GAME_SERVICE_URL) {
      setHostedRoundState({ loading: false, error: hostedGameServiceFailureMessage(), message: "", fetchedAt: Date.now(), summary: null });
      return null;
    }

    setHostedRoundState((prev) => ({ ...prev, loading: true, error: "", message: "" }));
    const fetchedAt = Date.now();
    try {
      const { response, result } = await postHostedRoundEnter(hostedRoundRequestBody());

      if (!response.ok || result?.ok === false) {
        const errorCode = result?.error || null;
        const errorMessage = hostedRoundFailureMessage(response.status, errorCode);
        setHostedRoundState({ loading: false, error: errorMessage, message: "", fetchedAt, summary: null });
        return null;
      }

      const summary = normaliseHostedRoundSummary(result, grantId);
      setHostedRoundState({
        loading: false,
        error: "",
        message: result?.message || `Hosted DEV round ready for ${summary.player?.displayName || "the selected player"}.`,
        fetchedAt,
        summary,
      });
      setActiveGameMode("hosted");
      return summary;
    } catch (error) {
      setHostedRoundState({ loading: false, error: hostedRoundFailureMessage(503, "service_unavailable"), message: "", fetchedAt, summary: null });
      return null;
    }
  }
  async function refreshMultiplayerIdentity({ forceResolve = false } = {}) {
    if (multiplayerIdentityState.loading) return;
    if (!testerAccessRecord?.accepted) {
      setMultiplayerIdentityState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
      return;
    }

    const accessGrant = testerAccessRecord?.accessGrant || null;
    const grantId = cleanSingleLineText(String(accessGrant?.grantId || accessGrant?.currentGrantId || ""), 128).trim() || "";
    const testerLabel = cleanSingleLineText(accessGrant?.testerLabel || testerAccessRecord?.testerLabel || "", 128).trim() || null;
    const displayName = cleanSingleLineText(testerLabel || "DEV Invite Tester", 80).trim() || "DEV Invite Tester";

    if (testerAccessRecord?.accessMode !== "invite-token") {
      setMultiplayerIdentityState({
        loading: false,
        error: "",
        message: "",
        fetchedAt: Date.now(),
        summary: multiplayerIdentityFallbackSummary(),
      });
      return;
    }

    if (!grantId) {
      const message = "Your tester access exists, but no invite grant was available. Reset tester access and redeem a real invite token.";
      setMultiplayerIdentityState({
        loading: false,
        error: forceResolve ? message : "",
        message: forceResolve ? message : "",
        fetchedAt: Date.now(),
        summary: multiplayerIdentityFallbackSummary(),
      });
      return;
    }

    if (!GAME_SERVICE_URL) {
      setMultiplayerIdentityState({ loading: false, error: multiplayerIdentityFailureMessage(503, "service_unavailable"), message: "", fetchedAt: Date.now(), summary: null });
      return;
    }

    setMultiplayerIdentityState((prev) => ({ ...prev, loading: true, error: "", message: "" }));
    const fetchedAt = Date.now();
    try {
      const { response, result } = await postResolvePlayerIdentity({
        roundKey: MULTIPLAYER_PREVIEW_ROUND_KEY,
        grantId,
        testerLabel,
        displayName,
      });

      if (!response.ok || result?.ok === false) {
        const errorCode = result?.error || null;
        const errorMessage = multiplayerIdentityFailureMessage(response.status, errorCode);
        setMultiplayerIdentityState({ loading: false, error: errorMessage, message: "", fetchedAt, summary: null });
        return;
      }

      const identity = result?.identity || null;
      const summary = normaliseIdentitySummary(identity, { displayName, testerLabel });
      const ignoredRequestLabels = Boolean(identity?.requestedDisplayNameIgnored || identity?.requestedTesterLabelIgnored);
      setMultiplayerIdentityState({
        loading: false,
        error: "",
        message: summary ? `You are linked as ${summary.displayName}.${ignoredRequestLabels ? " Requested labels were ignored in favor of the invite-token identity." : ""}` : "",
        fetchedAt,
        summary,
      });
      refreshMultiplayerPreview();
    } catch (error) {
      setMultiplayerIdentityState({ loading: false, error: multiplayerIdentityFailureMessage(503, "service_unavailable"), message: "", fetchedAt, summary: null });
    }
  }
  async function resolveMyMultiplayerIdentity() {
    if (multiplayerIdentityState.loading) return;
    if (!testerAccessRecord?.accepted) {
      setMultiplayerIdentityState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
      return;
    }

    const accessGrant = testerAccessRecord?.accessGrant || null;
    const grantId = cleanSingleLineText(String(accessGrant?.grantId || accessGrant?.currentGrantId || ""), 128).trim() || "";
    if (testerAccessRecord?.accessMode !== "invite-token" || !grantId) {
      const message = "No invite-token grant is present. Reset tester access and redeem a real invite token.";
      setMultiplayerIdentityState({
        loading: false,
        error: message,
        message: "",
        fetchedAt: Date.now(),
        summary: multiplayerIdentityFallbackSummary(),
      });
      return;
    }

    return refreshMultiplayerIdentity({ forceResolve: true });
  }
  async function submitMultiplayerDevAction({ endpointPath, actionType, requestBody, successMessage, onSuccessRefresh = refreshMultiplayerPreview, validateResult = null }) {
    if (multiplayerDevActionState.loading) return;
    if (!testerAccessRecord?.accepted) return;
    if (!GAME_SERVICE_URL) {
      const attemptedAt = Date.now();
      setMultiplayerDevActionState({
        loading: false,
        error: multiplayerDevActionFailureMessage(503, "service_unavailable"),
        lastActionAt: attemptedAt,
        lastActionType: actionType,
        lastActionResult: null,
        lastActionMessage: null,
      });
      return;
    }

    const attemptedAt = Date.now();
    setMultiplayerDevActionState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const { response, result } = await postDevAction(endpointPath, requestBody);

      if (!response.ok || result?.ok === false) {
        const errorCode = result?.error || null;
        const errorMessage = multiplayerDevActionFailureMessage(response.status, errorCode, multiplayerIdentityState.summary?.displayName || multiplayerIdentityState.summary?.testerLabel || "the selected player");
        setMultiplayerDevActionState({
          loading: false,
          error: errorMessage,
          lastActionAt: attemptedAt,
          lastActionType: actionType,
          lastActionResult: null,
          lastActionMessage: null,
        });
        return;
      }

      const validationError = typeof validateResult === "function" ? validateResult(result) : null;
      if (validationError) {
        setMultiplayerDevActionState({
          loading: false,
          error: validationError,
          lastActionAt: attemptedAt,
          lastActionType: actionType,
          lastActionResult: result,
          lastActionMessage: null,
        });
        return;
      }

      setMultiplayerDevActionState({
        loading: false,
        error: "",
        lastActionAt: attemptedAt,
        lastActionType: actionType,
        lastActionResult: result,
        lastActionMessage: result?.message || successMessage,
      });
      if (typeof onSuccessRefresh === "function") {
        onSuccessRefresh();
      }
    } catch {
      setMultiplayerDevActionState({
        loading: false,
        error: multiplayerDevActionFailureMessage(503, "service_unavailable"),
        lastActionAt: attemptedAt,
        lastActionType: actionType,
        lastActionResult: null,
        lastActionMessage: null,
      });
    }
  }
  async function submitMultiplayerDevQueueBuildFactory() {
    const accessGrant = testerAccessRecord?.accessGrant || null;
    const grantId = cleanSingleLineText(String(accessGrant?.grantId || accessGrant?.currentGrantId || ""), 128).trim() || "";
    if (testerAccessRecord?.accessMode !== "invite-token" || !grantId) {
      const message = "No invite-token grant is present. Reset tester access and redeem a real invite token.";
      setMultiplayerDevActionState({
        loading: false,
        error: message,
        lastActionAt: Date.now(),
        lastActionType: "dev_queue_build_factory",
        lastActionResult: null,
        lastActionMessage: null,
      });
      return;
    }

    if (!multiplayerIdentityState.summary?.currentPlayerId && !multiplayerIdentityState.summary?.playerId) {
      const message = "Resolve your multiplayer identity first.";
      setMultiplayerDevActionState({
        loading: false,
        error: message,
        lastActionAt: Date.now(),
        lastActionType: "dev_queue_build_factory",
        lastActionResult: null,
        lastActionMessage: null,
      });
      return;
    }

    return submitMultiplayerDevAction({
      endpointPath: "/api/dev/actions/queue-build-factory",
      actionType: "dev_queue_build_factory",
      requestBody: { ...multiplayerIdentityRequestBody(), amount: 1 },
      successMessage: "Factory build order queued for next tick.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  async function submitMultiplayerDevManualTick() {
    return submitMultiplayerDevAction({
      endpointPath: "/api/dev/tick/manual-run",
      actionType: "dev_manual_tick",
      requestBody: multiplayerIdentityRequestBody(),
      successMessage: "Manual tick processed.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  async function submitMultiplayerDevResetProofRound() {
    if (!confirm("Reset the Shared Multiplayer DEV proof round and clear the current proof window? This only affects the browser-run DEV proof state and cannot be undone.")) return;
    return submitMultiplayerDevAction({
      endpointPath: "/api/dev/reset-proof-round",
      actionType: "dev_reset_proof_round",
      requestBody: multiplayerIdentityRequestBody(),
      successMessage: "Shared DEV proof state reset.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  async function submitMultiplayerDevBuildFactory() {
    return submitMultiplayerDevAction({
      endpointPath: "/api/dev/actions/build-factory",
      actionType: "dev_build_factory",
      requestBody: { ...multiplayerIdentityRequestBody(), amount: 1 },
      successMessage: "Legacy immediate proof applied.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  function hostedRoundRefreshAfterAction() {
    refreshHostedDevRound();
    refreshMultiplayerPreview();
  }
  async function enterHostedDevRound() {
    const summary = await refreshHostedDevRound({ forceEnter: true });
    if (summary) {
      setActiveGameMode("hosted");
      setHostedDiagnosticsOpen(false);
      setPage("status");
    }
    return summary;
  }
  async function submitHostedDevQueueBuildOrder(buildingKey = "factory") {
    const buildingLabel = hostedBuildingLabel(buildingKey);
    return submitMultiplayerDevAction({
      endpointPath: HOSTED_QUEUE_BUILD_ENDPOINT,
      actionType: `hosted_queue_build_${buildingKey}`,
      requestBody: buildQueueBuildOrderBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord, buildingKey, amount: 1 }),
      successMessage: `${buildingLabel} build order queued for hosted round.`,
      onSuccessRefresh: hostedRoundRefreshAfterAction,
      validateResult: (result) => {
        const confirmedKey = result?.action?.buildingKey || result?.action?.payload?.buildingKey || null;
        if (confirmedKey && confirmedKey !== buildingKey) {
          return `The hosted game service recorded a ${hostedBuildingLabel(confirmedKey)} order instead of ${buildingLabel}. It is likely running an older build that does not honour buildingKey yet - redeploy game-service v0.43.2 before queueing this building type.`;
        }
        return null;
      },
    });
  }
  async function submitHostedDevQueueBuildFactory() {
    return submitHostedDevQueueBuildOrder("factory");
  }
  async function submitHostedDevQueueTrainUnits(unitSlot) {
    return submitMultiplayerDevAction({
      endpointPath: HOSTED_QUEUE_TRAIN_ENDPOINT,
      actionType: `hosted_queue_train_${unitSlot}`,
      requestBody: buildQueueTrainOrderBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord, unitSlot, amount: 1 }),
      successMessage: "Training order queued for hosted round.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
      validateResult: (result) => {
        const confirmedSlot = Number(result?.action?.unitSlot ?? result?.action?.payload?.unitSlot ?? 0);
        if (confirmedSlot && confirmedSlot !== unitSlot) {
          return `The hosted game service recorded a training order for unit slot ${confirmedSlot} instead of slot ${unitSlot}. It is likely running an older build - redeploy the game-service before queueing training orders.`;
        }
        return null;
      },
    });
  }
  async function submitHostedDevQueueExplore() {
    const hours = Math.floor(Number(hostedExploreHours) || 0);
    const spend = Math.floor(Number(hostedExploreSpend) || 0);
    return submitMultiplayerDevAction({
      endpointPath: HOSTED_QUEUE_EXPLORE_ENDPOINT,
      actionType: "hosted_queue_explore",
      requestBody: buildQueueExploreBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord, hours, spend }),
      successMessage: "Exploration queued for hosted round.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
      validateResult: (result) => {
        const confirmedHours = Number(result?.action?.hours ?? result?.action?.payload?.hours ?? 0);
        const confirmedSpend = Number(result?.action?.spend ?? result?.action?.payload?.spend ?? 0);
        if ((confirmedHours && confirmedHours !== hours) || (confirmedSpend && confirmedSpend !== spend)) {
          return `The hosted game service recorded an exploration for ${confirmedHours} hours / ${confirmedSpend} money instead of the requested ${hours} hours / ${spend} money. It is likely running an older build - redeploy the game-service before queueing explorations.`;
        }
        return null;
      },
    });
  }
  async function submitHostedDevQueueScience(field) {
    const label = hostedScienceLabel(field);
    return submitMultiplayerDevAction({
      endpointPath: HOSTED_QUEUE_SCIENCE_ENDPOINT,
      actionType: `hosted_queue_science_${field}`,
      requestBody: buildQueueScienceBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord, field }),
      successMessage: `${label} research queued for hosted round.`,
      onSuccessRefresh: hostedRoundRefreshAfterAction,
      validateResult: (result) => {
        const confirmedField = result?.action?.field || result?.action?.payload?.field || null;
        if (confirmedField && confirmedField !== field) {
          return `The hosted game service recorded a ${hostedScienceLabel(confirmedField)} research order instead of ${label}. It is likely running an older build - redeploy the game-service before queueing research.`;
        }
        return null;
      },
    });
  }
  async function submitHostedDevBankDeposit() {
    const amount = Math.floor(Number(hostedBankAmount) || 0);
    return submitMultiplayerDevAction({
      endpointPath: HOSTED_BANK_DEPOSIT_ENDPOINT,
      actionType: "hosted_bank_deposit",
      requestBody: buildBankActionBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord, amount }),
      successMessage: "Deposit completed for hosted round.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  async function submitHostedDevBankWithdraw() {
    const amount = Math.floor(Number(hostedBankAmount) || 0);
    return submitMultiplayerDevAction({
      endpointPath: HOSTED_BANK_WITHDRAW_ENDPOINT,
      actionType: "hosted_bank_withdraw",
      requestBody: buildBankActionBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord, amount }),
      successMessage: "Withdrawal completed for hosted round.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  async function submitHostedCompleteDueOrders(screen) {
    return submitMultiplayerDevAction({
      endpointPath: HOSTED_COMPLETE_DUE_ENDPOINT,
      actionType: `hosted_complete_due_${screen}`,
      requestBody: buildCompleteDueBody({ hostedSummary: hostedRoundState.summary, testerAccessRecord, screen }),
      successMessage: "Finished orders completed.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  async function submitHostedDevManualTick() {
    return submitMultiplayerDevAction({
      endpointPath: "/api/dev/tick/manual-run",
      actionType: "hosted_manual_tick",
      requestBody: hostedRoundRequestBody(),
      successMessage: "Hosted round manual tick processed.",
      onSuccessRefresh: hostedRoundRefreshAfterAction,
    });
  }
  async function submitTesterAccess() {
    if (testerAccessSubmitting) return;
    const entered = String(testerAccessDraft || "").trim();
    if (!entered) {
      setTesterAccessError(inviteTokenFailureMessage("empty_token"));
      return;
    }

    const staticRecord = testerAccessRecordForCode(entered);
    if (staticRecord) {
      safeWriteTesterAccess(staticRecord);
      setTesterAccessRecord(staticRecord);
      setTesterAccessDraft("");
      setTesterAccessCommentDraft("");
      setTesterAccessError("");
      setTesterAccessSubmitting(false);
      setMultiplayerHealthState({ loading: false, error: "", fetchedAt: null, summary: null });
      setMultiplayerPreviewState({ loading: false, error: "", fetchedAt: null, summary: null });
      setMultiplayerIdentityState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
      setMultiplayerDevActionState({ loading: false, error: "", lastActionAt: null, lastActionType: null, lastActionResult: null, lastActionMessage: null });
      setHostedRoundState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
      return;
    }

    if (!INVITE_TOKEN_SERVICE_URL) {
      setTesterAccessError(inviteTokenFailureMessage("service_unavailable"));
      return;
    }

    setTesterAccessSubmitting(true);
    setTesterAccessError("");

    const clientNonce = makeInviteTokenClientNonce();
    const testerComment = cleanMultiLineText(testerAccessCommentDraft || "", 1000);
    const payload = {
      token: entered,
      clientBuild: PROTOTYPE_VERSION,
      clientNonce,
    };
    if (testerComment) {
      payload.testerComment = testerComment;
    }

    try {
      const { response, result } = await postInviteTokenRedeem(payload);
      if (!response.ok || result?.ok === false) {
        const errorCode = result?.error?.code || (response.status === 409 ? "token_claimed" : response.status === 403 ? "token_revoked" : response.status === 404 ? "token_invalid" : response.status === 410 ? "token_expired" : response.status === 429 ? "rate_limited" : response.status >= 500 ? "service_unavailable" : "service_unavailable");
        setTesterAccessError(inviteTokenFailureMessage(errorCode));
        return;
      }

      const accessGrant = normaliseAccessGrant(result?.accessGrant || result?.grant || null);
      if (!accessGrant) {
        setTesterAccessError("The invite service returned an incomplete access grant.");
        return;
      }

      const record = {
        accepted: true,
        accessMode: "invite-token",
        codeLabel: null,
        testerLabel: accessGrant.testerLabel || null,
        acceptedAt: Date.now(),
        accessGrant,
      };
      safeWriteTesterAccess(record);
      setTesterAccessRecord(record);
      setTesterAccessDraft("");
      setTesterAccessCommentDraft("");
      setTesterAccessError("");
      setMultiplayerHealthState({ loading: false, error: "", fetchedAt: null, summary: null });
      setMultiplayerPreviewState({ loading: false, error: "", fetchedAt: null, summary: null });
      setMultiplayerIdentityState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
      setMultiplayerDevActionState({ loading: false, error: "", lastActionAt: null, lastActionType: null, lastActionResult: null, lastActionMessage: null });
      setHostedRoundState({ loading: false, error: "", message: "", fetchedAt: null, summary: null });
    } catch (error) {
      setTesterAccessError(inviteTokenFailureMessage("service_unavailable"));
    } finally {
      setTesterAccessSubmitting(false);
    }
  }
  function renderTesterAccessGate() {
    return <div className="app-shell wording-modern species-lithi min-h-screen bg-black text-orange-400 font-mono p-3 flex items-center justify-center" style={{ backgroundImage: "radial-gradient(circle at top, #1b1208 0, #030100 38%, #000 100%)" }}>
      <div className="w-[min(96vw,760px)] border border-orange-800 bg-black/90 p-5 shadow-2xl">
        <style>{`.app-shell{--antro-bg:#050100;--antro-panel-bg:rgba(0,0,0,.82);--antro-panel-header-bg:#240b02;--antro-border:#9a4b08;--antro-accent:#ffb15c;--species-accent:var(--antro-accent);--species-border:var(--antro-border);--species-glow:rgba(255,120,32,.14)}.wording-modern.species-lithi{--species-accent:#b98536;--species-border:#6d4216;--species-glow:rgba(224,162,74,.16)}.wording-modern .antro-panel{border-color:var(--species-border);box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 28px var(--species-glow)}.wording-modern .antro-panel-title{border-color:var(--species-border);color:var(--species-accent)}.classic-btn{border:1px solid #9a4b08;background:#160701;color:#ffb15c;padding:4px 8px;font-size:14px}.classic-btn:hover{background:#321004;color:#ffe0b0}.species-art-frame{border-color:var(--species-border);box-shadow:inset 0 0 30px rgba(0,0,0,.35),0 0 20px var(--species-glow)}`}</style>
        <div className="text-center mb-5"><h1 className="text-4xl md:text-5xl font-bold tracking-widest"><span className="text-orange-300">ANTROPH</span><span className="ml-1 text-cyan-200" style={{ textShadow: "0 0 6px #22d3ee, 0 0 14px #0ea5e9, 0 0 24px #38bdf8" }}>AI</span></h1><p className="text-orange-600 mt-1">Private tester access | {PROTOTYPE_VERSION}</p></div>
        <Panel title="Tester Access">
          <p className="text-orange-200 mb-4">Invite tokens are the preferred way to access this tester build. Each invite token is single-use. Redeemed access is stored locally in this browser, and your game saves stay local too. Development fallback codes still work for internal testing. This limits access; it is not DRM.</p>
          <div className="max-w-md">
            <label className="block text-orange-300 mb-1">Invite token or development fallback code</label>
            <input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-2" value={testerAccessDraft} placeholder="Invite token" onChange={(e) => { setTesterAccessDraft(e.target.value); setTesterAccessError(""); }} onKeyDown={(e) => { if (e.key === "Enter") submitTesterAccess(); }} autoFocus />
            <label className="block text-orange-300 mb-1 mt-3">Tester comment (optional)</label>
            <textarea className="w-full min-h-20 bg-black border border-orange-900 text-orange-100 px-2 py-2" value={testerAccessCommentDraft} placeholder="Optional note for the invite service" onChange={(e) => setTesterAccessCommentDraft(cleanMultiLineText(e.target.value, 1000))} />
            {testerAccessError ? <div className="text-red-300 mt-2">{testerAccessError}</div> : null}
            <div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={submitTesterAccess} disabled={testerAccessSubmitting}>{testerAccessSubmitting ? "Checking..." : "Enter"}</button></div>
            <div className="mt-4 text-xs text-orange-600 leading-relaxed">Trusted fallback codes remain for development use. Invite redemption is access limiting, not authentication.</div>
          </div>
        </Panel>
        <div className="mt-5 pt-3 border-t border-orange-950 text-xs text-orange-700 text-center">Local prototype only. No server account or login is created in this build.</div>
      </div>
    </div>;
  }

  useEffect(() => {
    const savedIndex = safeReadRoundSlotIndex();
    setRoundSlotIndex(savedIndex);
    let currentSlot = "glw-local";
    try { if (typeof window !== "undefined") currentSlot = window.localStorage.getItem(ROUND_SLOT_CURRENT_KEY) || currentSlot; } catch {}
    const slotSave = safeLoadRoundSlot(currentSlot);
    const legacySave = safeLoadSave();
    const saved = slotSave || legacySave;
    setActiveRoundSlotKey(currentSlot);
    if (saved) {
      applySavedState(saved);
      const isRealLauncherSave = Boolean(saved.playerNameSetupComplete || saved.glwRaceRegistered || saved.entryStage === "game" || (saved.player && cleanStoredName(saved.player.name, "SONAR") !== "SONAR"));
      if (isRealLauncherSave && !savedIndex.some((slot) => slot?.slotKey === currentSlot)) {
        const roundKey = canonicalRoundKeyForSlot({ ...saved, slotKey: currentSlot });
        const entry = { slotKey: currentSlot, label: saved.gameName || defaultRoundSlotLabel(roundKey), roundKey, roundName: saved.gameName || saved.roundProfile || defaultRoundSlotLabel(roundKey), roundStartedAt: saved.roundStartedAt, playerName: cleanStoredName(saved.player?.name, "SONAR"), speciesKey: saved.player?.race || saved.selectedSpeciesKey || "lithi", land: totalEmpireLand(saved.player || {}), power: publicPowerForEmpire(saved.player || {}), version: saved.saveStateVersion || PROTOTYPE_VERSION, savedAt: saved.savedAt || Date.now() };
        const nextIndex = upsertRoundSlotIndexEntry(savedIndex, entry);
        setRoundSlotIndex(nextIndex);
        safeWriteRoundSlotIndex(nextIndex);
      }
    } else { setEntryStage("glw"); setPlayerNameSetupComplete(false); setGlwRaceRegistered(false); setSelectedRoundKey("glw"); setRoundProfile("Godlike Warfare"); setRoundSettings(roundProfiles["Godlike Warfare"]); setGameName("Late War Test Round"); }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `AntrophAI GLW Prototype ${PROTOTYPE_VERSION}`;
  }, []);
  useEffect(() => {
    if (!hydrated || !testerAccessRecord?.accepted) return;
    refreshMultiplayerHealth();
    refreshMultiplayerIdentity();
    refreshMultiplayerPreview();
  }, [hydrated, testerAccessRecord?.accepted, testerAccessRecord?.accessMode, testerAccessRecord?.accessGrant?.grantId, testerAccessRecord?.accessGrant?.testerLabel, testerAccessRecord?.testerLabel]);
  // Visiting the hosted Build/Barracks screen explicitly completes that screen's
  // finished orders, mirroring the local prototype's page-visit completion. The
  // summary dependency is boolean on purpose: refreshes replace the summary
  // object and must not re-trigger completion.
  useEffect(() => {
    if (!hydrated || activeGameMode !== "hosted" || !hostedRoundState.summary) return;
    if (page !== "build" && page !== "barracks" && page !== "explore" && page !== "science") return;
    submitHostedCompleteDueOrders(page);
  }, [hydrated, activeGameMode, page, Boolean(hostedRoundState.summary)]);

  useEffect(() => { if (!hydrated) return; const payload = currentSavePayload(); safeWriteSave(payload); if (activeRoundSlotKey) safeWriteRoundSlot(activeRoundSlotKey, roundSlotPayload(activeRoundSlotKey)); }, [hydrated, activeRoundSlotKey, playerNameSetupComplete, entryStage, selectedRoundKey, selectedSpeciesKey, glwSeedMode, glwRaceRegistered, page, adminMode, displayModel, log, worldReports, buildForm, trainForm, mineAllocation, factoryAllocation, buildSpeedFactor, useBarracksSpeedMinerals, pageCompletionNotice, scienceOrder, scienceLevels, roundProfile, roundSettings, gameName, roundStartedAt, selectedTargetName, disableTargetTurrets, spyTarget, spies, mercenaries, alliance, shareAllianceProfile, allianceShareEnabledMembers, allianceAnnouncementDraft, allianceSubPage, donateAllianceLandAmount, allianceBankBuildQty, allianceBankSpeedFactor, allianceBankDepositAmount, lrcCardsAmount, lrcEnergyAmount, lrcMineralName, lrcMineralAmount, lrcTargetType, lrcTargetName, activeLrcSequence, exploreHours, exploreCards, newsFilter, newsPage, battleLogPage, battleLogOpponent, botDifficulty, onlineSort, nexusMineralName, nexusMineralAmount, demoMemberName, diplomacyTargetType, diplomacyTargetName, activeWars, alliedStatuses, diplomacyRequests, retalRecords, grievances, battleReport, lastUpdateSummary, outgoingMissiles, incomingMissiles, messages, marketOrders, processedBattleKeys, player, demoOpponents]);

  const caps = useMemo(() => calcCaps(player.buildings, scienceLevels), [player.buildings, scienceLevels]);
  const playerArmyPower = armyPower(player.race, player.army);
  const land = totalEmpireLand(player);
  const power = publicPowerForEmpire(player);
  const addLog = (msg, type = null) => setLog((old) => [makeNewsEntry(msg, type), ...old.filter((entry) => !newsText(entry).startsWith("Page request update:"))].slice(0, 5000));
  function showWarInlineNotice(text) {
    warInlineNoticeTimeoutsRef.current.forEach((id) => clearTimeout(id));
    warInlineNoticeTimeoutsRef.current = [];
    const id = Date.now();
    setWarInlineNotice({ id, text, visible: true });
    const fadeId = setTimeout(() => {
      setWarInlineNotice((notice) => notice && notice.id === id ? { ...notice, visible: false } : notice);
    }, 50);
    const clearId = setTimeout(() => {
      setWarInlineNotice((notice) => notice && notice.id === id ? null : notice);
    }, 1550);
    warInlineNoticeTimeoutsRef.current = [fadeId, clearId];
  }

  function normaliseBattleDedupeEntry(entry) {
    if (!entry || !entry.key) return null;
    return {
      key: String(entry.key),
      createdAt: Number(entry.createdAt || entry.reservedAt || entry.processedAt || entry.skippedAt || Date.now()),
      status: entry.status || "processed",
      source: entry.source || null,
      actionType: entry.actionType || null,
      attacker: entry.attacker || null,
      defender: entry.defender || null,
      reportId: entry.reportId || null,
      retalSourceKey: entry.retalSourceKey || null,
      botRunId: entry.botRunId || null,
      botAttemptIndex: entry.botAttemptIndex ?? null,
      reason: entry.reason || null,
      originalReportId: entry.originalReportId || null,
      processedAt: entry.processedAt || null,
      skippedAt: entry.skippedAt || null
    };
  }
  function battleDedupeActionType(usedRetalRecord, usedRetal = false) {
    return usedRetal || usedRetalRecord ? `retal:${retalDedupeKey(usedRetalRecord) || "unknown"}` : "normal";
  }
  function makeBattleDedupeKey({ source, attacker, defender, now, usedRetalRecord = null, usedRetal = false, botRunId = null }) {
    const bucket = Math.floor(Number(now || Date.now()) / BATTLE_DEDUPE_BUCKET_MS);
    const attackerId = attacker?.id ?? attacker?.name ?? "unknown-attacker";
    const defenderId = defender?.id ?? defender?.name ?? "unknown-defender";
    const actionType = battleDedupeActionType(usedRetalRecord, usedRetal);
    return `${source || "battle"}:${attackerId}->${defenderId}:${actionType}:bucket-${bucket}`;
  }
  function battleDedupeRecentCollision(entry, currentReports = worldReports) {
    const now = Number(entry.createdAt || Date.now());
    const actionType = entry.actionType || "normal";
    const cutoff = now - BATTLE_DEDUPE_BUCKET_MS;
    return (currentReports || []).find((report) => {
      if (!report || Number(report.createdAt || 0) < cutoff) return false;
      if (report.attacker !== entry.attacker || report.defender !== entry.defender) return false;
      const reportActionType = report.retal ? `retal:${report.retalSourceKey || report.retalRecordId || "unknown"}` : "normal";
      return reportActionType === actionType;
    }) || null;
  }
  function reserveBattleDedupe(entryInput) {
    const now = Number(entryInput?.createdAt || Date.now());
    const entry = normaliseBattleDedupeEntry({ ...entryInput, createdAt: now, status: "reserved" });
    if (!entry) return { ok: true, entry: null };
    const cutoff = now - BATTLE_DEDUPE_KEEP_MS;
    const recent = (processedBattleKeysRef.current || []).map(normaliseBattleDedupeEntry).filter((e) => e && Number(e.createdAt || 0) >= cutoff);
    const existing = recent.find((e) => e.key === entry.key && e.status !== "skipped");
    const recentReport = battleDedupeRecentCollision(entry);
    if (existing || recentReport) {
      const skipped = normaliseBattleDedupeEntry({
        ...entry,
        key: `${entry.key}:skipped-${now}-${recent.length}`,
        status: "skipped",
        reason: "duplicate_guard",
        originalReportId: existing?.reportId || recentReport?.id || null,
        skippedAt: now
      });
      processedBattleKeysRef.current = [skipped, ...recent].slice(0, 120);
      setProcessedBattleKeys(processedBattleKeysRef.current);
      return { ok: false, existing: existing || recentReport, skipped };
    }
    processedBattleKeysRef.current = [entry, ...recent].slice(0, 120);
    setProcessedBattleKeys(processedBattleKeysRef.current);
    return { ok: true, entry };
  }
  function commitBattleDedupe(key, patch = {}) {
    if (!key) return;
    const now = Date.now();
    const recent = (processedBattleKeysRef.current || []).map(normaliseBattleDedupeEntry).filter(Boolean);
    processedBattleKeysRef.current = recent.map((entry) => entry.key === key ? normaliseBattleDedupeEntry({ ...entry, ...patch, status: patch.status || "processed", processedAt: now }) : entry).slice(0, 120);
    setProcessedBattleKeys(processedBattleKeysRef.current);
  }
  function addInboxMessage(from, body, options = {}) {
    const cleanFrom = cleanSingleLineText(from || "System", 40).trim() || "System";
    const cleanBody = cleanMultiLineText(body || "", 4000).trim();
    if (!cleanBody) return null;
    const createdAt = options.createdAt || Date.now();
    const message = { id: `${createdAt}-${Math.floor(Math.random() * 100000)}`, direction: "inbox", from: cleanFrom, to: player.name, body: cleanBody, read: false, createdAt, reportId: options.reportId || null, kind: options.kind || cleanFrom };
    setMessages((old) => [message, ...old].slice(0, 500));
    setMessagePopup(message);
    return message;
  }
  function addSystemInboxMessage(from, body, options = {}) { setTimeout(() => addInboxMessage(from, body, options), 0); }
  function publicBattleReportLines(lines) {
    return (Array.isArray(lines) ? lines : []).filter((line) => !["calibration", "audit", "stack"].includes(battleLineKind(line)));
  }
  function battleReportMessageBody(report) {
    const lines = publicBattleReportLines(report?.lines || []);
    const textLines = lines.map((line) => transformClassicReportTextForMode(line, activeReportTextMode)).filter(Boolean);
    const fallbackText = transformClassicReportTextForMode(report?.text || "A battle report has arrived.", activeReportTextMode);
    return textLines.length ? textLines.join("\n") : fallbackText;
  }
  function displayMessageBody(messageOrBody) {
    const body = typeof messageOrBody === "object" && messageOrBody !== null ? messageOrBody.body : messageOrBody;
    const text = String(body || "");
    return text.split("\n").map((line) => transformClassicReportTextForMode(line, activeReportTextMode)).join("\n");
  }
  function marketSaleMessageBody(sale) {
    return `Your market listing sold: ${fmt(sale.quantity)} ${sale.mineral} to ${sale.buyer} for ${fmt(sale.total)} Cardisium (${fmt(sale.price)} each).`;
  }
  function isSystemMessageSender(name) { return ["War", "Missiles", "Market", "System"].includes(String(name || "")); }
  function openMessageReport(message) {
    if (!message?.reportId) return;
    const report = worldReports.find((r) => r.id === message.reportId);
    if (!report) return addLog("That battle report is no longer available in the current log.");
    setBattleReport(report.lines || [report.text]);
    setMessages((old) => old.map((m) => m.id === message.id ? { ...m, read: true } : m));
    setMessagePopup(null);
    setPage("report");
  }
  function processBotMarketSalesForPlayer(orders = [], ops = [], now = Date.now()) {
    let changed = false;
    const sales = [];
    const nextOps = ops.map((op) => ({ ...op, minerals: { ...emptyMinerals(), ...(op.minerals || {}) } }));
    const nextOrders = [];
    for (const order of orders) {
      if (order.seller !== player.name || order.quantity <= 0) { nextOrders.push(order); continue; }
      const buyerIndex = nextOps.findIndex((op) => op.name !== order.seller && (op.cards || 0) >= order.price && Boolean(op.botOnlineNow || (Number(op.botOnlineUntil || 0) > now && !op.botAsleep)) && Math.random() < 0.18);
      if (buyerIndex < 0) { nextOrders.push(order); continue; }
      const buyer = nextOps[buyerIndex];
      const affordableQty = Math.floor((buyer.cards || 0) / Math.max(1, order.price));
      const qty = Math.max(1, Math.min(order.quantity, affordableQty, Math.max(1, Math.floor(order.quantity * (0.35 + Math.random() * 0.65)))));
      const total = qty * order.price;
      nextOps[buyerIndex] = { ...buyer, cards: Math.max(0, (buyer.cards || 0) - total), minerals: { ...buyer.minerals, [order.mineral]: (buyer.minerals[order.mineral] || 0) + qty } };
      sales.push({ buyer: buyer.name, mineral: order.mineral, quantity: qty, price: order.price, total, orderId: order.id, createdAt: now });
      changed = true;
      const remaining = order.quantity - qty;
      if (remaining > 0) nextOrders.push({ ...order, quantity: remaining });
    }
    return { orders: nextOrders, ops: changed ? nextOps : ops, sales };
  }
  function openWorldReportByText(entry) { const text = newsText(entry); const report = worldReports.find((r) => r.text === text); if (!report) return; setBattleReport(report.lines || [report.text]); setPage("report"); }
  const gameSpeed = () => Math.max(0.001, Number(roundSettings.gameSpeed) || 1);
  const realSecondsPerTick = () => 1800 / gameSpeed();
  const realMillisecondsForGameSeconds = (seconds) => (seconds / gameSpeed()) * 1000;
  const publicOpponent = (o) => { const normalised = normaliseOpponentPresence(o, displayNow); const l = totalEmpireLand(normalised); return { ...normalised, land: l, power: publicPowerForEmpire(normalised), lastSeen: lastSeenLabelFromAt(normalised.lastSeenAt, displayNow) }; };
  const botProfileFor = (op) => {
    const map = {
      Randy: { doctrine: "naive", tz: -5, sleepStart: 1, sleepEnd: 8, aggression: 0.35 },
      Gump: { doctrine: "pRoller", tz: 0, sleepStart: 2, sleepEnd: 9, aggression: 0.12 },
      grisham: { doctrine: "grinder", tz: 1, sleepStart: 0, sleepEnd: 7, aggression: 0.18 },
      bobsville: { doctrine: "reluBalanced", tz: 10, sleepStart: 23, sleepEnd: 6, aggression: 0.24 },
      ProteusX: { doctrine: "killStack", tz: 0, sleepStart: 3, sleepEnd: 10, aggression: 0.33 },
      Picket: { doctrine: "sixBleeder", tz: 0, sleepStart: 1, sleepEnd: 8, aggression: 0.30 },
      Violator: { doctrine: "killStack", tz: -4, sleepStart: 2, sleepEnd: 9, aggression: 0.31 },
      "i dont know": { doctrine: "reluBalanced", tz: -1, sleepStart: 1, sleepEnd: 8, aggression: 0.26 },
    };
    if (map[op.name]) return map[op.name];
    const doctrines = ["sixBleeder", "grinder", "reluBalanced", "pRoller", "killStack", "naive", "random"];
    return { doctrine: doctrines[(Number(op.id) || 0) % doctrines.length], tz: ((Number(op.id) || 0) % 17) - 8, sleepStart: 1 + ((Number(op.id) || 0) % 3), sleepEnd: 8 + ((Number(op.id) || 0) % 3), aggression: 0.12 + (((Number(op.id) || 0) % 6) * 0.035) };
  };
  const botLocalHour = (profile, now) => (new Date(now + (profile.tz || 0) * 3600 * 1000).getUTCHours());
  const botIsAsleep = (profile, now) => { const h = botLocalHour(profile, now); const s = profile.sleepStart, e = profile.sleepEnd; return s < e ? h >= s && h < e : h >= s || h < e; };
  const botCheckInIntervalMs = (op, profile, difficulty) => {
    // This is a simulated human check-in cadence, not internal processing cadence.
    // Bots may be processed for economy/order timer ageing while offline, but they
    // should only finish orders, start new orders, attack, or activate waiting
    // retals when this check-in fires and Last Seen is updated.
    const id = Number(op?.id || 0) || Math.floor(String(op?.name || "bot").length * 13);
    const baseMinutes = 9 + (id % 17) * 4;
    const doctrineMod = profile?.doctrine === "pRoller" ? 1.35 : profile?.doctrine === "killStack" ? 0.85 : 1;
    const difficultyMod = Math.max(0.65, Math.min(1.45, 1 / Math.max(0.7, Number(difficulty?.growthFactor || 1))));
    return Math.floor(baseMinutes * doctrineMod * difficultyMod * 60000);
  };
  const botDesiredStack = (op, doctrine) => {
    const race = races[op.raceKey] || races.human;
    if (doctrine === "pRoller") return [1, 1, 1, 1, 1, 95];
    if (doctrine === "grinder") return [10, 8, 17, 20, 20, 25];
    if (doctrine === "reluBalanced") return [12, 12, 16, 20, 20, 20];
    if (doctrine === "killStack") return [18, 4, 28, 3, 32, 15];
    if (doctrine === "naive") return [4, 4, 12, 20, 25, 35];
    if (doctrine === "random") return [8, 18, 7, 26, 11, 30];
    if (race.maxTrain >= 2400 && race.units[5]?.[1] < 800) return [10, 9, 18, 21, 22, 20];
    return [16, 4, 22, 8, 30, 20];
  };
  const botNormaliseArmyToShape = (op, gainedPower, doctrine) => {
    const race = races[op.raceKey] || races.human;
    const desired = botDesiredStack(op, doctrine);
    const army = [...(op.army || [0,0,0,0,0,0])];
    desired.forEach((pct, i) => { const cost = race.units[i]?.[1] || 1; const add = Math.max(0, Math.floor((gainedPower * pct / 100) / cost)); army[i] += add; });
    return army;
  };
  const botChooseStackOrder = (op, doctrine) => {
    const rows = armyRows(op.raceKey, op.army || []);
    const pctByClass = Object.fromEntries(rows.map((r) => [r.unitClass, r.percent]));
    if (doctrine === "pRoller") return [1,2,3,4,5,6];
    if (doctrine === "naive") return [5,4,3,2,1,6];
    if (doctrine === "random") return [6,1,5,2,4,3].sort(() => Math.random() - 0.45);
    if ((pctByClass[6] || 0) > 32 || doctrine === "sixBleeder") return [6,1,5,2,4,3];
    if (doctrine === "killStack") return [5,4,6,1,3,2];
    if (doctrine === "reluBalanced") return [6,1,5,2,4,3];
    return [6,1,5,2,4,3];
  };
  const botOpeningWeights = (op, b, doctrine, land, armyP) => {
    const built = totalBuildings(b);
    const idJitter = ((Number(op.id) || 0) % 7) / 100;
    const exploreOn = roundSettings.exploreEnabled !== false;
    const barracks = b.barracks || 0;
    if (built < Math.min(12000, land * 0.35)) {
      return { living_areas: 0.50 + idJitter, nutrition_suppliers: 0.16, water_purifiers: 0.11, police_stations: 0.08, factories: 0.13, banks: 0.02 };
    }
    if (built < Math.min(18000, land * 0.40)) {
      return { living_areas: 0.34, nutrition_suppliers: 0.13, water_purifiers: 0.09, police_stations: 0.06, factories: 0.28 + idJitter, science_labs: 0.04, banks: 0.04, mineral_extractors: exploreOn ? 0.02 : 0 };
    }
    if (built < Math.min(26000, land * 0.58) || barracks < 2000) {
      return { living_areas: 0.18, nutrition_suppliers: 0.08, water_purifiers: 0.06, police_stations: 0.04, factories: 0.23 + idJitter, barracks: 0.31, science_labs: 0.04, banks: 0.04, mineral_extractors: exploreOn ? 0.02 : 0 };
    }
    if (barracks < 4000 || armyP < land * 350) {
      return { living_areas: 0.12, nutrition_suppliers: 0.06, water_purifiers: 0.04, police_stations: 0.03, factories: 0.14, barracks: barracks < 4000 ? 0.30 : 0.10, science_labs: 0.06, banks: 0.08, power_plants: 0.06, turrets: 0.04, mineral_extractors: exploreOn ? 0.05 : 0.02 };
    }
    if (doctrine === "pRoller") return { living_areas: 0.10, nutrition_suppliers: 0.04, water_purifiers: 0.03, police_stations: 0.03, factories: 0.10, barracks: 0.08, banks: 0.24, power_plants: 0.10, turrets: 0.20, science_labs: 0.05, mineral_extractors: exploreOn ? 0.03 : 0.02 };
    return { living_areas: 0.10, nutrition_suppliers: 0.04, water_purifiers: 0.03, police_stations: 0.03, factories: 0.12, barracks: 0.10, banks: 0.10, power_plants: 0.08, turrets: 0.10, science_labs: 0.07, mineral_extractors: exploreOn ? 0.06 : 0.03, missile_bases: 0.02 };
  };
  const botBuildAdditions = (buildPoints, weights) => {
    const ids = Object.keys(weights).filter((id) => weights[id] > 0);
    const total = ids.reduce((s, id) => s + weights[id], 0) || 1;
    const additions = Object.fromEntries(buildingOrder.map(([id]) => [id, 0]));
    ids.forEach((id) => { additions[id] = Math.floor(buildPoints * weights[id] / total); });
    let allocated = Object.values(additions).reduce((a, v) => a + v, 0);
    const priority = ["living_areas", "factories", "barracks", "nutrition_suppliers", "water_purifiers", "police_stations", "banks", "science_labs", "power_plants", "turrets", "mineral_extractors"];
    let i = 0;
    while (allocated < buildPoints && priority.length) {
      const id = priority[i % priority.length];
      if ((weights[id] || 0) > 0 || ids.includes(id)) { additions[id] += 1; allocated += 1; }
      i += 1;
      if (i > priority.length * 3 && allocated < buildPoints) { additions[ids[0] || "living_areas"] += 1; allocated += 1; }
    }
    return additions;
  };
  const botMiningTargets = (op) => {
    const raceMins = races[op.raceKey]?.mineableMinerals || [];
    if (roundSettings.exploreEnabled !== false) {
      const scanner = raceMins.filter((m) => SCANNER_MINERALS.includes(m));
      if (scanner.length) return scanner;
    }
    const speed = raceMins.filter((m) => SPEED_TRAIN_MINERALS.includes(m));
    if (speed.length) return speed;
    const lrc = raceMins.filter((m) => LRC_MINERALS.includes(m));
    if (lrc.length) return lrc.slice(0, 3);
    return [...raceMins].sort((a, b) => (shopPrices[b] || 0) - (shopPrices[a] || 0)).slice(0, 2);
  };
  const botMaybeBuySpeedMinerals = (op, mins, cards, growth, hasPlausibleBase) => {
    if (!hasPlausibleBase || cards < 250000) return { mins, cards };
    let nextMins = { ...mins };
    let nextCards = cards;
    SPEED_TRAIN_MINERALS.forEach((m) => {
      const target = Math.floor(1200 + 400 * growth);
      const have = nextMins[m] || 0;
      if (have >= target) return;
      const buy = Math.min(target - have, Math.floor(nextCards / Math.max(1, shopPrices[m] || 33333)), 4000);
      if (buy > 0) { nextMins[m] = have + buy; nextCards -= buy * (shopPrices[m] || 33333); }
    });
    return { mins: nextMins, cards: nextCards };
  };

  const botCompleteDueOrders = (op, now) => {
    let next = { ...op, buildings: { ...emptyBuildings(), ...(op.buildings || {}) }, army: [...(op.army || [0,0,0,0,0,0])] };
    const completed = [];
    if (next.botBuildOrder?.finishAt && now >= next.botBuildOrder.finishAt) {
      const build = next.botBuildOrder.build || {};
      const landUsed = totalBuildings(build);
      const buildings = { ...next.buildings };
      Object.entries(build).forEach(([id, q]) => { buildings[id] = (buildings[id] || 0) + (Number(q) || 0); });
      next = { ...next, buildings, freeLand: (next.freeLand || 0) - landUsed, botBuildOrder: null };
      completed.push(`completed build: ${fmt(landUsed)} buildings`);
    }
    if (next.botTrainOrder?.finishAt && now >= next.botTrainOrder.finishAt) {
      const trainOrder = next.botTrainOrder;
      const train = trainOrder.train || [0,0,0,0,0,0];
      next = awardCompletedTrysaurWarDrums({ ...next, army: next.army.map((v, i) => (Number(v) || 0) + (Number(train[i]) || 0)), botTrainOrder: null }, trainOrder, activeReportTextMode);
      completed.push(`completed training: ${fmt(train.reduce((a, b) => a + (Number(b) || 0), 0))} units`);
    }
    if (completed.length) next.lastBotCompleted = completed.join("; ");
    return next;
  };
  const botBuildPlan = (op, doctrine, now) => {
    const b = { ...emptyBuildings(), ...(op.buildings || {}) };
    if (op.botBuildOrder) return null;
    const freeLand = Math.max(0, Math.floor(op.freeLand || 0));
    const cards = Math.max(0, Math.floor(op.cards || 0));
    if (freeLand <= 0 || cards < 2500) return null;
    const built = totalBuildings(b);
    const land = totalEmpireLand(op);
    const armyP = armyPower(op.raceKey, op.army || []);
    const weights = botOpeningWeights(op, b, doctrine, land, armyP);
    const factories = b.factories || 0;
    const budgetShare = built < 1000 ? 0.28 : built < 6000 ? 0.36 : 0.48;
    const maxBudget = Math.max(0, Math.floor(cards * budgetShare));
    const speedFactor = factories > 4000 ? 3 : factories > 1000 ? 2 : 1;
    const budgetAtSpeed = Math.floor(maxBudget / speedFactor);
    let buildPoints = Math.max(0, Math.min(freeLand, Math.floor((40 + Math.sqrt(Math.max(1, land)) / 2) * (1 + Math.min(2, factories / 5000)))));
    buildPoints = Math.min(buildPoints, Math.max(1, Math.floor(budgetAtSpeed / 350)));
    if (buildPoints <= 0) return null;
    let build = botBuildAdditions(buildPoints, weights);
    let baseCost = buildCost(build);
    while ((baseCost <= 0 || baseCost * speedFactor > maxBudget || totalBuildings(build) > freeLand) && buildPoints > 0) {
      buildPoints = Math.floor(buildPoints * 0.75);
      if (buildPoints <= 0) return null;
      build = botBuildAdditions(buildPoints, weights);
      baseCost = buildCost(build);
    }
    const paidCost = speedFactorBuildCost(baseCost, speedFactor);
    if (paidCost > cards || totalBuildings(build) > freeLand || baseCost <= 0) return null;
    const seconds = effectiveConstructionSeconds(baseCost, speedFactor, b, { construction: "100" }, op, activeReportTextMode);
    return { build, baseCost, paidCost, speedFactor, finishAt: now + realMillisecondsForGameSeconds(seconds), display: oldTime(seconds) };
  };
  const botTrainPlan = (op, doctrine, now) => {
    if (op.botTrainOrder) return null;
    const b = { ...emptyBuildings(), ...(op.buildings || {}) };
    const barracks = b.barracks || 0;
    const economyBase = totalBuildings(b) - (b.turrets || 0) - (b.banks || 0) - (b.missile_bases || 0);
    const glwLike = roundProfile === "Godlike Warfare" || roundSettings.exploreEnabled === false;
    const minBarracks = glwLike ? 1800 : 700;
    const minEco = glwLike ? 9000 : 3500;
    if (barracks < minBarracks || economyBase < minEco) return null;
    const cards = Math.max(0, Math.floor(op.cards || 0));
    if (cards < 50000) return null;
    const r = races[op.raceKey] || races.human;
    const armyP = armyPower(op.raceKey, op.army || []);
    const land = Math.max(1, totalEmpireLand(op));
    const targetPower = glwLike ? land * 1000 : Math.max(500000, land * 450);
    const budget = Math.max(0, Math.min(Math.floor(cards * 0.35), Math.floor(Math.max(120000, targetPower - armyP) * 0.16)));
    if (budget <= 0 || armyP > targetPower * 1.25) return null;
    const desired = botDesiredStack(op, doctrine);
    const train = [0,0,0,0,0,0];
    let remaining = budget;
    const order = doctrine === "pRoller" ? [0,1,2,3,4,5] : [5,0,4,1,3,2];
    let guard = 0;
    while (remaining > 0 && guard < 5000) {
      let bought = false;
      for (const idx of order) {
        const cost = r.units[idx]?.[1] || 1;
        const currentPower = (op.army?.[idx] || 0) * cost + train[idx] * cost;
        const currentTotal = Math.max(1, armyP + (budget - remaining));
        const pct = currentPower / currentTotal;
        const want = desired[idx] || 0.05;
        const rowCap = effectiveMaxTrainForRow(op.raceKey, idx, { entity: op, useSpeedMinerals: false, mode: activeReportTextMode });
        if (pct < want * 1.12 && remaining >= cost && train[idx] < rowCap) {
          train[idx] += 1;
          remaining -= cost;
          bought = true;
        }
      }
      if (!bought) break;
      guard += 1;
    }
    const trainCost = train.reduce((s, q, i) => s + q * (r.units[i]?.[1] || 0), 0);
    if (trainCost <= 0 || trainCost > cards) return null;
    const hasSpeedMins = (op.minerals?.Endaurios || 0) >= 2000 && (op.minerals?.Armidi || 0) >= 2000;
    const useSpeed = hasSpeedMins && barracks >= 2500;
    const seconds = trainingDurationSeconds(trainCost, b, useSpeed, op, activeReportTextMode);
    return { train, cost: trainCost, useSpeed, finishAt: now + realMillisecondsForGameSeconds(seconds), display: oldTime(seconds) };
  };
  const evolveBotEconomy = (op, tickEquivalent, now) => {
    const profile = botProfileFor(op);
    const difficulty = BOT_DIFFICULTY_PROFILES[botDifficulty] || BOT_DIFFICULTY_PROFILES.Normal;
    const newRoundSurge = Number(op.botRoundSurgeUntil || 0) > now;
    const asleep = newRoundSurge ? false : botIsAsleep(profile, now);
    const doctrine = op.botDoctrine || profile.doctrine;
    let next = { ...op, botDoctrine: doctrine };
    const elapsed = Math.max(0, Number(tickEquivalent) || 0);
    if (elapsed > 0) {
      next = applyElapsedProductionPure(next, elapsed, Object.fromEntries((races[next.raceKey]?.mineableMinerals || []).map((m) => [m, Math.floor(100 / Math.max(1, (races[next.raceKey]?.mineableMinerals || []).length))])), { construction: "100", scanners: "0", missiles: "0" }, { ...scienceLevels, wordingMode: activeReportTextMode });
      const b = { ...emptyBuildings(), ...(next.buildings || {}) };
      let mins = { ...emptyMinerals(), ...(next.minerals || {}) };
      const targets = botMiningTargets(next);
      if ((b.mineral_extractors || 0) > 0 && targets.length) {
        const minedTotal = Math.floor((b.mineral_extractors || 0) * 13 * elapsed * zarthMiningMultiplier(next, activeReportTextMode));
        targets.forEach((m, i) => { const share = i === 0 && targets.length > 1 ? 0.45 : 1 / targets.length; mins[m] = (mins[m] || 0) + Math.floor(minedTotal * share); });
      }
      next = { ...next, minerals: mins };
    }
    const intervalMs = botCheckInIntervalMs(next, profile, difficulty);
    const lastCheck = Number(next.lastBotCheckInAt || 0);
    const surgeStaggerMs = (((Number(next.id || 0) || 0) % 12) + 1) * 60 * 1000;
    const surgeCheck = newRoundSurge && (!lastCheck || now - lastCheck >= surgeStaggerMs);
    const scheduledCheck = !asleep && elapsed > 0 && (!lastCheck || now - lastCheck >= intervalMs);
    const checkedIn = Boolean(surgeCheck || scheduledCheck);
    const canAct = checkedIn;
    let action = next.lastBotAction || "No bot action yet.";
    if (checkedIn) {
      next = botCompleteDueOrders(next, now);
      action = next.lastBotCompleted ? `Checked in; ${next.lastBotCompleted}.` : "Checked in.";
      const buildOrder = botBuildPlan(next, doctrine, now);
      if (buildOrder) {
        next = { ...next, cards: (next.cards || 0) - buildOrder.paidCost, botBuildOrder: buildOrder };
        action = `Started build: ${fmt(totalBuildings(buildOrder.build))} buildings, cost ${fmt(buildOrder.paidCost)}, finishes in ${buildOrder.display}.`;
      }
      const trainOrder = botTrainPlan(next, doctrine, now);
      if (trainOrder) {
        let minerals = { ...emptyMinerals(), ...(next.minerals || {}) };
        if (trainOrder.useSpeed) {
          minerals.Endaurios = Math.max(0, (minerals.Endaurios || 0) - 2000);
          minerals.Armidi = Math.max(0, (minerals.Armidi || 0) - 2000);
        }
        next = { ...next, cards: (next.cards || 0) - trainOrder.cost, minerals, botTrainOrder: trainOrder };
        action = `Started training: ${fmt(trainOrder.train.reduce((a,b)=>a+b,0))} units, cost ${fmt(trainOrder.cost)}, finishes in ${trainOrder.display}${trainOrder.useSpeed ? " using speed minerals" : ""}.`;
      }
    }
    const seenOffsetMinutes = newRoundSurge ? ((Number(op.id) || 0) % 5) : (asleep ? (60 * (1 + ((Number(op.id) || 0) % 7))) : ((Number(op.id) || 0) % 18));
    const lastSeenAt = checkedIn ? now : (Number(next.lastSeenAt || 0) || now - seenOffsetMinutes * 60000);
    const lastBotCheckInAt = checkedIn ? now : Number(next.lastBotCheckInAt || 0);
    const sessionMs = checkedIn ? Math.min(12 * 60 * 1000, Math.max(4 * 60 * 1000, Math.floor(intervalMs / 3))) : 0;
    const botOnlineUntil = checkedIn ? now + sessionMs : Number(next.botOnlineUntil || 0);
    return { ...next, stack: botChooseStackOrder(next, doctrine), protectionHours: Math.max(0, Number(next.protectionHours || 0) - 0.5 * elapsed), lastSeenAt, lastBotCheckInAt, botOnlineUntil, lastSeen: lastSeenLabelFromAt(lastSeenAt, now), botDoctrine: doctrine, botAsleep: asleep, botOnlineNow: checkedIn || (botOnlineUntil > now && !asleep), lastBotAction: action };
  };
  const resolveBotRaid = (attacker, defender, options = {}) => {
    const now = options.now || Date.now();
    const usedRetalRecord = normaliseRetalRecord(options.usedRetalRecord);
    const usedRetal = Boolean(options.usedRetal || usedRetalRecord);
    const attackerRace = attacker.raceKey || attacker.race || "human";
    const defenderRace = defender.raceKey || defender.race || "human";
    const aStart = armyPower(attackerRace, attacker.army || []);
    const dStart = armyPower(defenderRace, defender.army || []);
    const legality = canAttackEntity(attacker, defender, roundSettings, now, { hasRetal: usedRetal });
    if (!legality.ok) return { attacker, defender, event: null, newRetals: [], newGrievances: [] };

    const atk = {
      name: attacker.name,
      race: attackerRace,
      army: [...(attacker.army || [0,0,0,0,0,0])],
      stack: [...(attacker.stack || [1,2,3,4,5,6])],
      startArmy: [...(attacker.army || [0,0,0,0,0,0])],
      killedRows: [0,0,0,0,0,0],
      freeLand: attacker.freeLand || 0,
      buildings: attacker.buildings || emptyBuildings(),
      energy: attacker.energy || 0,
      scienceLevels: attacker.scienceLevels || {},
      combatScienceLevel: attacker.scienceLevels?.combat || 0,
      showCombatDebug: adminMode
    };
    const def = {
      name: defender.name,
      race: defenderRace,
      army: [...(defender.army || [0,0,0,0,0,0])],
      stack: [...(defender.stack || [1,2,3,4,5,6])],
      startArmy: [...(defender.army || [0,0,0,0,0,0])],
      killedRows: [0,0,0,0,0,0],
      freeLand: defender.freeLand || 0,
      buildings: defender.buildings || emptyBuildings(),
      energy: defender.energy || 0,
      scienceLevels: defender.scienceLevels || {},
      combatScienceLevel: 0,
      showCombatDebug: adminMode
    };
    const attackerBeforeAudit = combatantAuditSnapshot(atk);
    const defenderBeforeAudit = combatantAuditSnapshot(def);
    const reportId = `bot-${now}-${attacker.id || attacker.name}-${defender.id || defender.name}`;

    let aLost = 0;
    let dLost = 0;
    const textMode = activeReportTextMode;
    const lines = [reportOpeningLine(textMode, atk.name, def.name)];
    const turretAudit = applyTurretVolley(def, atk, { now, reportId, disabled: false, disableCost: 0, textMode }, lines);
    aLost += turretAudit.damagePower || 0;
    for (let i = 0; i < 6; i++) {
      dLost += rowAttack(atk, def, atk.stack[i], lines);
      aLost += rowAttack(def, atk, def.stack[i], lines);
    }
    const aPct = aStart > 0 ? aLost / aStart * 100 : 0;
    const dPct = dStart > 0 ? dLost / dStart * 100 : 0;
    const attackerWon = aPct < dPct;
    const spoils = attackerWon ? Math.min(Math.max(10000, Math.floor((defender.cards || 0) * dPct / 100)), defender.cards || 0) : 0;
    const landSpoils = attackerWon ? calculateLandSpoils(totalEmpireLand(defender), dPct, dStart) : 0;
    const defenderLandLoss = attackerWon ? applyFlatLandLoss(defender, landSpoils) : applyFlatLandLoss(defender, 0);
    const actualLandSpoils = attackerWon ? defenderLandLoss.actualLandLost : 0;
    const xpGained = Math.max(1, Math.floor(dLost / 10000));
    const defenderXp = Math.max(0, Math.floor(aLost / 10000));
    const addedProtectionHours = calculateAttackProtectionHours(dPct);
    const existingProtectionMs = Math.max(0, Number(defender.protectionUntil || 0) - now);
    const newProtectionUntil = now + existingProtectionMs + addedProtectionHours * 3600000;
    const newProtectionHours = Math.max(0, (newProtectionUntil - now) / 3600000);
    const dedupeKey = makeBattleDedupeKey({ source: "bot", attacker, defender, now, usedRetalRecord, usedRetal, botRunId: options.botRunId || null });
    const dedupe = reserveBattleDedupe({
      key: dedupeKey,
      createdAt: now,
      source: "bot",
      actionType: battleDedupeActionType(usedRetalRecord, usedRetal),
      attacker: attacker.name,
      defender: defender.name,
      reportId,
      retalSourceKey: usedRetalRecord ? retalDedupeKey(usedRetalRecord) : null,
      botRunId: options.botRunId || null,
      botAttemptIndex: options.botAttemptIndex ?? null
    });
    if (!dedupe.ok) return { attacker, defender, event: null, newRetals: [], newGrievances: [], duplicateSkipped: dedupe.skipped };

    lines.push(reportBotSummaryLine(textMode, attacker.name, defender.name, attackerWon, actualLandSpoils, spoils, aLost, aPct, dLost, dPct));
    const botLandLossLine = landLossReportLine(defender.name, defenderLandLoss);
    if (botLandLossLine) lines.push(botLandLossLine);

    const attackerAfterRowsAudit = combatantAuditSnapshot(atk);
    const defenderAfterRowsAudit = combatantAuditSnapshot(def);
    const atkRevives = applyBattleRevives(atk, roundSettings, { role: "attacker", opponentRace: def.race, wordingMode: activeReportTextMode });
    const defRevives = applyBattleRevives(def, roundSettings, { role: "defender", opponentRace: atk.race, wordingMode: activeReportTextMode });
    atk.army = atkRevives.army;
    def.army = defRevives.army;
    const attackerAfterRevivesAudit = combatantAuditSnapshot(atk);
    const defenderAfterRevivesAudit = combatantAuditSnapshot(def);
    const audit = makeCombatAudit({
      source: "bot",
      now,
      reportId,
      attacker: atk,
      defender: def,
      attackerBefore: attackerBeforeAudit,
      defenderBefore: defenderBeforeAudit,
      attackerAfterRows: attackerAfterRowsAudit,
      defenderAfterRows: defenderAfterRowsAudit,
      attackerAfterRevives: attackerAfterRevivesAudit,
      defenderAfterRevives: defenderAfterRevivesAudit,
      attackerRevivePercent: atkRevives.revivePercent,
      defenderRevivePercent: defRevives.revivePercent,
      attackerBaseRevivePercent: atkRevives.baseRevivePercent,
      defenderBaseRevivePercent: defRevives.baseRevivePercent,
      attackerRaceReviveCap: atkRevives.raceReviveCap,
      defenderRaceReviveCap: defRevives.raceReviveCap,
      attackerRaceReviveCapReason: atkRevives.raceReviveCapReason,
      defenderRaceReviveCapReason: defRevives.raceReviveCapReason,
      attackerRaceDisadvantaged: atkRevives.raceDisadvantaged,
      defenderRaceDisadvantaged: defRevives.raceDisadvantaged,
      attackerRevivePowerPerLand: atkRevives.revivePowerPerLand,
      defenderRevivePowerPerLand: defRevives.revivePowerPerLand,
      attackerReviveDistanceFromIdeal: atkRevives.reviveDistanceFromIdeal,
      defenderReviveDistanceFromIdeal: defRevives.reviveDistanceFromIdeal,
      attackerLossPower: aLost,
      defenderLossPower: dLost,
      attackerLossPct: aPct,
      defenderLossPct: dPct,
      attackerWon,
      retal: usedRetal,
      retalRecord: usedRetalRecord,
      turretAudit,
      botRunId: options.botRunId || null,
      botAttemptIndex: options.botAttemptIndex ?? null,
      battleDedupeKey: dedupeKey,
      battleDedupeStatus: "processed",
      round: { gameName, roundProfile, roundSettings, gameSpeed: gameSpeed() }
    });
    const survivorLines = [...atkRevives.lines, ...defRevives.lines];
    if (survivorLines.length) lines.push(...survivorLines);
    if (adminMode) appendCombatAuditLines(lines, audit);
    lines.push(reportProtectionExperienceLine(textMode, defender.name, newProtectionHours, xpGained, "bot", attacker.name));
    lines.push(`Stack used: ${atk.stack.join(",")} — ${stackNames(atk.race, atk.stack)}`);

    const text = textMode === "modern"
      ? `${attacker.name} engaged ${defender.name}${usedRetal ? " by retaliation order" : ""}: ${Math.floor(dPct)}% damage, ${Math.floor(aPct)}% return, ${fmt(spoils)} Cards, ${fmt(actualLandSpoils)} land, ${fmt(xpGained)} experience.`
      : `${attacker.name} attacked ${defender.name}${usedRetal ? " using a retal" : ""}: ${Math.floor(dPct)}% damage for ${Math.floor(aPct)}% return, taking ${fmt(spoils)} Cardisium, ${fmt(actualLandSpoils)} land and gaining ${fmt(xpGained)} experience.`;
    const event = { type: "War", text, reportId, report: {
      id: reportId,
      text,
      attacker: attacker.name,
      defender: defender.name,
      attackerPower: aStart,
      defenderPower: dStart,
      attackerAlliance: attacker.alliance || "None",
      defenderAlliance: defender.alliance || "None",
      attackerLossPct: aPct,
      defenderLossPct: dPct,
      attackerWon,
      retal: usedRetal,
      retalRecordId: usedRetalRecord?.id || null,
      retalSourceReportId: usedRetalRecord?.sourceReportId || null,
      retalSourceKey: usedRetalRecord ? retalDedupeKey(usedRetalRecord) : null,
      battleDedupeKey: dedupeKey,
      audit,
      lines,
      reportTextMode: textMode,
      classicReportTextSensitivity: textMode === "classic" ? "high-sensitivity retained/copied classic report wording" : null,
      createdAt: now
    } };
    const defenderIsPlayer = Boolean(defender.isPlayer);
    const newRetals = (usedRetal || !attackerWon) ? [] : [makeRetalRecord({ holder: defender.name, holderAlliance: defender.alliance || "None", target: attacker.name, targetAlliance: attacker.alliance || "None", createdAt: now, sourceReportId: reportId, activatedAt: defenderIsPlayer ? now : null, expiresAt: defenderIsPlayer ? now + retalWindowMsForSettings(roundSettings) : null, waitingForNextSeenAfter: defenderIsPlayer ? null : now })];
    const newGrievances = [
      makeGrievanceRecord({ holder: defender.name, holderType: "player", target: attacker.name, targetType: "player", score: 2 + dPct / 10, reason: "attacked", createdAt: now })
    ];
    if (defender.alliance && defender.alliance !== "None") newGrievances.push(makeGrievanceRecord({ holder: defender.alliance, holderType: "alliance", target: attacker.name, targetType: "player", score: 3 + dPct / 8, reason: "member attacked", createdAt: now }));
    if (attacker.alliance && attacker.alliance !== "None") newGrievances.push(makeGrievanceRecord({ holder: defender.name, holderType: "player", target: attacker.alliance, targetType: "alliance", score: 1 + dPct / 20, reason: "attacker alliance", createdAt: now }));
    commitBattleDedupe(dedupeKey, { reportId, status: "processed" });
    return {
      attacker: clearAttackProtection({ ...attacker, ...battleRecordPatch(attacker, attackerWon), army: atk.army, energy: atk.energy, cards: (attacker.cards || 0) + spoils, freeLand: (attacker.freeLand || 0) + actualLandSpoils, experience: (attacker.experience || 0) + xpGained, totalExperience: (attacker.totalExperience ?? attacker.experience ?? 0) + xpGained, lastSeenAt: now, lastSeen: "Now" }),
      defender: { ...defenderLandLoss.entity, ...battleRecordPatch(defender, !attackerWon), army: def.army, energy: def.energy, cards: Math.max(0, (defender.cards || 0) - spoils), protectionHours: newProtectionHours, protectionUntil: newProtectionUntil, lastAttackedAt: now, experience: (defender.experience || 0) + defenderXp, totalExperience: (defender.totalExperience ?? defender.experience ?? 0) + defenderXp },
      event,
      newRetals,
      newGrievances
    };
  };

  const botTargetFromPlayer = (p) => ({
    id: p.id,
    name: p.name,
    raceKey: p.race,
    alliance: alliance?.name || "None",
    freeLand: p.freeLand,
    cards: p.cards,
    banked: p.banked,
    pop: p.pop,
    energy: p.energy,
    scienceLevels,
    army: p.army,
    stack: p.stack,
    buildings: p.buildings,
    protectionHours: p.protectionHours || 0,
    protectionUntil: p.protectionUntil || 0,
    lastAttackedAt: p.lastAttackedAt || 0,
    botAsleep: false,
    isPlayer: true
  });
  const botCanAttackCandidate = (attacker, target, now, activeRetals = []) => {
    const hasRetal = activeRetals.some((r) => retalMatches(r, attacker.name, target.name, now));
    return canAttackEntity(attacker, target, roundSettings, now, { hasRetal }).ok;
  };
  const botTargetScore = (attacker, target, now, activeRetals, grievanceList, allTargets) => {
    const hasRetal = activeRetals.some((r) => retalMatches(r, attacker.name, target.name, now));
    const grievance = grievanceScoreFor(grievanceList, attacker.name, attacker.alliance || "None", target.name, target.alliance || "None");
    const targetPower = armyPower(target.raceKey, target.army || []);
    const maxPower = Math.max(1, ...allTargets.map((t) => armyPower(t.raceKey, t.army || [])));
    const maxLand = Math.max(1, ...allTargets.map((t) => totalEmpireLand(t)));
    const leaderPressure = (targetPower >= maxPower * 0.98 ? 35 : 0) + (totalEmpireLand(target) >= maxLand * 0.98 ? 20 : 0);
    const outsiderPressure = !target.alliance || target.alliance === "None" ? 10 : 0;
    const allianceEnemyPressure = target.alliance && target.alliance !== "None" && attacker.alliance && attacker.alliance !== "None" && target.alliance !== attacker.alliance ? 4 : 0;
    return (hasRetal ? 10000 : 0) + grievance * 80 + leaderPressure + outsiderPressure + allianceEnemyPressure + Math.random() * 10;
  };

  function marketSellerAlliance(seller, ops = [], currentPlayerForBots = player) {
    if (seller === currentPlayerForBots.name) return alliance?.name || "None";
    const op = ops.find((candidate) => candidate.name === seller);
    return op?.alliance || "None";
  }
  function botMarketBasePrice(mineral, op) {
    const shop = shopPrices[mineral] || 33333;
    const idMod = ((Number(op?.id || 0) || 0) % 7) * 0.015;
    const mineralBias = SPEED_TRAIN_MINERALS.includes(mineral) ? 0.82 : LRC_MINERALS.includes(mineral) ? 0.78 : 0.70;
    return Math.max(1, Math.floor(shop * Math.min(0.95, mineralBias + idMod)));
  }
  function botMarketListingPrice(mineral, op, orders = [], ops = [], currentPlayerForBots = player) {
    const ownAlliance = op?.alliance || "None";
    const relevant = (orders || []).filter((order) => order.mineral === mineral && Number(order.quantity || 0) > 0 && Number(order.price || 0) > 0);
    const ownAllianceOrders = ownAlliance !== "None"
      ? relevant.filter((order) => marketSellerAlliance(order.seller, ops, currentPlayerForBots) === ownAlliance)
      : [];
    if (ownAllianceOrders.length) return Math.min(...ownAllianceOrders.map((order) => Number(order.price || 0)));
    const rivalOrders = relevant.filter((order) => marketSellerAlliance(order.seller, ops, currentPlayerForBots) !== ownAlliance || ownAlliance === "None");
    if (rivalOrders.length) {
      const bestRival = Math.min(...rivalOrders.map((order) => Number(order.price || 0)));
      const undercut = Math.max(1, Math.floor(bestRival * 0.02));
      return Math.max(1, Math.min(botMarketBasePrice(mineral, op), bestRival - undercut));
    }
    return botMarketBasePrice(mineral, op);
  }
  function scaledBotMarketQuantity(op, mineral, qtyHave) {
    const botPower = armyPower(op.raceKey, op.army || []);
    const empireLand = totalEmpireLand(op);
    const scale = Math.max(botPower / 30000000, empireLand / 50000, 0.5);
    if (SPEED_TRAIN_MINERALS.includes(mineral)) {
      const maxChunk = scale < 1 ? 2000 : scale < 2 ? 4000 : scale < 3 ? 8000 : 12000;
      const available = Math.max(0, Math.floor(qtyHave - 2000));
      return Math.floor(Math.min(available, maxChunk) / 2000) * 2000;
    }
    if (LRC_MINERALS.includes(mineral)) {
      if (botPower < 35000000 && empireLand < 45000) return 0;
      const maxChunk = scale < 2 ? 25000 : scale < 4 ? 50000 : 100000;
      const available = Math.max(0, Math.floor(qtyHave - 25000));
      return Math.floor(Math.min(available, maxChunk) / 25000) * 25000;
    }
    const multiple = scale < 1 ? 1000 : scale < 2 ? 2500 : 5000;
    const maxChunk = scale < 1 ? 5000 : scale < 2 ? 15000 : scale < 4 ? 35000 : 75000;
    const available = Math.max(0, Math.floor(qtyHave * 0.35));
    return Math.floor(Math.min(available, maxChunk) / multiple) * multiple;
  }
  function botMarketListingPlan(op, orders = [], ops = [], currentPlayerForBots = player) {
    const mins = { ...emptyMinerals(), ...(op.minerals || {}) };
    const botPower = armyPower(op.raceKey, op.army || []);
    const candidates = Object.entries(mins).map(([mineral, qtyHave]) => {
      if (!shopPrices[mineral] || qtyHave <= 0) return null;
      const quantity = scaledBotMarketQuantity(op, mineral, qtyHave);
      if (quantity <= 0) return null;
      if (SPEED_TRAIN_MINERALS.includes(mineral)) {
        const earlyBonus = botPower < 25000000 ? 60 : 20;
        return { mineral, quantity, weight: 120 + earlyBonus + Math.random() * 20 };
      }
      if (LRC_MINERALS.includes(mineral)) {
        if (Math.random() > 0.18) return null;
        return { mineral, quantity, weight: 25 + Math.min(45, botPower / 2000000) + Math.random() * 15 };
      }
      return { mineral, quantity, weight: Math.min(65, qtyHave / 3000) + Math.random() * 25 };
    }).filter(Boolean).sort((a, b) => b.weight - a.weight);
    if (!candidates.length) return null;
    const picked = candidates[0];
    return { ...picked, price: botMarketListingPrice(picked.mineral, op, orders, ops, currentPlayerForBots) };
  }

  const runActiveBots = (ops, tickEquivalent, now, currentPlayerForBots = player) => {
    if (!tickEquivalent || tickEquivalent <= 0) return { ops, events: [], marketListings: [], retalRecords, grievances, player: currentPlayerForBots };
    const difficulty = BOT_DIFFICULTY_PROFILES[botDifficulty] || BOT_DIFFICULTY_PROFILES.Normal;
    let next = ops.map((op) => evolveBotEconomy(op, tickEquivalent, now));
    const events = [];
    const retalWindow = retalWindowMsForSettings(roundSettings);
    let grievanceList = decayGrievanceRecords(grievances, now);
    let retalList = mergeRetalRecords((retalRecords || []).map((r) => {
      const holder = next.find((op) => op.name === r.holder);
      if (!r.usedAt && !r.activatedAt && botRetalShouldActivate(holder, now, r)) return { ...r, activatedAt: now, expiresAt: now + retalWindow };
      return r;
    }).filter((r) => now - Number(r.createdAt || now) < 7 * 24 * 60 * 60 * 1000), []);
    let playerCandidate = botTargetFromPlayer(currentPlayerForBots);
    let playerAfterBots = currentPlayerForBots;
    const attempts = Math.min(10, Math.max(1, Math.floor(tickEquivalent / 2)));
    const botRunId = `bot-run-${now}-${Math.floor(Math.random() * 100000)}`;
    const hitDefendersThisRun = new Set();
    for (let i = 0; i < attempts; i++) {
      if (Math.random() > difficulty.attackChance * 1.35) continue;
      const awake = next.filter((op) => Boolean(op.botOnlineNow || (Number(op.botOnlineUntil || 0) > now && !op.botAsleep)) && armyPower(op.raceKey, op.army || []) > 500000);
      if (!awake.length) continue;
      const attacker = awake[Math.floor(Math.random() * awake.length)];
      const allCandidates = [...next.filter((op) => op.name !== attacker.name), playerCandidate];
      const candidates = allCandidates.filter((target) => !hitDefendersThisRun.has(target.name) && botCanAttackCandidate(attacker, target, now, retalList));
      if (!candidates.length) continue;
      const sorted = candidates.map((target) => ({ target, score: botTargetScore(attacker, target, now, retalList, grievanceList, [...next, playerCandidate]) })).sort((a, b) => b.score - a.score);
      const defender = sorted[0].target;
      const usedRetalRecord = retalList.find((r) => retalMatches(r, attacker.name, defender.name, now));
      const result = resolveBotRaid(attacker, defender, { now, usedRetalRecord, botRunId, botAttemptIndex: i });
      if (!result.event) continue;
      hitDefendersThisRun.add(defender.name);
      next = next.map((op) => op.name === attacker.name ? clearAttackProtection(result.attacker) : op.name === defender.name ? result.defender : op);
      if (defender.isPlayer) {
        playerAfterBots = { ...playerAfterBots, army: result.defender.army, cards: result.defender.cards, freeLand: result.defender.freeLand, protectionHours: result.defender.protectionHours, protectionUntil: result.defender.protectionUntil, lastAttackedAt: result.defender.lastAttackedAt, energy: result.defender.energy, experience: result.defender.experience, totalExperience: result.defender.totalExperience, roundWins: result.defender.roundWins, roundLosses: result.defender.roundLosses, totalWins: result.defender.totalWins, totalLosses: result.defender.totalLosses };
        playerCandidate = botTargetFromPlayer(playerAfterBots);
      }
      if (usedRetalRecord) retalList = markRetalRecordServed(retalList, usedRetalRecord, now, result.event.reportId, Boolean(result.event.report?.attackerWon));
      retalList = mergeRetalRecords(result.newRetals || [], retalList);
      grievanceList = [...(result.newGrievances || []), ...grievanceList].slice(0, 300);
      events.push(result.event);
    }
    const marketListings = [];
    next.forEach((op) => {
      if (!Boolean(op.botOnlineNow || (Number(op.botOnlineUntil || 0) > now && !op.botAsleep)) || Math.random() > 0.08 * Math.min(4, Math.max(1, tickEquivalent))) return;
      const plan = botMarketListingPlan(op, [...marketOrders, ...marketListings], next, currentPlayerForBots);
      if (!plan) return;
      marketListings.push({ seller: op.name, mineral: plan.mineral, quantity: plan.quantity, price: plan.price });
      op.minerals = { ...op.minerals, [plan.mineral]: Math.max(0, (op.minerals?.[plan.mineral] || 0) - plan.quantity) };
      events.push({ type: "Market", text: `${op.name} listed ${fmt(plan.quantity)} ${plan.mineral} on the market at ${fmt(plan.price)} Cardisium each.` });
    });
    return { ops: next, events, marketListings, retalRecords: retalList, grievances: grievanceList, player: playerAfterBots };
  };
  const getDemoPlayers = () => [{ id: player.id, name: player.name, race: races[player.race].name, power, land, pop: player.pop, alliance: alliance ? alliance.name : "None", ...normalisePlayerRecords(player), protectionHours: player.protectionHours || 0, protectionUntil: player.protectionUntil || 0, lastSeen: lastSeenLabelFromAt(player.previousClickAt || player.lastClickAt || player.lastUpdatedAt, displayNow) }, ...demoOpponents.map(publicOpponent)];
  const activeBuildSpeedFactor = () => normaliseBuildSpeedFactor(buildSpeedFactor);
  const activeBuildSpeedMultiplier = () => buildSpeedMultiplier(buildSpeedFactor);
  const activeConstructionMultiplier = () => constructionFactoryMultiplier(player.buildings, factoryAllocation);
  const activeConstructionBaseSeconds = (baseCost) => constructionDurationSeconds(baseCost, player.buildings, factoryAllocation);
  const activeConstructionDurationSeconds = (baseCost) => speedFactorBuildSeconds(baseCost, buildSpeedFactor, player.buildings, factoryAllocation);
  const activeConstructionCost = (baseCost) => speedFactorBuildCost(baseCost, buildSpeedFactor);
  const getDemoAlliances = () => { const groups = {}; getDemoPlayers().forEach((p) => { if (p.alliance && p.alliance !== "None") { groups[p.alliance] = groups[p.alliance] || []; groups[p.alliance].push(p); } }); return Object.entries(groups).map(([name, members]) => ({ name, members, leader: name === (alliance && alliance.name) ? player.name : members[0].name, totalPower: members.reduce((s, m) => s + m.power, 0), totalLand: members.reduce((s, m) => s + m.land, 0), diplomacy: diplomacyStateForAlliance(name), announcement: name === (alliance && alliance.name) ? alliance.announcement : "..." })); };
  function openProfile(name) { setProfileName(name); setPage("profile"); }
  function openAllianceProfile(name) { if (name && name !== "None") { setAllianceProfileName(name); setPage("allianceProfile"); } }
  function PlayerLink({ name }) { const label = safeDisplay(name); const isSelf = label === player.name; return <button className={`${isSelf ? "antro-self-name" : "font-bold text-orange-200"} hover:text-orange-50 underline`} onClick={() => openProfile(label)}>{label}</button>; }
  function AllianceLink({ name }) { const label = safeDisplay(name); return !label || label === "None" ? <span>None</span> : <button className="font-bold text-orange-300 hover:text-orange-50 underline" onClick={() => openAllianceProfile(label)}>{label}</button>; }
  const ownWarSideKeys = () => {
    const selfKey = diplomacyKey("player", player.name);
    if (!alliance) return [selfKey];
    const allianceKey = diplomacyKey("alliance", alliance.name);
    return alliance.createdByPlayer ? [allianceKey, selfKey] : [allianceKey];
  };
  const ownSideKeys = () => ownWarSideKeys();
  const ownRequestSideKeys = () => [currentDiplomacySide()];
  const ownAllySideKeys = () => alliance ? [diplomacyKey("alliance", alliance.name)] : [diplomacyKey("player", player.name)];
  const allianceSideKeys = (name) => [diplomacyKey("alliance", name)];
  const playerSideKeys = (p) => [diplomacyKey("player", p.name), p.alliance && p.alliance !== "None" ? diplomacyKey("alliance", p.alliance) : null].filter(Boolean);
  const sidePlayerName = (sideKey) => { const [type, ...rest] = String(sideKey || "").split(":"); return type === "player" ? rest.join(":") : ""; };
  const playerIsAllianceMember = (name) => {
    const label = cleanStoredName(name, "");
    if (!label || label === player.name) return false;
    const found = getDemoPlayers().find((p) => p.name === label);
    return Boolean(found && found.alliance && found.alliance !== "None");
  };
  const diplomacyRecordTargetsAllianceMemberPlayer = (record) => [record?.from, record?.to, record?.a, record?.b].filter(Boolean).some((side) => playerIsAllianceMember(sidePlayerName(side)));
  const validActiveWars = () => activeWars.filter((w) => !diplomacyRecordTargetsAllianceMemberPlayer(w));
  const validAlliedStatuses = () => alliedStatuses.filter((al) => !diplomacyRecordTargetsAllianceMemberPlayer(al));
  const sidesAreAtWar = (aKeys, bKeys) => validActiveWars().some((w) => aKeys.some((a) => bKeys.some((b) => warPairKey(a, b) === warPairKey(w.from, w.to))));
  const sidesAreAllied = (aKeys, bKeys) => validAlliedStatuses().some((al) => aKeys.some((a) => bKeys.some((b) => warPairKey(a, b) === warPairKey(al.a, al.b))));
  const diplomacyStateForAlliance = (name) => { const targetKeys = allianceSideKeys(name); if (sidesAreAtWar(ownWarSideKeys(), targetKeys)) return "War"; if (sidesAreAllied(ownAllySideKeys(), targetKeys)) return "Ally"; return "Neutral"; };
  const isAtWarWithPlayer = (p) => sidesAreAtWar(ownWarSideKeys(), playerSideKeys(p));
  const isAlliedWithPlayer = (p) => sidesAreAllied(ownAllySideKeys(), playerSideKeys(p));
  const activePlayerRetals = (now = displayNow) => mergeRetalRecords(retalRecords || [], []).filter((r) => retalMatches(r, player.name, r.target, now));
  const getRetalTargetEntries = (now = displayNow) => activePlayerRetals(now).map((r) => {
    const base = getDemoPlayers().find((p) => p.name === r.target) || getPrivateOpponentByName(r.target);
    if (!base) return null;
    const powerValue = base.power ?? publicPowerForEmpire(base);
    return { ...base, power: powerValue, retalEntry: true, retalId: r.id, retalSourceKey: retalDedupeKey(r), selectValue: `retal:${r.id}`, retalCountdown: activeRetalCountdownLabel(r, now) };
  }).filter(Boolean);
  const getSelectableTargets = () => { const min = Math.floor(power * 2 / 3); const normalMax = Math.floor(power * 1.5); const warMax = Math.floor(power * 2); const now = Date.now(); if (power < 500000) return []; const normal = getDemoPlayers().filter((p) => { if (p.name === player.name || isAlliedWithPlayer(p) || isAttackProtected(p) || isRecentAttackBlocked(p, roundSettings, now) || p.power < 500000 || p.power < min) return false; const atWar = isAtWarWithPlayer(p); return p.power <= normalMax || (atWar && p.power <= warMax); }).map((p) => ({ ...p, selectValue: p.name, warRange: p.power > normalMax && isAtWarWithPlayer(p), atWar: isAtWarWithPlayer(p) })); return [...normal, ...getRetalTargetEntries(displayNow)]; };
  const getAllWarCandidates = () => { const min = Math.floor(power * 2 / 3); const normalMax = Math.floor(power * 1.5); const warMax = Math.floor(power * 2); const now = Date.now(); if (power < 500000) return []; return getDemoPlayers().filter((p) => { if (p.name === player.name || isAlliedWithPlayer(p) || p.power < 500000 || p.power < min) return false; const atWar = isAtWarWithPlayer(p); return p.power <= normalMax || (atWar && p.power <= warMax); }).map((p) => ({ ...p, warRange: p.power > normalMax && isAtWarWithPlayer(p), protected: isAttackProtected(p), recentBlocked: isRecentAttackBlocked(p, roundSettings, now), atWar: isAtWarWithPlayer(p) })); };
  const getSelectedTarget = () => getSelectableTargets().find((p) => (p.selectValue || p.name) === selectedTargetName) || getSelectableTargets()[0] || null;
  const getAttackTargetByName = (name) => {
    const text = String(name || "");
    if (text.startsWith("retal:")) {
      const id = text.slice(6);
      const r = activePlayerRetals(displayNow).find((x) => x.id === id);
      if (!r) return null;
      const base = getDemoPlayers().find((p) => p.name === r.target) || getPrivateOpponentByName(r.target);
      return base ? { ...base, retalEntry: true, retalId: r.id, retalSourceKey: retalDedupeKey(r), selectValue: text } : null;
    }
    return getSelectableTargets().find((p) => p.name === name && !p.retalEntry) || null;
  };
  const getPrivateOpponentByName = (name) => demoOpponents.find((o) => o.name === name) || null;
  const selectTargetName = (name) => { setSelectedTargetName(name); setSpyTarget(name); setMessageTo(name); };

  function completeDuePageOrders(basePlayer, now, requestedPage) { let next = { ...basePlayer }; const completed = []; const notices = []; if (requestedPage === "build" && next.buildOrder?.finishAt && now >= next.buildOrder.finishAt) { const b = { ...next.buildings }; const finished = next.buildOrder.build; Object.entries(finished).forEach(([id, q]) => { b[id] = (b[id] || 0) + q; }); next = { ...next, freeLand: (next.freeLand || 0) - totalBuildings(finished), buildings: b, buildOrder: null }; completed.push("construction"); notices.push({ page: "build", title: "Construction Complete", message: "Your construction has been completed.", rows: Object.entries(finished).filter(([, q]) => q > 0).map(([id, q]) => [buildingOrder.find(([bid]) => bid === id)?.[1] || id, fmt(q)]) }); } if (requestedPage === "barracks" && next.trainOrder?.finishAt && now >= next.trainOrder.finishAt) { const trainOrder = next.trainOrder; const trained = trainOrder.train; next = awardCompletedTrysaurWarDrums({ ...next, army: next.army.map((v, i) => v + trained[i]), trainOrder: null }, trainOrder, activeReportTextMode); completed.push("training"); notices.push({ page: "barracks", title: "Training Complete", message: "Your army training has been completed.", rows: trained.map((q, i) => [races[next.race].units[i][0], fmt(q)]).filter(([, q]) => q !== "0") }); } if (requestedPage === "explore" && next.exploreOrder?.finishAt && now >= next.exploreOrder.finishAt) { const gain = next.exploreOrder.gain; next = { ...next, freeLand: next.freeLand + gain, exploreOrder: null }; completed.push("explore"); notices.push({ page: "explore", title: "Explore Complete", message: `Your scouts have finished exploring and you have gained ${fmt(gain)} land.`, rows: [["Land gained", fmt(gain)]] }); } if (requestedPage === "science" && scienceOrder?.finishAt && now >= scienceOrder.finishAt) { const field = scienceOrder.field; setScienceLevels((levels) => ({ ...levels, [field]: (levels[field] || 0) + 1 })); setScienceOrder(null); completed.push(`${scienceLabel(field)} research`); notices.push({ page: "science", title: "Research Complete", message: `${scienceLabel(field)} research has been completed.`, rows: [["Field", scienceLabel(field)]] }); } return { player: next, completed, notices }; }
  function calculatePageUpdate(basePlayer, now, requestedPage) { const last = basePlayer.lastUpdatedAt || now; let next = { ...basePlayer }; const completed = []; const due = completeDuePageOrders(next, now, requestedPage); next = due.player; completed.push(...due.completed); const notices = due.notices || []; const elapsedSeconds = Math.max(0, (now - last) / 1000); const tickEquivalent = Math.min(500, tickEquivalentForElapsed(elapsedSeconds, gameSpeed())); if (tickEquivalent > 0) { next = applyElapsedProductionPure(next, tickEquivalent, mineAllocation, factoryAllocation, { ...scienceLevels, wordingMode: activeReportTextMode }); next.lastUpdatedAt = now; } return { player: next, ticks: tickEquivalent, completed, notices, elapsedSeconds }; }
  function missileImpactAlreadyProcessed(id) { return processedMissileImpactIdsRef.current.includes(String(id)); }
  function markMissileImpactProcessed(id) {
    const key = String(id);
    if (!processedMissileImpactIdsRef.current.includes(key)) {
      processedMissileImpactIdsRef.current = [key, ...processedMissileImpactIdsRef.current].slice(0, 200);
    }
  }
  function processArrivedMissiles(now, basePlayer) {
    let next = { ...basePlayer };
    const arrivedOutgoing = outgoingMissiles.filter((o) => o.arrivesAt && now >= o.arrivesAt && !missileImpactAlreadyProcessed(o.id));
    const arrivedIncoming = incomingMissiles.filter((o) => o.arrivesAt && now >= o.arrivesAt && !missileImpactAlreadyProcessed(o.id));

    if (arrivedOutgoing.length) {
      let nextOpponents = demoOpponents;
      const impactMessages = [];

      arrivedOutgoing.forEach((order) => {
        markMissileImpactProcessed(order.id);
        const target = nextOpponents.find((op) => op.name === order.target);
        if (!target) {
          impactMessages.push(`${fmt(order.quantity)} missiles launched by ${player.name} reached ${order.target}, but the target state could not be found.`);
          return;
        }
        const total = Math.max(0, Math.floor(Number(order.quantity || 0)));
        const intercepted = interceptedMissileCount(target, total);
        const hitCount = Math.max(0, total - intercepted);
        const damage = damageBuildingsWithMissiles(target.buildings, hitCount);
        const damageText = damage.destroyed.length ? damage.destroyed.join(", ") : "no buildings destroyed";
        nextOpponents = nextOpponents.map((op) => op.name === order.target ? { ...op, buildings: damage.buildings } : op);
        impactMessages.push(`${fmt(total)} missiles launched by ${player.name} impacted ${order.target}. Intercepted: ${fmt(intercepted)}. Destroyed: ${damageText}.`);
        addSystemInboxMessage("Missiles", `Your ${fmt(total)} missile${total === 1 ? "" : "s"} impacted ${order.target}. Intercepted: ${fmt(intercepted)}. Destroyed: ${damageText}.`, { kind: "missiles", createdAt: now, intercepted, destroyed: damage.destroyed });
      });

      setDemoOpponents(nextOpponents);
      setOutgoingMissiles((orders) => orders.filter((o) => !arrivedOutgoing.some((a) => a.id === o.id)));
      impactMessages.forEach((message) => addLog(message, "Missiles"));
    }

    if (arrivedIncoming.length) {
      arrivedIncoming.forEach((order) => markMissileImpactProcessed(order.id));
      const total = arrivedIncoming.reduce((s, o) => s + Number(o.quantity || 0), 0);
      const intercepted = interceptedMissileCount(next, total);
      const incomingSources = [...new Set(arrivedIncoming.map((o) => o.source || "Unknown"))].join(", ");
      const damage = damageBuildingsWithMissiles(next.buildings, Math.max(0, total - intercepted));
      next = { ...next, buildings: damage.buildings };
      const damageText = damage.destroyed.length ? damage.destroyed.join(", ") : "no buildings destroyed";
      const body = `${incomingSources} launched ${fmt(total)} missile${total === 1 ? "" : "s"} at you. Intercepted: ${fmt(intercepted)}. Destroyed: ${damageText}.`;
      addLog(`${fmt(total)} missiles from ${incomingSources} impacted ${player.name}. Intercepted: ${fmt(intercepted)}. Destroyed: ${damageText}.`, "Missiles");
      addSystemInboxMessage("Missiles", body, { kind: "missiles", createdAt: now, intercepted, destroyed: damage.destroyed });
      setIncomingMissiles((orders) => orders.filter((o) => !arrivedIncoming.some((a) => a.id === o.id)));
    }

    return { player: next, outgoingCount: arrivedOutgoing.length, incomingCount: arrivedIncoming.length };
  }
  function runPageUpdate(requestedPage = page) {
    const now = Date.now();
    let summary = null;
    setPlayer((current) => {
      const update = calculatePageUpdate(current, now, requestedPage);
      const missileUpdate = processArrivedMissiles(now, update.player);
      summary = { ...update, player: missileUpdate.player, outgoingCount: missileUpdate.outgoingCount, incomingCount: missileUpdate.incomingCount };
      if (update.ticks > 0) setDemoOpponents((ops) => {
        const botUpdate = runActiveBots(ops.map((op) => decayProtection(op, update.ticks)), update.ticks, now, missileUpdate.player);
        setTimeout(() => {
          setRetalRecords((current) => mergeRetalRecords(botUpdate.retalRecords || [], current));
          setGrievances(botUpdate.grievances || []);
          if (botUpdate.player && botUpdate.player !== missileUpdate.player) {
            setPlayer((cur) => ({
              ...cur,
              army: botUpdate.player.army || cur.army,
              cards: botUpdate.player.cards ?? cur.cards,
              freeLand: botUpdate.player.freeLand ?? cur.freeLand,
              buildings: botUpdate.player.buildings || cur.buildings,
              protectionHours: botUpdate.player.protectionHours ?? cur.protectionHours,
              protectionUntil: botUpdate.player.protectionUntil ?? cur.protectionUntil,
              lastAttackedAt: botUpdate.player.lastAttackedAt || cur.lastAttackedAt,
              experience: botUpdate.player.experience ?? cur.experience,
              totalExperience: botUpdate.player.totalExperience ?? cur.totalExperience,
              roundWins: botUpdate.player.roundWins ?? cur.roundWins,
              roundLosses: botUpdate.player.roundLosses ?? cur.roundLosses,
              totalWins: botUpdate.player.totalWins ?? cur.totalWins,
              totalLosses: botUpdate.player.totalLosses ?? cur.totalLosses
            }));
          }
          const reports = botUpdate.events.filter((e) => e.report).map((e) => e.report);
          if (reports.length) setWorldReports((oldReports) => [...reports, ...oldReports].slice(0, 2000));
          botUpdate.events.forEach((e) => {
            addLog(e.text, e.type || "War");
            if (e.report && e.report.defender === player.name) {
              addSystemInboxMessage("War", battleReportMessageBody(e.report), { kind: "war", reportId: e.report.id, createdAt: e.report.createdAt || now });
            }
          });
          setMarketOrders((orders) => {
            const saleResult = processBotMarketSalesForPlayer(orders, botUpdate.ops || [], now);
            if (saleResult.sales.length) {
              setDemoOpponents(saleResult.ops);
              const cardGain = saleResult.sales.reduce((sum, sale) => sum + sale.total, 0);
              setPlayer((cur) => ({ ...cur, cards: (cur.cards || 0) + cardGain }));
              saleResult.sales.forEach((sale) => addSystemInboxMessage("Market", marketSaleMessageBody(sale), { kind: "market", createdAt: sale.createdAt || now }));
            }
            const baseId = Math.max(0, ...saleResult.orders.map((o) => o.id || 0));
            const additions = (botUpdate.marketListings || []).map((o, i) => ({ id: baseId + i + 1, ...o }));
            return [...additions, ...saleResult.orders].slice(0, 60);
          });
        }, 0);
        return botUpdate.ops;
      });
      return { ...missileUpdate.player, previousClickAt: current.lastClickAt || current.previousClickAt || current.lastUpdatedAt || now, lastClickAt: now };
    });
    setTimeout(() => {
      if (!summary) return;
      const parts = [];
      if (summary.completed.length) parts.push(`${summary.completed.join(", ")} complete`);
      if (summary.ticks) parts.push(`${summary.ticks.toFixed(3)} tick-equivalent elapsed production`);
      if (summary.outgoingCount) parts.push(`${fmt(summary.outgoingCount)} outgoing missile impact${summary.outgoingCount === 1 ? "" : "s"}`);
      if (summary.incomingCount) parts.push(`${fmt(summary.incomingCount)} incoming missile impact${summary.incomingCount === 1 ? "" : "s"}`);
      const message = parts.length ? `Page request update: ${parts.join("; ")}.` : `Page request update: no elapsed production due yet. Elapsed ${summary.elapsedSeconds.toFixed(3)}s.`;
      if (summary.notices && summary.notices.length) setPageCompletionNotice(summary.notices[0]);
      setLastUpdateSummary(parts.length ? `${message} Elapsed ${summary.elapsedSeconds.toFixed(1)}s; production is pro-rata, 1.000 tick-equivalent = ${realSecondsPerTick().toFixed(1)}s.` : message);
    }, 0);
  }
  function navigatePage(nextPage) { if (pageCompletionNotice?.page === nextPage) setPageCompletionNotice(null); setPageFlash(true); setTimeout(() => setPageFlash(false), 120); runPageUpdate(nextPage); setPage(nextPage); }

  function bonusSecondsRemaining() { if (!player.bonusClaimedAt) return 0; return Math.max(0, Math.floor((player.bonusClaimedAt + 24 * 3600 * 1000 - Date.now()) / 1000)); }
  function bonusCountdownLabel() { const s = bonusSecondsRemaining(); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; }
  function openBonusWindow() { const win = window.open("", "antrophai_bonus", "width=420,height=260"); if (!win) return addLog("Bonus window was blocked by the browser."); win.document.write(`<!doctype html><html><head><title>AntrophAI Bonus</title><style>body{background:#050100;color:#ffb15c;font-family:monospace;padding:24px}h1{color:#ffcc80}</style></head><body><h1>welcome to 2001</h1><p>Classic bonus link placeholder.</p><p>You may now return to AntrophAI and claim your bonus.</p></body></html>`); win.document.close(); }
  function claimBonus() { const remaining = bonusSecondsRemaining(); if (remaining > 0) return addLog(`Bonus is not ready yet. Time remaining: ${bonusCountdownLabel()}.`); setPlayer((p) => ({ ...p, cards: p.cards + 500000, bonusClaimed: true, bonusClaimedAt: Date.now() })); addLog("You follow the bonus link and receive 500,000 Cardisium."); }
  function trainOrderBaseCost(order, raceKey = player.race) {
    if (!order) return 0;
    if (Number.isFinite(Number(order.cost))) return Math.floor(Number(order.cost));
    const race = races[raceKey] || races.human;
    return race.units.reduce((sum, [, cost], i) => sum + (order.train?.[i] || 0) * cost, 0);
  }
  function trainOrderRefund(order, raceKey = player.race) {
    return Math.floor(trainOrderBaseCost(order, raceKey) / 2);
  }
  function constructionCancelRefund(order) {
    if (!order) return 0;
    const base = Number.isFinite(Number(order.baseCost)) ? Number(order.baseCost) : buildCost(order.build || {});
    return Math.floor(Math.max(0, base) / 2);
  }
  function cancelConstructionOrder() {
    const order = player.buildOrder;
    if (!order) return addLog("There is no construction order to cancel.");
    const refund = constructionCancelRefund(order);
    setPlayer((p) => ({ ...p, cards: (p.cards || 0) + refund, buildOrder: null }));
    addLog(`Construction cancelled. ${fmt(refund)} Cardisium refunded (half base cost; speed premium lost).`);
  }
  function cancelTrainingOrder() {
    const order = player.trainOrder;
    if (!order) return addLog("There is no training order to cancel.");
    const refund = trainOrderRefund(order, player.race);
    setPlayer((p) => ({ ...p, cards: (p.cards || 0) + refund, trainOrder: null }));
    addLog(`Training cancelled. ${fmt(refund)} Cardisium refunded (half training cost; speed minerals are not returned).`);
  }
  function cancelExploreOrder() {
    const order = player.exploreOrder;
    if (!order) return addLog("There is no exploration order to cancel.");
    const refund = Math.floor(Number(order.cards || 0));
    setPlayer((p) => ({ ...p, cards: (p.cards || 0) + refund, exploreOrder: null }));
    addLog(`Exploration cancelled. ${fmt(refund)} Cardisium refunded and no land gained.`);
  }
  function cancelScienceOrder() {
    if (!scienceOrder) return addLog("There is no science research order to cancel.");
    const field = scienceLabel(scienceOrder.field);
    setScienceOrder(null);
    addLog(`${field} research cancelled. No science level was gained.`);
  }
  function cancelAllianceBankOrder() {
    if (!alliance?.bankOrder) return addLog("There is no alliance bank construction order to cancel.");
    const order = alliance.bankOrder;
    const refund = Math.floor(Number(order.cost || 0));
    const landReturned = parseQty(order.quantity);
    setPlayer((p) => ({ ...p, cards: (p.cards || 0) + refund }));
    setAlliance((a) => normaliseAlliance({ ...a, bankLand: (a.bankLand || 0) + landReturned, bankOrder: null }));
    addLog(`Alliance bank construction cancelled. ${fmt(refund)} Cardisium refunded and ${fmt(landReturned)} alliance land returned.`);
  }
  function cancelAllOrders() {
    const buildRefund = player.buildOrder ? constructionCancelRefund(player.buildOrder) : 0;
    const trainRefund = player.trainOrder ? trainOrderRefund(player.trainOrder, player.race) : 0;
    const exploreRefund = player.exploreOrder ? Math.floor(Number(player.exploreOrder.cards || 0)) : 0;
    const lostSpeedMinerals = Boolean(player.trainOrder?.speedMinerals);
    const allianceRefund = alliance?.bankOrder ? Math.floor(Number(alliance.bankOrder.cost || 0)) : 0;
    const allianceLandReturned = alliance?.bankOrder ? parseQty(alliance.bankOrder.quantity) : 0;
    const hadScience = Boolean(scienceOrder);
    const any = player.buildOrder || player.trainOrder || player.exploreOrder || scienceOrder || alliance?.bankOrder;
    if (!any) return addLog("There are no active orders to cancel.");
    setPlayer((p) => ({
      ...p,
      cards: (p.cards || 0) + buildRefund + trainRefund + exploreRefund + allianceRefund,
      minerals: { ...p.minerals },
      buildOrder: null,
      trainOrder: null,
      exploreOrder: null
    }));
    if (scienceOrder) setScienceOrder(null);
    if (alliance?.bankOrder) setAlliance((a) => normaliseAlliance({ ...a, bankLand: (a.bankLand || 0) + allianceLandReturned, bankOrder: null }));
    addLog(`All active orders cancelled. Refunded ${fmt(buildRefund + trainRefund + exploreRefund + allianceRefund)} Cardisium${lostSpeedMinerals ? "; speed-training minerals were not returned" : ""}${hadScience ? "; science research cancelled" : ""}.`);
  }
  function renderPendingOrderPanel(title, noun, finishAt, cancelOne) {
    return <Panel title={title}><p className="text-orange-200 mb-3">{staticFinishMessage(noun, finishAt, displayNow)}</p><div className="flex gap-2 flex-wrap"><button className="classic-btn antro-action-btn" onClick={cancelOne}>Cancel Order</button></div></Panel>;
  }
  function addPrototypeCards() { setPlayer((p) => ({ ...p, cards: p.cards + 10000000 })); addLog("Prototype helper: 10,000,000 Cardisium added."); }
  function startDay1Build() { const baseCost = buildCost(day1Build); const cost = activeConstructionCost(baseCost); if (player.buildOrder) return addLog("You already have a construction order running."); if (player.freeLand < 1000) return addLog("You do not have enough free land."); if (player.cards < cost) return addLog(`You need ${fmt(cost)} Cardisium.`); const seconds = activeConstructionDurationSeconds(baseCost); const multiplier = activeConstructionMultiplier(); const speed = activeBuildSpeedFactor(); const speedMultiplier = activeBuildSpeedMultiplier(); setPlayer((p) => ({ ...p, cards: p.cards - cost, buildOrder: { build: day1Build, display: oldTime(seconds), finishAt: Date.now() + realMillisecondsForGameSeconds(seconds), constructionMultiplier: multiplier, speedFactor: speed, speedMultiplier, baseCost, paidCost: cost } })); addLog(`You have spent ${fmt(cost)} cards on construction which will be finished in ${durationHms(seconds / gameSpeed())}.`, "Other"); }
  function startCustomBuild() { const build = Object.fromEntries(Object.entries(buildForm).map(([id, value]) => [id, parseQty(value)])); const qty = totalBuildings(build); const baseCost = buildCost(build); const cost = activeConstructionCost(baseCost); if (qty <= 0) return addLog("Enter at least one building to construct."); if (player.buildOrder) return addLog("You already have a construction order running."); if (qty > player.freeLand) return addLog(`You only have ${fmt(player.freeLand)} free land.`); if (cost > player.cards) return addLog(`You need ${fmt(cost)} Cardisium for this construction.`); const seconds = activeConstructionDurationSeconds(baseCost); const multiplier = activeConstructionMultiplier(); const speed = activeBuildSpeedFactor(); const speedMultiplier = activeBuildSpeedMultiplier(); setPlayer((p) => ({ ...p, cards: p.cards - cost, buildOrder: { build, display: oldTime(seconds), finishAt: Date.now() + realMillisecondsForGameSeconds(seconds), constructionMultiplier: multiplier, speedFactor: speed, speedMultiplier, baseCost, paidCost: cost } })); addLog(`You have spent ${fmt(cost)} cards on construction which will be finished in ${durationHms(seconds / gameSpeed())}.`, "Other"); }
  function completeBuild() { if (!player.buildOrder) return addLog("There is no construction order to complete."); const b = { ...player.buildings }; const finished = player.buildOrder.build; Object.entries(finished).forEach(([id, q]) => { b[id] = (b[id] || 0) + q; }); setPlayer((p) => ({ ...p, freeLand: (p.freeLand || 0) - totalBuildings(finished), buildings: b, buildOrder: null })); addLog("Your construction has been completed."); }

  function destroyBuildings() {
    const requested = Object.fromEntries(Object.entries(destroyForm).map(([id, value]) => [id, parseQty(value)]));
    const qty = totalBuildings(requested);
    if (qty <= 0) return addLog("Enter at least one building to destroy.");
    const invalid = buildingOrder.find(([id]) => requested[id] > (player.buildings[id] || 0));
    if (invalid) return addLog(`You only have ${fmt(player.buildings[invalid[0]] || 0)} ${invalid[1]}.`);
    setPlayer((p) => {
      const nextBuildings = { ...p.buildings };
      Object.entries(requested).forEach(([id, q]) => { nextBuildings[id] = Math.max(0, (nextBuildings[id] || 0) - q); });
      return { ...p, buildings: nextBuildings, freeLand: (p.freeLand || 0) + qty };
    });
    setDestroyForm(emptyBuildForm());
    addLog(`You destroyed ${fmt(qty)} buildings. ${fmt(qty)} land returned to free land.`);
  }
  function destroyAllBuildings() {
    const existing = { ...emptyBuildings(), ...player.buildings };
    const qty = totalBuildings(existing);
    if (qty <= 0) return addLog("You have no buildings to destroy.");
    setDestroyForm(Object.fromEntries(buildingOrder.map(([id]) => [id, String(existing[id] || 0)])));
  }
  function disbandUnits() {
    const requested = disbandForm.map(parseQty);
    const qty = requested.reduce((a, b) => a + b, 0);
    if (qty <= 0) return addLog("Enter at least one unit to disband.");
    const invalidIndex = requested.findIndex((q, i) => q > (player.army[i] || 0));
    if (invalidIndex >= 0) return addLog(`You only have ${fmt(player.army[invalidIndex] || 0)} ${races[player.race].units[invalidIndex][0]}.`);
    const disbandedPower = requested.reduce((sum, q, i) => sum + q * races[player.race].units[i][1], 0);
    setPlayer((p) => ({ ...p, army: p.army.map((v, i) => Math.max(0, v - requested[i])) }));
    setDisbandForm(["", "", "", "", "", ""]);
    addLog(`You disbanded ${fmt(qty)} units and lost ${fmt(disbandedPower)} army power. No Cardisium was refunded.`);
  }
  function disbandAllUnits() {
    const totalUnits = player.army.reduce((a, b) => a + b, 0);
    if (totalUnits <= 0) return addLog("You have no units to disband.");
    setDisbandForm(player.army.map((q) => String(q || 0)));
  }

  function estimateExploreGain(hours, spend = player.cards, landNow = Math.max(1, land), explorer = player) { const h = Math.max(1, Math.floor(Number(hours) || 0)); const cardFactor = Math.sqrt(Math.max(0.01, spend / 1000000)); const landPenalty = Math.sqrt(1000 / Math.max(1000, landNow)); const scannerBonus = scannerExploreMultiplier(explorer); return Math.max(1, Math.floor(120 * Math.sqrt(h) * cardFactor * landPenalty * scannerBonus)); }
  function startExplore(hoursArg = exploreHours, cardsArg = exploreCards) { const hours = Math.floor(Number(hoursArg)); if (!Number.isFinite(hours) || hours <= 0) return addLog("Enter a whole number of explore hours."); if (player.exploreOrder) return addLog("You already have an explore running."); if (player.cards <= 0) return addLog(`You need ${currencyLabel} to explore.`); const requestedSpend = parseQty(cardsArg); if (!Number.isFinite(requestedSpend) || requestedSpend <= 0) return addLog(`Enter how many ${currencyLabel} to spend on exploring.`); if (requestedSpend > player.cards) return addLog(`You only have ${fmt(player.cards)} ${currencyLabel} available.`); const spend = requestedSpend; const rawGain = estimateExploreGain(hours, spend); if (rawGain > land) return addLog(`Explore rejected: estimated return ${fmt(rawGain)} land would more than double your empire. Maximum allowed return is your existing land: ${fmt(land)}.`); setPlayer((p) => ({ ...p, cards: p.cards - spend, exploreOrder: { cards: spend, hours, gain: rawGain, finishAt: Date.now() + realMillisecondsForGameSeconds(hours * 3600) } })); addLog(`You spend ${fmt(spend)} ${currencyLabel} and send your scouts out to explore extra land. Expect it to be finished in ${hours} hours and 0 minutes.`); }
  function completeExplore() { if (!player.exploreOrder) return addLog("There is no explore order to complete."); const gain = player.exploreOrder.gain; setPlayer((p) => ({ ...p, freeLand: p.freeLand + gain, exploreOrder: null })); addLog(`Your scouts returned and found ${fmt(gain)} land.`); }
  function startCustomTrain() { const train = trainForm.map(parseQty); const cost = races[player.race].units.reduce((s, [, c], i) => s + train[i] * c, 0); if (cost <= 0) return addLog("Enter at least one unit to train."); if (player.trainOrder) return addLog("You already have a barracks order running."); if (cost > player.cards) return addLog(`You need ${fmt(cost)} Cardisium for this training.`); const usesSpeedMinerals = Boolean(useBarracksSpeedMinerals); const rowCaps = effectiveMaxTrainByRow(player.race, { entity: player, useSpeedMinerals: usesSpeedMinerals, mode: activeReportTextMode }); if (train.some((q, i) => q > rowCaps[i])) return addLog(`${races[player.race].name} can train a maximum of ${rowCaps.map((cap, i) => `${fmt(cap)} ${races[player.race].units[i][0]}`).join(", ")} per train${usesSpeedMinerals && player.race === "lithi" && speciesBonusesEnabled(activeReportTextMode) ? " when speed minerals are enabled" : ""}.`); if (usesSpeedMinerals && ((player.minerals.Endaurios || 0) < 2000 || (player.minerals.Armidi || 0) < 2000)) return addLog("You need 2,000 Endaurios and 2,000 Armidi to boost this training order."); const barracksMultiplier = barracksTrainingMultiplier(player.buildings); const seconds = trainingDurationSeconds(cost, player.buildings, usesSpeedMinerals, player, activeReportTextMode); setPlayer((p) => ({ ...p, cards: p.cards - cost, minerals: usesSpeedMinerals ? { ...p.minerals, Endaurios: (p.minerals.Endaurios || 0) - 2000, Armidi: (p.minerals.Armidi || 0) - 2000 } : p.minerals, trainOrder: { train, cost, display: oldTime(seconds), finishAt: Date.now() + realMillisecondsForGameSeconds(seconds), speedMinerals: usesSpeedMinerals, barracksMultiplier, speedTrainingDivider: trainingSpeedDivider(player, usesSpeedMinerals, activeReportTextMode) } })); addLog(`You have spent ${fmt(cost)} cards on training which will be finished in ${durationHms(seconds / gameSpeed())}.`, "Other"); }
  function completeTrain() { if (!player.trainOrder) return addLog("There is no training order to complete."); setPlayer((p) => awardCompletedTrysaurWarDrums({ ...p, army: p.army.map((v, i) => v + p.trainOrder.train[i]), trainOrder: null }, p.trainOrder, activeReportTextMode)); addLog("Your army training has been completed."); }
  function applyOneFactoryTick(base) { if (!allocationIsValid(factoryAllocation) || (base.buildings.factories || 0) <= 0) return base; const f = base.buildings.factories; const scanners = Math.floor(f * parseQty(factoryAllocation.scanners) / 100 * 0.25); const missiles = Math.floor(f * parseQty(factoryAllocation.missiles) / 100 * 0.005); const affordable = Math.min(scanners, Math.floor(base.cards / 10000)); const missileCap = missileCapacityForBuildings(base.buildings); return { ...base, cards: base.cards - affordable * 10000, scanners: base.scanners + affordable, missiles: Math.min(missileCap, base.missiles + missiles) }; }
  function applyEconomyTick() { setPlayer((p) => applyEconomyTickPure(p)); addLog("Debug: one 30-minute economy tick applied."); }
  function applySixHourEconomy() { let next = player; for (let i = 0; i < 12; i++) next = applyEconomyTickPure(next); setPlayer(next); const msg = "Debug: applied 12 economy ticks only. Order finish times were not advanced."; setLastUpdateSummary(msg); addLog(msg); }
  function skipGameHours(hours) { const now = Date.now(); const ms = Math.max(0, Number(hours) || 0) * 3600 * 1000; setPlayer((p) => ({ ...p, lastUpdatedAt: (p.lastUpdatedAt || now) - ms, buildOrder: p.buildOrder ? { ...p.buildOrder, finishAt: p.buildOrder.finishAt - ms } : null, trainOrder: p.trainOrder ? { ...p.trainOrder, finishAt: p.trainOrder.finishAt - ms } : null, exploreOrder: p.exploreOrder ? { ...p.exploreOrder, finishAt: p.exploreOrder.finishAt - ms } : null })); setAlliance((a) => a?.bankOrder ? { ...a, bankOrder: { ...a.bankOrder, finishAt: a.bankOrder.finishAt - ms } } : a); setScienceOrder((o) => o ? { ...o, finishAt: o.finishAt - ms } : null); setOutgoingMissiles((orders) => orders.map((o) => ({ ...o, arrivesAt: o.arrivesAt ? o.arrivesAt - ms : o.arrivesAt }))); setIncomingMissiles((orders) => orders.map((o) => ({ ...o, arrivesAt: o.arrivesAt ? o.arrivesAt - ms : o.arrivesAt }))); setActiveLrcSequence((seq) => shiftLrcSequence(seq, ms)); setDisplayNow(now); const msg = `Debug: skipped ${hours} real hour${Number(hours) === 1 ? "" : "s"}. Finish times and the production clock were advanced; if an order now says ready, click its page to commit completion.`; setLastUpdateSummary(msg); addLog(msg); }
  function applyMineTick() { setPlayer((p) => applyElapsedProductionPure(p, 1, mineAllocation, factoryAllocation, { ...scienceLevels, wordingMode: activeReportTextMode })); addLog("Debug: mines worked for 30 minutes."); }
  function applyFactoryTick() { setPlayer((p) => applyOneFactoryTick(p)); addLog("Debug: factories worked for 30 minutes."); }
  function damageBuildingsWithMissiles(buildings, missileCount) {
    const b = { ...emptyBuildings(), ...buildings };
    const totals = {};
    const addDestroyed = (key, amount) => { if (amount > 0) totals[key] = (totals[key] || 0) + amount; };
    const damageSpecific = (key, amount) => {
      const available = Math.max(0, Math.floor(Number(b[key] || 0)));
      const destroyed = Math.min(available, amount);
      if (destroyed > 0) { b[key] = available - destroyed; addDestroyed(key, destroyed); }
      return destroyed;
    };
    const damageAny = (amount) => {
      let remaining = amount;
      for (const [key] of buildingOrder) {
        if (remaining <= 0) break;
        if (!b[key]) continue;
        const destroyed = damageSpecific(key, Math.min(remaining, b[key]));
        remaining -= destroyed;
      }
      return amount - remaining;
    };
    const priority = [
      ["blast_shields", 5],
      ["living_areas", 50],
      ["barracks", 50],
      ["banks", 50],
      ["turrets", 10],
      ["power_plants", 10]
    ];
    for (let i = 0; i < Math.max(0, Math.floor(Number(missileCount || 0))); i += 1) {
      let hit = false;
      for (const [key, amount] of priority) {
        if (Math.max(0, Math.floor(Number(b[key] || 0))) > 0) {
          damageSpecific(key, amount);
          hit = true;
          break;
        }
      }
      if (!hit) damageAny(100);
    }
    const priorityOrder = [...priority.map(([key]) => key), ...buildingOrder.map(([key]) => key)];
    const seen = new Set();
    const destroyed = priorityOrder
      .filter((key) => { if (seen.has(key)) return false; seen.add(key); return totals[key] > 0; })
      .map((key) => `${fmt(totals[key])} ${buildingLabel(key)}`);
    return { buildings: b, destroyed };
  }
  function starWarsInterceptionPercent(entity = player) {
    const land = totalEmpireLand(entity);
    if (land <= 0) return 0;
    const pctOfLand = Math.max(0, Number(entity.buildings?.star_wars || 0)) / land * 100;
    const curve = [
      [0, 0],
      [0.2, 10],
      [1, 20],
      [5, 99]
    ];
    if (pctOfLand <= 0) return 0;
    for (let i = 1; i < curve.length; i += 1) {
      const [x1, y1] = curve[i - 1];
      const [x2, y2] = curve[i];
      if (pctOfLand <= x2) {
        const t = (pctOfLand - x1) / Math.max(0.0001, x2 - x1);
        return Math.max(0, Math.min(99, y1 + (y2 - y1) * t));
      }
    }
    return 99;
  }
  function interceptedMissileCount(entity, missileCount) {
    const total = Math.max(0, Math.floor(Number(missileCount || 0)));
    return Math.min(total, Math.floor(total * starWarsInterceptionPercent(entity) / 100));
  }

  function impactShieldDamageReductionPercent(entity = player) {
    const land = totalEmpireLand(entity);
    if (land <= 0) return 0;
    const pctOfLand = Math.max(0, Number(entity.buildings?.impact_shields || 0)) / land * 100;
    const curve = [
      [0, 0],
      [0.2, 10],
      [1, 20],
      [5, 90]
    ];
    if (pctOfLand <= 0) return 0;
    for (let i = 1; i < curve.length; i += 1) {
      const [x1, y1] = curve[i - 1];
      const [x2, y2] = curve[i];
      if (pctOfLand <= x2) {
        const t = (pctOfLand - x1) / Math.max(0.0001, x2 - x1);
        return Math.max(0, Math.min(90, y1 + (y2 - y1) * t));
      }
    }
    return 90;
  }
  function damageEntityWithLrc(entity, shotCount) {
    const shots = Math.max(1, Math.floor(Number(shotCount || 1)));
    const reductionPercent = impactShieldDamageReductionPercent(entity);
    const perShotDamage = (LRC_BASE_DAMAGE_PERCENT / 100) * (1 - reductionPercent / 100);
    const totalDamageFraction = Math.max(0, Math.min(1, 1 - Math.pow(1 - perShotDamage, shots)));
    const buildings = { ...emptyBuildings(), ...(entity.buildings || {}) };
    const destroyedBuildingRows = buildingOrder.map(([key]) => {
      const before = Math.max(0, Math.floor(Number(buildings[key] || 0)));
      const destroyed = Math.min(before, Math.floor(before * totalDamageFraction));
      buildings[key] = Math.max(0, before - destroyed);
      return { key, label: buildingLabel(key), destroyed };
    });
    const raceKey = races[entity.raceKey] ? entity.raceKey : (races[entity.race] ? entity.race : "human");
    const army = Array.isArray(entity.army) ? [...entity.army] : [0, 0, 0, 0, 0, 0];
    const destroyedUnitRows = (races[raceKey] || races.human).units.map(([name], index) => {
      const before = Math.max(0, Math.floor(Number(army[index] || 0)));
      const destroyed = Math.min(before, Math.floor(before * totalDamageFraction));
      army[index] = Math.max(0, before - destroyed);
      return { index, label: name, destroyed };
    });
    return {
      entity: { ...entity, buildings, army },
      shots,
      reductionPercent,
      effectiveDamagePercent: totalDamageFraction * 100,
      destroyedBuildingRows,
      destroyedUnitRows
    };
  }
  function formatLrcRows(rows) {
    return rows.map((r) => `${fmt(r.destroyed)} ${r.label}`).join(", ");
  }

  function missileCapacity() { return missileCapacityForBuildings(player.buildings); }
  function missileImpactCountdown(order) { if (!order?.arrivesAt) return "Unknown"; return order.arrivesAt <= displayNow ? "Impact due" : remainingTimeLabel(order.arrivesAt, displayNow); }
  function launchMissiles() { const qty = parseQty(missileQty); const target = getSelectedTarget(); const available = Math.min(player.missiles || 0, missileCapacity()); const energyCost = qty * MISSILE_LAUNCH_ENERGY_COST; if (power < 500000) return addLog("You need at least 500,000 power before you can launch missiles."); if (!target) return addLog("No players are currently in missile range."); if (publicPowerForEmpire(target) < 500000) return addLog(`${target.name} is too small to target with missiles. Missile targets must have at least 500,000 power.`); if (qty <= 0) return addLog("Enter a number of missiles to launch."); if (qty > available) return addLog(`You only have ${fmt(available)} missiles available. Each missile needs ${fmt(MISSILE_BASES_PER_MISSILE)} missile bases for storage.`); if ((player.energy || 0) < energyCost) return addLog(`You need ${fmt(energyCost)} Energy to launch ${fmt(qty)} missile${qty === 1 ? "" : "s"}.`); setPlayer((p) => ({ ...p, missiles: p.missiles - qty, energy: Math.max(0, (p.energy || 0) - energyCost) })); setOutgoingMissiles((orders) => [{ id: Date.now(), target: target.name, quantity: qty, arrivesAt: Date.now() + realMillisecondsForGameSeconds(3600) }, ...orders]); setMissileQty(""); addLog(`${player.name} has launched ${fmt(qty)} missiles at ${target.name}. They will arrive in 1 hour.`); }
  function triggerOutgoingMissileImpact(id) {
    if (missileImpactAlreadyProcessed(id)) return;
    const order = outgoingMissiles.find((o) => o.id === id);
    if (!order) return addLog("Outgoing missile order not found.");
    markMissileImpactProcessed(id);
    const target = demoOpponents.find((op) => op.name === order.target);
    const total = Math.max(0, Math.floor(Number(order.quantity || 0)));
    const intercepted = target ? interceptedMissileCount(target, total) : 0;
    const damage = target ? damageBuildingsWithMissiles(target.buildings, Math.max(0, total - intercepted)) : { buildings: null, destroyed: [] };
    const summary = target ? (damage.destroyed.length ? damage.destroyed.join(", ") : "no buildings destroyed") : "target state not found";
    if (target) setDemoOpponents((ops) => ops.map((op) => op.name === order.target ? { ...op, buildings: damage.buildings } : op));
    setOutgoingMissiles((orders) => orders.filter((o) => o.id !== id));
    addLog(`${fmt(total)} missiles launched by ${player.name} impacted ${order.target}. Intercepted: ${fmt(intercepted)}. Destroyed: ${summary}.`, "Missiles");
    if (target) addSystemInboxMessage("Missiles", `Your ${fmt(total)} missile${total === 1 ? "" : "s"} impacted ${order.target}. Intercepted: ${fmt(intercepted)}. Destroyed: ${summary}.`, { kind: "missiles", createdAt: Date.now(), intercepted, destroyed: damage.destroyed });
  }
  function triggerIncomingMissileImpact(id) {
    if (missileImpactAlreadyProcessed(id)) return;
    const order = incomingMissiles.find((o) => o.id === id);
    if (!order) return addLog("Incoming missile order not found.");
    markMissileImpactProcessed(id);
    const intercepted = interceptedMissileCount(player, order.quantity);
    const damage = damageBuildingsWithMissiles(player.buildings, Math.max(0, order.quantity - intercepted));
    const summary = damage.destroyed.length ? damage.destroyed.join(", ") : "no buildings destroyed";
    setPlayer((p) => ({ ...p, buildings: damage.buildings }));
    setIncomingMissiles((orders) => orders.filter((o) => o.id !== id));
    addLog(`${fmt(order.quantity)} missiles from ${order.source} impacted ${player.name}. Intercepted: ${fmt(intercepted)}. Destroyed: ${summary}.`, "Missiles");
    addSystemInboxMessage("Missiles", `${order.source} launched ${fmt(order.quantity)} missile${order.quantity === 1 ? "" : "s"} at you. Intercepted: ${fmt(intercepted)}. Destroyed: ${summary}.`, { kind: "missiles", createdAt: Date.now(), intercepted, destroyed: damage.destroyed });
  }
  function depositBankAmount(amount) { const requested = parseQty(amount); const cap = calcCaps(player.buildings, scienceLevels).bankCap; const space = Math.max(0, cap - player.banked); if (requested <= 0) return addLog("Enter an amount of Cardisium to deposit."); if ((player.buildings.banks || 0) <= 0) return addLog("You have no completed Banks."); if (player.cards <= 0) return addLog("You have no Cardisium on hand to deposit."); if (space <= 0) return addLog("Your banks are full."); const actual = Math.min(requested, player.cards, space); if (actual <= 0) return addLog("No valid Cardisium can be deposited."); setPlayer((p) => ({ ...p, cards: p.cards - actual, banked: p.banked + actual })); setBankAmount(""); addLog(`${fmt(actual)} Cardisium deposited into your banks.`); }
  function depositBank() { depositBankAmount(bankAmount); }
  function fillMaxBank() { const cap = calcCaps(player.buildings, scienceLevels).bankCap; const space = Math.max(0, cap - player.banked); depositBankAmount(Math.min(player.cards, space)); }
  function withdrawBankAmount(amount) { const requested = parseQty(amount); if (requested <= 0) return addLog("Enter an amount of Cardisium to withdraw."); if (player.banked <= 0) return addLog("You have no banked Cardisium to withdraw."); const actual = Math.min(requested, player.banked); if (actual <= 0) return addLog("No valid Cardisium can be withdrawn."); setPlayer((p) => ({ ...p, cards: p.cards + actual, banked: p.banked - actual })); setBankAmount(""); addLog(`${fmt(actual)} Cardisium withdrawn from your banks.`); }
  function withdrawBank() { withdrawBankAmount(bankAmount); }
  function withdrawBankPercent(percent) { withdrawBankAmount(Math.floor((player.banked || 0) * percent)); }
  function scienceLabel(field) { return ({ agriculture: "Agriculture", combat: "Combat", crime: "Crime", housing: "Housing", population: "Population", banking: "Banking", turrets: "Turrets" })[field] || field; }
  function scienceEffect(field, level) { const pct = sciencePercent(level); return ({ agriculture: `Food/water caps and production +${pct}% WIP`, combat: `Attack combat science curve WIP (${fmt(level)} levels)`, crime: `Police capacity +${pct}% WIP`, housing: `Living Area capacity +${pct}% WIP`, population: `Population growth/tax +${pct}% WIP`, banking: `Bank capacity/interest +${pct}% WIP`, turrets: `Disable ${fmt(Math.floor(turretDisableCostPerTurret(level)))} cards/turret; turret energy ${Number(turretEnergyPerShot(level)).toFixed(1)} per shot` })[field] || "Work in progress"; }
  function startScienceResearch() { if (scienceOrder) return addLog("You already have a research order running."); if ((player.buildings.science_labs || 0) <= 0) return addLog("You have no completed Science Labs."); const currentLevel = scienceLevels[scienceField] || 0; const seconds = scienceDurationSeconds(currentLevel, player.buildings); const nextLevel = currentLevel + 1; setScienceOrder({ field: scienceField, level: nextLevel, display: oldTime(seconds), finishAt: Date.now() + realMillisecondsForGameSeconds(seconds), scienceLabMultiplier: scienceLabMultiplier(player.buildings) }); addLog(`You have spent 0 cards on ${scienceLabel(scienceField)} research level ${fmt(nextLevel)} which will be finished in ${durationHms(seconds / gameSpeed())}.`, "Other"); }
  function completeScienceResearch() { if (!scienceOrder) return addLog("There is no science research order to complete."); const field = scienceOrder.field; setScienceLevels((levels) => ({ ...levels, [field]: (levels[field] || 0) + 1 })); setScienceOrder(null); addLog(`${scienceLabel(field)} research has been completed.`); }
  function buyShopMinerals() { const qty = parseQty(shopQty); const price = shopPrices[shopMineral]; if (!price) return addLog(`${shopItemLabel(shopMineral)} is not currently available in the shop.`); if (qty <= 0) return addLog("Enter a quantity to buy from the shop."); const cost = qty * price; if (cost > player.cards) return addLog(`You need ${fmt(cost)} ${currencyLabel} to buy that many ${shopItemLabel(shopMineral)}.`); setPlayer((p) => { if (["Food", "Water", "Energy"].includes(shopMineral)) return { ...p, cards: p.cards - cost, [shopMineral.toLowerCase()]: (p[shopMineral.toLowerCase()] || 0) + qty }; return { ...p, cards: p.cards - cost, minerals: { ...p.minerals, [shopMineral]: (p.minerals[shopMineral] || 0) + qty } }; }); addLog(`Bought ${fmt(qty)} ${shopItemLabel(shopMineral)} from the shop for ${fmt(cost)} ${currencyLabel}.`); }
  function createMarketSellOrder() { const qty = parseQty(marketQty); const price = parseQty(marketPrice); if (qty <= 0 || price <= 0) return addLog("Enter quantity and price for the market order."); if (shopPrices[marketMineral] && price > shopPrices[marketMineral]) return addLog(`Market price cannot exceed shop cost for ${mineralLabel(marketMineral)}: ${fmt(shopPrices[marketMineral])}.`); if ((player.minerals[marketMineral] || 0) < qty) return addLog(`You do not have ${fmt(qty)} ${mineralLabel(marketMineral)} to sell.`); const id = Math.max(0, ...marketOrders.map((o) => o.id)) + 1; setPlayer((p) => ({ ...p, minerals: { ...p.minerals, [marketMineral]: (p.minerals[marketMineral] || 0) - qty } })); setMarketOrders((orders) => [{ id, seller: player.name, mineral: marketMineral, quantity: qty, price }, ...orders]); addLog(`${player.name} listed ${fmt(qty)} ${mineralLabel(marketMineral)} at ${fmt(price)} ${currencyLabel} each.`); }
  function buyMarketOrder(id) { const qtyWanted = parseQty(marketBuyQty); const order = marketOrders.find((o) => o.id === id); if (!order || qtyWanted <= 0) return addLog("Choose a market order and quantity to buy."); if (order.seller === player.name) return addLog("You cannot buy your own market listing."); if (shopPrices[order.mineral] && order.price > shopPrices[order.mineral]) return addLog(`This order is above shop cost and cannot be bought: ${fmt(order.price)} > ${fmt(shopPrices[order.mineral])}.`); const qty = Math.min(qtyWanted, order.quantity); const cost = qty * order.price; if (cost > player.cards) return addLog(`You need ${fmt(cost)} ${currencyLabel} to buy that order.`); setPlayer((p) => ({ ...p, cards: p.cards - cost, minerals: { ...p.minerals, [order.mineral]: (p.minerals[order.mineral] || 0) + qty } })); setMarketOrders((orders) => orders.map((o) => o.id === id ? { ...o, quantity: o.quantity - qty } : o).filter((o) => o.quantity > 0)); addLog(`Bought ${fmt(qty)} ${mineralLabel(order.mineral)} from ${order.seller} for ${fmt(cost)} ${currencyLabel}.`); }
  function cancelMarketOrder(id) { const order = marketOrders.find((o) => o.id === id); if (!order || order.seller !== player.name) return addLog("You can only cancel your own market listings."); setPlayer((p) => ({ ...p, minerals: { ...p.minerals, [order.mineral]: (p.minerals[order.mineral] || 0) + order.quantity } })); setMarketOrders((orders) => orders.filter((o) => o.id !== id)); addLog(`Cancelled your market order and returned ${fmt(order.quantity)} ${mineralLabel(order.mineral)}.`); }
  function fillMarketOwned() { const owned = Math.floor(player.minerals[marketMineral] || 0); if (owned <= 0) return addLog(`You do not currently have any ${mineralLabel(marketMineral)} to list.`); setMarketQty(String(owned)); }
  function fillMarketShopPrice() { const price = shopPrices[marketMineral] || 0; if (price <= 0) return addLog(`No shop price is known for ${mineralLabel(marketMineral)}.`); setMarketPrice(String(price)); }
  function selectMarketBuyOrder(order) { setMarketBuyQty(String(Math.floor(order.quantity || 0))); addLog(`Selected market order: ${fmt(order.quantity)} ${mineralLabel(order.mineral)} from ${order.seller} at ${fmt(order.price)} each.`); }
  function sendMessage() { const target = cleanStoredName(messageTo); const body = cleanMultiLineText(messageBody, TEXT_LIMITS.messageBody).trim(); if (!target || !body) return addLog("Enter a recipient and message body."); const id = Math.max(0, ...messages.map((m) => m.id)) + 1; setMessages((m) => [{ id, direction: "sent", from: player.name, to: target, body, read: true }, ...m]); setMessageTo(target); setMessageBody(""); addLog(`Message sent to ${target}.`); }
  function trainSpies() { const qty = parseQty(spyCount); const cost = qty * 5000; if (qty <= 0) return addLog("Enter a number of spies to train."); if ((player.buildings.spy_stations || 0) <= 0) return addLog("You need completed Spy Stations before training spies."); if (cost > player.cards) return addLog(`You need ${fmt(cost)} Cardisium to train ${fmt(qty)} spies.`); setPlayer((p) => ({ ...p, cards: p.cards - cost })); setSpies((n) => n + qty); setSpyCount(""); addLog(`${fmt(qty)} spies have been trained for ${fmt(cost)} ${currencyLabel}.`); }
  function trainMercenaries() { const qty = parseQty(mercCount); const cost = qty * 10000; if (qty <= 0) return addLog("Enter a number of mercenaries to train."); if ((player.buildings.spy_stations || 0) <= 0) return addLog("You need completed Spy Stations before training mercenaries."); if (cost > player.cards) return addLog(`You need ${fmt(cost)} Cardisium to train ${fmt(qty)} mercenaries.`); setPlayer((p) => ({ ...p, cards: p.cards - cost })); setMercenaries((n) => n + qty); setMercCount(""); addLog(`${fmt(qty)} mercenaries have been trained for ${fmt(cost)} ${currencyLabel}.`); }
  function spyOnTarget() { const target = spyTarget || selectedTargetName || "Randy"; if (spies <= 0) return addLog("You need at least one spy to gather information."); const pub = getDemoPlayers().find((p) => p.name === target); const priv = demoOpponents.find((p) => p.name === target); const body = pub && priv ? `${target} appears to have ${fmt(pub.land)} land, ${fmt(pub.pop)} population, ${fmt(pub.power)} power, ${fmt(priv.cards)} visible Cardisium, and ${fmt(armyPower(priv.raceKey, priv.army))} army power. Stack appears to be ${priv.stack.join(",")}.` : `${target} could not be fully identified in this prototype.`; setSpyReports((r) => [{ id: Date.now(), target, body }, ...r].slice(0, 8)); addLog(`Your spies have returned from ${target}.`); }
  function sendMercenaries() { const target = spyTarget || selectedTargetName || "Randy"; const st = demoOpponents.find((p) => p.name === target); if (!st) return addLog("Target state not found for mercenary raid."); if (mercenaries <= 0) return addLog("You need mercenaries before launching a mercenary raid."); const losses = Math.ceil(mercenaries * 0.25); setMercenaries((n) => Math.max(0, n - losses)); if (mercenaries <= st.buildings.police_stations) return addLog(`Your mercenary raid on ${target} was stopped by ${fmt(st.buildings.police_stations)} Police Stations. ${fmt(losses)} mercenaries were lost.`); const stolen = Math.min(st.cards, Math.max(50000, Math.floor(mercenaries * 2500))); setDemoOpponents((ops) => ops.map((o) => o.name === target ? { ...o, cards: Math.max(0, o.cards - stolen) } : o)); setPlayer((p) => ({ ...p, cards: p.cards + stolen })); addLog(`Your mercenaries raided ${target} successfully and stole ${fmt(stolen)} Cardisium. ${fmt(losses)} mercenaries were lost.`); }
  function clearAlliedDiplomacyForKeys(keys) {
    const liveKeys = new Set((keys || []).filter(Boolean));
    if (!liveKeys.size) return;
    setAlliedStatuses((als) => als.filter((a) => !liveKeys.has(a.a) && !liveKeys.has(a.b)));
    setDiplomacyRequests((reqs) => reqs.filter((r) => r.type !== "alliance" || (!liveKeys.has(r.from) && !liveKeys.has(r.to))));
  }
  function createAlliance() { const name = cleanSingleLineText(allianceName, TEXT_LIMITS.allianceName).trim(); if (!name) return addLog("Enter an alliance name first."); if (alliance) return addLog(`You are already in ${alliance.name}.`); clearAlliedDiplomacyForKeys([diplomacyKey("player", player.name)]); setAlliance({ name, createdByPlayer: true, leader: player.name, viceLeader: null, members: [player.name], memberLimit: ALLIANCE_MEMBER_LIMIT, announcement: "...", bankLand: 0, allianceBanks: 0, bankedCards: 0, bankOrder: null, nexusMinerals: emptyMinerals(), lrcQuota: { cards: 0, minerals: emptyMinerals() }, nexusLedger: {}, diplomacy: "Neutral", lrcStatus: "Not started" }); addLog(`${player.name} has created the alliance ${name}. Allied status has been reset; individual war status still applies to the new alliance.`); }
  function joinAlliance(name) { const targetName = cleanSingleLineText(name || allianceName || "", TEXT_LIMITS.allianceName).trim(); if (!targetName) return addLog("Choose an alliance to join first."); if (alliance) return addLog(`You are already in ${alliance.name}. Leave it before joining another alliance.`); const found = getDemoAlliances().find((a) => a.name.toLowerCase() === targetName.toLowerCase()); if (!found) return addLog(`${targetName} could not be found.`); const existingMembers = found.members.map((m) => m.name).filter((n) => n !== player.name); if (existingMembers.length + 1 > ALLIANCE_MEMBER_LIMIT) return addLog(`${found.name} is full (${fmt(existingMembers.length)} / ${fmt(ALLIANCE_MEMBER_LIMIT)} members).`); clearAlliedDiplomacyForKeys([diplomacyKey("player", player.name)]); setAlliance({ name: found.name, createdByPlayer: false, leader: found.leader, viceLeader: null, members: [player.name, ...existingMembers], memberLimit: ALLIANCE_MEMBER_LIMIT, announcement: found.announcement || "...", bankLand: 0, allianceBanks: 0, bankedCards: 0, diplomacy: "Neutral", lrcStatus: "Not started" }); setAllianceName(""); addLog(`${player.name} has joined the alliance ${found.name}. Allied status has been reset; individual war status does not apply while serving in a joined alliance.`); }
  function renameAlliance() { const name = cleanSingleLineText(allianceName, TEXT_LIMITS.allianceName).trim(); if (!alliance) return addLog("You are not in an alliance."); if (!canRenameAlliance(player.name, alliance)) return addLog("Only the alliance leader can rename the alliance."); if (!name) return addLog("Enter the new alliance name first."); const oldName = alliance.name; setAlliance((a) => ({ ...a, name })); setAllianceName(""); addLog(`${oldName} has been renamed to ${name}.`); }
  function setViceLeader(memberName) { if (!alliance) return addLog("You are not in an alliance."); if (!canSetAllianceViceLeader(player.name, memberName, alliance)) return addLog("Only the leader can appoint a co-leader, and the leader cannot appoint themselves."); setAlliance((a) => ({ ...a, viceLeader: memberName })); addLog(`${memberName} has been appointed Co-Leader of ${alliance.name}.`); }
  function removeViceLeader() { if (!alliance) return addLog("You are not in an alliance."); if (!isAllianceLeader(player.name, alliance)) return addLog("Only the leader can remove the co-leader."); const oldCoLeader = alliance.viceLeader; setAlliance((a) => ({ ...a, viceLeader: null })); addLog(oldCoLeader ? `${oldCoLeader} is no longer Co-Leader of ${alliance.name}.` : "There is no Co-Leader to remove."); }
  function kickAllianceMember(memberName) { if (!alliance) return addLog("You are not in an alliance."); if (!canKickAllianceMember(player.name, memberName, alliance)) return addLog(`You do not have permission to kick ${memberName}.`); setAlliance((a) => ({ ...a, members: a.members.filter((m) => m !== memberName), viceLeader: a.viceLeader === memberName ? null : a.viceLeader })); addLog(`${memberName} has been kicked from ${alliance.name}.`); }
  function addDemoAllianceMember(memberName = demoMemberName) { if (!alliance) return addLog("Create or join an alliance first."); if (!isAllianceLeader(player.name, alliance)) return addLog("Only the alliance leader can add prototype members."); const name = (memberName || "").trim(); if (!name) return addLog("Choose a demo member first."); if (alliance.members.includes(name)) return addLog(`${name} is already in ${alliance.name}.`); if ((alliance.members || []).length >= (alliance.memberLimit || ALLIANCE_MEMBER_LIMIT)) return addLog(`${alliance.name} is full (${fmt(alliance.members.length)} / ${fmt(alliance.memberLimit || ALLIANCE_MEMBER_LIMIT)} members).`); setAlliance((a) => ({ ...a, members: [...a.members, name] })); addLog(`${name} has joined ${alliance.name} for prototype testing.`); }
  function saveAllianceAnnouncement() { if (!alliance) return addLog("You are not in an alliance."); if (!isAllianceAdmin(player.name, alliance)) return addLog("Only the Leader or Co-Leader can edit the announcement."); const announcement = cleanMultiLineText(allianceAnnouncementDraft, TEXT_LIMITS.allianceAnnouncement).trim(); setAlliance((a) => ({ ...a, announcement: announcement || a.announcement })); setAllianceAnnouncementDraft(announcement); addLog(`Alliance announcement updated for ${alliance.name}.`); }
  const currentDiplomacySide = () => alliance ? diplomacyKey("alliance", alliance.name) : diplomacyKey("player", player.name);
  const currentDiplomacyLabel = () => alliance ? `Alliance: ${alliance.name}` : `Player: ${player.name}`;
  const diplomacyTargetKey = () => diplomacyKey(diplomacyTargetType, diplomacyTargetName);
  function canManageDiplomacy() { return !alliance || isAllianceAdmin(player.name, alliance); }
  function declareWarOnSide(targetType, targetName) { if (!canManageDiplomacy()) return addLog("Only the alliance Leader or Co-Leader can manage diplomacy."); const name = cleanSingleLineText(targetName || "", TEXT_LIMITS.targetName).trim(); const from = currentDiplomacySide(); const to = diplomacyKey(targetType, name); if (!name || from === to) return addLog("Choose a valid diplomacy target first."); if (targetType === "player" && playerIsAllianceMember(name)) return addLog(`${name} belongs to an alliance. Declare war on their alliance instead.`); const key = warPairKey(from, to); if (validActiveWars().some((w) => warPairKey(w.from, w.to) === key)) return addLog(`${prettySide(from)} is already at war with ${prettySide(to)}.`); setActiveWars((wars) => [{ id: Date.now(), from, to, fromLabel: prettySide(from), toLabel: prettySide(to), declaredBy: player.name }, ...wars.filter((w) => !diplomacyRecordTargetsAllianceMemberPlayer(w))]); setAlliedStatuses((als) => als.filter((a) => warPairKey(a.a, a.b) !== key && !diplomacyRecordTargetsAllianceMemberPlayer(a))); addLog(`${prettySide(from)} has declared war on ${prettySide(to)}.`); }
  function declareWarOnTarget() { declareWarOnSide(diplomacyTargetType, diplomacyTargetName); }
  function sendDiplomacyRequestToSide(type, targetType, targetName) { if (!canManageDiplomacy()) return addLog("Only the alliance Leader or Co-Leader can manage diplomacy."); const name = cleanSingleLineText(targetName || "", TEXT_LIMITS.targetName).trim(); const from = currentDiplomacySide(); const to = diplomacyKey(targetType, name); if (!name || from === to) return addLog("Choose a valid diplomacy target first."); if (targetType === "player" && playerIsAllianceMember(name)) return addLog(`${name} belongs to an alliance. Use alliance diplomacy instead.`); setDiplomacyRequests((reqs) => [{ id: Date.now(), type, from, to, fromLabel: prettySide(from), toLabel: prettySide(to), status: "pending" }, ...reqs]); addLog(`${prettySide(from)} sent a ${type === "peace" ? "peace" : "allied status"} request to ${prettySide(to)}.`); }
  function sendDiplomacyRequest(type) { sendDiplomacyRequestToSide(type, diplomacyTargetType, diplomacyTargetName); }
  function acceptDiplomacyRequest(id) { const req = diplomacyRequests.find((r) => r.id === id); if (!req) return; const key = warPairKey(req.from, req.to); if (req.type === "peace") setActiveWars((wars) => wars.filter((w) => warPairKey(w.from, w.to) !== key)); if (req.type === "alliance") setAlliedStatuses((als) => [{ id: Date.now(), a: req.from, b: req.to, aLabel: prettySide(req.from), bLabel: prettySide(req.to) }, ...als.filter((a) => warPairKey(a.a, a.b) !== key)]); setDiplomacyRequests((reqs) => reqs.filter((r) => r.id !== id)); addLog(`${req.toLabel} accepted ${req.fromLabel}'s ${req.type === "peace" ? "peace" : "allied status"} request.`); }
  function declineDiplomacyRequest(id) { const req = diplomacyRequests.find((r) => r.id === id); if (!req) return; setDiplomacyRequests((reqs) => reqs.filter((r) => r.id !== id)); addLog(`${req.toLabel} declined ${req.fromLabel}'s ${req.type === "peace" ? "peace" : "allied status"} request.`); }
  function simulateIncomingDiplomacyRequest(type) { const from = diplomacyKey("alliance", "Old Guard"); const to = currentDiplomacySide(); setDiplomacyRequests((reqs) => [{ id: Date.now(), type, from, to, fromLabel: prettySide(from), toLabel: prettySide(to), status: "pending" }, ...reqs]); addLog(`Prototype: ${prettySide(from)} sent ${prettySide(to)} a ${type === "peace" ? "peace" : "allied status"} request.`); }
  function moveStackUnitUp(i) { if (i <= 0) return; const next = [...player.stack]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; setPlayer((p) => ({ ...p, stack: next })); addLog(`Your army stack has been changed to ${next.join(",")}.`); }
  function firstAvailableRow(stack, army) { return stack.find((unitClass) => army[unitClass - 1] > 0); }
  function rowAttack(attacker, defender, attackerClass, lines) {
    if ((attacker.army[attackerClass - 1] || 0) <= 0) return 0;
    const defenderClass = firstAvailableRow(defender.stack, defender.army);
    if (!defenderClass) return 0;
    const attackerStats = races[attacker.race].unitStats[attackerClass - 1];
    const defenderStats = races[defender.race].unitStats[defenderClass - 1];
    const info = killRateInfo(attacker.race, attackerClass, defender.race, defenderClass);
    const scienceBonus = combatScienceBonus(attacker.combatScienceLevel || 0);
    const modifier = info.rate * (1 + scienceBonus);
    const killed = Math.min(defender.army[defenderClass - 1], Math.floor((attacker.army[attackerClass - 1] * attackerStats.off * modifier) / defenderStats.def));
    defender.army[defenderClass - 1] -= killed;
    defender.killedRows = defender.killedRows || [0,0,0,0,0,0];
    defender.killedRows[defenderClass - 1] += killed;
    const lost = killed * defenderStats.cost;
    lines.push(reportUnitExchangeLine(reportTextMode, attacker.name, attackerStats.name, defender.name, defenderStats.name, killed, lost));
    if (attacker.showCombatDebug) {
      const perUnit = defenderStats.def ? attackerStats.off * modifier / defenderStats.def : 0;
      lines.push({ kind: "calibration", text: `Combat calibration: ${attackerStats.name} vs ${defenderStats.name} — base kill rate ${(info.rate * 100).toFixed(2)}% (${info.source}); combat science +${(scienceBonus * 100).toFixed(2)}%; final applied rate ${(modifier * 100).toFixed(2)}%; expected kills per attacking unit ${perUnit.toFixed(3)}. ${info.note || ""}` });
    }
    return lost;
  }
  function demoAttack() {
    const target = getAttackTargetByName(selectedTargetName);
    if (power < 500000) return addLog("You need at least 500,000 power before you can attack another empire.");
    if (!target) return addLog(`${selectedTargetName || "Selected target"} is not currently in your attack range, or is under attack protection.`);
    const stored = getPrivateOpponentByName(target.name);
    if (!stored) return addLog("Target state not found.");
    const attackNow = Date.now();
    const usingRetal = Boolean(target.retalEntry && target.retalId);
    const usedRetalRecord = usingRetal ? normaliseRetalRecord((retalRecords || []).find((r) => {
      const sameRetal = r.id === target.retalId || (target.retalSourceKey && retalDedupeKey(r) === target.retalSourceKey);
      return sameRetal && retalMatches(r, player.name, stored.name, attackNow);
    })) : null;
    if (usingRetal && !usedRetalRecord) return addLog("That retal has already been used or expired.");
    if (!usingRetal && isAttackProtected(stored)) return addLog(`${stored.name} is under attack protection for ${effectiveProtectionHours(stored).toFixed(2)} more hours.`);
    if (isRecentAttackBlocked(stored, roundSettings, attackNow)) return showWarInlineNotice(`${stored.name} was attacked too recently. Wait ${remainingTimeLabel(recentAttackUntil(stored, roundSettings, attackNow), attackNow)}.`);
    const disableTurretsThisAttack = Boolean(disableTargetTurrets && (stored.buildings?.turrets || 0) > 0);
    const turretDisableCost = disableTurretsThisAttack ? turretDisableCostForTarget(stored, scienceLevels) : 0;
    if (disableTurretsThisAttack && turretDisableCost > player.cards) return showWarInlineNotice(`You need ${fmt(turretDisableCost)} Cardisium to disable ${stored.name}'s turrets.`);
    const atk = { name: player.name, race: player.race, army: [...player.army], stack: [...player.stack], startArmy: [...player.army], killedRows: [0,0,0,0,0,0], freeLand: player.freeLand, buildings: player.buildings, energy: player.energy || 0, scienceLevels, combatScienceLevel: scienceLevels.combat || 0, showCombatDebug: adminMode };
    const def = { name: stored.name, race: stored.raceKey, army: [...stored.army], stack: [...stored.stack], startArmy: [...stored.army], killedRows: [0,0,0,0,0,0], freeLand: stored.freeLand, buildings: stored.buildings, energy: stored.energy || 0, scienceLevels: stored.scienceLevels || {}, combatScienceLevel: 0, showCombatDebug: adminMode };
    const attackerBeforeAudit = combatantAuditSnapshot(atk);
    const defenderBeforeAudit = combatantAuditSnapshot(def);
    const reportId = `user-${attackNow}-${player.name}-${stored.name}`;
    const dedupeKey = makeBattleDedupeKey({ source: "player", attacker: player, defender: stored, now: attackNow, usedRetalRecord, usedRetal: usingRetal });
    const dedupe = reserveBattleDedupe({
      key: dedupeKey,
      createdAt: attackNow,
      source: "player",
      actionType: battleDedupeActionType(usedRetalRecord, usingRetal),
      attacker: player.name,
      defender: stored.name,
      reportId,
      retalSourceKey: usedRetalRecord ? retalDedupeKey(usedRetalRecord) : null
    });
    if (!dedupe.ok) return addLog(`Duplicate battle attempt skipped for ${player.name} vs ${stored.name}; no losses or report were applied.`, "Admin");
    const aStart = armyPower(atk.race, atk.army);
    const dStart = armyPower(def.race, def.army);
    let aLost = 0;
    let dLost = 0;
    const textMode = activeReportTextMode;
    const lines = [reportOpeningLine(textMode, atk.name, def.name)];
    const turretAudit = applyTurretVolley(def, atk, { now: attackNow, reportId, disabled: disableTurretsThisAttack, disableCost: turretDisableCost, textMode }, lines);
    aLost += turretAudit.damagePower || 0;
    for (let i = 0; i < 6; i++) {
      dLost += rowAttack(atk, def, atk.stack[i], lines);
      aLost += rowAttack(def, atk, def.stack[i], lines);
    }
    const aPct = aStart > 0 ? aLost / aStart * 100 : 0;
    const dPct = dStart > 0 ? dLost / dStart * 100 : 0;
    const won = aPct < dPct;
    const stolen = won ? Math.floor(stored.cards * dPct / 100) : 0;
    const landSpoils = won ? calculateLandSpoils(totalEmpireLand(stored), dPct, dStart) : 0;
    const defenderLandLoss = won ? applyFlatLandLoss(stored, landSpoils) : applyFlatLandLoss(stored, 0);
    const actualLandSpoils = won ? defenderLandLoss.actualLandLost : 0;
    const addedProtectionHours = calculateAttackProtectionHours(dPct);
    const existingProtectionMs = Math.max(0, Number(stored.protectionUntil || 0) - attackNow);
    const protectionUntil = attackNow + existingProtectionMs + addedProtectionHours * 3600000;
    const protectionHours = Math.max(0, (protectionUntil - attackNow) / 3600000);
    const attackerXp = Math.floor(dLost / 10000);
    const defenderXp = Math.floor(aLost / 10000);
    lines.push(reportPlayerSummaryLine(textMode, won, stored.name, actualLandSpoils, stolen, aLost, aPct, dLost, dPct));
    const playerLandLossLine = landLossReportLine(stored.name, defenderLandLoss);
    if (playerLandLossLine) lines.push(playerLandLossLine);
    const attackerAfterRowsAudit = combatantAuditSnapshot(atk);
    const defenderAfterRowsAudit = combatantAuditSnapshot(def);
    const atkRevives = applyBattleRevives(atk, roundSettings, { role: "attacker", opponentRace: def.race, wordingMode: activeReportTextMode });
    const defRevives = applyBattleRevives(def, roundSettings, { role: "defender", opponentRace: atk.race, wordingMode: activeReportTextMode });
    atk.army = atkRevives.army;
    def.army = defRevives.army;
    const attackerAfterRevivesAudit = combatantAuditSnapshot(atk);
    const defenderAfterRevivesAudit = combatantAuditSnapshot(def);
    const audit = makeCombatAudit({
      source: "player",
      now: attackNow,
      reportId,
      attacker: atk,
      defender: def,
      attackerBefore: attackerBeforeAudit,
      defenderBefore: defenderBeforeAudit,
      attackerAfterRows: attackerAfterRowsAudit,
      defenderAfterRows: defenderAfterRowsAudit,
      attackerAfterRevives: attackerAfterRevivesAudit,
      defenderAfterRevives: defenderAfterRevivesAudit,
      attackerRevivePercent: atkRevives.revivePercent,
      defenderRevivePercent: defRevives.revivePercent,
      attackerBaseRevivePercent: atkRevives.baseRevivePercent,
      defenderBaseRevivePercent: defRevives.baseRevivePercent,
      attackerRaceReviveCap: atkRevives.raceReviveCap,
      defenderRaceReviveCap: defRevives.raceReviveCap,
      attackerRaceReviveCapReason: atkRevives.raceReviveCapReason,
      defenderRaceReviveCapReason: defRevives.raceReviveCapReason,
      attackerRaceDisadvantaged: atkRevives.raceDisadvantaged,
      defenderRaceDisadvantaged: defRevives.raceDisadvantaged,
      attackerRevivePowerPerLand: atkRevives.revivePowerPerLand,
      defenderRevivePowerPerLand: defRevives.revivePowerPerLand,
      attackerReviveDistanceFromIdeal: atkRevives.reviveDistanceFromIdeal,
      defenderReviveDistanceFromIdeal: defRevives.reviveDistanceFromIdeal,
      attackerLossPower: aLost,
      defenderLossPower: dLost,
      attackerLossPct: aPct,
      defenderLossPct: dPct,
      attackerWon: won,
      retal: usingRetal,
      retalRecord: usedRetalRecord,
      turretAudit,
      battleDedupeKey: dedupeKey,
      battleDedupeStatus: "processed",
      round: { gameName, roundProfile, roundSettings, gameSpeed: gameSpeed() }
    });
    const survive = [...atkRevives.lines, ...defRevives.lines];
    if (survive.length) lines.push(...survive);
    if (adminMode) appendCombatAuditLines(lines, audit);
    lines.push(reportProtectionExperienceLine(textMode, stored.name, protectionHours, attackerXp, "player"));
    lines.push(`Stack used: ${atk.stack.join(",")} — ${stackNames(atk.race, atk.stack)}`);
    setDemoOpponents((ops) => ops.map((o) => o.name === stored.name ? { ...defenderLandLoss.entity, ...battleRecordPatch(o, !won), army: def.army, energy: def.energy, cards: Math.max(0, o.cards - stolen), protectionHours, protectionUntil, lastAttackedAt: attackNow, experience: (o.experience || 0) + defenderXp, totalExperience: (o.totalExperience ?? o.experience ?? 0) + defenderXp } : o));
    setPlayer((p) => clearAttackProtection({ ...p, ...battleRecordPatch(p, won), army: atk.army, cards: p.cards - turretDisableCost + stolen, freeLand: p.freeLand + actualLandSpoils, experience: (p.experience || 0) + attackerXp, totalExperience: (p.totalExperience ?? p.experience ?? 0) + attackerXp }));
    const reportText = textMode === "modern"
      ? `${player.name} engaged ${stored.name}${usingRetal ? " by retaliation order" : ""}: ${Math.floor(dPct)}% damage, ${Math.floor(aPct)}% return, ${fmt(stolen)} Cards, ${fmt(actualLandSpoils)} land, ${fmt(attackerXp)} experience.`
      : `${player.name} attacked ${stored.name}${usingRetal ? " using a retal" : ""}: ${Math.floor(dPct)}% damage for ${Math.floor(aPct)}% return, taking ${fmt(stolen)} Cardisium, ${fmt(actualLandSpoils)} land and gaining ${fmt(attackerXp)} experience.`;
    const report = {
      id: reportId,
      text: reportText,
      attacker: player.name,
      defender: stored.name,
      attackerPower: aStart,
      defenderPower: dStart,
      attackerAlliance: alliance?.name || "None",
      defenderAlliance: stored.alliance || "None",
      attackerLossPct: aPct,
      defenderLossPct: dPct,
      attackerWon: won,
      retal: usingRetal,
      retalRecordId: usedRetalRecord?.id || null,
      retalSourceReportId: usedRetalRecord?.sourceReportId || null,
      retalSourceKey: usedRetalRecord ? retalDedupeKey(usedRetalRecord) : null,
      battleDedupeKey: dedupeKey,
      audit,
      lines,
      reportTextMode: textMode,
      classicReportTextSensitivity: textMode === "classic" ? "high-sensitivity retained/copied classic report wording" : null,
      createdAt: attackNow
    };
    setWorldReports((reports) => [report, ...reports].slice(0, 2000));
    setRetalRecords((records) => {
      const updated = usingRetal ? markRetalRecordServed(records || [], usedRetalRecord, report.createdAt, reportId, Boolean(won)) : mergeRetalRecords(records || [], []);
      const counterRetal = (usingRetal || !won) ? [] : [makeRetalRecord({ holder: stored.name, holderAlliance: stored.alliance || "None", target: player.name, targetAlliance: alliance?.name || "None", createdAt: report.createdAt, sourceReportId: reportId, waitingForNextSeenAfter: report.createdAt })];
      return mergeRetalRecords(counterRetal, updated);
    });
    setGrievances((records) => [
      makeGrievanceRecord({ holder: stored.name, holderType: "player", target: player.name, targetType: "player", score: 2 + dPct / 10, reason: "attacked", createdAt: report.createdAt }),
      ...(stored.alliance && stored.alliance !== "None" ? [makeGrievanceRecord({ holder: stored.alliance, holderType: "alliance", target: player.name, targetType: "player", score: 3 + dPct / 8, reason: "member attacked", createdAt: report.createdAt })] : []),
      ...(alliance?.name ? [makeGrievanceRecord({ holder: stored.name, holderType: "player", target: alliance.name, targetType: "alliance", score: 1 + dPct / 20, reason: "attacker alliance", createdAt: report.createdAt })] : []),
      ...decayGrievanceRecords(records, report.createdAt)
    ].slice(0, 300));
    commitBattleDedupe(dedupeKey, { reportId, status: "processed" });
    setBattleReport(lines);
    setPage("report");
    addLog(reportText, "War");
  }
  function renderTargetSelect({ value, onChange, includeAll = false }) { const targets = (includeAll ? getDemoPlayers().filter((p) => p.name !== player.name).map((p) => ({ ...p, selectValue: p.name })) : getSelectableTargets()).sort((a, b) => (b.power || 0) - (a.power || 0)); const validValue = targets.some((t) => (t.selectValue || t.name) === value) ? value : ""; return <select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={validValue} onChange={(e) => onChange(e.target.value)}>{targets.length === 0 && <option value="">No valid targets</option>}{targets.length > 0 && !validValue && <option value="">Choose target</option>}{targets.map((t) => <option key={t.selectValue || t.name} value={t.selectValue || t.name} className={t.retalEntry ? "text-yellow-300" : t.warRange ? "text-red-500" : "text-orange-100"}>{t.retalEntry ? `${t.name} (${t.retalCountdown})` : t.warRange ? `WAR: ${t.name}` : t.name} — {fmt(t.power)} power{t.retalEntry ? " — RETAL" : ""}</option>)}</select>; }
  function applyRoundProfile(profileName) { const preset = roundProfiles[profileName]; if (!preset) return; const now = Date.now(); setRoundProfile(profileName); setRoundSettings({ ...preset }); setGameName(profileName); setRoundStartedAt(roundStartTimestampForKey(profileName === "Intro Game" ? "intro" : "glw", now)); setPlayer((p) => ({ ...p, lastUpdatedAt: now })); setDemoOpponents((ops) => ops.map((op) => { const rk = roundRaceForBot(op, profileName); return { ...op, trainingSpeedOrdersCompleted: Number(op.trainingSpeedOrdersCompleted || 0), raceKey: rk, race: raceNameFromKey(rk), lastBotUpdatedAt: now, lastSeenAt: now - ((Number(op.id) || 0) % 5) * 60000, lastSeen: lastSeenLabelFromAt(now - ((Number(op.id) || 0) % 5) * 60000, now), lastBotCheckInAt: 0, botOnlineUntil: now + 10 * 60 * 1000, botRoundSurgeUntil: now + 2 * 60 * 60 * 1000, botAsleep: false, botBuildOrder: null, botTrainOrder: null, lastBotAction: "Round start: waiting for first action.", lastBotCompleted: "None yet" }; })); addLog(`Round setup preset loaded: ${profileName}. Bots marked as round-start active; tick timer reset for new speed.`, "War"); }
  function applyRoundStartingValues() {
    const l = parseQty(roundSettings.startingLand);
    const c = parseQty(roundSettings.startingCards);
    const now = Date.now();
    setPlayer((p) => ({
      ...p,
      freeLand: l, cards: c, banked: 0, pop: 0, rebels: 0, food: 0, water: 0, energy: 0,
      scanners: 0, missiles: 0, experience: 0, totalExperience: p.totalExperience ?? p.experience ?? 0, roundWins: 0, roundLosses: 0, totalWins: p.totalWins ?? p.roundWins ?? 0, totalLosses: p.totalLosses ?? p.roundLosses ?? 0, minerals: emptyMinerals(), buildings: emptyBuildings(),
      army: [0,0,0,0,0,0], buildOrder: null, exploreOrder: null, trainOrder: null, bonusClaimed: false,
      bonusClaimedAt: null, protectionHours: 0, protectionUntil: 0, lastAttackedAt: 0, mineralReserves: null, lastUpdatedAt: now, previousClickAt: now, lastClickAt: now
    }));
    setBuildForm(emptyBuildForm());
    setTrainForm(["", "", "", "", "", ""]);
    setScienceOrder(null);
    setScienceLevels({ agriculture: 0, combat: 0, crime: 0, housing: 0, population: 0, banking: 0, turrets: 0 });
    setOutgoingMissiles([]);
    setIncomingMissiles([]);
    setBattleReport([]);
    setWorldReports([]);
    setRetalRecords([]);
    setGrievances([]);
    setMarketOrders([]);
    processedBattleKeysRef.current = [];
    setProcessedBattleKeys([]);
    setAllianceShareEnabledMembers([]);
    setPageCompletionNotice(null);
    setDemoOpponents((ops) => ops.map((op) => {
      const rk = roundRaceForBot(op, roundProfile);
      return {
      ...op, raceKey: rk, race: raceNameFromKey(rk), freeLand: l, cards: c, banked: 0, pop: 0, rebels: 0, food: 0, water: 0, energy: 0,
      scanners: 0, missiles: 0, experience: 0, totalExperience: op.totalExperience ?? op.experience ?? 0, roundWins: 0, roundLosses: 0, totalWins: op.totalWins ?? op.roundWins ?? 0, totalLosses: op.totalLosses ?? op.roundLosses ?? 0, minerals: emptyMinerals(), buildings: emptyBuildings(), army: [0,0,0,0,0,0],
      buildOrder: null, exploreOrder: null, trainOrder: null, protectionHours: 0, powerOffset: 0,
      lastBotUpdatedAt: now, lastSeenAt: now - ((Number(op.id) || 0) % 5) * 60000,
      lastSeen: lastSeenLabelFromAt(now - ((Number(op.id) || 0) % 5) * 60000, now),
      lastBotCheckInAt: 0,
      botOnlineUntil: now + 10 * 60 * 1000,
      botRoundSurgeUntil: now + 2 * 60 * 60 * 1000, botAsleep: false, botBuildOrder: null, botTrainOrder: null, lastBotAction: "Round start: waiting for first action.", lastBotCompleted: "None yet"
    }; }));
    setLog([makeNewsEntry(`New ${roundProfile} round started: ${fmt(l)} free land and ${fmt(c)} Cardisium. Player and bot empires reset; bots are treated as round-start active for the next two real hours.`, "War", now)]);
  }
  function resetLocalSave() { if (typeof window !== "undefined") window.localStorage.removeItem(SAVE_KEY); window.location.reload(); }
  function snapshotKey(slot) { return `${SNAPSHOT_PREFIX}${slot}`; }
  function snapshotMeta(slot) { try { const raw = window.localStorage.getItem(snapshotKey(slot)); if (!raw) return "Empty"; const snap = JSON.parse(raw); return snap.savedAt ? new Date(snap.savedAt).toLocaleString() : "Saved"; } catch { return "Unreadable"; } }
  function saveSnapshot(slot, label = `Slot ${slot}`) { if (typeof window === "undefined") return; const payload = currentSavePayload(); window.localStorage.setItem(snapshotKey(slot), JSON.stringify({ savedAt: Date.now(), label, payload })); setSnapshotTick((v) => v + 1); addLog(`Admin: saved prototype snapshot ${slot}.`); }
  function loadSnapshot(slot) { if (typeof window === "undefined") return; const raw = window.localStorage.getItem(snapshotKey(slot)); if (!raw) return addLog(`Admin: snapshot ${slot} is empty.`); try { const snap = JSON.parse(raw); window.localStorage.setItem(SAVE_KEY, JSON.stringify(snap.payload)); window.location.reload(); } catch { addLog(`Admin: snapshot ${slot} could not be loaded.`); } }
  function saveRewindPoint(label = "manual") {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(REWIND_KEY, JSON.stringify({ savedAt: Date.now(), label, payload: currentSavePayload() }));
      setSnapshotTick((v) => v + 1);
      return true;
    } catch (err) {
      console.warn("Rewind save failed; continuing admin time advance", err);
      setSnapshotTick((v) => v + 1);
      return false;
    }
  }
  function loadRewindPoint() { if (typeof window === "undefined") return; const raw = window.localStorage.getItem(REWIND_KEY); if (!raw) return addLog("Admin: no rewind point saved yet."); try { const snap = JSON.parse(raw); window.localStorage.setItem(SAVE_KEY, JSON.stringify(snap.payload)); window.location.reload(); } catch { addLog("Admin: rewind point could not be loaded."); } }
  function rewindMeta() { try { const raw = window.localStorage.getItem(REWIND_KEY); if (!raw) return "None"; const snap = JSON.parse(raw); return snap.savedAt ? new Date(snap.savedAt).toLocaleString() : "Saved"; } catch { return "Unreadable"; } }


  function renderCompletionNotice(expectedPage) { if (!pageCompletionNotice || pageCompletionNotice.page !== expectedPage) return null; return <Panel title={pageCompletionNotice.title}><p className="mb-3 text-orange-200">{pageCompletionNotice.message}</p>{pageCompletionNotice.rows?.length ? <OldTable rows={pageCompletionNotice.rows} /> : null}<div className="mt-4"><button className="classic-btn antro-action-btn" onClick={() => setPageCompletionNotice(null)}>Continue</button></div></Panel>; }
  function adminAddCards(amount = 50000000) { setPlayer((p) => ({ ...p, cards: (p.cards || 0) + amount })); addLog(`Admin: added ${fmt(amount)} Cardisium for playtesting.`, "Admin"); }
  function clearAllRetals() { setRetalRecords([]); addLog("Admin: cleared all retal records for playtesting.", "Admin"); }
  function exportEntityForDebug(entity = {}) {
    const raceKey = entity.raceKey || entity.race || "human";
    return {
      id: entity.id || null,
      name: entity.name || "Unknown",
      race: entity.race || raceNameFromKey(raceKey),
      raceKey,
      alliance: entity.alliance || "None",
      army: cloneArmy(entity.army || []),
      stack: [...(entity.stack || [])],
      armyPower: armyPower(raceKey, entity.army || []),
      publicPower: entity.power ?? null,
      powerOffset: entity.powerOffset || 0,
      freeLand: entity.freeLand || 0,
      totalLand: totalEmpireLand(entity),
      cards: entity.cards || 0,
      banked: entity.banked || 0,
      pop: entity.pop || 0,
      buildings: { ...emptyBuildings(), ...(entity.buildings || {}) },
      minerals: { ...emptyMinerals(), ...(entity.minerals || {}) },
      protectionHours: entity.protectionHours || 0,
      protectionUntil: entity.protectionUntil || 0,
      lastAttackedAt: entity.lastAttackedAt || 0,
      lastSeen: entity.lastSeen || "",
      lastSeenAt: entity.lastSeenAt || 0,
      lastBotCheckInAt: entity.lastBotCheckInAt || 0,
      botOnlineUntil: entity.botOnlineUntil || 0,
      botOnlineNow: Boolean(entity.botOnlineNow),
      botAsleep: Boolean(entity.botAsleep),
      botDoctrine: entity.botDoctrine || null,
      lastBotAction: entity.lastBotAction || null,
      lastBotCompleted: entity.lastBotCompleted || null,
      buildOrder: entity.buildOrder || entity.botBuildOrder || null,
      trainOrder: entity.trainOrder || entity.botTrainOrder || null,
      exploreOrder: entity.exploreOrder || null
    };
  }
  function currentDebugExportPayload(testerComment = "") {
    const now = Date.now();
    const debugPlayer = exportEntityForDebug({ ...player, raceKey: player.race, alliance: alliance?.name || "None" });
    const debugAccessGrant = normaliseAccessGrant(testerAccessRecord?.accessGrant || null);
    return {
      schemaVersion: "antrophai-debug-export-v1",
      prototypeVersion: PROTOTYPE_VERSION,
      generatedAt: now,
      generatedAtIso: new Date(now).toISOString(),
      testerComment: cleanMultiLineText(testerComment || "", 1000),
      timing: {
        displayNow,
        displayNowIso: new Date(displayNow).toISOString(),
        gameName,
        roundProfile,
        roundSettings,
        gameSpeed: gameSpeed(),
        realSecondsPerTick: realSecondsPerTick(),
        lastUpdateSummary
      },
      testerAccess: {
        accepted: Boolean(testerAccessRecord?.accepted),
        accessMode: testerAccessRecord?.accepted ? (testerAccessRecord?.accessMode === "invite-token" ? "invite-token" : "development-fallback") : null,
        codeLabel: testerAccessRecord?.codeLabel || null,
        testerLabel: testerAccessRecord?.testerLabel || debugAccessGrant?.testerLabel || null,
        grantId: debugAccessGrant?.grantId || null,
        tokenId: debugAccessGrant?.tokenId || null,
        tokenHashPrefix: debugAccessGrant?.tokenHashPrefix || null,
        issuedAt: debugAccessGrant?.issuedAt || null,
        lastRevalidatedAt: debugAccessGrant?.lastRevalidatedAt || null,
        acceptedAt: testerAccessRecord?.acceptedAt || null,
        inviteServiceUrl: INVITE_TOKEN_SERVICE_URL || null,
        inviteServiceHost: INVITE_TOKEN_SERVICE_HOST || null,
        accessGrant: debugAccessGrant
      },
      selected: { page, entryStage, selectedRoundKey, selectedSpeciesKey, activeRoundSlotKey, selectedTargetName, battleLogPage, battleLogOpponent, newsFilter, newsPage, onlineSort },
      roundSlots: {
        activeRoundSlotKey,
        currentStorageKey: (() => { try { return typeof window !== "undefined" ? window.localStorage.getItem(ROUND_SLOT_CURRENT_KEY) : null; } catch { return null; } })(),
        index: roundSlotIndex,
        liveIndex: liveRoundSlotIndex(roundSlotIndex)
      },
      multiplayerPreview: {
        gameServiceUrl: GAME_SERVICE_URL || null,
        gameServiceHost: (() => { try { return GAME_SERVICE_URL ? new URL(GAME_SERVICE_URL).host : null; } catch { return null; } })(),
        lastMultiplayerPreviewFetchAt: multiplayerPreviewState.fetchedAt || null,
        lastMultiplayerPreviewFetchAtIso: multiplayerPreviewState.fetchedAt ? new Date(multiplayerPreviewState.fetchedAt).toISOString() : null,
        multiplayerPreviewRoundSummary: multiplayerPreviewState.summary?.roundSummary || null,
        multiplayerPreviewRoundKey: multiplayerPreviewState.summary?.round?.roundKey || MULTIPLAYER_PREVIEW_ROUND_KEY,
        multiplayerPreviewRoundId: multiplayerPreviewState.summary?.round?.id || null,
        multiplayerPreviewPlayerCount: Array.isArray(multiplayerPreviewState.summary?.players) ? multiplayerPreviewState.summary.players.length : 0,
        multiplayerPreviewActionSummary: multiplayerPreviewState.summary?.actionSummary || null,
        multiplayerPreviewRecentActions: Array.isArray(multiplayerPreviewState.summary?.recentActions) ? multiplayerPreviewState.summary.recentActions : [],
        multiplayerPreviewRecentPublicEvents: Array.isArray(multiplayerPreviewState.summary?.recentPublicEvents) ? multiplayerPreviewState.summary.recentPublicEvents : [],
        multiplayerPreviewRecentTickLogs: Array.isArray(multiplayerPreviewState.summary?.recentTickLogs) ? multiplayerPreviewState.summary.recentTickLogs : [],
        multiplayerPreviewError: multiplayerPreviewState.error || null,
      },
      multiplayerIdentity: {
        lastMultiplayerIdentityFetchAt: multiplayerIdentityState.fetchedAt || null,
        lastMultiplayerIdentityFetchAtIso: multiplayerIdentityState.fetchedAt ? new Date(multiplayerIdentityState.fetchedAt).toISOString() : null,
        multiplayerIdentityLoading: Boolean(multiplayerIdentityState.loading),
        multiplayerIdentityError: multiplayerIdentityState.error || null,
        multiplayerIdentityDisplayName: multiplayerIdentityState.summary?.displayName || null,
        multiplayerIdentityTesterLabel: multiplayerIdentityState.summary?.testerLabel || null,
        multiplayerIdentityGrantId: multiplayerIdentityState.summary?.grantId || null,
        multiplayerIdentityPlayerId: multiplayerIdentityState.summary?.currentPlayerId || multiplayerIdentityState.summary?.playerId || null,
        multiplayerIdentityResolvedFrom: multiplayerIdentityState.summary?.resolvedFrom || null,
        multiplayerIdentityRoundKey: multiplayerIdentityState.summary?.roundKey || null,
        multiplayerIdentityRoundName: multiplayerIdentityState.summary?.roundName || null,
        multiplayerIdentityRoundStatus: multiplayerIdentityState.summary?.roundStatus || null,
        multiplayerIdentityCurrentTick: multiplayerIdentityState.summary?.currentTick ?? null,
        multiplayerIdentityPlayerRoundId: multiplayerIdentityState.summary?.playerRoundId || null,
      },
      lastMultiplayerDevActionAt: multiplayerDevActionState.lastActionAt || null,
      lastMultiplayerDevActionAtIso: multiplayerDevActionState.lastActionAt ? new Date(multiplayerDevActionState.lastActionAt).toISOString() : null,
      lastMultiplayerDevActionType: multiplayerDevActionState.lastActionType || null,
      lastMultiplayerDevActionResult: multiplayerDevActionState.lastActionResult || null,
      lastMultiplayerDevActionMessage: multiplayerDevActionState.lastActionMessage || null,
      lastMultiplayerDevResetAt: multiplayerDevActionState.lastActionType === "dev_reset_proof_round" ? multiplayerDevActionState.lastActionAt || null : null,
      lastMultiplayerDevResetAtIso: multiplayerDevActionState.lastActionType === "dev_reset_proof_round" && multiplayerDevActionState.lastActionAt ? new Date(multiplayerDevActionState.lastActionAt).toISOString() : null,
      lastMultiplayerDevResetResult: multiplayerDevActionState.lastActionType === "dev_reset_proof_round" ? multiplayerDevActionState.lastActionResult || null : null,
      lastMultiplayerPreviewError: multiplayerPreviewState.error || null,
      currentRoundSummary: {
        version: PROTOTYPE_VERSION,
        slotKey: activeRoundSlotKey,
        roundKey: currentRoundKeyFromProfile(),
        roundShortLabel: launcherRoundShortLabelForKey(currentRoundKeyFromProfile()),
        roundName: launcherRoundNameForKey(currentRoundKeyFromProfile()),
        localOnly: true,
        roundSettingsSummary: launcherRoundSettingsSummary(currentRoundKeyFromProfile(), roundSettings),
      },
      player: { ...debugPlayer, scienceLevels, spies, mercenaries },
      demoOpponents: (demoOpponents || []).map(exportEntityForDebug),
      publicPlayers: getDemoPlayers(),
      battleLog: (worldReports || []).slice(0, 200),
      battleDedupe: { recent: processedBattleKeysRef.current || processedBattleKeys || [] },
      news: (log || []).slice(0, 500),
      retalRecords: mergeRetalRecords(retalRecords || [], []),
      grievances: grievances || [],
      diplomacy: { activeWars, alliedStatuses, diplomacyRequests },
      alliance,
      messages: (messages || []).slice(0, 200),
      missiles: { outgoingMissiles, incomingMissiles },
      marketOrders: (marketOrders || []).slice(0, 200),
      lastBattleReport: battleReport,
      savePayload: currentSavePayload()
    };
  }
  function exportDebugJson(testerComment = "") {
    const payload = currentDebugExportPayload(testerComment);
    const json = JSON.stringify(payload, null, 2);
    const stamp = new Date(payload.generatedAt).toISOString().replace(/[:.]/g, "-");
    const filename = `antrophai_debug_${PROTOTYPE_VERSION}_${stamp}.json`;
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.warn("Debug export download failed", err);
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(() => addLog(`Admin: exported debug JSON (${filename}) and copied it to clipboard.`, "Admin")).catch(() => addLog(`Admin: exported debug JSON (${filename}); clipboard copy was blocked.`, "Admin"));
    } else {
      addLog(`Admin: exported debug JSON (${filename}).`, "Admin");
    }
  }
  function shiftTimestamp(value, realMs) { return value ? Math.max(0, value - realMs) : value; }
  function shiftLrcSequence(sequence, realMs) {
    if (!sequence || sequence.status === "complete") return sequence;
    return {
      ...sequence,
      startedAt: shiftTimestamp(sequence.startedAt, realMs),
      nextShotAt: shiftTimestamp(sequence.nextShotAt, realMs),
      completedAt: shiftTimestamp(sequence.completedAt, realMs)
    };
  }
  function shiftNewsEntryTime(entry, realMs) { return (entry && typeof entry === "object") ? { ...entry, createdAt: shiftTimestamp(entry.createdAt, realMs) } : entry; }
  function shiftReportTime(report, realMs) {
    if (!report || typeof report !== "object") return report;
    return {
      ...report,
      createdAt: shiftTimestamp(report.createdAt, realMs),
      battleStartedAt: shiftTimestamp(report.battleStartedAt, realMs),
      usedAt: shiftTimestamp(report.usedAt, realMs)
    };
  }

  function botDidCheckInDuringAdvance(op, wallMs, now) {
    const profile = botProfileFor(op);
    const difficulty = BOT_DIFFICULTY_PROFILES[botDifficulty] || BOT_DIFFICULTY_PROFILES.Normal;
    const elapsed = Math.max(0, Number(wallMs) || 0);
    if (elapsed <= 0) return false;
    const start = now - elapsed;
    const interval = Math.max(60000, botCheckInIntervalMs(op, profile, difficulty));
    const surge = Number(op.botRoundSurgeUntil || 0) > start;
    const id = Number(op.id || 0) || String(op.name || "bot").length;

    // v0.40.61: the earlier due-time calculation was too brittle after repeated
    // save/load/time-shift cycles and often produced zero check-ins for hours.
    // Instead, treat check-ins like human login opportunities during the elapsed
    // wall-clock window. This keeps Last Seen meaningful: bots only finish orders,
    // attack, or activate retals when this returns a genuine check-in time.
    const expected = elapsed / interval;
    const activityWeight = surge ? 1.15 : 0.55;
    const chance = Math.max(0.01, Math.min(0.92, (1 - Math.exp(-expected)) * activityWeight));
    if (Math.random() > chance) return false;

    // Pick a plausible time within the skipped interval, biased toward the latter
    // part of the window so Online doesn't look like everyone logged in hours ago.
    let checkAt = now - Math.floor(Math.random() * elapsed * 0.85);
    const step = Math.max(5 * 60000, Math.min(interval, 20 * 60000));
    while (checkAt >= start) {
      const awakeAtCheck = !botIsAsleep(profile, checkAt) || Number(op.botRoundSurgeUntil || 0) > checkAt;
      if (awakeAtCheck) return Math.min(now, Math.max(start, checkAt));
      checkAt -= step;
    }

    // If the random point fell in a sleep window, try the end of the interval as
    // a final realistic candidate before declaring no check-in.
    if (!botIsAsleep(profile, now) || Number(op.botRoundSurgeUntil || 0) > now) return now;
    return false;
  }

  function botCheckInForAdminAdvance(op, checkAt, now) {
    const profile = botProfileFor(op);
    const difficulty = BOT_DIFFICULTY_PROFILES[botDifficulty] || BOT_DIFFICULTY_PROFILES.Normal;
    const doctrine = op.botDoctrine || profile.doctrine;
    const asleep = botIsAsleep(profile, checkAt) && !(Number(op.botRoundSurgeUntil || 0) > checkAt);
    let next = { ...op, botDoctrine: doctrine, botAsleep: asleep };
    if (asleep) return { bot: { ...next, botOnlineNow: false, lastSeen: lastSeenLabelFromAt(next.lastSeenAt, now) }, checkedIn: false };
    next = botCompleteDueOrders(next, checkAt);
    let action = next.lastBotCompleted ? `Checked in during admin time advance; ${next.lastBotCompleted}.` : "Checked in during admin time advance.";
    const buildOrder = botBuildPlan(next, doctrine, checkAt);
    if (buildOrder) {
      next = { ...next, cards: (next.cards || 0) - buildOrder.paidCost, botBuildOrder: buildOrder };
      action = `Checked in; started build: ${fmt(totalBuildings(buildOrder.build))} buildings, cost ${fmt(buildOrder.paidCost)}, finishes in ${buildOrder.display}.`;
    }
    const trainOrder = botTrainPlan(next, doctrine, checkAt);
    if (trainOrder) {
      let minerals = { ...emptyMinerals(), ...(next.minerals || {}) };
      if (trainOrder.useSpeed) {
        minerals.Endaurios = Math.max(0, (minerals.Endaurios || 0) - 2000);
        minerals.Armidi = Math.max(0, (minerals.Armidi || 0) - 2000);
      }
      next = { ...next, cards: (next.cards || 0) - trainOrder.cost, minerals, botTrainOrder: trainOrder };
      action = `Checked in; started training: ${fmt(trainOrder.train.reduce((a,b)=>a+b,0))} units, cost ${fmt(trainOrder.cost)}, finishes in ${trainOrder.display}${trainOrder.useSpeed ? " using speed minerals" : ""}.`;
    }
    const sessionMs = Math.min(12 * 60 * 1000, Math.max(3 * 60 * 1000, Math.floor(botCheckInIntervalMs(next, profile, difficulty) / 3)));
    return {
      bot: {
        ...next,
        lastSeenAt: checkAt,
        lastBotCheckInAt: checkAt,
        botOnlineUntil: Math.max(Number(next.botOnlineUntil || 0), checkAt + sessionMs),
        botOnlineNow: checkAt + sessionMs >= now,
        lastSeen: lastSeenLabelFromAt(checkAt, now),
        lastBotAction: action
      },
      checkedIn: true
    };
  }

  function adminAdvanceRealMilliseconds(realMs, label) {
    const wallMs = Math.max(0, Number(realMs) || 0);
    if (wallMs <= 0) return;
    const progressMs = wallMs;
    const now = Date.now();
    const rewindSaved = saveRewindPoint(`before ${label}`);

    // Keep the admin time controls deliberately simple and robust: they shift
    // stored clocks directly. Page-request completion/economy/bot processing can
    // then happen normally on the next click, which is much easier to reason
    // about during testing than mixing time-shift and page-update state writes.
    setLog((entries) => (entries || []).map((entry) => shiftNewsEntryTime(entry, wallMs)));
    setWorldReports((reports) => (reports || []).map((report) => shiftReportTime(report, wallMs)));
    setOutgoingMissiles((orders) => (orders || []).map((o) => ({ ...o, arrivesAt: shiftTimestamp(o.arrivesAt, progressMs) })));
    setIncomingMissiles((orders) => (orders || []).map((o) => ({ ...o, arrivesAt: shiftTimestamp(o.arrivesAt, progressMs) })));
    setActiveLrcSequence((seq) => shiftLrcSequence(seq, progressMs));
    setScienceOrder((o) => shiftFinishAt(o, progressMs));
    setAlliance((a) => { if (!a) return a; const shifted = normaliseAlliance({ ...a, bankOrder: shiftFinishAt(a.bankOrder, progressMs), lrcConstructionFinishAt: shiftTimestamp(a.lrcConstructionFinishAt, progressMs) }); return completeLrcConstructionIfDue(shifted, now); });
    setRetalRecords((records) => (records || []).map((r) => ({
      ...r,
      createdAt: shiftTimestamp(r.createdAt, wallMs),
      activatedAt: shiftTimestamp(r.activatedAt, wallMs),
      expiresAt: shiftTimestamp(r.expiresAt, wallMs),
      usedAt: shiftTimestamp(r.usedAt, wallMs)
    })));
    setGrievances((records) => (records || []).map((g) => ({ ...g, createdAt: shiftTimestamp(g.createdAt, wallMs), lastAt: shiftTimestamp(g.lastAt, wallMs) })));
    setPlayer((current) => ({
      ...current,
      lastUpdatedAt: Math.max(0, (current.lastUpdatedAt || now) - wallMs),
      previousClickAt: shiftTimestamp(current.previousClickAt, wallMs),
      lastClickAt: shiftTimestamp(current.lastClickAt, wallMs),
      buildOrder: shiftFinishAt(current.buildOrder, progressMs),
      trainOrder: shiftFinishAt(current.trainOrder, progressMs),
      exploreOrder: shiftFinishAt(current.exploreOrder, progressMs),
      lastAttackedAt: shiftTimestamp(current.lastAttackedAt, wallMs),
      protectionUntil: shiftTimestamp(current.protectionUntil, wallMs)
    }));
    let botCheckInCount = 0;
    setDemoOpponents((ops) => (ops || []).map((op) => {
      const shifted = {
        ...op,
        lastBotUpdatedAt: Math.max(0, (op.lastBotUpdatedAt || now) - wallMs),
        lastSeenAt: shiftTimestamp(op.lastSeenAt, wallMs),
        lastBotCheckInAt: shiftTimestamp(op.lastBotCheckInAt, wallMs),
        botOnlineUntil: shiftTimestamp(op.botOnlineUntil, wallMs),
        botRoundSurgeUntil: shiftTimestamp(op.botRoundSurgeUntil, wallMs),
        botBuildOrder: shiftFinishAt(op.botBuildOrder, progressMs),
        botTrainOrder: shiftFinishAt(op.botTrainOrder, progressMs),
        buildOrder: shiftFinishAt(op.buildOrder, progressMs),
        trainOrder: shiftFinishAt(op.trainOrder, progressMs),
        exploreOrder: shiftFinishAt(op.exploreOrder, progressMs),
        lastAttackedAt: shiftTimestamp(op.lastAttackedAt, wallMs),
        protectionUntil: shiftTimestamp(op.protectionUntil, wallMs)
      };
      const checkAt = botDidCheckInDuringAdvance(shifted, wallMs, now);
      if (!checkAt) return { ...shifted, botOnlineNow: Number(shifted.botOnlineUntil || 0) > now && !shifted.botAsleep, lastSeen: lastSeenLabelFromAt(shifted.lastSeenAt, now) };
      const result = botCheckInForAdminAdvance(shifted, checkAt, now);
      if (result.checkedIn) botCheckInCount += 1;
      return result.bot;
    }));
    setDisplayNow(now);
    const message = `Admin: advanced ${label}. Order clocks, LRC sequence clocks, protection, retals, News and Battle Log moved by ${compactHms(wallMs / 1000)} real time. Simulated ${botCheckInCount} bot check-in${botCheckInCount === 1 ? "" : "s"}. ${rewindSaved ? "Rewind point saved." : "Rewind point not saved (storage full or unavailable), but time advance was applied."}`;
    setLastUpdateSummary(message);
    addLog(message, "Admin");
  }
  function adminAdvanceRealMinutes(minutes) {
    const realMs = Number(minutes) * 60 * 1000;
    adminAdvanceRealMilliseconds(realMs, `${minutes} real minute${Number(minutes) === 1 ? "" : "s"}`);
  }
  function realMillisecondsForGameTicks(ticks = 1) {
    const count = Math.max(1, Math.floor(Number(ticks) || 1));
    const speed = Math.max(0.001, Number(gameSpeed()) || 1);
    return count * 30 * 60 * 1000 / speed;
  }
  function adminAdvanceGameTicks(ticks) {
    const count = Math.max(1, Math.floor(Number(ticks) || 1));
    const realMs = realMillisecondsForGameTicks(count);
    adminAdvanceRealMilliseconds(realMs, `${count} tick${count === 1 ? "" : "s"} = ${compactHms(realMs / 1000)} real time at ${gameSpeed()}x`);
  }
  function adminTimeAuditRows() {
    const speed = gameSpeed();
    const tickReal = compactHms(realMillisecondsForGameTicks(1) / 1000);
    const recent = compactHms(recentAttackBlockMsForSettings(roundSettings) / 1000);
    const retal = compactHms(retalWindowMsForSettings(roundSettings) / 1000);
    return [["This round speed", `${speed}x`], ["Admin +1 tick", `${tickReal} real time`], ["Admin +20m", "20:00 real time"], ["Recent-hit lockout", recent], ["Retal window", retal]];
  }
  function renderAdmin() {
    const difficulty = BOT_DIFFICULTY_PROFILES[botDifficulty] || BOT_DIFFICULTY_PROFILES.Normal;
    return <Panel title="Admin Control">
      <p className="mb-3 text-orange-200">Prototype admin area. The quick playtest buttons now live in the small admin sidebar under the main left navigation, so they are available from any page while admin mode is enabled.</p>
      <OldTable rows={[
        ["Admin Mode", adminMode ? "Enabled" : "Disabled"],
        ["Game", gameName],
        ["Profile", roundProfile],
        ["Speed", `${roundSettings.gameSpeed}x`],
        ["Bot Difficulty", difficulty.label],
        ["Report Wording", REPORT_WORDING_MODES[activeReportTextMode] || activeReportTextMode],
        ["Save Key", SAVE_KEY]
      ]} />
      <Panel title="Active Bot Doctrines">
        <OldTable rows={Object.entries(BOT_DOCTRINES).map(([key, value]) => [key, value])} />
      </Panel>
      <Panel title="Battle Report Wording Mode">
        <p className="mb-2 text-orange-200">Admin/dev switch for comparing report prose. Classic remains the private-beta default; Modern is the public-readiness fallback template layer.</p>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(REPORT_WORDING_MODES).map((mode) => <button key={mode} className={reportTextMode === mode ? "classic-btn bg-orange-900" : "classic-btn"} onClick={() => { setReportTextMode(mode); addLog(`Report wording mode set to ${REPORT_WORDING_MODES[mode]}.`, "Admin"); }}>{REPORT_WORDING_MODES[mode]}</button>)}
        </div>
        <p className="mt-2 text-xs text-orange-500">{REPORT_WORDING_MODE_NOTES[reportTextMode]}</p>
      </Panel>
      <div className="flex gap-2 flex-wrap mt-4">
        <button className="classic-btn antro-action-btn" onClick={exportDebugJson}>Export Debug JSON</button>
        <button className="classic-btn antro-action-btn" onClick={() => setPage("todo")}>To Do / Tests</button>
        <button className="classic-btn antro-action-btn" onClick={disableAdminAccess}>Leave Admin</button>
      </div>
    </Panel>;
  }

  function renderAdminSidebar() {
    if (!adminMode) return null;
    return <div className="border-t border-red-900 mt-3 pt-3">
      <div className="border border-red-700 bg-[#120000] p-2">
        <div className="text-red-300 font-bold text-xs mb-2 tracking-wide">Prototype / Admin Tools</div>
        <div className="grid gap-1">
          <button className="admin-btn" onClick={() => adminAddCards(50000000)}>+50m Cards</button>
          <button className="admin-btn" onClick={() => setPlayer((p) => ({ ...p, missiles: Math.min(missileCapacityForBuildings(p.buildings || {}), (p.missiles || 0) + 50) }))}>+50 missiles</button>
          <button className="admin-btn" onClick={() => setPlayer((p) => ({ ...p, scanners: (p.scanners || 0) + 100 }))}>+100 scanners</button>
          <button className="admin-btn" onClick={() => setPlayer((p) => ({ ...p, energy: (p.energy || 0) + 50000 }))}>+50k energy</button>
          <button className="admin-btn" onClick={() => exportDebugJson()}>Export Debug JSON</button>
          <div className="text-[10px] text-red-300 mt-1">Advance this round's clocks</div>
          <div className="grid grid-cols-2 gap-1">{[1,4,10,100].map((t) => <button key={t} className="admin-btn" title={`${t} tick${t === 1 ? "" : "s"} = ${compactHms(realMillisecondsForGameTicks(t) / 1000)} real time`} onClick={() => adminAdvanceGameTicks(t)}>+{t} tick{t === 1 ? "" : "s"}</button>)}</div>
          <div className="text-[10px] text-red-300 mt-1">Advance this round by real time</div>
          <div className="grid grid-cols-2 gap-1">{[1,5,20,60].map((m) => <button key={m} className="admin-btn" title={`${m} real minute${m === 1 ? "" : "s"}`} onClick={() => adminAdvanceRealMinutes(m)}>+{m < 60 ? `${m}m` : "1h"} real</button>)}</div>
          <div className="text-[10px] text-red-400">Applies only to the currently loaded round. Other round slots/snapshots are not advanced.</div>
          <OldTable rows={adminTimeAuditRows()} />
          <button className="admin-btn" onClick={clearAllRetals}>Clear All Retals</button>
          <label className="text-red-300 text-xs mt-1">Bot Difficulty</label>
          <select className="bg-black border border-red-800 text-red-100 px-1 py-1 text-xs" value={botDifficulty} onChange={(e) => setBotDifficulty(e.target.value)}>
            {Object.keys(BOT_DIFFICULTY_PROFILES).map((key) => <option key={key} value={key}>{BOT_DIFFICULTY_PROFILES[key].label}</option>)}
          </select>
        </div>
      </div>
    </div>;
  }

  function renderRoundSetup() { return <Panel title="Game Admin"><p className="mb-3 text-orange-200">Admin-facing controls for round creation, round profiles and custom settings.</p><OldTable rows={[["Game Name", gameName], ["Selected Profile", roundProfile], ["Game Speed", `${roundSettings.gameSpeed}x`], ["Starting Land", fmt(roundSettings.startingLand)], ["Starting Cardisium", fmt(roundSettings.startingCards)], ["Revive Mode", roundSettings.revives], ["Protection Base", `${roundSettings.protectionBaseHours} hours`], ["Explore", roundSettings.exploreEnabled === false ? "Disabled" : "Enabled"]]} /><Panel title="Preset Profiles"><div className="flex gap-2 flex-wrap">{Object.keys(roundProfiles).map((p) => <button key={p} className="classic-btn antro-action-btn" onClick={() => applyRoundProfile(p)}>{p}</button>)}</div></Panel><Panel title="Custom Parameters"><div className="mb-3"><label className="block text-orange-300 mb-1">Game Name</label><input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-1" value={gameName} maxLength={TEXT_LIMITS.gameName} onChange={(e) => setGameName(cleanSingleLineText(e.target.value, TEXT_LIMITS.gameName))} /></div><table className="w-full text-sm"><tbody>{[["gameSpeed", "Game Speed"], ["startingLand", "Starting Land"], ["startingCards", "Starting Cardisium"], ["protectionBaseHours", "Protection Base Hours"]].map(([key, label]) => <tr key={key} className="border-b border-orange-950"><td className="p-1 text-orange-300">{label}</td><td className="p-1 text-right"><TextInput value={roundSettings[key]} onChange={(v) => setRoundSettings((s) => ({ ...s, [key]: v }))} /></td></tr>)}<tr className="border-b border-orange-950"><td className="p-1 text-orange-300">Revives</td><td className="p-1 text-right"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={roundSettings.revives} onChange={(e) => setRoundSettings((s) => ({ ...s, revives: e.target.value }))}><option>No revives</option><option>10% revives</option><option>Full revive system</option></select></td></tr><tr className="border-b border-orange-950"><td className="p-1 text-orange-300">Explore</td><td className="p-1 text-right"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={roundSettings.exploreEnabled === false ? "Disabled" : "Enabled"} onChange={(e) => setRoundSettings((s) => ({ ...s, exploreEnabled: e.target.value !== "Disabled" }))}><option>Enabled</option><option>Disabled</option></select></td></tr></tbody></table><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={applyRoundStartingValues}>Prototype: Apply Starting Values</button><button className="classic-btn antro-action-btn" onClick={() => addLog(`Admin: round settings saved: ${gameName}, ${roundProfile}, speed ${roundSettings.gameSpeed}x, ${roundSettings.revives}.`, "Admin")}>Save Round Settings</button></div></Panel></Panel>; }
  function renderStatus() {
    if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHostedStatusPage();
    const supportCap = supportedPopulationCap(caps);
    const popInc = Math.floor(Math.max(0, supportCap - player.pop - player.rebels) * 0.015);
    const armyUnits = player.army.reduce((a, b) => a + b, 0);
    const foodNet = (player.buildings.nutrition_suppliers || 0) * 5 - (player.pop + player.rebels + armyUnits) * 0.02;
    const waterNet = (player.buildings.water_purifiers || 0) * 8 - (player.pop + player.rebels + armyUnits) * 0.02;
    const energyNet = productionPerTick(player.buildings, scienceLevels).energy;
    const bankInterest = Math.floor(player.banked * 0.0010415);
    const taxRevenue = Math.floor(player.pop * 2);
    const totalCardIncrease = Math.floor(taxRevenue + bankInterest);
    const intervalLabel = gameSpeed() === 1 ? "Next 30 min." : `Next ${durationHms(1800 / gameSpeed()).replace(", 0 seconds", "")}.`;
    const starWarsDefence = starWarsInterceptionPercent(player);
    const starWarsLandPct = totalEmpireLand(player) > 0 ? (Math.max(0, Number(player.buildings.star_wars || 0)) / totalEmpireLand(player) * 100) : 0;
    return <div className="grid md:grid-cols-2 gap-4">
      <Panel title="Economy"><OldTable rows={[
        ["Current Pop.", fmt(player.pop)],
        [`Pop. Increase ${intervalLabel}`, fmt(popInc)],
        ["Max Pop.", fmt(caps.maxPop)],
        ["Max Fed Pop.", fmt(caps.maxFed)],
        ["Max Watered Pop.", fmt(caps.maxWatered)],
        ["Max Policed Pop.", fmt(caps.maxPoliced)],
        [`Max Bank ${currencyLabel}.`, fmt(caps.bankCap)],
        [`Bank Interest ${intervalLabel}`, fmt(bankInterest)],
        [`Tax Revenue ${intervalLabel}`, fmt(taxRevenue)],
        [`Total ${currencyLabel} Increase ${intervalLabel}`, fmt(totalCardIncrease)]
      ]} /></Panel>
      <Panel title="Military"><OldTable rows={[
        ["Star Wars / Land", `${fmt(player.buildings.star_wars || 0)} / ${fmt(totalEmpireLand(player))} = ${starWarsLandPct.toFixed(2)}%`],
        ["Star Wars Interception", `${starWarsDefence.toFixed(1)}%`],
        ["Rebels Increase Next 30 min.", player.pop > caps.maxPoliced ? fmt(Math.floor((player.pop - caps.maxPoliced) * 0.01)) : "0"],
        ["Time Since Rebel Raid", "N/A"],
        ["LRC Shots Fired", alliance ? fmt(normaliseAlliance(alliance).lrcShotsFired || 0) : "N/A"],
        ["Max. Opponent Power", fmt(Math.floor(power * 1.5))],
        ["Min. Opponent Power", fmt(Math.floor(power * (2 / 3)))],
        ["Combat Science Bonus", `${scienceLevels.combat || 0}%`],
        ["Army Upkeep Cost Next 30 min.", fmt(Math.floor(armyUnits * 0.02))]
      ]} /></Panel>
      <Panel title="Finish Times"><OldTable rows={[
        ["Barracks Finish Time", player.trainOrder ? remainingTimeLabel(player.trainOrder.finishAt, displayNow) : "None"],
        ["Build Finish Time", player.buildOrder ? remainingTimeLabel(player.buildOrder.finishAt, displayNow) : "None"],
        ["Explore Finish Time", player.exploreOrder ? remainingTimeLabel(player.exploreOrder.finishAt, displayNow) : "None"],
        ["Science Finish Time", scienceOrder ? remainingTimeLabel(scienceOrder.finishAt, displayNow) : "None"],
        ["Spies Finish Time", "None"]
      ]} /></Panel>
      <Panel title="Resources"><OldTable rows={[
        [`${resourceLabel("missiles")} Increase Next 30 min.`, fmt((player.buildings.factories || 0) * parseQty(factoryAllocation.missiles) / 100 * 0.005)],
        [`Energy Increase ${intervalLabel}`, fmt(energyNet)],
        [`${resourceLabel("food")} Increase ${intervalLabel}`, fmt(foodNet)],
        [`Water Increase ${intervalLabel}`, fmt(waterNet)],
        [`Mineral Increase ${intervalLabel}`, fmt((player.buildings.mineral_extractors || 0) * 13)],
        [`Scanner Increase ${intervalLabel}`, fmt((player.buildings.factories || 0) * parseQty(factoryAllocation.scanners) / 100 * 0.25)]
      ]} /></Panel>
    </div>;
  }

  function renderBuild() {
    if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHostedBuildPage();
    const notice = renderCompletionNotice("build");
    if (notice) return notice;
    const pendingBuildPanel = player.buildOrder?.finishAt && !isFinishDue(player.buildOrder.finishAt, displayNow) ? renderPendingOrderPanel(pageLabel("build"), "construction", player.buildOrder.finishAt, cancelConstructionOrder) : null;
    const customBuild = Object.fromEntries(Object.entries(buildForm).map(([id, v]) => [id, parseQty(v)]));
    const customBuildLand = totalBuildings(customBuild);
    const baseCustomCost = buildCost(customBuild);
    const customCost = activeConstructionCost(baseCustomCost);
    const customBuildSeconds = baseCustomCost > 0 ? Math.floor(activeConstructionDurationSeconds(baseCustomCost) / gameSpeed()) : 0;
    const speedMultiplier = activeBuildSpeedMultiplier();
    const h = String(Math.floor(customBuildSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((customBuildSeconds % 3600) / 60)).padStart(2, "0");
    const sec = String(customBuildSeconds % 60).padStart(2, "0");
    const timeBox = (value) => <span className="inline-block min-w-[3.25rem] border border-orange-900 bg-black px-2 py-1 text-center text-orange-100">{value}</span>;
    const infoBox = (label, value, content) => <div className="border border-orange-900 bg-black px-3 py-2 text-center min-w-[9rem]"><div className="text-[10px] uppercase tracking-wide text-orange-600 mb-1">{label}</div><div className="text-orange-100">{content || value}</div></div>;
    return <Panel title={pageLabel("build")}>{pendingBuildPanel}
      <table className="w-full text-sm mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Structure</th><th className="text-right p-1">Owned</th><th className="text-right p-1">Cost</th><th className="text-right p-1">{actionLabel("build")}</th><th className="text-right p-1">Day 1</th></tr></thead><tbody>{buildingOrder.map(([id, name, cost]) => <tr key={id} className="border-b border-orange-950"><td className="p-1">{buildingLabel(id)}</td><td className="p-1 text-right">{fmt(player.buildings[id])}</td><td className="p-1 text-right">{fmt(cost)}</td><td className="p-1 text-right"><TextInput value={buildForm[id]} onChange={(v) => setBuildForm((f) => ({ ...f, [id]: v }))} onEnter={startCustomBuild} /></td><td className="p-1 text-right">{day1Build[id] || ""}</td></tr>)}</tbody></table>
      <div className="mb-4 max-w-xs border border-orange-900 bg-black px-3 py-2 text-center"><div className="text-[10px] uppercase tracking-wide text-orange-600 mb-1">Land Used</div><div className="text-orange-100">{fmt(customBuildLand)}</div></div>
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-1 text-orange-300 text-sm">{timeBox(h)}<span>:</span>{timeBox(m)}<span>:</span>{timeBox(sec)}</div>
        <div className="flex flex-wrap justify-center gap-2">{infoBox("Speed Factor", null, <div className="flex justify-center items-center gap-2"><TextInput className="w-16 text-center" value={buildSpeedFactor} onChange={setBuildSpeedFactor} placeholder="1-9" /><span className="text-orange-600">/ 9</span></div>)}{infoBox("Final Cost", fmt(customCost))}{adminMode && infoBox("Build Speed", `${speedMultiplier.toFixed(2)}x`)}</div>
        <div className="flex gap-2 mt-2 flex-wrap justify-center"><button className="classic-btn antro-action-btn" onClick={() => setBuildForm({ ...emptyBuildForm(), ...Object.fromEntries(Object.entries(day1Build).map(([k, v]) => [k, String(v)])) })}>Fill Day 1 Values</button><button className="classic-btn antro-action-btn" onClick={startCustomBuild} disabled={!!player.buildOrder}>{actionLabel("startConstruction")}</button>{adminMode && <button className="classic-btn antro-action-btn" onClick={completeBuild} disabled={!player.buildOrder}>{`Trigger Finish ${actionLabel("startConstruction").replace(/^Start /, "")}`}</button>}<button className="classic-btn antro-action-btn" onClick={() => setBuildSpeedFactor("1")}>{`Reset ${actionLabel("reset_speed_factor")}`}</button></div>
      </div>
    </Panel>;
  }

  function getHostedShellSnapshot() {
    return buildHostedShellSnapshot({ hostedRoundState, identitySummary: multiplayerIdentityState.summary, testerAccessRecord });
  }

  function renderHostedPageUnavailable(pageKey) {
    return <Panel title={`Hosted ${pageLabel(pageKey) || pageKey || "Page"}`}>
      <p className="text-orange-200 mb-3">This hosted DEV shell does not expose the {pageLabel(pageKey) || pageKey || "selected"} page yet. Use Status, Build, or the DEV diagnostics panel.</p>
      <div className="flex gap-2 flex-wrap">
        <button className="classic-btn antro-action-btn" onClick={() => setPage("status")}>Go to Status</button>
        <button className="classic-btn antro-action-btn" onClick={() => setPage("build")}>Go to Build</button>
        <button className="classic-btn antro-action-btn" onClick={() => setHostedDiagnosticsOpen(true)}>Open DEV proof panel / diagnostics</button>
      </div>
    </Panel>;
  }

  const renderSharedMultiplayerPreviewPanel = () => {
    const summary = multiplayerPreviewState.summary || null;
    const round = summary?.round || null;
    const health = multiplayerHealthState.summary || null;
    const players = Array.isArray(summary?.players) ? summary.players : [];
    const recentEvents = Array.isArray(summary?.recentEvents) ? summary.recentEvents : [];
    const recentPublicEvents = Array.isArray(summary?.recentPublicEvents) ? summary.recentPublicEvents : recentEvents;
    const recentActions = Array.isArray(summary?.recentActions) ? summary.recentActions : [];
    const recentTickLogs = Array.isArray(summary?.recentTickLogs) ? summary.recentTickLogs : [];
    const actionSummary = summary?.actionSummary || null;
    const roundSummary = summary?.roundSummary || null;
    const proofBoundary = summary?.proofBoundary || null;
    const hostedSummary = hostedRoundState.summary || null;
    const hostedRound = hostedSummary?.round || null;
    const hostedPlayer = hostedSummary?.player || null;
    const hostedPlayerState = hostedSummary?.playerState || null;
    const hostedBuildings = hostedSummary?.buildings || null;
    const hostedArmies = hostedSummary?.armies || null;
    const hostedActionSummary = hostedSummary?.actionSummary || null;
    const hostedOtherPlayers = Array.isArray(hostedSummary?.otherPlayers) ? hostedSummary.otherPlayers : [];
    const hostedRoundSummary = hostedSummary?.roundSummary || null;
    const previewBusy = multiplayerPreviewState.loading;
    const roundKey = roundSummary?.roundKey || round?.roundKey || MULTIPLAYER_PREVIEW_ROUND_KEY;
    const roundName = roundSummary?.roundName || round?.roundName || "Shared Multiplayer DEV";
    const roundStatus = roundSummary?.roundStatus || round?.status || "Unknown";
    const currentTick = roundSummary?.currentTick ?? round?.currentTick ?? "-";
    const lastPreviewFetchLabel = multiplayerPreviewState.fetchedAt ? new Date(multiplayerPreviewState.fetchedAt).toLocaleString() : "Not refreshed yet";
    const lastHealthFetchLabel = multiplayerHealthState.fetchedAt ? new Date(multiplayerHealthState.fetchedAt).toLocaleString() : "Not refreshed yet";
    const identitySummary = multiplayerIdentityState.summary || (testerAccessRecord?.accepted && testerAccessRecord?.accessMode !== "invite-token" ? multiplayerIdentityFallbackSummary() : null);
    const accessGrant = testerAccessRecord?.accessGrant || null;
    const canEnterHostedDevRound = Boolean(testerAccessRecord?.accepted && testerAccessRecord?.accessMode === "invite-token" && (accessGrant?.grantId || accessGrant?.currentGrantId));
    const hostedGrantId = hostedSummary?.grantId || accessGrant?.grantId || accessGrant?.currentGrantId || "";
    const hostedPlayerLabel = hostedPlayer ? `${hostedPlayer.displayName}${hostedPlayer.testerLabel ? ` / ${hostedPlayer.testerLabel}` : ""}` : (canEnterHostedDevRound ? "Hosted round not entered yet" : "Redeem a real invite token");
    const hostedRoundKey = hostedRound?.roundKey || MULTIPLAYER_PREVIEW_ROUND_KEY;
    const hostedRoundName = hostedRound?.roundName || "Shared Multiplayer DEV";
    const hostedCurrentTick = hostedRound?.currentTick ?? hostedRoundSummary?.currentTick ?? "-";
    const hostedLastFetchLabel = hostedRoundState.fetchedAt ? new Date(hostedRoundState.fetchedAt).toLocaleString() : "Not entered yet";
    const hostedFactoryCount = Number(hostedSummary?.factoryCount ?? hostedBuildings?.factories ?? hostedBuildings?.counts?.factory ?? hostedSummary?.currentPlayerSummary?.factoryCount ?? 0);
    const hostedQueuedCount = Number(hostedSummary?.queuedCount ?? hostedActionSummary?.queued ?? hostedSummary?.currentPlayerSummary?.queuedCount ?? 0);
    const hostedProcessedCount = Number(hostedSummary?.processedCount ?? hostedActionSummary?.processed ?? hostedSummary?.currentPlayerSummary?.processedCount ?? 0);
    const hostedDueNowCount = Number(hostedActionSummary?.dueNow ?? 0);
    const grantId = identitySummary?.grantId || accessGrant?.grantId || accessGrant?.currentGrantId || "";
    const testerLabel = identitySummary?.testerLabel || testerAccessRecord?.testerLabel || accessGrant?.testerLabel || "";
    const displayName = identitySummary?.displayName || (multiplayerIdentityState.loading ? "Resolving multiplayer identity..." : testerAccessRecord?.accessMode === "invite-token" ? "Invite grant pending resolution" : "DEV Invite Tester");
    const resolvedFrom = identitySummary?.resolvedFrom || (testerAccessRecord?.accessMode === "invite-token" ? "invite grant pending" : "development fallback");
    const identityResolved = Boolean(identitySummary?.currentPlayerId || identitySummary?.playerId);
    const playerId = identitySummary?.currentPlayerId || identitySummary?.playerId || "";
    const playerRoundId = identitySummary?.playerRoundId || "";
    const currentIdentityLabel = identityResolved ? displayName : testerAccessRecord?.accessMode === "invite-token" ? "Awaiting invite-token identity resolution" : displayName;
    const identityGuardLabel = identityResolved
      ? (identitySummary?.requestedDisplayNameIgnored || identitySummary?.requestedTesterLabelIgnored ? "Requested labels ignored" : "No override detected")
      : "Not resolved yet";
    const totalPlayerCount = Number(roundSummary?.playerCount ?? players.length ?? 0);
    const canonicalPlayerCount = Number(roundSummary?.canonicalPlayerCount ?? 0);
    const playerCountLabel = canonicalPlayerCount > 0 ? "Canonical players" : "Players";
    const playerCount = canonicalPlayerCount > 0 ? canonicalPlayerCount : totalPlayerCount;
    const legacyPlayerCount = canonicalPlayerCount > 0 ? Number(roundSummary?.legacyPlayerCount ?? Math.max(0, totalPlayerCount - canonicalPlayerCount)) : 0;
    const factoryCount = Number(roundSummary?.factoryCount ?? 0);
    const queuedCount = Number(roundSummary?.queuedCount ?? actionSummary?.queued ?? 0);
    const processedCount = Number(roundSummary?.processedCount ?? actionSummary?.processed ?? 0);
    const dueNowCount = Number(actionSummary?.dueNow ?? 0);
    const latestResetAt = proofBoundary?.latestResetAt || roundSummary?.latestResetAt || null;
    const latestResetEvent = proofBoundary?.latestResetEvent || roundSummary?.latestResetEvent || null;
    const latestResetLabel = latestResetAt ? new Date(latestResetAt).toLocaleString() : "No proof reset yet";
    const latestResetEventLabel = latestResetEvent ? `${latestResetEvent.eventType || latestResetEvent.visibility || "Reset event"} · ${latestResetEvent.id ? maskStableIdentifier(latestResetEvent.id) : "unknown"}` : "No reset event yet";
    const playerSummary = (player = {}) => {
      const state = player.state || {};
      return {
        title: player.displayName || "Unknown player",
        testerLabel: player.testerLabel || "",
        playerId: player.id ? maskStableIdentifier(player.id) : "",
        playerRoundId: player.playerRoundId ? maskStableIdentifier(player.playerRoundId) : "",
        grantId: player.grantId ? maskStableIdentifier(player.grantId) : "",
        accessLinkId: player.accessLinkId ? maskStableIdentifier(player.accessLinkId) : "",
        identityScope: player.identityScope || (player.isGrantLinked ? "canonical" : "diagnostic"),
        isGrantLinked: Boolean(player.isGrantLinked),
        raceLabel: raceNameFromKey(state.raceKey || ""),
        tick: state.tick ?? "—",
        stateVersion: state.stateVersion ?? "—",
        land: fmt(Number(state.land || 0)),
        power: compactFmt(Number(state.power || 0)),
        money: compactFmt(Number(state.money || 0)),
        factoryCount: fmt(Math.max(0, Math.floor(Number(player.factoryCount ?? 0)))),
        queuedCount: fmt(Math.max(0, Math.floor(Number(player.queuedCount ?? 0)))),
        processedCount: fmt(Math.max(0, Math.floor(Number(player.processedCount ?? 0)))),
      };
    };
    const renderStatusCard = (title, rows, note = null) => <div className="border border-orange-950 bg-black/50 p-3">
      <div className="text-sm font-bold text-orange-200 mb-2">{title}</div>
      <OldTable rows={rows} />
      {note ? <div className="text-xs text-orange-600 mt-2">{note}</div> : null}
    </div>;
    return <>
      <Panel title="Browser-Driven Multiplayer Proof">
      <p className="text-orange-200 mb-3">This diagnostic proof stays browser-driven and local to your tester access. Resolve the invite grant, queue +1 factory, run a manual DEV tick, and confirm the updated factory count. The hosted round view below is the player-facing entry path; this panel remains for testing and troubleshooting.</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {canEnterHostedDevRound ? <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Entering Hosted DEV Round..." : hostedSummary ? "Refresh hosted state" : "Enter Hosted DEV Round"}</button> : <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">Redeem a real invite token before entering a hosted round.</span>}
        <button className="classic-btn antro-action-btn" onClick={refreshMultiplayerHealth} disabled={multiplayerHealthState.loading || multiplayerPreviewState.loading}>{multiplayerHealthState.loading ? "Refreshing service health..." : "Refresh service health"}</button>
        <button className="classic-btn antro-action-btn" onClick={refreshMultiplayerPreview} disabled={multiplayerPreviewState.loading || multiplayerDevActionState.loading}>{multiplayerPreviewState.loading ? "Refreshing round summary..." : "Refresh round summary"}</button>
        <button className="classic-btn antro-action-btn" onClick={resolveMyMultiplayerIdentity} disabled={multiplayerIdentityState.loading || multiplayerDevActionState.loading}>{multiplayerIdentityState.loading ? "Resolving identity..." : identityResolved ? "Re-resolve identity" : "Resolve my multiplayer identity"}</button>
        <button className="classic-btn antro-action-btn" onClick={submitMultiplayerDevQueueBuildFactory} disabled={multiplayerDevActionState.loading || multiplayerPreviewState.loading || !identityResolved}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "dev_queue_build_factory" ? "Queuing +1 factory..." : "Queue +1 factory"}</button>
        <button className="classic-btn antro-action-btn" onClick={submitMultiplayerDevManualTick} disabled={multiplayerDevActionState.loading || multiplayerPreviewState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "dev_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
        <button className="classic-btn antro-action-btn" onClick={submitMultiplayerDevResetProofRound} disabled={multiplayerDevActionState.loading || multiplayerPreviewState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "dev_reset_proof_round" ? "Resetting proof window..." : "Reset proof cleanly"}</button>
        <button className="classic-btn antro-action-btn" onClick={submitMultiplayerDevBuildFactory} disabled={multiplayerDevActionState.loading || multiplayerPreviewState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "dev_build_factory" ? "Running legacy proof..." : "Legacy immediate proof: build +1 factory"}</button>
        <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">Server-authorised proof</span>
        <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">{GAME_SERVICE_URL || "Game service unavailable"}</span>
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        {renderStatusCard("Access Status", [
          ["Access mode", testerAccessModeLabel(testerAccessRecord)],
          ["Access accepted", testerAccessRecord?.accepted ? "Yes" : "No"],
          ["Tester label", testerLabel || "—"],
          ["Current browser identity", currentIdentityLabel],
          ["Grant status", accessGrant ? "Invite grant present" : "No invite grant"],
          ["Grant id", grantId ? maskStableIdentifier(grantId) : "—"],
          ["Access source", testerAccessRecord?.accessMode === "invite-token" ? "Invite-token gate" : "Development fallback"],
        ], "Tester access remains browser-local and separate from the save data.")}
        {renderStatusCard("Service Health", [
          ["Reachable", health ? (health.reachable ? "Yes" : "No") : "Unknown"],
          ["Service", health?.service || "Not loaded"],
          ["Version", health?.version || "—"],
          ["Environment", health?.environment || "—"],
          ["Supabase configured", health?.supabaseConfigured === true ? "Yes" : health?.supabaseConfigured === false ? "No" : "Unknown"],
          ["DB reachable", health?.dbReachable === true ? "Yes" : health?.dbReachable === false ? "No" : "Unknown"],
          ["Invite ledger", health?.inviteLedgerReachable === true ? "Yes" : health?.inviteLedgerReachable === false ? "No" : "Unknown"],
          ["DEV endpoints", health?.devEndpointsEnabled === true ? "Enabled" : health?.devEndpointsEnabled === false ? "Disabled" : "Unknown"],
          ["Allowed origins", Number.isFinite(Number(health?.allowedOriginsCount)) ? fmt(Number(health.allowedOriginsCount)) : "—"],
          ["Last refreshed", lastHealthFetchLabel],
        ], "This health check only reports service readiness and never exposes secrets.")}          
        {renderStatusCard("Identity Status", [
          ["Resolved state", identityResolved ? "Resolved" : multiplayerIdentityState.loading ? "Resolving..." : testerAccessRecord?.accessMode === "invite-token" ? "Awaiting resolve" : "Fallback ready"],
          ["Current browser identity", currentIdentityLabel],
          ["Tester label", testerLabel || "—"],
          ["Resolved from", resolvedFrom],
          ["Impersonation guard", identityGuardLabel],
          ["Grant id", grantId ? maskStableIdentifier(grantId) : "—"],
          ["Player id", playerId ? maskStableIdentifier(playerId) : "—"],
          ["Player round id", playerRoundId ? maskStableIdentifier(playerRoundId) : "—"],
          ["Round key", roundKey],
          ["Round name", roundName],
          ["Current tick", currentTick],
          ["Last refreshed", multiplayerIdentityState.fetchedAt ? new Date(multiplayerIdentityState.fetchedAt).toLocaleString() : "Not refreshed yet"],
        ], "Resolve identity before queueing a factory order so the selected grant is linked to the right player.")}
        {renderStatusCard("Round Proof Summary", [
          ["Round status", roundStatus],
          [playerCountLabel, fmt(playerCount)],
          ...(legacyPlayerCount > 0 ? [["Legacy players", fmt(legacyPlayerCount)]] : []),
          ["Factory count", fmt(Math.max(0, Math.floor(factoryCount)))],
          ["Queued rows", fmt(queuedCount)],
          ["Processed rows", fmt(processedCount)],
          ["Due now", fmt(dueNowCount)],
          ["Latest reset at", latestResetLabel],
          ["Latest reset event", latestResetEventLabel],
          ["Recent public events", fmt(recentPublicEvents.length)],
          ["Recent actions", fmt(recentActions.length)],
          ["Recent tick logs", fmt(recentTickLogs.length)],
          ["Last round refresh", lastPreviewFetchLabel],
        ], "The lists below are trimmed to the latest DEV proof boundary.")}          
      </div>
      {previewBusy ? <div className="mt-3 text-xs text-orange-500">Loading shared multiplayer proof data...</div> : null}
      {multiplayerPreviewState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{multiplayerPreviewState.error}</div> : null}
      {multiplayerIdentityState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{multiplayerIdentityState.error}</div> : null}
      {multiplayerIdentityState.message ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{multiplayerIdentityState.message}</div> : null}
      {multiplayerDevActionState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{multiplayerDevActionState.error}</div> : null}
      {multiplayerDevActionState.lastActionMessage ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{multiplayerDevActionState.lastActionMessage}</div> : null}
      {!previewBusy && !multiplayerPreviewState.error && !summary ? <div className="mt-3 text-sm text-orange-600 border border-orange-950 bg-black/50 p-3">Refresh the panel to load the hosted Shared Multiplayer DEV round summary.</div> : null}
      {players.length ? <div className="mt-3 grid gap-2">
        {players.map((player) => {
          const details = playerSummary(player);
          const isCurrentPlayer = identityResolved && player.id === playerId;
          return <div key={player.id} className={`border p-2 ${isCurrentPlayer ? "border-cyan-300 bg-cyan-950/15" : "border-orange-950 bg-black/50"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-orange-200">{details.title}</span>
              {isCurrentPlayer ? <span className="text-[10px] uppercase tracking-wide border border-cyan-300 bg-cyan-950/35 text-cyan-100 px-2 py-0.5">You</span> : null}
              {details.identityScope === "canonical" ? <span className="text-[10px] uppercase tracking-wide border border-cyan-300 bg-cyan-950/35 text-cyan-100 px-2 py-0.5">Canonical</span> : details.identityScope === "legacy" ? <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">Legacy</span> : <span className="text-[10px] uppercase tracking-wide border border-orange-800 bg-black/50 text-orange-500 px-2 py-0.5">Diagnostic</span>}
              {details.testerLabel ? <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">{details.testerLabel}</span> : null}
              {details.playerId ? <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">Player {details.playerId}</span> : null}
            </div>
            <div className="text-xs text-orange-600 mt-1">Race: {details.raceLabel || "Unknown"} · Tick: {details.tick} · State version: {details.stateVersion}</div>
            <div className="text-xs text-orange-600 mt-1">Land: {details.land} · Power: {details.power} · Money: {details.money}</div>
            <div className="text-xs text-orange-700 mt-1">Factory count: {details.factoryCount} · Queued: {details.queuedCount} · Processed: {details.processedCount}{isCurrentPlayer ? " · Current browser identity" : ""}</div>
          </div>;
        })}
      </div> : null}
      <div className="mt-3 text-[10px] uppercase tracking-wide text-orange-600">Recent actions</div>
      {recentActions.length ? <div className="mt-2 grid gap-2">
        {recentActions.map((action) => {
          const result = action.resultSummary || null;
          return <div key={action.id} className="border border-orange-950 bg-black/50 p-2">
            <div className="text-[10px] uppercase tracking-wide text-orange-600">Request tick {action.requestedTick ?? "—"} · Execute after {action.executeAfterTick ?? "—"} · {action.status || "unknown"}</div>
            <div className="font-bold text-orange-200 mt-1">{action.actionType || "Action"}</div>
            {result ? <div className="text-xs text-orange-200 mt-1">Factory: {result.oldCount ?? "—"} {"->"} {result.newCount ?? "—"} · Amount: {result.amount ?? "—"} · Tick: {result.tick ?? "—"}</div> : null}
            {action.errorMessage ? <div className="text-xs text-red-300 mt-1">{action.errorMessage}</div> : null}
          </div>;
        })}
      </div> : null}
      <div className="mt-3 text-[10px] uppercase tracking-wide text-orange-600">Recent tick logs</div>
      {recentTickLogs.length ? <div className="mt-2 grid gap-2">
        {recentTickLogs.map((tickLog) => {
          const tickSummary = tickLog.summary || {};
          return <div key={tickLog.id} className="border border-orange-950 bg-black/50 p-2">
            <div className="text-[10px] uppercase tracking-wide text-orange-600">Tick {tickLog.tick ?? "—"} · {tickLog.status || "unknown"}</div>
            <div className="font-bold text-orange-200 mt-1">Manual DEV tick</div>
            <div className="text-xs text-orange-200 mt-1">Processed: {tickSummary.processedTotal ?? tickSummary.processed_total ?? 0} · Factory builds: {tickSummary.factoryBuilds ?? tickSummary.factory_builds ?? 0} · Failed: {tickSummary.failedTotal ?? tickSummary.failed_total ?? 0}</div>
            {tickLog.errorMessage ? <div className="text-xs text-red-300 mt-1">{tickLog.errorMessage}</div> : null}
          </div>;
        })}
      </div> : null}
      <div className="mt-3 text-[10px] uppercase tracking-wide text-orange-600">Recent public events</div>
      {recentPublicEvents.length ? <div className="mt-2 grid gap-2">
        {recentPublicEvents.map((event) => <div key={event.id} className="border border-orange-950 bg-black/50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-orange-600">Tick {event.tick ?? "—"} · {event.visibility || "unknown"}</div>
          <div className="font-bold text-orange-200 mt-1">{event.title || event.eventType || "Event"}</div>
          {event.body ? <div className="text-xs text-orange-200 mt-1 whitespace-pre-line">{event.body}</div> : null}
          <div className="text-[11px] text-orange-700 mt-1">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}</div>
        </div>)}
      </div> : null}
      <p className="text-xs text-orange-600 mt-3">This proof is read-only until you click a DEV action button. It does not write to localStorage or Supabase, and it does not change the browser-local GLW or IG saves.</p>
    </Panel>
    <Panel title="Hosted DEV Round">
      <p className="text-orange-200 mb-3">This is the player-facing hosted round entry view. It loads canonical server state from your invite-token grant instead of guessing from browser-local saves.</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={!canEnterHostedDevRound || hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Loading hosted state..." : hostedSummary ? "Refresh hosted state" : "Enter Hosted DEV Round"}</button>
        <button className="classic-btn antro-action-btn" onClick={submitHostedDevQueueBuildFactory} disabled={!hostedSummary || hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_queue_build_factory" ? "Queuing +1 factory..." : "Queue +1 factory"}</button>
        <button className="classic-btn antro-action-btn" onClick={submitHostedDevManualTick} disabled={!hostedSummary || hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
        <button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>
        <span className="text-[10px] uppercase tracking-wide border border-cyan-700 bg-[#0b1d24] text-cyan-200 px-2 py-0.5">Invite-token hosted entry</span>
      </div>
      {hostedRoundState.error ? <div className="mb-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{hostedRoundState.error}</div> : null}
      {hostedRoundState.message ? <div className="mb-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{hostedRoundState.message}</div> : null}
      {!hostedSummary ? <div className="text-sm text-orange-600 border border-orange-950 bg-black/50 p-3">Redeem a real invite token and click Enter Hosted DEV Round to load your canonical hosted state.</div> : <div className="grid lg:grid-cols-2 gap-3">
        {renderStatusCard("Hosted Access", [
          ["Access mode", testerAccessModeLabel(testerAccessRecord)],
          ["Access accepted", testerAccessRecord?.accepted ? "Yes" : "No"],
          ["Tester label", hostedPlayer?.testerLabel || testerLabel || "—"],
          ["Current browser identity", hostedPlayerLabel],
          ["Grant status", accessGrant ? "Invite grant present" : "No invite grant"],
          ["Grant id", hostedGrantId ? maskStableIdentifier(hostedGrantId) : "—"],
          ["Round status", hostedRoundSummary?.roundStatus || hostedRound?.status || "Unknown"],
          ["Last refreshed", hostedLastFetchLabel],
        ], "This hosted view is canonical server state and remains separate from the local launcher save data.")}
        {renderStatusCard("Service Health", [
          ["Reachable", health ? (health.reachable ? "Yes" : "No") : "Unknown"],
          ["Service", health?.service || "Not loaded"],
          ["Version", health?.version || "—"],
          ["Environment", health?.environment || "—"],
          ["Supabase configured", health?.supabaseConfigured === true ? "Yes" : health?.supabaseConfigured === false ? "No" : "Unknown"],
          ["DB reachable", health?.dbReachable === true ? "Yes" : health?.dbReachable === false ? "No" : "Unknown"],
          ["Invite ledger", health?.inviteLedgerReachable === true ? "Yes" : health?.inviteLedgerReachable === false ? "No" : "Unknown"],
          ["DEV endpoints", health?.devEndpointsEnabled === true ? "Enabled" : health?.devEndpointsEnabled === false ? "Disabled" : "Unknown"],
          ["Allowed origins", Number.isFinite(Number(health?.allowedOriginsCount)) ? fmt(Number(health.allowedOriginsCount)) : "—"],
          ["Last refreshed", lastHealthFetchLabel],
        ], "This health check only reports service readiness and never exposes secrets.")}
        {renderStatusCard("Canonical Player State", [
          ["Round name", hostedRoundName],
          ["Round key", hostedRoundKey],
          ["Current tick", hostedCurrentTick],
          ["Player", hostedPlayerLabel],
          ["Current player id", hostedSummary?.currentPlayerId || hostedSummary?.player?.id ? maskStableIdentifier(hostedSummary.currentPlayerId || hostedSummary.player?.id) : "—"],
          ["Identity scope", hostedSummary?.currentPlayerSummary?.identityScope || (hostedSummary?.currentPlayerSummary?.isGrantLinked ? "canonical" : "diagnostic")],
          ["Factory count", fmt(Math.max(0, Math.floor(hostedFactoryCount)))],
          ["Queued actions", fmt(hostedQueuedCount)],
          ["Processed actions", fmt(hostedProcessedCount)],
          ["Due now", fmt(hostedDueNowCount)],
          ["Race", raceNameFromKey(hostedPlayerState?.raceKey || "")],
          ["State version", hostedPlayerState?.stateVersion ?? "—"],
          ["Land", hostedPlayerState ? fmt(Number(hostedPlayerState.land || 0)) : "—"],
          ["Power", hostedPlayerState ? compactFmt(Number(hostedPlayerState.power || 0)) : "—"],
          ["Money", hostedPlayerState ? compactFmt(Number(hostedPlayerState.money || 0)) : "—"],
          ["Buildings", `Factories ${fmt(Math.max(0, Math.floor(Number(hostedBuildings?.counts?.factory ?? 0))))} · Barracks ${fmt(Math.max(0, Math.floor(Number(hostedBuildings?.counts?.barracks ?? 0))))} · Banks ${fmt(Math.max(0, Math.floor(Number(hostedBuildings?.counts?.bank ?? 0))))} · Science labs ${fmt(Math.max(0, Math.floor(Number(hostedBuildings?.counts?.scienceLabs ?? 0))))}`],
          ["Armies", `Infantry ${fmt(Math.max(0, Math.floor(Number(hostedArmies?.counts?.infantry ?? 0))))} · Defense ${fmt(Math.max(0, Math.floor(Number(hostedArmies?.counts?.defense ?? 0))))} · Training ${fmt(Math.max(0, Math.floor(Number(hostedArmies?.counts?.training ?? 0))))} · Returning ${fmt(Math.max(0, Math.floor(Number(hostedArmies?.counts?.returning ?? 0))))}`],
        ], "Loaded directly from the hosted game-service so the player view stays canonical.")}
        {renderStatusCard("Other Players", hostedOtherPlayers.length ? hostedOtherPlayers.map((player, index) => [`Player ${index + 1}`, `${player.displayName || "Unknown player"}${player.testerLabel ? ` / ${player.testerLabel}` : ""} · Factories ${fmt(Math.max(0, Math.floor(Number(player.factoryCount ?? 0))))} · Queued ${fmt(Math.max(0, Math.floor(Number(player.queuedCount ?? 0))))} · Processed ${fmt(Math.max(0, Math.floor(Number(player.processedCount ?? 0))))} · Tick ${player.currentTick ?? "—"}`]) : [["Other players", "No other hosted players are visible yet."]], "Compact public summaries only.")}
      </div>}
      <p className="text-xs text-orange-600 mt-3">Hosted actions still call the existing DEV endpoints for now, but the round view itself is sourced from the server so the player state is canonical.</p>
    </Panel>
  </>;
  };
  function renderHostedDiagnosticsPanel() {
    return <div className="grid gap-4">{renderSharedMultiplayerPreviewPanel()}</div>;
  }

  function renderHostedStatusPage() {
    const hosted = getHostedShellSnapshot();
    if (!hosted.summary) return renderHostedPageUnavailable("status");
    const hostedSummaryRows = [
      ["Mode", "Hosted DEV Round"],
      ["Current browser identity", hosted.playerLabel],
      ["Player id", hosted.playerId ? maskStableIdentifier(hosted.playerId) : "—"],
      ["Round name", hosted.roundName],
      ["Round key", hosted.roundKey],
      ["Round status", hosted.roundStatus],
      ["Current tick", hosted.currentTick],
      ["Race", hosted.raceLabel || "Unknown"],
      ["Land", fmt(Math.max(0, Math.floor(hosted.land)))],
      ["Power", fmt(Math.max(0, Math.floor(hosted.power)))],
      ["Money", fmt(Math.max(0, Math.floor(hosted.money)))],
      ["Energy", fmt(Math.max(0, Math.floor(hosted.energy)))],
      ["Food", fmt(Math.max(0, Math.floor(hosted.food)))],
      ["Water", fmt(Math.max(0, Math.floor(hosted.water)))],
      ["Population", fmt(Math.max(0, Math.floor(hosted.population)))],
      ["Factories", fmt(Math.max(0, Math.floor(hosted.factoryCount)))],
      ["Queued actions", fmt(Math.max(0, Math.floor(hosted.queuedCount)))],
      ["Orders ready to complete", fmt(Math.max(0, Math.floor(hosted.dueNowCount)))],
      ["Processed actions", fmt(Math.max(0, Math.floor(hosted.processedCount)))],
      ["Other players", hosted.otherPlayerSummary],
      ["Last hosted refresh", hosted.lastFetchLabel],
    ];
    return <div className="grid gap-4">
      <Panel title="Status">
        <p className="mb-3 text-orange-200">Hosted DEV Round mode uses canonical server state. This shell is separate from local save slots and keeps the player-facing view in the normal AntrophAI style.</p>
        <OldTable rows={hostedSummaryRows} />
        {hostedRoundState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{hostedRoundState.error}</div> : null}
        {hostedRoundState.message ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{hostedRoundState.message}</div> : null}
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Refreshing hosted state..." : "Refresh hosted state"}</button>
          <button className="classic-btn antro-action-btn" onClick={() => setPage("build")} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>Go to Build</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevQueueBuildFactory} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_queue_build_factory" ? "Queuing +1 factory..." : "Queue +1 Factory"}</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevManualTick} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
          <button className="classic-btn antro-action-btn" onClick={() => setHostedDiagnosticsOpen((value) => !value)}>{hostedDiagnosticsOpen ? "Hide DEV proof panel / diagnostics" : "Open DEV proof panel / diagnostics"}</button>
          <button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>
        </div>
      </Panel>
      {hostedDiagnosticsOpen ? renderHostedDiagnosticsPanel() : null}
    </div>;
  }

  function renderHostedBuildPage() {
    const hosted = getHostedShellSnapshot();
    if (!hosted.summary) return renderHostedPageUnavailable("build");
    return <div className="grid gap-4">
      <Panel title="Build">
        <p className="mb-3 text-orange-200">Hosted DEV Build stays focused on factory orders. Queue +1 Factory uses the hosted game-service and the current grant-linked player only.</p>
        <OldTable rows={[
          ["Mode", "Hosted DEV Round"],
          ["Current browser identity", hosted.playerLabel],
          ["Round name", hosted.roundName],
          ["Round key", hosted.roundKey],
          ["Round status", hosted.roundStatus],
          ["Current tick", hosted.currentTick],
          ["Current factories", fmt(Math.max(0, Math.floor(hosted.factoryCount)))],
          ["Queued factory builds", fmt(Math.max(0, Math.floor(hosted.queuedCount)))],
          ["Orders ready to complete", fmt(Math.max(0, Math.floor(hosted.dueNowCount)))],
          ["Processed builds", fmt(Math.max(0, Math.floor(hosted.processedCount)))],
          ["Other players", hosted.otherPlayerSummary],
          ["Last hosted refresh", hosted.lastFetchLabel],
        ]} />
        <h3 className="mt-4 mb-1 text-orange-300 font-bold">Construction Orders</h3>
        <p className="mb-2 text-xs text-orange-600">Canonical building counts and queued orders come from the hosted game-service.</p>
        <OldTable rows={hosted.buildingRows.map((row) => [row.label, <span key={row.buildingKey} className="inline-flex items-center gap-2">
          <span>{fmt(row.count)}</span>
          <button className="classic-btn antro-action-btn" onClick={() => submitHostedDevQueueBuildOrder(row.buildingKey)} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === `hosted_queue_build_${row.buildingKey}` ? `Queuing +1 ${row.label}...` : `Queue +1 ${row.label}`}</button>
        </span>])} />
        {hostedRoundState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{hostedRoundState.error}</div> : null}
        {hostedRoundState.message ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{hostedRoundState.message}</div> : null}
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevQueueBuildFactory} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_queue_build_factory" ? "Queuing +1 factory..." : "Queue +1 Factory"}</button>
          <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Refreshing hosted state..." : "Refresh hosted state"}</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevManualTick} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
          <button className="classic-btn antro-action-btn" onClick={() => setHostedDiagnosticsOpen((value) => !value)}>{hostedDiagnosticsOpen ? "Hide DEV proof panel / diagnostics" : "Open DEV proof panel / diagnostics"}</button>
          <button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>
        </div>
      </Panel>
      {hostedDiagnosticsOpen ? renderHostedDiagnosticsPanel() : null}
    </div>;
  }

  function renderHostedBarracksPage() {
    const hosted = getHostedShellSnapshot();
    if (!hosted.summary) return renderHostedPageUnavailable("barracks");
    return <div className="grid gap-4">
      <Panel title="Barracks">
        <p className="mb-3 text-orange-200">Hosted DEV Barracks trains canonical server units. Training orders take real time; finished orders complete when you visit this screen.</p>
        <OldTable rows={[
          ["Mode", "Hosted DEV Round"],
          ["Current browser identity", hosted.playerLabel],
          ["Round name", hosted.roundName],
          ["Round key", hosted.roundKey],
          ["Round status", hosted.roundStatus],
          ["Current tick", hosted.currentTick],
          ["Species", hosted.raceLabel || "Unknown"],
          ["Queued orders", fmt(Math.max(0, Math.floor(hosted.queuedCount)))],
          ["Orders ready to complete", fmt(Math.max(0, Math.floor(hosted.dueNowCount)))],
          ["Last hosted refresh", hosted.lastFetchLabel],
        ]} />
        <h3 className="mt-4 mb-1 text-orange-300 font-bold">Training Orders</h3>
        <p className="mb-2 text-xs text-orange-600">Canonical unit counts come from the hosted game-service. Units in training join the standing army when their finished order completes on this screen.</p>
        <OldTable rows={hosted.armyRows.map((row) => [row.label, <span key={row.unitKey} className="inline-flex items-center gap-2">
          <span>{fmt(row.count)}{row.trainingCount > 0 ? ` (+${fmt(row.trainingCount)} training)` : ""}</span>
          <button className="classic-btn antro-action-btn" onClick={() => submitHostedDevQueueTrainUnits(row.unitSlot)} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === `hosted_queue_train_${row.unitSlot}` ? `Training +1 ${row.label}...` : `Train +1 ${row.label}`}</button>
        </span>])} />
        {hostedRoundState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{hostedRoundState.error}</div> : null}
        {hostedRoundState.message ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{hostedRoundState.message}</div> : null}
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Refreshing hosted state..." : "Refresh hosted state"}</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevManualTick} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
          <button className="classic-btn antro-action-btn" onClick={() => setHostedDiagnosticsOpen((value) => !value)}>{hostedDiagnosticsOpen ? "Hide DEV proof panel / diagnostics" : "Open DEV proof panel / diagnostics"}</button>
          <button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>
        </div>
      </Panel>
      {hostedDiagnosticsOpen ? renderHostedDiagnosticsPanel() : null}
    </div>;
  }

  function renderHostedExplorePage() {
    const hosted = getHostedShellSnapshot();
    if (!hosted.summary) return renderHostedPageUnavailable("explore");
    const exploreHoursValue = Math.floor(Number(hostedExploreHours) || 0);
    const exploreSpendValue = Math.floor(Number(hostedExploreSpend) || 0);
    const estimatedGain = exploreHoursValue > 0 && exploreSpendValue > 0 ? hostedExploreEstimate(exploreHoursValue, exploreSpendValue, Math.max(1, hosted.land)) : 0;
    return <div className="grid gap-4">
      <Panel title="Explore">
        <p className="mb-3 text-orange-200">Hosted DEV Explore sends scouts for canonical server land. Explorations take real time; finished explorations complete when you visit this screen.</p>
        <OldTable rows={[
          ["Mode", "Hosted DEV Round"],
          ["Current browser identity", hosted.playerLabel],
          ["Round name", hosted.roundName],
          ["Round key", hosted.roundKey],
          ["Round status", hosted.roundStatus],
          ["Current tick", hosted.currentTick],
          ["Land", fmt(Math.max(0, Math.floor(hosted.land)))],
          ["Money", fmt(Math.max(0, Math.floor(hosted.money)))],
          ["Queued orders", fmt(Math.max(0, Math.floor(hosted.queuedCount)))],
          ["Orders ready to complete", fmt(Math.max(0, Math.floor(hosted.dueNowCount)))],
          ["Last hosted refresh", hosted.lastFetchLabel],
        ]} />
        <h3 className="mt-4 mb-1 text-orange-300 font-bold">Exploration</h3>
        <p className="mb-2 text-xs text-orange-600">The estimated return uses the reference formula; the hosted game-service locks the authoritative gain when the exploration is queued.</p>
        <OldTable rows={[
          ["Explore hours", <TextInput key="hours" value={hostedExploreHours} onChange={(v) => setHostedExploreHours(String(Math.max(0, Math.floor(Number(v) || 0))))} className="w-24" />],
          ["Money spend", <TextInput key="spend" value={hostedExploreSpend} onChange={(v) => setHostedExploreSpend(String(Math.max(0, Math.floor(Number(v) || 0))))} className="w-32" />],
          ["Estimated land return", fmt(estimatedGain)],
        ]} />
        {hostedRoundState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{hostedRoundState.error}</div> : null}
        {hostedRoundState.message ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{hostedRoundState.message}</div> : null}
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevQueueExplore} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId || exploreHoursValue <= 0 || exploreSpendValue <= 0}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_queue_explore" ? "Queuing exploration..." : "Start Exploration"}</button>
          <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Refreshing hosted state..." : "Refresh hosted state"}</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevManualTick} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
          <button className="classic-btn antro-action-btn" onClick={() => setHostedDiagnosticsOpen((value) => !value)}>{hostedDiagnosticsOpen ? "Hide DEV proof panel / diagnostics" : "Open DEV proof panel / diagnostics"}</button>
          <button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>
        </div>
      </Panel>
      {hostedDiagnosticsOpen ? renderHostedDiagnosticsPanel() : null}
    </div>;
  }

  function renderHostedSciencePage() {
    const hosted = getHostedShellSnapshot();
    if (!hosted.summary) return renderHostedPageUnavailable("science");
    const scienceLabs = Number(hosted.buildingRows.find((row) => row.buildingKey === "science_labs")?.count || 0);
    return <div className="grid gap-4">
      <Panel title="Science Labs">
        <p className="mb-3 text-orange-200">Hosted DEV Science researches canonical server levels. Research takes real time; finished research completes when you visit this screen. One research order per field at a time.</p>
        <OldTable rows={[
          ["Mode", "Hosted DEV Round"],
          ["Current browser identity", hosted.playerLabel],
          ["Round name", hosted.roundName],
          ["Round key", hosted.roundKey],
          ["Round status", hosted.roundStatus],
          ["Current tick", hosted.currentTick],
          ["Science Labs", fmt(scienceLabs)],
          ["Queued orders", fmt(Math.max(0, Math.floor(hosted.queuedCount)))],
          ["Orders ready to complete", fmt(Math.max(0, Math.floor(hosted.dueNowCount)))],
          ["Last hosted refresh", hosted.lastFetchLabel],
        ]} />
        <h3 className="mt-4 mb-1 text-orange-300 font-bold">Research Fields</h3>
        <p className="mb-2 text-xs text-orange-600">Canonical research levels come from the hosted game-service. Next-level research time uses the reference curve; the server locks the authoritative duration from the current level when the order is queued. Research requires at least one completed Science Lab.</p>
        <OldTable rows={hosted.scienceRows.map((row) => [row.label, <span key={row.field} className="inline-flex items-center gap-2">
          <span>Level {fmt(row.level)}</span>
          <span className="text-orange-600 text-xs">next: {durationHms(row.nextLevelSeconds / gameSpeed())}</span>
          <button className="classic-btn antro-action-btn" onClick={() => submitHostedDevQueueScience(row.field)} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId || scienceLabs <= 0}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === `hosted_queue_science_${row.field}` ? `Researching ${row.label}...` : `Research ${row.label}`}</button>
        </span>])} />
        {hostedRoundState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{hostedRoundState.error}</div> : null}
        {hostedRoundState.message ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{hostedRoundState.message}</div> : null}
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Refreshing hosted state..." : "Refresh hosted state"}</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevManualTick} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
          <button className="classic-btn antro-action-btn" onClick={() => setHostedDiagnosticsOpen((value) => !value)}>{hostedDiagnosticsOpen ? "Hide DEV proof panel / diagnostics" : "Open DEV proof panel / diagnostics"}</button>
          <button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>
        </div>
      </Panel>
      {hostedDiagnosticsOpen ? renderHostedDiagnosticsPanel() : null}
    </div>;
  }

  function renderHostedBankPage() {
    const hosted = getHostedShellSnapshot();
    if (!hosted.summary) return renderHostedPageUnavailable("bank");
    const banked = Math.max(0, Math.floor(hosted.banked));
    const bankCap = Math.max(0, Math.floor(hosted.bankCap));
    return <div className="grid gap-4">
      <Panel title="Bank">
        <p className="mb-3 text-orange-200">Hosted DEV Bank stores canonical server money. Each Bank protects 250,000 and generates interest each tick. Deposit and withdraw apply immediately.</p>
        <OldTable rows={[
          ["Mode", "Hosted DEV Round"],
          ["Current browser identity", hosted.playerLabel],
          ["Round name", hosted.roundName],
          ["Round key", hosted.roundKey],
          ["Current tick", hosted.currentTick],
          ["Money on hand", fmt(Math.max(0, Math.floor(hosted.money)))],
          ["Banked / Capacity", `${fmt(banked)} / ${fmt(bankCap)}`],
          ["Banks", fmt(Math.max(0, Math.floor(hosted.banksCount)))],
          ["Last hosted refresh", hosted.lastFetchLabel],
        ]} />
        <div className="mt-4 mb-4"><label className="block text-orange-300 mb-1">Deposit/Withdraw amount</label><TextInput value={hostedBankAmount} onChange={(v) => setHostedBankAmount(String(Math.max(0, Math.floor(Number(v) || 0))))} className="w-48" /></div>
        {hostedRoundState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{hostedRoundState.error}</div> : null}
        {hostedRoundState.message ? <div className="mt-3 border border-green-900 bg-green-950/35 p-3 text-sm text-green-200">{hostedRoundState.message}</div> : null}
        {multiplayerDevActionState.error ? <div className="mt-3 border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{multiplayerDevActionState.error}</div> : null}
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevBankDeposit} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_bank_deposit" ? "Depositing..." : "Deposit"}</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevBankWithdraw} disabled={hostedRoundState.loading || multiplayerDevActionState.loading || !hosted.playerId}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_bank_withdraw" ? "Withdrawing..." : "Withdraw"}</button>
          <button className="classic-btn antro-action-btn" onClick={enterHostedDevRound} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{hostedRoundState.loading ? "Refreshing hosted state..." : "Refresh hosted state"}</button>
          <button className="classic-btn antro-action-btn" onClick={submitHostedDevManualTick} disabled={hostedRoundState.loading || multiplayerDevActionState.loading}>{multiplayerDevActionState.loading && multiplayerDevActionState.lastActionType === "hosted_manual_tick" ? "Running manual DEV tick..." : "Run manual DEV tick"}</button>
          <button className="classic-btn antro-action-btn" onClick={() => setHostedDiagnosticsOpen((value) => !value)}>{hostedDiagnosticsOpen ? "Hide DEV proof panel / diagnostics" : "Open DEV proof panel / diagnostics"}</button>
          <button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>
        </div>
      </Panel>
      {hostedDiagnosticsOpen ? renderHostedDiagnosticsPanel() : null}
    </div>;
  }

  function renderDestroy() {
    const requested = Object.fromEntries(Object.entries(destroyForm).map(([id, value]) => [id, parseQty(value)]));
    const destroyQty = totalBuildings(requested);
    return <Panel title={pageLabel("destroy")}><p className="mb-3 text-orange-200">{pageLabel("destroy")} completed structures to return the land to free land. No {currencyLabel} is refunded.</p><table className="w-full text-sm mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Structure</th><th className="text-right p-1">Owned</th><th className="text-right p-1">{actionLabel("destroy_verb")}</th></tr></thead><tbody>{buildingOrder.map(([id, name]) => <tr key={id} className="border-b border-orange-950"><td className="p-1">{buildingLabel(id)}</td><td className="p-1 text-right">{fmt(player.buildings[id])}</td><td className="p-1 text-right"><TextInput value={destroyForm[id]} onChange={(v) => setDestroyForm((f) => ({ ...f, [id]: v }))} onEnter={destroyBuildings} /></td></tr>)}</tbody></table><OldTable rows={[["Buildings selected", fmt(destroyQty)], ["Land returned", fmt(destroyQty)], [`${currencyLabel} refunded`, "0"]]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={destroyBuildings}>{`${actionLabel("destroy_verb")} Selected`}</button><button className="classic-btn antro-action-btn" onClick={destroyAllBuildings}>Fill All Structures</button><button className="classic-btn antro-action-btn" onClick={() => setDestroyForm(emptyBuildForm())}>Clear</button></div></Panel>;
  }

  function renderExplore() {
    if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHostedExplorePage();
    const notice = renderCompletionNotice("explore");
    if (notice) return notice;
    if (player.exploreOrder?.finishAt && !isFinishDue(player.exploreOrder.finishAt, displayNow)) return renderPendingOrderPanel(pageLabel("explore"), "exploration", player.exploreOrder.finishAt, cancelExploreOrder);
    if (roundSettings.exploreEnabled === false) return <Panel title={pageLabel("explore")}><p className="mb-3 text-orange-200">{pageLabel("explore")} is disabled in this round profile.</p><OldTable rows={[["Game", gameName], ["Selected Profile", roundProfile], [pageLabel("explore"), "Disabled"]]} /></Panel>;
    const h = Math.floor(Number(exploreHours) || 0);
    const requestedSpend = parseQty(exploreCards);
    const spendValid = requestedSpend > 0 && requestedSpend <= player.cards;
    const estimated = h > 0 && spendValid ? estimateExploreGain(h, requestedSpend) : 0;
    const blocked = estimated > land;
    const validation = requestedSpend <= 0 ? `Enter ${currencyLabel} spend` : requestedSpend > player.cards ? `Not enough ${currencyLabel}` : blocked ? "Rejected: return would exceed existing land" : "OK";
    return <Panel title={pageLabel("explore")}><p className="mb-3">Use {currencyLabel} to {String(actionLabel("explore_verb")).toLowerCase()} for new land. Formula is currently our best reconstruction guess: time, Cardisium and scanners help strongly; larger empires get reduced returns. Scanners are not consumed.</p><OldTable rows={[
      [`${pageLabel("explore")} Hours`, <TextInput value={exploreHours} onChange={(v) => setExploreHours(String(Math.max(0, Math.floor(Number(v) || 0))))} className="w-24" onEnter={() => startExplore(exploreHours, exploreCards)} />],
      [`${currencyLabel} Spend`, <TextInput value={exploreCards} onChange={(v) => setExploreCards(String(Math.max(0, Math.floor(Number(v) || 0))))} className="w-32" onEnter={() => startExplore(exploreHours, exploreCards)} />],
      [`${currencyLabel} Available`, fmt(player.cards)],
      ["Scanners", fmt(player.scanners)],
      ["Scanner Explore Multiplier", `${scannerExploreMultiplier(player).toFixed(2)}x`],
      ["Estimated Land", fmt(estimated)],
      ["Existing Land Limit", fmt(land)],
      ["Validation", validation]
    ]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => startExplore(exploreHours, exploreCards)} disabled={!!player.exploreOrder || player.cards <= 0 || !spendValid || blocked}>{actionLabel("explore_verb")}</button><button className="classic-btn antro-action-btn" onClick={() => setExploreHours("24")}>24h</button><button className="classic-btn antro-action-btn" onClick={() => setExploreHours("48")}>48h</button><button className="classic-btn antro-action-btn" onClick={() => setExploreCards(String(Math.max(0, Math.floor(player.cards || 0))))}>Max Spend</button>{adminMode && <button className="classic-btn antro-action-btn" onClick={completeExplore} disabled={!player.exploreOrder}>{`Trigger ${pageLabel("explore")} Completion`}</button>}</div>{player.exploreOrder && <p className="mt-3 text-orange-300">Expected land: {fmt(player.exploreOrder.gain)} from {fmt(player.exploreOrder.cards || 0)} {currencyLabel}.</p>}</Panel>;
  }

  function renderBarracks() {
    if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHostedBarracksPage();
    const notice = renderCompletionNotice("barracks");
    if (notice) return notice;
    const pendingTrainingPanel = player.trainOrder?.finishAt && !isFinishDue(player.trainOrder.finishAt, displayNow) ? renderPendingOrderPanel(pageLabel("barracks"), "training", player.trainOrder.finishAt, cancelTrainingOrder) : null;
    const race = races[player.race];
    const customTrain = trainForm.map(parseQty);
    const cost = race.unitStats.reduce((sum, u, i) => sum + customTrain[i] * u.cost, 0);
    const currentArmyRows = armyRows(player.race, player.army);
    const rowCaps = effectiveMaxTrainByRow(player.race, { entity: player, useSpeedMinerals: Boolean(useBarracksSpeedMinerals), mode: activeReportTextMode });
    const fillMaxRow = (i) => setTrainForm((f) => f.map((old, idx) => idx === i ? String(rowCaps[i]) : old));
    const customTrainSeconds = cost > 0 ? Math.floor(trainingDurationSeconds(cost, player.buildings, useBarracksSpeedMinerals, player, activeReportTextMode) / gameSpeed()) : 0;
    const h = String(Math.floor(customTrainSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((customTrainSeconds % 3600) / 60)).padStart(2, "0");
    const sec = String(customTrainSeconds % 60).padStart(2, "0");
    const timeBox = (value) => <span className="inline-block min-w-[3.25rem] border border-orange-900 bg-black px-2 py-1 text-center text-orange-100">{value}</span>;
    return <Panel title={pageLabel("barracks")}>{pendingTrainingPanel}
      <table className="w-full text-sm mt-1 mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Unit</th><th className="text-right p-1">Cost</th><th className="text-right p-1">Attack</th><th className="text-right p-1">Defense</th><th className="text-right p-1">Quantity</th><th className="text-right p-1">Fill</th><th className="text-right p-1 border-l border-orange-900">Current</th><th className="text-right p-1">Power</th><th className="text-right p-1">%</th></tr></thead><tbody>{race.unitStats.map((u, i) => { const cur = currentArmyRows[i]; return <tr key={u.name} className="border-b border-orange-950"><td className="p-1">{i + 1}. {u.name}</td><td className="p-1 text-right">{fmt(u.cost)}</td><td className="p-1 text-right">{fmt(u.off)}</td><td className="p-1 text-right">{fmt(u.def)}</td><td className="p-1 text-right"><TextInput value={trainForm[i]} onChange={(v) => setTrainForm((f) => f.map((old, idx) => idx === i ? v : old))} onEnter={startCustomTrain} /></td><td className="p-1 text-right"><button className="classic-btn antro-action-btn" onClick={() => fillMaxRow(i)}>{`Fill ${fmt(rowCaps[i])}`}</button></td><td className="p-1 text-right border-l border-orange-900">{fmt(cur.number)}</td><td className="p-1 text-right">{fmt(cur.power)}</td><td className="p-1 text-right">{cur.percent.toFixed(1)}%</td></tr>; })}</tbody></table>
      <div className="mt-4 flex flex-col items-center gap-2">
        <label className="text-orange-200"><input type="checkbox" className="mr-2" checked={useBarracksSpeedMinerals} onChange={(e) => setUseBarracksSpeedMinerals(e.target.checked)} />Use 2,000 Endaurios + 2,000 Armidi to halve training time</label>
        <div className="flex items-center justify-center gap-1 text-orange-300 text-sm">{timeBox(h)}<span>:</span>{timeBox(m)}<span>:</span>{timeBox(sec)}</div>
        <div className="flex gap-2 mt-2 flex-wrap justify-center"><button className="classic-btn antro-action-btn" onClick={() => { const max = String(race.maxTrain); setTrainForm([max, max, max, max, max, max]); }}>Max Train</button><button className="classic-btn antro-action-btn" onClick={startCustomTrain} disabled={!!player.trainOrder}>{actionLabel("startTraining")}</button>{adminMode && <button className="classic-btn antro-action-btn" onClick={completeTrain} disabled={!player.trainOrder}>{`Trigger Finish ${actionLabel("train")}`}</button>}{adminMode && <button className="classic-btn antro-action-btn" onClick={addPrototypeCards}>Prototype: Add 10,000,000 Cards</button>}</div>
      </div>
    </Panel>;
  }

  function renderDisband() {
    const r = races[player.race];
    const currentPower = armyPower(player.race, player.army);
    return <Panel title={pageLabel("disband")}><p className="mb-3 text-orange-200">Separate {String(pageLabel("disband")).toLowerCase()} page for stack reshaping. This page does not complete {pageLabel("barracks")} orders.</p><OldTable rows={[["Current Army Power", fmt(currentPower)], ["Stack Order", player.stack.join(",")], ["Active Training", player.trainOrder ? `Still running: ${remainingTimeLabel(player.trainOrder.finishAt, displayNow)}` : "None"]]} /><table className="w-full text-sm mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Unit</th><th className="text-right p-1">Current</th><th className="text-right p-1">Power</th><th className="text-right p-1">%</th><th className="text-right p-1">{actionLabel("disband")}</th></tr></thead><tbody>{r.units.map(([name, cost], i) => <tr key={name} className="border-b border-orange-950"><td className="p-1">{name}</td><td className="p-1 text-right">{fmt(player.army[i] || 0)}</td><td className="p-1 text-right">{fmt((player.army[i] || 0) * cost)}</td><td className="p-1 text-right">{currentPower > 0 ? (((player.army[i] || 0) * cost) / currentPower * 100).toFixed(1) : "0.0"}%</td><td className="p-1 text-right"><TextInput value={disbandForm[i]} onChange={(v) => setDisbandForm((f) => f.map((x, idx) => idx === i ? v : x))} onEnter={disbandUnits} /></td></tr>)}</tbody></table><div className="flex gap-2 flex-wrap mt-4 items-center"><button className="classic-btn antro-action-btn" onClick={disbandUnits}>{`${actionLabel("disband")} Selected`}</button><button className="classic-btn antro-action-btn" onClick={disbandAllUnits}>{`Fill ${actionLabel("disband")} All`}</button><button className="classic-btn antro-action-btn" onClick={() => setDisbandForm(["", "", "", "", "", ""])}>Clear</button><label className="text-orange-300 ml-0 md:ml-2">Targets in range</label>{renderTargetSelect({ value: selectedTargetName, onChange: setSelectedTargetName })}</div></Panel>;
  }

  function renderWar() {
    const targets = getSelectableTargets();
    const candidates = getAllWarCandidates();
    const selected = getAttackTargetByName(selectedTargetName);
    const selectedPrivate = selected ? getPrivateOpponentByName(selected.name) : getPrivateOpponentByName(selectedTargetName);
    const selectedDisableCost = selectedPrivate ? turretDisableCostForTarget(selectedPrivate, scienceLevels) : 0;
    const selectedDisableCostLabel = selectedPrivate ? fmt(selectedDisableCost) : "None";
    return <><Panel title={pageLabel("war")}><p className="mb-3 text-orange-200">Only players in attack range are listed. Target stack visibility below is a prototype/bot-only aid; in real player combat, stack order is private and should not be shown.</p><div className="mb-4"><label className="block text-orange-300 mb-1">Target</label>{renderTargetSelect({ value: selectedTargetName, onChange: selectTargetName })}</div><OldTable rows={[
      ["Your Stack", player.stack.join(",")],
      ["Min Normal Range", fmt(Math.floor(power * 2 / 3))],
      ["Max Normal Range", fmt(Math.floor(power * 1.5))],
      ["Max War Range", fmt(Math.floor(power * 2))],
      ["Targets Attackable", fmt(targets.length)],
      ["Protected / Unattackable In Range", fmt(candidates.filter((p) => p.protected).length)],
      ["Selected Target", selected ? `${selected.name}${selected.retalEntry ? " (retal)" : ""}` : (selectedTargetName ? `${selectedTargetName} (not attackable)` : "None")],
      ["Target Status", selected ? (selected.warRange ? "War range" : "Normal range") : selectedPrivate ? protectionLabel(selectedPrivate) : "None"],
      ["Target Stack", selectedPrivate ? `BOT/PROTOTYPE ONLY: ${selectedPrivate.stack.join(",")} — ${stackNames(selectedPrivate.raceKey, selectedPrivate.stack)}` : "None"],
      ["Target Race Key", selectedPrivate ? selectedPrivate.raceKey : "None"],
      ["Target Army Power", selectedPrivate ? fmt(armyPower(selectedPrivate.raceKey, selectedPrivate.army)) : "None"],
      ["Target Turrets", selectedPrivate ? fmt(selectedPrivate.buildings?.turrets || 0) : "None"],
      ["Turrets Disable Cost", selectedPrivate ? selectedDisableCostLabel : "None"]
    ]} /><div className="flex items-center gap-3 mt-4 flex-wrap"><button className="classic-btn antro-action-btn" onClick={demoAttack} disabled={!selected}>{actionLabel("attack")} {selected ? selected.name : "Selected Target"}</button><label className="flex items-center gap-1 text-sm text-orange-200"><input type="checkbox" checked={disableTargetTurrets} onChange={(e) => setDisableTargetTurrets(e.target.checked)} disabled={!selectedPrivate || !(selectedPrivate.buildings?.turrets > 0)} /> Disable turrets</label><span className="text-sm text-orange-300">Turrets disable cost: {selectedDisableCostLabel}</span>{warInlineNotice && <span className={`text-sm text-red-300 transition-opacity duration-[1500ms] ${warInlineNotice.visible ? "opacity-100" : "opacity-0"}`}>{warInlineNotice.text}</span>}</div></Panel><Panel title="War / Stacking"><p className="mb-3 text-orange-200">Click a unit name to move it up one row.</p><div className="border border-orange-900 bg-[#100400] p-3 mb-4"><div className="grid grid-cols-[2rem_1fr_6rem_5rem] gap-2 text-orange-300 bg-[#240B02] px-2 py-1 text-sm font-bold"><span>Row</span><span>Unit</span><span className="text-right">Power</span><span className="text-right">Power %</span></div>{player.stack.map((unitClass, i) => { const row = armyRows(player.race, player.army).find((r) => r.unitClass === unitClass); return <button key={`${unitClass}-${i}`} onClick={() => moveStackUnitUp(i)} className="grid grid-cols-[2rem_1fr_6rem_5rem] gap-2 w-full text-left font-bold text-orange-200 hover:text-orange-50 hover:bg-[#321004] px-2 py-1 border-b border-orange-950 last:border-b-0"><span>{i + 1}</span><span>{races[player.race].units[unitClass - 1][0]}</span><span className="text-right">{fmt(row ? row.power : 0)}</span><span className="text-right">{row ? row.percent.toFixed(1) : "0.0"}%</span></button>; })}</div><OldTable rows={[
      ["Current stack", player.stack.join(",")],
      ["First row", races[player.race].units[player.stack[0] - 1][0]],
      ["Last row", races[player.race].units[player.stack[5] - 1][0]]
    ]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => setPlayer((p) => ({ ...p, stack: [6, 3, 4, 2, 1, 5] }))}>Preset: 6,3,4,2,1,5</button><button className="classic-btn antro-action-btn" onClick={() => setPlayer((p) => ({ ...p, stack: [1, 6, 5, 4, 3, 2] }))}>Preset Defence Test</button></div></Panel></>;
  }

  function renderMines() {
    const totalPer30 = (player.buildings.mineral_extractors || 0) * 13 * zarthMiningMultiplier(player, activeReportTextMode);
    const total = races[player.race].mineableMinerals.map((m) => parseQty(mineAllocation[m])).reduce((a, b) => a + b, 0);
    const minedSoFar = (m) => Math.max(0, totalEmpireLand(player) * MINERAL_RESERVE_PER_LAND - (player.mineralReserves?.[m] ?? totalEmpireLand(player) * MINERAL_RESERVE_PER_LAND));
    return <Panel title="Mines"><table className="w-full text-sm mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Mineral</th><th className="text-right p-1">Reserve Left / Original</th><th className="text-right p-1">Allocation %</th><th className="text-right p-1">Increase Next 30 min</th></tr></thead><tbody>{races[player.race].mineableMinerals.map((m) => { const pct = parseQty(mineAllocation[m]); const original = totalEmpireLand(player) * MINERAL_RESERVE_PER_LAND; const left = Math.max(0, original - minedSoFar(m)); return <tr key={m} className="border-b border-orange-950"><td className="p-1">{mineralLabel(m)}</td><td className="p-1 text-right">{fmt(left)} / {fmt(original)}</td><td className="p-1 text-right"><TextInput className="w-16" value={mineAllocation[m] || "0"} onChange={(v) => setMineAllocation((cur) => ({ ...cur, [m]: clampPercentInput(v) }))} onEnter={() => total === 100 ? addLog("Mine allocation saved.") : addLog(`Mine allocation must add up to 100%. Current total is ${total}%.`)} /></td><td className="p-1 text-right">{fmt(Math.floor(totalPer30 * pct / 100))}</td></tr>; })}</tbody></table><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => total === 100 ? addLog("Mine allocation saved.") : addLog(`Mine allocation must add up to 100%. Current total is ${total}%. Each field must be between 0 and 100.`)}>Save Mine Allocation</button><button className="classic-btn antro-action-btn" onClick={applyMineTick}>Prototype: Mine 30 Minutes</button><button className="classic-btn antro-action-btn" onClick={() => setPlayer((p) => ({ ...p, buildings: { ...p.buildings, mineral_extractors: p.buildings.mineral_extractors + 25 } }))}>Prototype: Add 25 Extractors</button></div></Panel>;
  }

  function renderFactories() { const f = player.buildings.factories || 0; const total = Object.values(factoryAllocation).map(parseQty).reduce((a, b) => a + b, 0); const rows = [["construction", `${actionLabel("build")} Support`, `${(f * parseQty(factoryAllocation.construction) / 100).toFixed(1)} effective units — ${constructionFactoryMultiplier(player.buildings, factoryAllocation).toFixed(2)}x build speed / ${(100 / constructionFactoryMultiplier(player.buildings, factoryAllocation)).toFixed(1)}% build time`], ["scanners", "Scanners", `${(f * parseQty(factoryAllocation.scanners) / 100 * 0.25).toFixed(2)} scanner capacity`], ["missiles", resourceLabel("missiles"), `${(f * parseQty(factoryAllocation.missiles) / 100 * 0.005).toFixed(2)} missile capacity`]]; return <Panel title={buildingLabel("factories")}><p className="mb-3 text-orange-200">Set {String(buildingLabel("factories")).toLowerCase()} percentages. Total must be 100%.</p><table className="w-full text-sm mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Use</th><th className="text-right p-1">Allocation %</th><th className="text-right p-1">Projected Next 30 min</th></tr></thead><tbody>{rows.map(([key, label, proj]) => <tr key={key} className="border-b border-orange-950"><td className="p-1">{label}</td><td className="p-1 text-right"><TextInput className="w-16" value={factoryAllocation[key]} onChange={(v) => setFactoryAllocation((cur) => ({ ...cur, [key]: clampPercentInput(v) }))} /></td><td className="p-1 text-right">{proj}</td></tr>)}</tbody></table><OldTable rows={[[buildingLabel("factories"), fmt(f)], ["Allocation Total", `${total}%`], ["Allocation Status", total === 100 ? "Valid" : "Must total 100%"], ["Construction Multiplier", `${constructionFactoryMultiplier(player.buildings, factoryAllocation).toFixed(2)}x`], ["Current Scanners", fmt(player.scanners)], [`Current ${resourceLabel("missiles")}`, fmt(player.missiles)], ["Scanner cost", `10,000 ${currencyLabel} + scanner minerals each`]]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => total === 100 ? addLog("Factory allocation saved.") : addLog(`Factory allocation must add up to 100%. Current total is ${total}%. Each field must be between 0 and 100.`)}>{`Save ${buildingLabel("factories")} Allocation`}</button><button className="classic-btn antro-action-btn" onClick={applyFactoryTick}>Prototype: Run Factories 30 Minutes</button><button className="classic-btn antro-action-btn" onClick={() => setPlayer((p) => ({ ...p, buildings: { ...p.buildings, factories: p.buildings.factories + 100 } }))}>Prototype: Add 100 Factories</button></div></Panel>; }
  function renderMissiles() {
    const selected = getSelectedTarget();
    const available = Math.min(player.missiles || 0, missileCapacity());
    return <Panel title={resourceLabel("missiles")}>
      <p className="mb-3 text-orange-200">{resourceLabel("missiles")} take 1 hour to arrive. Launches appear in public News.</p>
      <OldTable rows={[
        [resourceLabel("missiles"), fmt(player.missiles)],
        [buildingLabel("missile_bases"), fmt(player.buildings.missile_bases)],
        [`${resourceLabel("missiles")} Capacity`, `${fmt(missileCapacity())} (${fmt(MISSILE_BASES_PER_MISSILE)} bases each)`],
        [`${resourceLabel("missiles")} Available`, fmt(available)],
        ["Launch Energy", `${fmt(MISSILE_LAUNCH_ENERGY_COST)} per missile`],
        [buildingLabel("star_wars"), fmt(player.buildings.star_wars)],
        ["Star Wars / Land", `${fmt(player.buildings.star_wars || 0)} / ${fmt(totalEmpireLand(player))} = ${((totalEmpireLand(player) > 0 ? (Math.max(0, Number(player.buildings.star_wars || 0)) / totalEmpireLand(player) * 100) : 0)).toFixed(2)}%`],
        ["Star Wars Interception", `${starWarsInterceptionPercent(player).toFixed(1)}%`],
        [buildingLabel("blast_shields"), fmt(player.buildings.blast_shields)],
        [buildingLabel("turrets"), fmt(player.buildings.turrets)]
      ]} />
      <div className="mb-4"><label className="block text-orange-300 mb-1">Target</label>{renderTargetSelect({ value: selected ? selected.name : "", onChange: setSelectedTargetName })}</div>
      <div className="flex gap-2 flex-wrap mt-4 mb-4"><TextInput value={missileQty} onChange={setMissileQty} className="w-32" placeholder={resourceLabel("missiles")} /><button className="classic-btn antro-action-btn" onClick={launchMissiles}>{`Launch ${resourceLabel("missiles")}`}</button>{adminMode && <button className="classic-btn antro-action-btn" onClick={() => { setIncomingMissiles((orders) => [{ id: Date.now(), source: "Randy", quantity: 3, arrivesAt: Date.now() + realMillisecondsForGameSeconds(3600) }, ...orders]); addLog("Randy has launched 3 missiles at SONAR. They will arrive in 1 hour."); }}>Prototype: Randy Launches 3</button>}{adminMode && <button className="classic-btn antro-action-btn" onClick={() => { setIncomingMissiles((orders) => [{ id: Date.now(), source: "Prototype Missile Test", quantity: 100, arrivesAt: Date.now() + realMillisecondsForGameSeconds(3600) }, ...orders]); addLog("Prototype Missile Test has launched 100 missiles at SONAR. They will arrive in 1 hour."); }}>Prototype: Launch 100 at Me</button>}{adminMode && <button className="classic-btn antro-action-btn" onClick={() => setPlayer((p) => ({ ...p, missiles: Math.min(missileCapacityForBuildings({ ...p.buildings, missile_bases: (p.buildings.missile_bases || 0) + 200 }), p.missiles + 10), energy: (p.energy || 0) + 100000, buildings: { ...p.buildings, missile_bases: (p.buildings.missile_bases || 0) + 200, star_wars: (p.buildings.star_wars || 0) + 25, blast_shields: (p.buildings.blast_shields || 0) + 90, turrets: (p.buildings.turrets || 0) + 5 } }))}>Prototype: Add Missile Defence</button>}</div>
      <Panel title={`Outgoing ${resourceLabel("missiles")}`}>{outgoingMissiles.length ? <table className="w-full text-sm"><tbody>{outgoingMissiles.map((o) => <tr key={o.id} className="border-b border-orange-950"><td className="p-1">{fmt(o.quantity)} {String(resourceLabel("missiles")).toLowerCase()} to {o.target}</td><td className="p-1 text-right text-orange-300">{missileImpactCountdown(o)}</td><td className="p-1 text-right">{adminMode && <button className="classic-btn antro-action-btn" onClick={() => triggerOutgoingMissileImpact(o.id)}>Trigger Impact</button>}</td></tr>)}</tbody></table> : <p>No outgoing missiles.</p>}</Panel>
      <Panel title={`Incoming ${resourceLabel("missiles")}`}>{incomingMissiles.length ? <table className="w-full text-sm"><tbody>{incomingMissiles.map((o) => <tr key={o.id} className="border-b border-orange-950"><td className="p-1">{fmt(o.quantity)} {String(resourceLabel("missiles")).toLowerCase()} from {o.source}</td><td className="p-1 text-right">{adminMode && <button className="classic-btn antro-action-btn" onClick={() => triggerIncomingMissileImpact(o.id)}>Trigger Impact</button>}</td></tr>)}</tbody></table> : <p>No incoming missiles.</p>}</Panel>
    </Panel>;
  }
    function renderBank() { if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHostedBankPage(); const cap = caps.bankCap; return <Panel title={pageLabel("bank")}><p className="mb-3 text-orange-200">Each {buildingLabel("banks")} protects 250,000 {currencyLabel} and generates interest.</p><OldTable rows={[["Banked/Capacity", `${fmt(player.banked)}/${fmt(cap)}`]]} /><div className="mt-4 mb-4"><label className="block text-orange-300 mb-1">Deposit/Withdraw</label><TextInput value={bankAmount} onChange={setBankAmount} className="w-48" /></div><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={depositBank}>{actionLabel("deposit")}</button><button className="classic-btn antro-action-btn" onClick={withdrawBank}>Withdraw</button><button className="classic-btn antro-action-btn" onClick={() => withdrawBankPercent(0.10)}>Withdraw 10%</button><button className="classic-btn antro-action-btn" onClick={() => withdrawBankPercent(1)}>Withdraw 100%</button><button className="classic-btn antro-action-btn" onClick={fillMaxBank}>Fill max</button></div></Panel>; }
  function renderScience() { if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHostedSciencePage(); const notice = renderCompletionNotice("science"); if (notice) return notice; if (scienceOrder?.finishAt && !isFinishDue(scienceOrder.finishAt, displayNow)) return renderPendingOrderPanel(pageLabel("science"), "research", scienceOrder.finishAt, cancelScienceOrder); const labs = player.buildings.science_labs || 0; const effectiveMultiplier = scienceLabMultiplier(player.buildings); const selectedCurrentLevel = scienceLevels[scienceField] || 0; const selectedSeconds = scienceDurationSeconds(selectedCurrentLevel, player.buildings); return <Panel title={pageLabel("science")}><p className="mb-3 text-orange-200">Science is work in progress. Research time now uses a quadratic next-level curve calibrated to the old IG benchmark: with full labs and perfect utilisation, level 1 to 180 is roughly one 90-day x1 round. {pageLabel("science")} use the same 0/1k/4k curve as {pageLabel("barracks")}.</p><OldTable rows={[[pageLabel("science"), fmt(player.buildings.science_labs)], [`${pageLabel("science")} Speed`, `${effectiveMultiplier.toFixed(2)}x`], ["Selected Next Level", fmt(selectedCurrentLevel + 1)], ["Selected Research Time", durationHms(selectedSeconds / gameSpeed())], ["Active Research", scienceOrder ? `${scienceLabel(scienceOrder.field)} — ${remainingTimeLabel(scienceOrder.finishAt, displayNow)}` : "None"]]} /><table className="w-full text-sm mt-4 mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Field</th><th className="text-right p-1">Level</th><th className="text-left p-1">Current Effect</th></tr></thead><tbody>{Object.keys(scienceLevels).map((field) => <tr key={field} className="border-b border-orange-950"><td className="p-1">{scienceLabel(field)}</td><td className="p-1 text-right">{fmt(scienceLevels[field])}</td><td className="p-1">{scienceEffect(field, scienceLevels[field])}</td></tr>)}</tbody></table><div className="mt-4 mb-4"><label className="block text-orange-300 mb-1">Research Field</label><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={scienceField} onChange={(e) => setScienceField(e.target.value)}>{Object.keys(scienceLevels).map((f) => <option key={f} value={f}>{scienceLabel(f)}</option>)}</select></div><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={startScienceResearch} disabled={!!scienceOrder}>{`Start ${actionLabel("research")}`}</button>{adminMode && <button className="classic-btn antro-action-btn" onClick={completeScienceResearch} disabled={!scienceOrder}>Trigger Finish Research</button>}{adminMode && <button className="classic-btn antro-action-btn" onClick={() => setPlayer((p) => ({ ...p, buildings: { ...p.buildings, science_labs: p.buildings.science_labs + 50 } }))}>{`Prototype: Add 50 ${pageLabel("science")}`}</button>}</div></Panel>; }
  function donateAllianceLand() { const amount = parseQty(donateAllianceLandAmount); if (!alliance) return addLog("You are not currently in an alliance."); if (amount <= 0) return addLog("Enter land to donate."); if (amount > player.freeLand) return addLog(`You only have ${fmt(player.freeLand)} free land.`); setPlayer((p) => ({ ...p, freeLand: p.freeLand - amount })); setAlliance((a) => normaliseAlliance({ ...a, bankLand: (a.bankLand || 0) + amount })); setDonateAllianceLandAmount(""); addLog(`${player.name} donated ${fmt(amount)} land to ${alliance.name}. Alliance total land is now ${fmt(allianceTotalLand({ ...alliance, bankLand: (alliance.bankLand || 0) + amount }))}.`); }
  function startAllianceBankBuild() { const qty = parseQty(allianceBankBuildQty); if (!alliance) return addLog("You are not currently in an alliance."); if (!isAllianceAdmin(player.name, alliance)) return addLog("Only the Leader or Co-Leader can build alliance banks."); if (qty <= 0) return addLog("Enter alliance banks to build."); if (alliance.bankOrder) return addLog("Alliance bank construction is already running."); if ((alliance.bankLand || 0) < qty) return addLog(`Alliance needs ${fmt(qty)} donated land. Current alliance land is ${fmt(alliance.bankLand || 0)}.`); const speed = normaliseAllianceBankSpeedFactor(allianceBankSpeedFactor); const cost = allianceBankBuildCost(qty, speed); if (player.cards < cost) return addLog(`You need ${fmt(cost)} Cardisium to build those alliance banks.`); const seconds = allianceBankBuildSeconds(qty, speed, alliance); setPlayer((p) => ({ ...p, cards: p.cards - cost })); setAlliance((a) => normaliseAlliance({ ...a, bankLand: (a.bankLand || 0) - qty, bankOrder: { quantity: qty, speedFactor: speed, cost, finishAt: Date.now() + realMillisecondsForGameSeconds(seconds), display: oldTime(seconds) } })); addLog(`Alliance bank construction started: ${fmt(qty)} banks at speed factor ${speed}, finished in ${oldTime(seconds)}. Cost: ${fmt(cost)} Cardisium.`); }
  function completeAllianceBankBuild() { if (!alliance?.bankOrder) return addLog("There is no alliance bank order to complete."); const q = alliance.bankOrder.quantity; setAlliance((a) => normaliseAlliance({ ...a, allianceBanks: (a.allianceBanks || 0) + q, bankOrder: null })); addLog(`Alliance bank construction complete: ${fmt(q)} banks added to ${alliance.name}.`); }
  function depositAllianceBankFunds() { const amount = parseQty(allianceBankDepositAmount); if (!alliance) return addLog("You are not currently in an alliance."); if (amount <= 0) return addLog("Enter Cardisium to deposit to the alliance bank."); const cap = allianceBankCapacity(alliance); const space = Math.max(0, cap - (alliance.bankedCards || 0)); if (space <= 0) return addLog("The alliance bank is full."); if (amount > player.cards) return addLog(`You only have ${fmt(player.cards)} Cardisium.`); const actual = Math.min(amount, space); setPlayer((p) => ({ ...p, cards: p.cards - actual })); setAlliance((a) => normaliseAlliance({ ...a, bankedCards: (a.bankedCards || 0) + actual })); setAllianceBankDepositAmount(""); addLog(`${fmt(actual)} Cardisium deposited into the alliance bank.`); }
  function donateLrcCards() {
    const requested = parseQty(lrcCardsAmount);
    if (!alliance) return addLog("You are not currently in an alliance.");
    const current = normaliseAlliance(alliance);
    const remaining = Math.max(0, LRC_CARD_QUOTA - (current.lrcQuota?.cards || 0));
    const amount = Math.min(requested, remaining);
    if (remaining <= 0) return addLog("The LRC Cardisium quota is already complete. No more donations accepted until the LRC resets.");
    if (amount <= 0) return addLog("Enter Cardisium to donate to the LRC.");
    if (amount > player.cards) return addLog(`You only have ${fmt(player.cards)} Cardisium.`);
    setPlayer((p) => ({ ...p, cards: p.cards - amount }));
    setAlliance((a) => { const cur = normaliseAlliance(a); return maybeStartLrcConstructionForAlliance({ ...cur, lrcQuota: { ...cur.lrcQuota, cards: (cur.lrcQuota?.cards || 0) + amount } }); });
    setLrcCardsAmount("");
    addLog(`${fmt(amount)} Cardisium donated to the Long Range Cannon quota.`);
  }

  function donateLrcEnergy() {
    addLog("Energy is not required for the Long Range Cannon in this 2005-style reconstruction.");
  }

  function maybeStartLrcConstructionForAlliance(rawAlliance, now = Date.now()) {
    const cur = normaliseAlliance(rawAlliance);
    if (!lrcQuotaComplete(cur)) return cur;
    if (cur.lrcConstructionFinishAt || String(cur.lrcStatus || "").toLowerCase().includes("ready")) return cur;
    return normaliseAlliance({ ...cur, lrcConstructionFinishAt: now + realMillisecondsForGameSeconds(LRC_CONSTRUCTION_SECONDS), lrcStatus: "Construction phase" });
  }

  function completeLrcConstructionIfDue(rawAlliance, now = Date.now()) {
    const cur = normaliseAlliance(rawAlliance);
    if (cur.lrcConstructionFinishAt && cur.lrcConstructionFinishAt <= now) {
      return normaliseAlliance({ ...cur, lrcConstructionFinishAt: 0, lrcStatus: "Ready to fire" });
    }
    return cur;
  }

  function donateLrcTwentyFiveThousand() {
    setLrcMineralAmount(String(Math.min(LRC_MINERAL_QUOTA, player.minerals[lrcMineralName] || 0)));
  }

  function saveLrcTarget() {
    if (!alliance) return addLog("You are not currently in an alliance.");
    if (!adminMode && !isAllianceAdmin(player.name, alliance)) return addLog("Only the Leader or Co-Leader can select the LRC target.");
    const cur = completeLrcConstructionIfDue(alliance);
    if (!lrcReadyToFire(cur)) return addLog("The Long Range Cannon is not ready to fire yet.");
    if (!lrcTargetName) return addLog("Select an LRC target first.");
    setAlliance((a) => normaliseAlliance({ ...completeLrcConstructionIfDue(a), lrcTargetType, lrcTargetName }));
    addLog(`Long Range Cannon target selected: ${lrcTargetType === "alliance" ? "Alliance" : "Player"} ${lrcTargetName}.`, "LRC");
  }
  function lrcTargetNamesFor(type, name) {
    const cleanName = cleanSingleLineText(name || "", TEXT_LIMITS.targetName).trim();
    if (!cleanName) return [];
    if (type === "alliance") return getDemoPlayers().filter((p) => p.alliance === cleanName && p.name !== player.name).map((p) => p.name);
    const target = getDemoPlayers().find((p) => p.name === cleanName);
    if (!target || target.name === player.name) return [];
    if (target.alliance && target.alliance !== "None") return [];
    return [target.name];
  }
  function lrcShotCountForAlliance(allianceLike = alliance) {
    const a = normaliseAlliance(allianceLike);
    return LRC_SHOT_BASE_COUNT + Math.max(0, Array.isArray(a?.members) ? a.members.length : 0);
  }
  function lrcTargetAllianceFor(type, name) {
    const cleanName = cleanSingleLineText(name || "", TEXT_LIMITS.targetName).trim();
    if (!cleanName) return "";
    if (type === "alliance") return cleanName;
    const pub = getDemoPlayers().find((p) => p.name === cleanName);
    return pub?.alliance && pub.alliance !== "None" ? pub.alliance : "";
  }
  function isAllianceLrcLocked(allianceLike = alliance, sequence = activeLrcSequence) {
    const a = normaliseAlliance(allianceLike);
    if (!a || !sequence || sequence.status === "complete") return false;
    return a.name === sequence.firingAlliance || a.name === sequence.targetAlliance;
  }
  function lrcLockLabel(sequence = activeLrcSequence) {
    if (!sequence || sequence.status === "complete") return "None";
    return `${sequence.firingAlliance} firing at ${sequence.targetLabel}: ${fmt(sequence.shotsCompleted || 0)} / ${fmt(sequence.totalShots || 0)} shots fired`;
  }
  function lrcSequenceCountdown(sequence = activeLrcSequence) {
    if (!sequence || sequence.status === "complete") return "None";
    return sequence.nextShotAt <= displayNow ? "Shot due" : remainingTimeLabel(sequence.nextShotAt, displayNow);
  }
  function readyLrcForTesting() {
    if (!alliance) return addLog("You are not currently in an alliance.");
    setAlliance((a) => normaliseAlliance({ ...a, lrcQuota: { cards: LRC_CARD_QUOTA, minerals: Object.fromEntries(LRC_MINERALS.map((m) => [m, LRC_MINERAL_QUOTA])) }, lrcConstructionFinishAt: 0, lrcStatus: "Ready to fire" }));
    addLog("Admin: Long Range Cannon quota filled and set ready to fire.", "Admin");
  }
  function resolveLrcShotAgainstEntity(entity, shotNumber, sequence, now) {
    const beforePower = publicPowerForEmpire(entity);
    const result = damageEntityWithLrc(entity, 1);
    const afterPower = publicPowerForEmpire(result.entity);
    const powerLost = Math.max(0, beforePower - afterPower);
    const newsLine = `LRC shot ${fmt(shotNumber)} from ${sequence.firingAlliance} struck ${entity.name}. Power lost: ${fmt(powerLost)}.`;
    if (entity.name === player.name) {
      addSystemInboxMessage("LRC", `Long Range Cannon shot ${fmt(shotNumber)} from ${sequence.firingAlliance} hit your empire.\n\nPower lost: ${fmt(powerLost)}.\nImpact Shield reduction: ${result.reductionPercent.toFixed(1)}%.\nEffective damage: ${result.effectiveDamagePercent.toFixed(2)}%.\n\nBuildings destroyed:\n${formatLrcRows(result.destroyedBuildingRows)}\n\nUnits destroyed:\n${formatLrcRows(result.destroyedUnitRows)}`, { kind: "lrc", createdAt: now });
    }
    return { entity: result.entity, newsLine, powerLost };
  }
  function processDueLrcShots(now = Date.now()) {
    const seq = activeLrcSequence;
    if (!seq || seq.status === "complete" || !seq.nextShotAt || now < seq.nextShotAt) return;
    let working = { ...seq };
    const newsLines = [];
    let nextPlayer = player;
    let nextOpponents = demoOpponents;
    while (working.shotsCompleted < working.totalShots && now >= working.nextShotAt) {
      const shotNumber = working.shotsCompleted + 1;
      const targetNames = Array.isArray(working.targetNames) && working.targetNames.length ? working.targetNames : [];
      const targetName = targetNames.length ? (working.targetType === "alliance" ? targetNames[Math.floor(Math.random() * targetNames.length)] : targetNames[0]) : "";
      if (!targetName) {
        newsLines.push(`LRC shot ${fmt(shotNumber)} from ${working.firingAlliance} had no valid target.`);
      } else if (targetName === player.name) {
        const shot = resolveLrcShotAgainstEntity(nextPlayer, shotNumber, working, now);
        nextPlayer = { ...shot.entity, name: nextPlayer.name, race: nextPlayer.race };
        newsLines.push(shot.newsLine);
      } else {
        const target = nextOpponents.find((op) => op.name === targetName);
        if (!target) {
          newsLines.push(`LRC shot ${fmt(shotNumber)} from ${working.firingAlliance} could not find ${targetName}.`);
        } else {
          const shot = resolveLrcShotAgainstEntity(target, shotNumber, working, now);
          nextOpponents = nextOpponents.map((op) => op.name === targetName ? shot.entity : op);
          newsLines.push(shot.newsLine);
        }
      }
      working = { ...working, shotsCompleted: shotNumber, nextShotAt: working.nextShotAt + realMillisecondsForGameSeconds(LRC_SHOT_INTERVAL_GAME_SECONDS) };
    }
    if (working.shotsCompleted >= working.totalShots) {
      working = { ...working, status: "complete", completedAt: now };
      newsLines.push(`LRC firing sequence from ${working.firingAlliance} at ${working.targetLabel} is complete.`);
      setAlliance((a) => a && a.name === working.firingAlliance ? normaliseAlliance({ ...a, lrcLockedUntil: 0, lrcLockReason: "", lrcStatus: `Fired ${fmt(working.totalShots)} shots at ${working.targetLabel}` }) : a);
    }
    if (nextPlayer !== player) setPlayer(nextPlayer);
    if (nextOpponents !== demoOpponents) setDemoOpponents(nextOpponents);
    newsLines.forEach((line) => addLog(line, "LRC"));
    setActiveLrcSequence(working.status === "complete" ? null : working);
  }
  function fireLrc() {
    const cur = completeLrcConstructionIfDue(alliance);
    if (!cur) return addLog("You are not currently in an alliance.");
    if (activeLrcSequence && activeLrcSequence.status !== "complete") return addLog("An LRC firing sequence is already active.");
    if (!adminMode && !isAllianceAdmin(player.name, cur)) return addLog("Only the alliance Leader or Co-Leader can fire the Long Range Cannon.");
    if (!lrcReadyToFire(cur)) return addLog("The Long Range Cannon is not ready to fire yet.");
    const targetType = lrcTargetType || cur.lrcTargetType || "alliance";
    const targetName = cleanSingleLineText(lrcTargetName || cur.lrcTargetName || "", TEXT_LIMITS.targetName).trim();
    if (!targetName) return addLog("Select an LRC target first.");
    const targetNames = lrcTargetNamesFor(targetType, targetName);
    if (!targetNames.length) return addLog("No valid LRC targets found.");
    const shots = lrcShotCountForAlliance(cur);
    const targetLabel = `${targetType === "alliance" ? "Alliance" : "Player"} ${targetName}`;
    const targetAlliance = lrcTargetAllianceFor(targetType, targetName);
    const now = Date.now();
    const sequence = {
      id: now,
      status: "firing",
      firingAlliance: cur.name,
      targetType,
      targetName,
      targetAlliance,
      targetLabel,
      targetNames,
      totalShots: shots,
      shotsCompleted: 0,
      nextShotAt: now,
      startedAt: now
    };
    setAlliance((a) => {
      const before = completeLrcConstructionIfDue(a);
      return normaliseAlliance({
        ...before,
        lrcQuota: { cards: 0, minerals: emptyMinerals() },
        lrcConstructionFinishAt: 0,
        lrcTargetType: targetType,
        lrcTargetName: targetName,
        lrcShotsFired: (before.lrcShotsFired || 0),
        lrcLockedUntil: now + realMillisecondsForGameSeconds(LRC_SHOT_INTERVAL_GAME_SECONDS) * Math.max(1, shots),
        lrcLockReason: `LRC firing at ${targetLabel}`,
        lrcStatus: `Firing ${fmt(shots)} shots at ${targetLabel}`
      });
    });
    setActiveLrcSequence(sequence);
    addLog(`${cur.name} began LRC firing at ${targetLabel}. ${fmt(shots)} shots scheduled: first shot now, then one shot every 1 IG hour.`, "LRC");
    setTimeout(() => processDueLrcShots(Date.now()), 0);
  }

  function donateLrcMineral() {
    const requested = parseQty(lrcMineralAmount);
    const mineral = lrcMineralName;
    if (!alliance) return addLog("You are not currently in an alliance.");
    if (!LRC_MINERALS.includes(mineral)) return addLog(`${mineralLabel(mineral)} is not currently required for the LRC.`);
    const current = normaliseAlliance(alliance);
    const lrcMinerals = { ...emptyMinerals(), ...(current.lrcQuota?.minerals || {}) };
    const remaining = Math.max(0, LRC_MINERAL_QUOTA - (lrcMinerals[mineral] || 0));
    const amount = Math.min(requested, remaining);
    if (remaining <= 0) return addLog(`${mineralLabel(mineral)} quota is already complete. No more donations accepted until the LRC resets.`);
    if (amount <= 0) return addLog("Enter a mineral quantity to donate to the LRC.");
    if ((player.minerals[mineral] || 0) < amount) return addLog(`You only have ${fmt(player.minerals[mineral] || 0)} ${mineralLabel(mineral)}.`);
    setPlayer((p) => ({ ...p, minerals: { ...p.minerals, [mineral]: (p.minerals[mineral] || 0) - amount } }));
    setAlliance((a) => { const cur = normaliseAlliance(a); const mins = { ...emptyMinerals(), ...(cur.lrcQuota?.minerals || {}) }; return maybeStartLrcConstructionForAlliance({ ...cur, lrcQuota: { ...cur.lrcQuota, minerals: { ...mins, [mineral]: (mins[mineral] || 0) + amount } } }); });
    setLrcMineralAmount("");
    addLog(`${fmt(amount)} ${mineralLabel(mineral)} donated to the Long Range Cannon quota.`);
  }

  function donateNexusMineral() {
    const amount = parseQty(nexusMineralAmount);
    const mineral = nexusMineralName;
    if (!alliance) return addLog("You are not currently in an alliance.");
    if (!NEXUS_MINERALS.includes(mineral)) return addLog(`${mineralLabel(mineral)} is not accepted by the nexus. Only scanner minerals and barracks-speed minerals are currently required.`);
    if (amount <= 0) return addLog("Enter a mineral quantity to donate to the alliance nexus.");
    if ((player.minerals[mineral] || 0) < amount) return addLog(`You only have ${fmt(player.minerals[mineral] || 0)} ${mineralLabel(mineral)}.`);
    setPlayer((p) => ({ ...p, minerals: { ...p.minerals, [mineral]: (p.minerals[mineral] || 0) - amount } }));
    setAlliance((a) => { const cur = normaliseAlliance(a); const ledger = { ...(cur.nexusLedger || {}) }; ledger[player.name] = (ledger[player.name] || 0) + amount; return normaliseAlliance({ ...cur, nexusLedger: ledger, nexusMinerals: { ...emptyMinerals(), ...(cur.nexusMinerals || {}), [mineral]: ((cur.nexusMinerals || {})[mineral] || 0) + amount } }); });
    setNexusMineralAmount("");
    addLog(`${fmt(amount)} ${mineralLabel(mineral)} donated to the alliance nexus.`);
  }

  function withdrawNexusMineral() {
    const amount = parseQty(nexusMineralAmount);
    const mineral = nexusMineralName;
    if (!alliance) return addLog("You are not currently in an alliance.");
    if (!isAllianceAdmin(player.name, alliance)) return addLog("Only the Leader or Co-Leader can withdraw from the alliance nexus.");
    if (!NEXUS_MINERALS.includes(mineral)) return addLog(`${mineralLabel(mineral)} is not held by the nexus.`);
    const currentAmount = (normaliseAlliance(alliance).nexusMinerals || {})[mineral] || 0;
    if (amount <= 0) return addLog("Enter a mineral quantity to withdraw from the alliance nexus.");
    if (currentAmount < amount) return addLog(`The alliance nexus only has ${fmt(currentAmount)} ${mineralLabel(mineral)}.`);
    setAlliance((a) => { const cur = normaliseAlliance(a); const ledger = { ...(cur.nexusLedger || {}) }; ledger[player.name] = (ledger[player.name] || 0) - amount; return normaliseAlliance({ ...cur, nexusLedger: ledger, nexusMinerals: { ...emptyMinerals(), ...(cur.nexusMinerals || {}), [mineral]: ((cur.nexusMinerals || {})[mineral] || 0) - amount } }); });
    setPlayer((p) => ({ ...p, minerals: { ...p.minerals, [mineral]: (p.minerals[mineral] || 0) + amount } }));
    setNexusMineralAmount("");
    addLog(`${fmt(amount)} ${mineralLabel(mineral)} withdrawn from the alliance nexus.`);
  }

  function renderAllianceNexusSubPage(currentAlliance) {
    const nexus = { ...emptyMinerals(), ...(currentAlliance.nexusMinerals || {}) };
    const total = NEXUS_MINERALS.reduce((a, m) => a + (Number(nexus[m]) || 0), 0);
    const admin = isAllianceAdmin(player.name, currentAlliance);
    const ledgerNames = Array.from(new Set([...(currentAlliance.members || []), ...Object.keys(currentAlliance.nexusLedger || {})]));
    const mineralRows = (list) => list.map((m) => <tr key={m} className="border-b border-orange-950"><td className="p-1 text-orange-300">{mineralLabel(m)}</td><td className="p-1 text-right">{fmt(nexus[m] || 0)}</td><td className="p-1 text-right">{fmt(player.minerals[m] || 0)}</td></tr>);
    return <Panel title="Alliance Nexus"><p className="mb-3 text-orange-200">Nexus accepts scanner minerals and barracks-speed minerals only. Member net balances are public: donated minus withdrawn/sent.</p><OldTable rows={[
      ["Total Nexus Minerals", fmt(total)],
      ["Withdraw Access", admin ? "Leader / Co-Leader" : "No"]
    ]} /><Panel title="Donate / Withdraw Minerals"><div className="flex gap-2 flex-wrap mb-3"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={nexusMineralName} onChange={(e) => setNexusMineralName(e.target.value)}>{NEXUS_MINERALS.map((m) => <option key={m} value={m}>{mineralLabel(m)}</option>)}</select><TextInput value={nexusMineralAmount} onChange={setNexusMineralAmount} className="w-32" placeholder="Qty" onEnter={donateNexusMineral} /><button className="classic-btn antro-action-btn" onClick={donateNexusMineral}>Donate</button>{admin && <button className="classic-btn antro-action-btn" onClick={withdrawNexusMineral}>Withdraw</button>}</div><table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Scanner Minerals</th><th className="text-right p-1">Nexus Stock</th><th className="text-right p-1">Your Stock</th></tr></thead><tbody>{mineralRows(NEXUS_SCANNER_MINERALS)}</tbody><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Speed Minerals</th><th className="text-right p-1">Nexus Stock</th><th className="text-right p-1">Your Stock</th></tr></thead><tbody>{mineralRows(NEXUS_SPEED_MINERALS)}</tbody></table></Panel><Panel title="Member Net Balances"><table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Member</th><th className="text-right p-1">Net Donated</th></tr></thead><tbody>{ledgerNames.map((name) => <tr key={name} className="border-b border-orange-950"><td className="p-1"><PlayerLink name={name} /></td><td className="p-1 text-right">{fmt((currentAlliance.nexusLedger || {})[name] || 0)}</td></tr>)}</tbody></table></Panel><button className="classic-btn antro-action-btn" onClick={() => setAllianceSubPage("main")}>Back to Alliance</button></Panel>;
  }

  function renderAllianceBankSubPage(currentAlliance) { const bankOrder = currentAlliance.bankOrder; const qty = parseQty(allianceBankBuildQty); const speed = normaliseAllianceBankSpeedFactor(allianceBankSpeedFactor); const cost = allianceBankBuildCost(qty, speed); const seconds = allianceBankBuildSeconds(qty, speed, currentAlliance); const admin = isAllianceAdmin(player.name, currentAlliance); return <Panel title="Alliance Bank"><p className="mb-3 text-orange-200">Alliance banks are built on donated alliance land. Build speed factor is 1-99. Prototype effective units are 1,000 per alliance member.</p><OldTable rows={[["Alliance Bank Funds", allianceBankStockLabel(currentAlliance)], ["Alliance Banks", fmt(currentAlliance.allianceBanks || 0)], ["Bank Capacity", fmt(allianceBankCapacity(currentAlliance))], ["Land/Free Land", allianceLandFreeLabel(allianceTotalLand(currentAlliance), currentAlliance.bankLand || 0)], ["Reserved Alliance Land", fmt(allianceReservedBankLand(currentAlliance))], ["Effective Alliance Factories", fmt(allianceEffectiveFactories(currentAlliance))], ["Active Bank Build", bankOrder ? `${fmt(bankOrder.quantity)} banks — ${remainingTimeLabel(bankOrder.finishAt, displayNow)}` : "None"]]} /><Panel title="Donate Land"><p className="mb-2 text-orange-200">Any member can donate free land to the alliance.</p><div className="flex gap-2 flex-wrap"><TextInput value={donateAllianceLandAmount} onChange={setDonateAllianceLandAmount} className="w-32" placeholder="Land" /><button className="classic-btn antro-action-btn" onClick={donateAllianceLand}>Donate Land</button><button className="classic-btn antro-action-btn" onClick={() => setDonateAllianceLandAmount(String(player.freeLand))}>Max Land</button></div></Panel>{admin && <Panel title="Build Alliance Banks"><OldTable rows={[["Banks to build", fmt(qty)], ["Speed factor", speed], ["Cost", fmt(cost)], ["Build time", qty > 0 ? oldTime(seconds) : "0 hours and 0 minutes"]]} /><div className="flex gap-2 flex-wrap mt-3"><TextInput value={allianceBankBuildQty} onChange={setAllianceBankBuildQty} className="w-32" placeholder="Banks" /><TextInput value={allianceBankSpeedFactor} onChange={setAllianceBankSpeedFactor} className="w-24" placeholder="1-99" /><button className="classic-btn antro-action-btn" onClick={startAllianceBankBuild} disabled={!!bankOrder}>Start Build</button><button className="classic-btn antro-action-btn" onClick={completeAllianceBankBuild} disabled={!bankOrder}>Trigger Finish</button></div></Panel>}<Panel title="Deposit Alliance Bank Funds"><div className="flex gap-2 flex-wrap"><TextInput value={allianceBankDepositAmount} onChange={setAllianceBankDepositAmount} className="w-40" placeholder="Cardisium" /><button className="classic-btn antro-action-btn" onClick={depositAllianceBankFunds}>Deposit</button><button className="classic-btn antro-action-btn" onClick={() => setAllianceBankDepositAmount(String(player.cards))}>{`${actionLabel("deposit")} Max`}</button></div></Panel><button className="classic-btn antro-action-btn" onClick={() => setAllianceSubPage("main")}>Back to Alliance</button></Panel>; }
  function renderLrcSubPage(currentAlliance) {
    const normalised = completeLrcConstructionIfDue(currentAlliance, displayNow);
    if (normalised.lrcConstructionFinishAt !== currentAlliance.lrcConstructionFinishAt || normalised.lrcStatus !== currentAlliance.lrcStatus) {
      setTimeout(() => setAlliance((a) => completeLrcConstructionIfDue(a, Date.now())), 0);
    }
    const quota = normalised.lrcQuota || { cards: 0, minerals: emptyMinerals() };
    const lrcMinerals = { ...emptyMinerals(), ...(quota.minerals || {}) };
    const cardsComplete = (quota.cards || 0) >= LRC_CARD_QUOTA;
    const mineralsComplete = LRC_MINERALS.every((m) => (lrcMinerals[m] || 0) >= LRC_MINERAL_QUOTA);
    const quotaComplete = cardsComplete && mineralsComplete;
    const constructionActive = normalised.lrcConstructionFinishAt && normalised.lrcConstructionFinishAt > displayNow;
    const ready = quotaComplete && !constructionActive && !normalised.lrcConstructionFinishAt;
    const admin = isAllianceAdmin(player.name, normalised);
    const canManageLrc = admin || adminMode;
    const allianceTargets = getDemoAlliances().filter((a) => a.name !== normalised.name).map((a) => a.name);
    const playerTargets = getDemoPlayers().filter((p) => p.name !== player.name && (!p.alliance || p.alliance === "None")).map((p) => p.name);
    const targetOptions = lrcTargetType === "alliance" ? allianceTargets : playerTargets;
    return <Panel title="Long Range Cannon"><p className="mb-3 text-orange-200">LRC is a quota, not an open stockpile. Once 1b Cardisium and 25k of each required mineral are met, a 48-hour x1 construction phase begins. When construction completes, the Leader/Co-Leader can select a target ready for the future firing step.</p><OldTable rows={[
      ["LRC Status", allianceLrcStatusLabel(normalised, displayNow)],
      ["Cardisium", `${fmt(quota.cards || 0)} / ${fmt(LRC_CARD_QUOTA)}`],
      ["Mineral quota", `${fmt(LRC_MINERAL_QUOTA)} each`],
      ["Construction Time", "48h at x1 speed"],
      ["Building Clock", constructionActive ? remainingTimeLabel(normalised.lrcConstructionFinishAt, displayNow) : "None"],
      ["Shots Fired", fmt(normalised.lrcShotsFired || 0)],
      ["Energy", "Not required"],
      ["Selected Target", normalised.lrcTargetName ? `${normalised.lrcTargetType === "alliance" ? "Alliance" : "Player"}: ${normalised.lrcTargetName}` : "None"], ["Active Firing", lrcLockLabel()], ["Next Shot", lrcSequenceCountdown()], ["Shot Count", `${fmt(lrcShotCountForAlliance(normalised))} (${fmt(LRC_SHOT_BASE_COUNT)} + ${fmt(normalised.members.length)} members)`]
    ]} /><Panel title="Donate Cardisium"><div className="flex gap-2 flex-wrap mb-3"><TextInput value={lrcCardsAmount} onChange={setLrcCardsAmount} className="w-40" placeholder="Cardisium" onEnter={donateLrcCards} /><button className="classic-btn antro-action-btn" onClick={donateLrcCards} disabled={cardsComplete}>Donate Cardisium</button><button className="classic-btn antro-action-btn" onClick={() => setLrcCardsAmount(String(Math.min(player.cards, Math.max(0, LRC_CARD_QUOTA - (quota.cards || 0))))) } disabled={cardsComplete}>Fill Remaining</button></div></Panel><Panel title="Donate LRC Minerals"><div className="flex gap-2 flex-wrap mb-3"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={lrcMineralName} onChange={(e) => setLrcMineralName(e.target.value)}>{LRC_MINERALS.map((m) => <option key={m} value={m}>{mineralLabel(m)}</option>)}</select><TextInput value={lrcMineralAmount} onChange={setLrcMineralAmount} className="w-32" placeholder="Qty" onEnter={donateLrcMineral} /><button className="classic-btn antro-action-btn" onClick={donateLrcMineral}>Donate Mineral</button><button className="classic-btn antro-action-btn" onClick={donateLrcTwentyFiveThousand}>Donate 25,000</button></div><table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">LRC Mineral</th><th className="text-right p-1">Quota Filled</th><th className="text-right p-1">Remaining</th><th className="text-right p-1">Your Stock</th></tr></thead><tbody>{LRC_MINERALS.map((m) => { const filled = Math.min(LRC_MINERAL_QUOTA, lrcMinerals[m] || 0); return <tr key={m} className="border-b border-orange-950"><td className="p-1 text-orange-300">{mineralLabel(m)}</td><td className="p-1 text-right">{fmt(filled)} / {fmt(LRC_MINERAL_QUOTA)}</td><td className="p-1 text-right">{fmt(Math.max(0, LRC_MINERAL_QUOTA - filled))}</td><td className="p-1 text-right">{fmt(player.minerals[m] || 0)}</td></tr>; })}</tbody></table></Panel>{<Panel title="Select / Fire LRC Target"><p className="mb-3 text-orange-200">Each LRC shot destroys 10% of every building type and every unit row before Impact Shield reduction. Impact Shields use the Star Wars-style land curve, capped at 90% damage reduction. Shots are fixed at 10 + 1 per firing-alliance member. First shot fires immediately, then one shot every 1 IG hour.</p>{!ready && <p className="mb-3 text-yellow-300">The LRC is not ready yet. Use the quota controls or Prototype: Ready LRC to enable firing.</p>}{ready && !canManageLrc && <p className="mb-3 text-yellow-300">Only the alliance Leader or Co-Leader can fire. Admin mode can override this for prototype testing.</p>}<div className="flex gap-2 flex-wrap"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={lrcTargetType} onChange={(e) => { setLrcTargetType(e.target.value); setLrcTargetName(""); }}><option value="alliance">Target Alliance</option><option value="player">Target Individual</option></select><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={lrcTargetName} maxLength={TEXT_LIMITS.targetName} onChange={(e) => setLrcTargetName(cleanSingleLineText(e.target.value, TEXT_LIMITS.targetName))}><option value="">Choose target</option>{targetOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select><button className="classic-btn antro-action-btn" onClick={saveLrcTarget} disabled={!ready || !canManageLrc}>Save Target</button><button className="classic-btn antro-action-btn" onClick={fireLrc} disabled={!ready || !canManageLrc || Boolean(activeLrcSequence && activeLrcSequence.status !== "complete")}>Fire LRC ({fmt(lrcShotCountForAlliance(normalised))} shots)</button></div></Panel>} {adminMode && <Panel title="Prototype LRC Tools"><button className="classic-btn antro-action-btn" onClick={readyLrcForTesting}>Prototype: Ready LRC</button></Panel>}<button className="classic-btn antro-action-btn" onClick={() => setAllianceSubPage("main")}>Back to Alliance</button></Panel>;
  }

  function renderAlliances() {
    const availableAlliances = getDemoAlliances().filter((a) => !alliance || a.name !== alliance.name);
    const currentAlliance = normaliseAlliance(alliance);
    const admin = isAllianceAdmin(player.name, currentAlliance);
    if (currentAlliance && allianceSubPage === "bank") return renderAllianceBankSubPage(currentAlliance);
    if (currentAlliance && allianceSubPage === "lrc") return renderLrcSubPage(currentAlliance);
    if (currentAlliance && allianceSubPage === "nexus") return renderAllianceNexusSubPage(currentAlliance);
    const demoMemberOptions = getDemoPlayers().filter((p) => p.name !== player.name && (!currentAlliance || !currentAlliance.members.includes(p.name)));
    const diplomacyAllianceOptions = getDemoAlliances().filter((a) => !currentAlliance || a.name !== currentAlliance.name);
    const diplomacyPlayerOptions = getDemoPlayers().filter((p) => p.name !== player.name && !(p.alliance && p.alliance !== "None"));
    const targetOptions = diplomacyTargetType === "alliance" ? diplomacyAllianceOptions.map((a) => a.name) : diplomacyPlayerOptions.map((p) => p.name);
    const incomingRequests = diplomacyRequests.filter((r) => ownRequestSideKeys().includes(r.to));
    const outgoingRequests = diplomacyRequests.filter((r) => ownRequestSideKeys().includes(r.from));
    const displayedActiveWars = validActiveWars();
    const displayedAlliedStatuses = validAlliedStatuses();

    if (currentAlliance) {
      const memberLimit = currentAlliance.memberLimit || ALLIANCE_MEMBER_LIMIT;
      const memberRows = currentAlliance.members.map((member) => {
        const role = allianceMemberRoleSuffix(member, currentAlliance);
        return <tr key={member} className="border-b border-orange-950"><td className="p-1"><PlayerLink name={member} />{role && <span className="ml-2 text-xs text-orange-600">({role})</span>}</td><td className="p-1 text-right"><div className="flex gap-2 justify-end flex-wrap">{canSetAllianceViceLeader(player.name, member, currentAlliance) && currentAlliance.viceLeader !== member && <button className="classic-btn antro-action-btn" onClick={() => setViceLeader(member)}>Make Co-Leader</button>}{isAllianceLeader(player.name, currentAlliance) && currentAlliance.viceLeader === member && <button className="classic-btn antro-action-btn" onClick={removeViceLeader}>Remove Co-Leader</button>}{canKickAllianceMember(player.name, member, currentAlliance) && <button className="classic-btn antro-action-btn" onClick={() => kickAllianceMember(member)}>Kick</button>}</div></td></tr>;
      });
      return <Panel title="Alliances"><div className="text-center mb-5"><h2 className="text-3xl md:text-4xl text-orange-200 font-bold tracking-wide">{currentAlliance.name}</h2><p className="mt-2 text-orange-300 italic">{currentAlliance.announcement || "..."}</p></div><OldTable rows={[["Members", `${fmt(currentAlliance.members.length)} / ${fmt(memberLimit)}`], ["Land/Free Land", allianceLandFreeLabel(allianceTotalLand(currentAlliance), currentAlliance.bankLand)], ["Alliance Banks", fmt(currentAlliance.allianceBanks)], ["Alliance Bank Funds", allianceBankStockLabel(currentAlliance)], ["Nexus Minerals", fmt(Object.values(currentAlliance.nexusMinerals || {}).reduce((a, b) => a + (Number(b) || 0), 0))], ["LRC Status", allianceLrcStatusLabel(currentAlliance, displayNow)]]} />
        <div className="flex gap-2 flex-wrap mt-4 mb-4"><button className="classic-btn antro-action-btn" onClick={() => setAllianceSubPage("bank")}>Alliance Bank / Donate Land</button><button className="classic-btn antro-action-btn" onClick={() => setAllianceSubPage("nexus")}>Alliance Nexus</button><button className="classic-btn antro-action-btn" onClick={() => { setAllianceSubPage("lrc"); setAlliance((a) => normaliseAlliance({ ...a, lrcStatus: "Stockpile controls opened" })); }}>Long Range Cannon</button></div>
        <Panel title="Alliance Members"><table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Member</th><th className="text-right p-1">Actions</th></tr></thead><tbody>{memberRows}</tbody></table></Panel>
        {admin && <Panel title="Alliance Administration"><p className="mb-3 text-orange-200">Leader and Co-Leader have admin access. The Co-Leader cannot rename the alliance, disband the alliance, or kick the Leader.</p><div className="grid md:grid-cols-2 gap-4"><div className="border border-orange-900 bg-[#100400] p-3"><label className="block text-orange-300 mb-1">Announcement</label><textarea className="w-full min-h-[80px] bg-black border border-orange-900 text-orange-100 px-2 py-1" value={allianceAnnouncementDraft} maxLength={TEXT_LIMITS.allianceAnnouncement} onChange={(e) => setAllianceAnnouncementDraft(cleanMultiLineText(e.target.value, TEXT_LIMITS.allianceAnnouncement))} placeholder={currentAlliance.announcement} /><button className="classic-btn mt-2" onClick={saveAllianceAnnouncement}>Save Announcement</button></div>{canRenameAlliance(player.name, currentAlliance) && <div className="border border-orange-900 bg-[#100400] p-3"><label className="block text-orange-300 mb-1">Rename Alliance</label><input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-1 mb-2" value={allianceName} maxLength={TEXT_LIMITS.allianceName} onChange={(e) => setAllianceName(cleanSingleLineText(e.target.value, TEXT_LIMITS.allianceName))} placeholder="New alliance name" /><button className="classic-btn antro-action-btn" onClick={renameAlliance}>Rename</button></div>}</div><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => setAllianceSubPage("bank")}>Alliance Bank</button><button className="classic-btn antro-action-btn" onClick={() => setAllianceSubPage("nexus")}>Alliance Nexus</button><button className="classic-btn antro-action-btn" onClick={() => { setAllianceSubPage("lrc"); setAlliance((a) => normaliseAlliance({ ...a, lrcStatus: "Stockpile controls opened" })); addLog("Long Range Cannon controls opened for this alliance."); }}>Long Range Cannon</button></div>{isAllianceLeader(player.name, currentAlliance) && <div className="border border-orange-900 bg-[#100400] p-3 mt-4"><label className="block text-orange-300 mb-1">Prototype: add member for role/kick testing</label><div className="flex gap-2 flex-wrap"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={demoMemberName} onChange={(e) => setDemoMemberName(e.target.value)}>{demoMemberOptions.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select><button className="classic-btn antro-action-btn" onClick={() => addDemoAllianceMember(demoMemberName)} disabled={demoMemberOptions.length === 0}>Add Member</button></div></div>}</Panel>}
        {admin && <Panel title="Diplomacy"><p className="mb-3 text-orange-200">War declarations are unilateral and active immediately. Peace and allied status are requests which must be accepted.</p><OldTable rows={[["Acting As", currentDiplomacyLabel()], ["Active Wars", fmt(displayedActiveWars.length)], ["Active Allies", fmt(displayedAlliedStatuses.length)], ["Incoming Requests", fmt(incomingRequests.length)], ["Outgoing Requests", fmt(outgoingRequests.length)]]} /><div className="flex gap-2 flex-wrap mt-4 mb-4"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={diplomacyTargetType} onChange={(e) => { setDiplomacyTargetType(e.target.value); const opts = e.target.value === "alliance" ? diplomacyAllianceOptions.map((a) => a.name) : diplomacyPlayerOptions.map((p) => p.name); setDiplomacyTargetName(opts[0] || ""); }}><option value="alliance">Alliance</option><option value="player">Player</option></select><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={diplomacyTargetName} maxLength={TEXT_LIMITS.targetName} onChange={(e) => setDiplomacyTargetName(cleanSingleLineText(e.target.value, TEXT_LIMITS.targetName))}>{targetOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select><button className="classic-btn antro-action-btn" onClick={declareWarOnTarget}>Declare War</button><button className="classic-btn antro-action-btn" onClick={() => sendDiplomacyRequest("peace")}>Request Peace</button><button className="classic-btn antro-action-btn" onClick={() => sendDiplomacyRequest("alliance")}>Request Allied Status</button></div><div className="flex gap-2 flex-wrap mb-4"><button className="classic-btn antro-action-btn" onClick={() => simulateIncomingDiplomacyRequest("peace")}>Prototype Incoming Peace</button><button className="classic-btn antro-action-btn" onClick={() => simulateIncomingDiplomacyRequest("alliance")}>Prototype Incoming Ally Request</button></div><Panel title="Active Wars">{displayedActiveWars.length ? <table className="w-full text-sm"><tbody>{displayedActiveWars.map((w) => <tr key={w.id} className="border-b border-orange-950"><td className="p-1">{w.fromLabel} vs {w.toLabel}</td></tr>)}</tbody></table> : <p>No active wars.</p>}</Panel><Panel title="Allied Statuses">{displayedAlliedStatuses.length ? <table className="w-full text-sm"><tbody>{displayedAlliedStatuses.map((a) => <tr key={a.id} className="border-b border-orange-950"><td className="p-1">{a.aLabel} allied with {a.bLabel}</td></tr>)}</tbody></table> : <p>No active allied statuses.</p>}</Panel><Panel title="Incoming Diplomacy Requests">{incomingRequests.length ? <table className="w-full text-sm"><tbody>{incomingRequests.map((r) => <tr key={r.id} className="border-b border-orange-950"><td className="p-1">{r.fromLabel} requests {r.type === "peace" ? "peace" : "allied status"}</td><td className="p-1 text-right"><button className="classic-btn mr-2" onClick={() => acceptDiplomacyRequest(r.id)}>Accept</button><button className="classic-btn antro-action-btn" onClick={() => declineDiplomacyRequest(r.id)}>Decline</button></td></tr>)}</tbody></table> : <p>No incoming requests.</p>}</Panel><Panel title="Outgoing Diplomacy Requests">{outgoingRequests.length ? <table className="w-full text-sm"><tbody>{outgoingRequests.map((r) => <tr key={r.id} className="border-b border-orange-950"><td className="p-1">{r.type === "peace" ? "Peace" : "Allied status"} request sent to {r.toLabel}</td></tr>)}</tbody></table> : <p>No outgoing requests.</p>}</Panel></Panel>}
        <div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" disabled={isAllianceLrcLocked(currentAlliance)} onClick={() => { if (isAllianceLrcLocked(currentAlliance)) return addLog("You cannot leave this alliance while an LRC firing sequence is active."); clearAlliedDiplomacyForKeys([diplomacyKey("player", player.name), diplomacyKey("alliance", currentAlliance.name)]); addLog(`${player.name} has left the alliance ${currentAlliance.name}. Allied status has been reset; individual war status remains.`); setAlliance(null); }}>Leave Alliance</button>{isAllianceLeader(player.name, currentAlliance) && <button className="classic-btn antro-action-btn" disabled={isAllianceLrcLocked(currentAlliance)} onClick={() => { if (isAllianceLrcLocked(currentAlliance)) return addLog("You cannot disband this alliance while an LRC firing sequence is active."); clearAlliedDiplomacyForKeys([diplomacyKey("player", player.name), diplomacyKey("alliance", currentAlliance.name)]); addLog(`${player.name} has disbanded the alliance ${currentAlliance.name}. Allied status has been reset; individual war status remains.`); setAlliance(null); }}>Disband Alliance</button>}</div>
        <div className="mt-5 pt-3 border-t border-orange-950"><label className="flex items-center gap-2 text-orange-200"><input type="checkbox" checked={shareAllianceProfile} onChange={(e) => { const checked = e.target.checked; setShareAllianceProfile(checked); setAllianceShareEnabledMembers((members) => checked ? Array.from(new Set([...members, player.name])) : members.filter((m) => m !== player.name)); }} /> Share my full profile with alliance Leader/Co-Leader and opted-in alliance profile viewers.</label><p className="text-orange-600 mt-2">Prototype note: admin mode can still view all profiles for testing.</p></div>
      </Panel>;
    }

    return <Panel title="Alliances"><p className="mb-3 text-orange-200">You are not currently in an alliance. Create one, or request to join one of the alliances listed below. Prototype allows classic-style alliances up to {fmt(ALLIANCE_MEMBER_LIMIT)} members; full alliances reject new members.</p><OldTable rows={[["Current Alliance", "None"], ["Available Actions", "Create / Find / Request"], ["Alliance Member Limit", `${fmt(ALLIANCE_MEMBER_LIMIT)} members`], ["Alliance Bank", "Requires alliance land and banks"], ["LRC", "Requires capped quota donations"]]} /><Panel title="Find / Request Alliance"><table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Alliance</th><th className="text-left p-1">Leader</th><th className="text-right p-1">Members</th><th className="text-right p-1">Power</th><th className="text-left p-1">Diplomacy</th><th className="text-right p-1">Action</th></tr></thead><tbody>{availableAlliances.map((a) => <tr key={a.name} className="border-b border-orange-950"><td className="p-1"><AllianceLink name={a.name} /></td><td className="p-1"><PlayerLink name={a.leader} /></td><td className="p-1 text-right">{fmt(a.members.length)} / {fmt(ALLIANCE_MEMBER_LIMIT)}</td><td className="p-1 text-right">{fmt(a.totalPower)}</td><td className={`p-1 ${diplomacyStateClass(a.diplomacy)}`}>{a.diplomacy}</td><td className="p-1 text-right"><button className="classic-btn antro-action-btn" onClick={() => joinAlliance(a.name)} disabled={a.members.length + 1 > ALLIANCE_MEMBER_LIMIT}>{a.members.length + 1 > ALLIANCE_MEMBER_LIMIT ? "Full" : "Request to join alliance"}</button></td></tr>)}</tbody></table></Panel><Panel title="Create Alliance"><div className="mt-1 mb-4"><label className="block text-orange-300 mb-1">Alliance Name</label><input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-1" value={allianceName} maxLength={TEXT_LIMITS.allianceName} onChange={(e) => setAllianceName(cleanSingleLineText(e.target.value, TEXT_LIMITS.allianceName))} placeholder="Enter alliance name" /></div><div className="flex gap-2 flex-wrap"><button className="classic-btn antro-action-btn" onClick={createAlliance}>Create Alliance</button><button className="classic-btn antro-action-btn" onClick={() => joinAlliance(allianceName)}>Request to join alliance</button></div></Panel></Panel>;
  }

  function renderShops() {
    const price = shopPrices[shopMineral] || 0;
    const qty = parseQty(shopQty);
    const cost = price * qty;
    return <Panel title="Shops"><p className="mb-3 text-orange-200">Buy food, water, energy and minerals from the shop at fixed prices.</p><table className="w-full text-sm mb-4"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Item</th><th className="text-right p-1">Shop Price</th><th className="text-right p-1">Your Stockpile</th></tr></thead><tbody>{shopItemOrder.map((m) => <tr key={m} className="border-b border-orange-950"><td className="p-1">{shopItemLabel(m)}</td><td className="p-1 text-right">{shopPrices[m] ? fmt(shopPrices[m]) : "Not sold"}</td><td className="p-1 text-right">{fmt(["Food", "Water", "Energy"].includes(m) ? player[m.toLowerCase()] : (player.minerals[m] || 0))}</td></tr>)}</tbody></table><OldTable rows={[
      ["Selected Item", shopItemLabel(shopMineral)],
      ["Unit Price", price ? fmt(price) : "Not sold"],
      ["Quantity", fmt(qty)],
      ["Total Cost", fmt(cost)]
    ]} /><div className="flex gap-2 flex-wrap mt-4"><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={shopMineral} onChange={(e) => setShopMineral(e.target.value)}>{shopItemOrder.map((m) => <option key={m} value={m}>{shopItemLabel(m)}</option>)}</select><TextInput value={shopQty} onChange={setShopQty} className="w-32" placeholder="Quantity" onEnter={buyShopMinerals} /><button className="classic-btn antro-action-btn" onClick={buyShopMinerals}>Buy From Shop</button><button className="classic-btn antro-action-btn" onClick={() => addLog(`Scanner mineral check — ${SCANNER_MINERALS.map((m) => `${mineralLabel(m)}: ${fmt(Math.max(0, 10 - (player.minerals[m] || 0)))}`).join(", ")}`)}>Check 1 Scanner Minerals</button></div></Panel>;
  }

  function renderMarket() {
    const ownedSelected = player.minerals[marketMineral] || 0;
    return <Panel title="Market">
      <p className="mb-3 text-orange-200">Create mineral sell orders, buy partial quantities from other players, or cancel your own listings.</p>
      <Panel title="Create Sell Order">
        <div className="flex gap-2 flex-wrap items-center mb-2">
          <select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={marketMineral} onChange={(e) => setMarketMineral(e.target.value)}>
            {mineralOrder.map((m) => <option key={m} value={m}>{mineralLabel(m)}</option>)}
          </select>
          <TextInput value={marketQty} onChange={setMarketQty} className="w-28" placeholder="Qty" />
          <TextInput value={marketPrice} onChange={setMarketPrice} className="w-32" placeholder="Price each" />
          <button className="classic-btn antro-action-btn" onClick={fillMarketOwned}>Fill Owned</button>
          <button className="classic-btn antro-action-btn" onClick={fillMarketShopPrice}>Shop Price</button>
          <button className="classic-btn antro-action-btn" onClick={createMarketSellOrder}>List Minerals</button>
        </div>
        <p className="text-xs text-orange-500">Current stock: {fmt(ownedSelected)} {mineralLabel(marketMineral)}. Fields intentionally stay populated after listing so repeated orders can be entered quickly.</p>
      </Panel>
      <div className="mb-4">
        <label className="block text-orange-300 mb-1">Quantity to buy from selected order</label>
        <div className="flex gap-2 flex-wrap items-center">
          <TextInput value={marketBuyQty} onChange={setMarketBuyQty} className="w-36" placeholder="Qty" />
          <span className="text-xs text-orange-500">Use Fill Buy on a listing, then click Buy. The quantity field stays populated after purchases.</span>
        </div>
      </div>
      <table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Seller</th><th className="text-left p-1">Mineral</th><th className="text-right p-1">Quantity</th><th className="text-right p-1">Price Each</th><th className="text-right p-1">Action</th></tr></thead><tbody>{marketOrders.map((o) => <tr key={o.id} className="border-b border-orange-950"><td className="p-1"><PlayerLink name={o.seller} /></td><td className="p-1">{mineralLabel(o.mineral)}</td><td className="p-1 text-right">{fmt(o.quantity)}</td><td className="p-1 text-right">{fmt(o.price)}</td><td className="p-1 text-right"><div className="flex gap-1 justify-end">{o.seller === player.name ? <button className="classic-btn antro-action-btn" onClick={() => cancelMarketOrder(o.id)}>Cancel</button> : <><button className="classic-btn antro-action-btn" onClick={() => selectMarketBuyOrder(o)}>Fill Buy</button><button className="classic-btn antro-action-btn" onClick={() => buyMarketOrder(o.id)}>Buy</button></>}</div></td></tr>)}</tbody></table>
    </Panel>;
  }

  function renderSpyCenter() { return <Panel title={pageLabel("spy")}><p className="mb-3 text-orange-200">{pageLabel("spy")} allow information gathering and mercenary raids. Exact old formulas are placeholders for now.</p><OldTable rows={[[pageLabel("spy"), fmt(player.buildings.spy_stations)], ["Spies", fmt(spies)], ["Mercenaries", fmt(mercenaries)], ["Spy training cost", `5,000 ${currencyLabel} each placeholder`], ["Mercenary training cost", `10,000 ${currencyLabel} each placeholder`], ["Target", spyTarget || selectedTargetName || "Randy"]]} /><Panel title="Train"><div className="flex gap-2 flex-wrap mb-3"><TextInput value={spyCount} onChange={setSpyCount} className="w-28" placeholder="Spies" /><button className="classic-btn antro-action-btn" onClick={trainSpies}>Train Spies</button><span className="text-orange-300 self-center">Cost: {fmt(parseQty(spyCount) * 5000)}</span></div><div className="flex gap-2 flex-wrap"><TextInput value={mercCount} onChange={setMercCount} className="w-28" placeholder="Mercs" /><button className="classic-btn antro-action-btn" onClick={trainMercenaries}>Train Mercenaries</button><span className="text-orange-300 self-center">Cost: {fmt(parseQty(mercCount) * 10000)}</span></div></Panel><Panel title="Operations"><div className="mb-3"><label className="block text-orange-300 mb-1">Target player</label>{renderTargetSelect({ value: spyTarget || selectedTargetName, onChange: setSpyTarget })}</div><div className="flex gap-2 flex-wrap"><button className="classic-btn antro-action-btn" onClick={spyOnTarget}>Gather Information</button><button className="classic-btn antro-action-btn" onClick={sendMercenaries}>Send Mercenaries</button><button className="classic-btn antro-action-btn" onClick={() => setPlayer((p) => ({ ...p, buildings: { ...p.buildings, spy_stations: p.buildings.spy_stations + 25 } }))}>{`Prototype: Add 25 ${pageLabel("spy")}`}</button></div></Panel><Panel title="Spy Reports">{spyReports.length ? <table className="w-full text-sm"><tbody>{spyReports.map((r) => <tr key={r.id} className="border-b border-orange-950"><td className="p-1 text-orange-300">{r.target}</td><td className="p-1">{r.body}</td></tr>)}</tbody></table> : <p>No spy reports yet.</p>}</Panel></Panel>; }
  function renderMessages() {
    const inbox = messages.filter((m) => m.direction === "inbox");
    const sent = messages.filter((m) => m.direction === "sent");
    const renderSender = (name) => isSystemMessageSender(name) ? <span className="font-bold text-orange-300">{name}</span> : <PlayerLink name={name} />;
    const previewMessageBody = (body) => { const text = displayMessageBody(body); return text.length > 180 ? `${text.slice(0, 180)}...` : text; };
    const toggleInboxMessage = (m) => {
      setExpandedMessageId((id) => id === m.id ? null : m.id);
      if (!m.read) setMessages((old) => old.map((x) => x.id === m.id ? { ...x, read: true } : x));
    };
    const messageActionLabel = (m, expanded) => !m.read ? "Mark Read" : expanded ? "Collapse" : "Expand";
    const handleMessageAction = (m, expanded) => {
      if (!m.read) {
        setMessages((old) => old.map((x) => x.id === m.id ? { ...x, read: true } : x));
        return;
      }
      setExpandedMessageId(expanded ? null : m.id);
    };
    return <Panel title="Messages"><p className="mb-3 text-orange-200">Send and receive player-to-player and system messages.</p><Panel title="Compose Message"><div className="mb-3"><label className="block text-orange-300 mb-1">To</label><input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-1" value={messageTo} maxLength={TEXT_LIMITS.messageTo} onChange={(e) => setMessageTo(cleanSingleLineText(e.target.value, TEXT_LIMITS.messageTo))} /></div><div className="mb-3"><label className="block text-orange-300 mb-1">Message</label><textarea className="w-full min-h-[90px] bg-black border border-orange-900 text-orange-100 px-2 py-1" value={messageBody} maxLength={TEXT_LIMITS.messageBody} onChange={(e) => setMessageBody(cleanMultiLineText(e.target.value, TEXT_LIMITS.messageBody))} placeholder="Enter message" /></div><div className="flex gap-2 flex-wrap"><button className="classic-btn antro-action-btn" onClick={sendMessage}>Send Message</button>{adminMode && <button className="classic-btn antro-action-btn" onClick={() => addInboxMessage("Randy", "Your spies tell you Randy is online and looking nervous.", { kind: "player" })}>Prototype: Receive Randy Reply</button>}</div></Panel><Panel title="Inbox">{inbox.length ? <table className="w-full text-sm"><tbody>{inbox.map((m) => { const expanded = expandedMessageId === m.id; return <tr key={m.id} className={`border-b border-orange-950 align-top cursor-pointer ${expanded ? "bg-[#160700]" : ""}`} onClick={() => toggleInboxMessage(m)}><td className="p-1 text-orange-300 whitespace-nowrap">{m.read ? "Read" : "New"}</td><td className="p-1"><div>From {renderSender(m.from)}</div><div className={`whitespace-pre-wrap text-orange-100 ${expanded ? "" : "text-orange-300"}`}>{expanded ? displayMessageBody(m) : previewMessageBody(m)}</div>{!expanded && displayMessageBody(m).length > 180 ? <div className="text-xs text-orange-600 mt-1">Click to expand.</div> : null}</td><td className="p-1 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}><div className="flex gap-1 justify-end flex-wrap">{m.reportId ? <button className="classic-btn antro-action-btn" onClick={() => openMessageReport(m)}>View Report</button> : null}<button className="classic-btn antro-action-btn" onClick={() => handleMessageAction(m, expanded)}>{messageActionLabel(m, expanded)}</button></div></td></tr>; })}</tbody></table> : <p>No inbox messages.</p>}</Panel><Panel title="Sent">{sent.length ? <table className="w-full text-sm"><tbody>{sent.map((m) => <tr key={m.id} className="border-b border-orange-950"><td className="p-1">To <PlayerLink name={m.to} />: {m.body}</td></tr>)}</tbody></table> : <p>No sent messages.</p>}</Panel></Panel>;
  }
  function renderOnline() {
    const sorters = {
      empire: (a, b) => compareText(a.name, b.name),
      race: (a, b) => compareText(a.race, b.race),
      power: (a, b) => (a.power || 0) - (b.power || 0),
      alliance: (a, b) => compareText(a.alliance, b.alliance),
      lastSeen: (a, b) => lastSeenSortValue(a.lastSeen) - lastSeenSortValue(b.lastSeen),
    };
    const dir = onlineSort.dir === "desc" ? -1 : 1;
    const primarySorter = sorters[onlineSort.key] || sorters.lastSeen;
    const secondarySorter = onlineSort.key === "power" ? sorters.lastSeen : ((a, b) => (b.power || 0) - (a.power || 0));
    const sorted = [...getDemoPlayers()].sort((a, b) => {
      const primary = primarySorter(a, b);
      if (primary) return dir * primary;
      const secondary = secondarySorter(a, b);
      if (secondary) return secondary;
      return compareText(a.name, b.name);
    });
    const header = (label, key, align = "left") => {
      const active = onlineSort.key === key;
      const marker = active ? (onlineSort.dir === "asc" ? " ▲" : " ▼") : "";
      return <th className={`p-1 text-${align}`}><button className="text-orange-300 hover:text-orange-100 underline decoration-orange-900" onClick={() => setOnlineSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "lastSeen" ? "asc" : "desc" })}>{label}{marker}</button></th>;
    };
    return <Panel title="Online"><table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]">{header("Empire", "empire")}{header(speciesDisplayLabel(), "race")}{header("Power", "power", "right")}{header("Alliance", "alliance")}{header("Last Seen", "lastSeen", "right")}</tr></thead><tbody>{sorted.map((r) => <tr key={r.name} className={`border-b border-orange-950 ${r.name === player.name ? "antro-self-row" : ""}`}><td className="p-1"><PlayerLink name={r.name} /></td><td className="p-1">{r.race}</td><td className="p-1 text-right">{fmt(r.power)}</td><td className="p-1"><AllianceLink name={r.alliance} /></td><td className="p-1 text-right">{r.lastSeen}</td></tr>)}</tbody></table></Panel>;
  }

  function renderSearch() { const term = searchTerm.trim().toLowerCase(); const results = term ? getDemoPlayers().filter((p) => p.name.toLowerCase().includes(term) || String(p.id) === term) : []; return <Panel title="Search"><p className="mb-3 text-orange-200">Search for a player by round-specific player name or player ID.</p><div className="flex gap-2 flex-wrap mb-4"><input className="flex-1 min-w-[220px] bg-black border border-orange-900 text-orange-100 px-2 py-1" value={searchTerm} maxLength={TEXT_LIMITS.search} onChange={(e) => setSearchTerm(cleanSingleLineText(e.target.value, TEXT_LIMITS.search))} placeholder="Player name or ID" /><button className="classic-btn antro-action-btn" onClick={() => setSearchTerm("Randy")}>Find Randy</button></div>{results.length ? <table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-right p-1">ID</th><th className="text-left p-1">Empire</th><th className="text-left p-1">{speciesDisplayLabel()}</th><th className="text-right p-1">Power</th><th className="text-right p-1">Land</th><th className="text-left p-1">Alliance</th><th className="text-right p-1">Protection</th></tr></thead><tbody>{results.map((r) => <tr key={r.id} className="border-b border-orange-950"><td className="p-1 text-right">{r.id}</td><td className="p-1"><PlayerLink name={r.name} />{isAttackProtected(r) && <span className="ml-2 text-orange-200">Protected</span>}</td><td className="p-1">{r.race}</td><td className="p-1 text-right">{fmt(r.power)}</td><td className="p-1 text-right">{fmt(r.land)}</td><td className="p-1"><AllianceLink name={r.alliance} /></td><td className="p-1 text-right">{protectionShort(r)}</td></tr>)}</tbody></table> : <p>{term ? "No matching players found." : "Enter a player name or ID to search."}</p>}</Panel>; }
  function Pagination({ page, pageCount, setPage }) {
    if (pageCount <= 1) return null;
    const pages = [];
    for (let i = 1; i <= pageCount; i++) {
      if (i === 1 || i === pageCount || Math.abs(i - page) <= 3) pages.push(i);
      else if (pages[pages.length - 1] !== "...") pages.push("...");
    }
    return <div className="flex gap-1 flex-wrap mt-3 items-center text-sm">
      <button className="classic-btn antro-action-btn" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>Prev</button>
      {pages.map((pnum, idx) => pnum === "..." ? <span key={`ellipsis-${idx}`} className="px-2 text-orange-700">...</span> : <button key={pnum} className={`classic-btn ${page === pnum ? "ring-1 ring-orange-300" : ""}`} onClick={() => setPage(pnum)}>{pnum}</button>)}
      <button className="classic-btn antro-action-btn" disabled={page >= pageCount} onClick={() => setPage(Math.min(pageCount, page + 1))}>Next</button>
    </div>;
  }

  function renderNews() {
    const filters = ["All", "LRC", "Diplomacy", "Merc", "Missiles", "War", "Admin", "Other"];
    const classify = (entry) => { const explicit = newsType(entry); if (explicit) return explicit; const e = newsText(entry).toLowerCase(); if (e.startsWith("admin:") || e.includes("prototype helper")) return "Admin"; if (e.startsWith("page request update:")) return "Debug"; if (e.includes("lrc") || e.includes("long range")) return "LRC"; if (e.includes("peace") || e.includes("allied") || e.includes("diplomacy") || e.includes("declared war")) return "Diplomacy"; if (e.includes("merc") || e.includes("rebel") || e.includes("raid")) return "Merc"; if (e.includes("missile")) return "Missiles"; if (e.includes("attack") || e.includes("battle") || e.includes("war")) return "War"; return "Other"; };
    const visibleLog = log.filter((entry) => !newsText(entry).startsWith("Page request update:"));
    const filtered = newsFilter === "All" ? visibleLog : visibleLog.filter((entry) => classify(entry) === newsFilter);
    const pageSize = 100;
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(Math.max(1, newsPage), pageCount);
    const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const renderNewsEntry = (entry) => {
      const text = newsText(entry);
      const report = worldReports.find((r) => r.text === text);
      const renderDisplay = () => {
        const attackMatch = text.match(/^(.*?) attacked (.*?)( using a retal)?: (.*)$/);
        if (attackMatch) {
          const [, attacker, defender, retalText = "", rest] = attackMatch;
          const cleanedRest = rest.replace(/^\d+% damage for \d+% return,\s*/, "");
          return <><strong className="text-orange-50">{attacker}</strong>{" attacked "}<strong className="text-orange-50">{defender}</strong>{retalText}{cleanedRest ? `: ${cleanedRest}` : ""}</>;
        }
        return text;
      };
      if (adminMode && report) return <button className="text-orange-100 hover:text-orange-50 underline decoration-orange-700 text-left" onClick={() => openWorldReportByText(entry)}>{renderDisplay()}</button>;
      return renderDisplay();
    };
    return <Panel title="News"><div className="flex gap-2 flex-wrap mb-4">{filters.map((f) => <button key={f} className={`classic-btn ${newsFilter === f ? "ring-1 ring-orange-300" : ""}`} onClick={() => { setNewsFilter(f); setNewsPage(1); }}>{f}</button>)}</div><p className="mb-3 text-orange-200">Showing {pageItems.length ? `${fmt((safePage - 1) * pageSize + 1)}-${fmt((safePage - 1) * pageSize + pageItems.length)} of ${fmt(filtered.length)}` : "0"} items for this filter. Newest first.</p><div className="border border-orange-900 bg-[#100400] p-3 mb-4"><label className="block text-orange-300 mb-1">Post prototype news / announcement</label><div className="flex gap-2 flex-wrap"><input className="flex-1 min-w-[220px] bg-black border border-orange-900 text-orange-100 px-2 py-1" value={newsDraft} maxLength={TEXT_LIMITS.newsDraft} onChange={(e) => setNewsDraft(cleanSingleLineText(e.target.value, TEXT_LIMITS.newsDraft))} onKeyDown={(e) => { if (e.key === "Enter") { if (!newsDraft.trim()) return addLog("Enter a message before posting to News."); addLog(`${player.name} posted: ${newsDraft.trim()}`, "Other"); setNewsDraft(""); } }} placeholder="Enter news text" /><button className="classic-btn antro-action-btn" onClick={() => { if (!newsDraft.trim()) return addLog("Enter a message before posting to News."); addLog(`${player.name} posted: ${newsDraft.trim()}`, "Other"); setNewsDraft(""); }}>Post News</button></div></div><div className="flex gap-2 flex-wrap mb-4">{adminMode && <button className="classic-btn antro-action-btn" onClick={() => setLog((l) => [makeNewsEntry("Randy has launched 3 missiles at SONAR.", "Missiles"), makeNewsEntry("The alliance Orange Dawn has declared war on The Old Guard.", "Diplomacy"), makeNewsEntry("Long Range Cannon quota has been filled by Human Shield.", "LRC"), makeNewsEntry("Mercenaries from Laser Union have been spotted.", "Merc"), ...l].slice(0, 5000))}>Prototype: Add World News</button>}{adminMode && <button className="classic-btn antro-action-btn" onClick={() => { setLog([makeNewsEntry("News has been cleared in this prototype view.", "Other")]); setWorldReports([]); }}>Clear Prototype News</button>}</div><table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1 w-16">No.</th><th className="text-left p-1 w-24">Time</th><th className="text-left p-1 w-24">Type</th><th className="text-left p-1">Event</th></tr></thead><tbody>{pageItems.map((entry, i) => <tr key={`${newsText(entry)}-${newsCreatedAt(entry) || i}-${i}`} className="border-b border-orange-950"><td className="p-1 text-orange-300">{fmt(filtered.length - ((safePage - 1) * pageSize + i))}</td><td className="p-1 text-orange-300">{newsTimeLabel(entry)}</td><td className="p-1 text-orange-300">{classify(entry)}</td><td className="p-1 text-orange-100">{renderNewsEntry(entry)}</td></tr>)}</tbody></table><Pagination page={safePage} pageCount={pageCount} setPage={setNewsPage} /></Panel>;
  }

  function renderRankings() {
    const sortValue = (row, key) => {
      if (key === "id") return Number(row.id || 0);
      if (key === "name") return String(row.name || "").toLowerCase();
      if (key === "race") return String(row.race || "").toLowerCase();
      if (key === "power") return Number(row.power || 0);
      if (key === "land") return Number(row.land || 0);
      if (key === "pop") return Number(row.pop || 0);
      if (key === "alliance") return String(row.alliance || "None").toLowerCase();
      return "";
    };
    const clickSort = (key) => {
      setRankingSorts((current) => {
        const existing = current.find((s) => s.key === key);
        const rest = current.filter((s) => s.key !== key);
        const numericDefaultDesc = ["id", "power", "land", "pop"].includes(key);
        const nextDir = existing ? (existing.dir === "asc" ? "desc" : "asc") : (numericDefaultDesc ? "desc" : "asc");
        return [{ key, dir: nextDir }, ...rest].slice(0, 4);
      });
    };
    const sortMarker = (key) => { const idx = rankingSorts.findIndex((s) => s.key === key); if (idx < 0) return ""; return `${rankingSorts[idx].dir === "asc" ? " ▲" : " ▼"}${idx > 0 ? idx + 1 : ""}`; };
    const sortHeader = (id, label, align = "left") => <th key={id} className={`${align === "right" ? "text-right" : "text-left"} p-1`}><button className="font-bold underline decoration-orange-900 hover:text-orange-100" onClick={() => clickSort(id)}>{label}{sortMarker(id)}</button></th>;
    const ranked = [...getDemoPlayers()].sort((a, b) => { for (const sort of rankingSorts.filter((s) => s.key !== "protection")) { const av = sortValue(a, sort.key); const bv = sortValue(b, sort.key); let cmp = 0; if (typeof av === "number" && typeof bv === "number") cmp = av - bv; else cmp = String(av).localeCompare(String(bv)); if (cmp !== 0) return sort.dir === "asc" ? cmp : -cmp; } return Number(a.id || 0) - Number(b.id || 0); });
    return <Panel title="Rankings"><table className="w-full text-sm"><thead><tr className="bg-[#240B02] text-orange-300"><th className="text-right p-1">Rank</th>{sortHeader("name", "Empire")}{sortHeader("race", speciesDisplayLabel())}{sortHeader("power", "Power", "right")}{sortHeader("land", "Land", "right")}{sortHeader("pop", "Population", "right")}{sortHeader("alliance", "Alliance")}</tr></thead><tbody>{ranked.map((r, i) => <tr key={`${r.id}-${r.name}`} className={`border-b border-orange-950 ${r.name === player.name ? "antro-self-row" : ""}`}><td className="p-1 text-right">{i + 1}</td><td className="p-1"><PlayerLink name={r.name} /></td><td className="p-1">{r.race}</td><td className="p-1 text-right">{fmt(r.power)}</td><td className="p-1 text-right">{fmt(r.land)}</td><td className="p-1 text-right">{fmt(r.pop)}</td><td className="p-1"><AllianceLink name={r.alliance} /></td></tr>)}</tbody></table></Panel>;
  }

  function rawBattleLineText(line) { return typeof line === "object" && line !== null ? safeDisplay(line.text) : safeDisplay(line); }
  function battleLineText(line) { return transformClassicReportTextForMode(line, activeReportTextMode); }
  function battleLineKind(line) {
    if (typeof line === "object" && line !== null && line.kind) return line.kind;
    const text = battleLineText(line);
    if (text.startsWith("Here are the results") || text.startsWith("Battle record opened")) return "heading";
    if (text.startsWith("Combat calibration")) return "calibration";
    if ((text.includes("attacks") && text.includes("shoot down")) || (text.includes(" engaged ") && text.includes("destroying") && text.includes("removing"))) return "attack";
    if (text.startsWith("Your attack") || text.startsWith("The attack") || text.includes("'s attack succeeded") || text.includes("'s attack failed")) return "summary";
    if (text.includes("survive after the battle") || text.includes("re-formed after the battle") || text.includes("units restored")) return "survive";
    if (text.startsWith("The person has been put") || text.includes("received") && text.includes("attack protection")) return "protection";
    if (text.startsWith("Stack used")) return "stack";
    if (text.includes("turret grid fired") || text.includes("defensive turrets fire first") || text.includes("turrets stayed silent") || text.includes("insufficient energy")) return "turret";
    return "plain";
  }
  function battleLineStyle(kind) {
    const base = { fontFamily: "Consolas, Monaco, 'Courier New', monospace", borderLeft: "3px solid #5f2508", padding: "5px 8px", margin: "0 0 6px 0", background: "#090909", whiteSpace: "pre-wrap" };
    const styles = {
      heading: { color: "#ffd27a", background: "#1d0b00", borderLeftColor: "#ff9f1c", fontWeight: 700 },
      attack: { color: "#ffb86c", background: "#100701", borderLeftColor: "#ff7a18" },
      calibration: { color: "#8be9fd", background: "#061016", borderLeftColor: "#3dd6ff", fontSize: "0.86em" },
      audit: { color: "#c4b5fd", background: "#0d0718", borderLeftColor: "#a78bfa", fontSize: "0.86em" },
      summary: { color: "#f1fa8c", background: "#151205", borderLeftColor: "#f1fa8c", fontWeight: 700 },
      survive: { color: "#50fa7b", background: "#061207", borderLeftColor: "#50fa7b" },
      protection: { color: "#fed7aa", background: "#120905", borderLeftColor: "#ffb86c" },
      stack: { color: "#ff79c6", background: "#170714", borderLeftColor: "#ff79c6" },
      turret: { color: "#fbbf24", background: "#130d02", borderLeftColor: "#f59e0b" },
      plain: { color: "#fed7aa" },
    };
    return { ...base, ...(styles[kind] || styles.plain) };
  }
  function renderBattleLine(line, i) {
    const text = battleLineText(line);
    const kind = battleLineKind(line);
    if (["calibration", "audit", "stack"].includes(kind)) return null;
    const prefix = { heading: "//", attack: "•", summary: "=>", survive: "+", protection: "@", turret: "⚑", plain: "" }[kind] || "";
    return <div key={`${text}-${i}`} style={battleLineStyle(kind)}><span style={{ opacity: 0.65, marginRight: 8 }}>{prefix}</span>{text}</div>;
  }
  function renderReport() {
    return <Panel title="Battle Report">
      {battleReport.length ? <div>{battleReport.map(renderBattleLine)}</div> : <p>No battle report selected.</p>}
    </Panel>;
  }

  function battleLogMeta(report) {
    const lookup = (name) => getDemoPlayers().find((p) => p.name === name) || {};
    const attacker = lookup(report.attacker);
    const defender = lookup(report.defender);
    const text = String(report.text || "");
    const m = text.match(/^(.*?) attacked (.*?):\s*(\d+)% damage for (\d+)% return/i);
    const damagePct = Number(report.defenderLossPct ?? (m ? m[3] : 0));
    const returnPct = Number(report.attackerLossPct ?? (m ? m[4] : 0));
    const attackerWon = report.attackerWon ?? (damagePct > returnPct);
    return {
      attackerName: report.attacker || (m ? m[1] : "Unknown"),
      defenderName: report.defender || (m ? m[2] : "Unknown"),
      attackerPower: Number(report.attackerPower ?? attacker.power ?? 0),
      defenderPower: Number(report.defenderPower ?? defender.power ?? 0),
      attackerAlliance: report.attackerAlliance || attacker.alliance || "None",
      defenderAlliance: report.defenderAlliance || defender.alliance || "None",
      attackerWon,
      retal: Boolean(report.retal),
      winPct: attackerWon ? damagePct : returnPct,
    };
  }

  function activePlayerWonBattle(report, meta = null) {
    const m = meta || battleLogMeta(report);
    if (m.attackerName === player.name) return Boolean(m.attackerWon);
    if (m.defenderName === player.name) return !Boolean(m.attackerWon);
    return false;
  }

  function retalPairForReport(report, meta = null) {
    const m = meta || battleLogMeta(report);
    if (report?.retal) {
      const record = (retalRecords || []).map(normaliseRetalRecord).find((r) =>
        r && (r.usedByReportId === report.id || (report.retalSourceReportId && r.sourceReportId === report.retalSourceReportId) || (report.retalSourceKey && retalDedupeKey(r) === report.retalSourceKey))
      );
      return {
        kind: "retalBattle",
        sourceReportId: report.retalSourceReportId || record?.sourceReportId || null,
        retalReportId: report.id,
        activePlayerWon: activePlayerWonBattle(report, m),
        report,
        record: record || null
      };
    }
    const record = retalRecordForSourceReport(retalRecords || [], report.id);
    if (!record?.usedAt) return null;
    const usedReport = worldReports.find((r) => r.id === record.usedByReportId) || null;
    let activePlayerWon = false;
    if (usedReport) {
      activePlayerWon = activePlayerWonBattle(usedReport);
    } else if (record.usedWon !== null && record.usedWon !== undefined) {
      const holderWon = Boolean(record.usedWon);
      activePlayerWon = record.holder === player.name ? holderWon : record.target === player.name ? !holderWon : holderWon;
    }
    return {
      kind: "sourceAttack",
      sourceReportId: report.id,
      retalReportId: record.usedByReportId || null,
      activePlayerWon,
      usedReport,
      record
    };
  }

  function retalOutcomeForReport(report, meta = null) {
    const pair = retalPairForReport(report, meta);
    if (!pair) return null;
    if (pair.kind === "retalBattle") return { activePlayerWon: pair.activePlayerWon, usedReport: report, isRetalBattle: true };
    return { activePlayerWon: pair.activePlayerWon, usedReport: pair.usedReport || null, isRetalBattle: false };
  }

  function retalOutcomeLabel(activePlayerWon) {
    return activePlayerWon ? "Success" : "Failure";
  }

  function retalOutcomeClass(activePlayerWon) {
    return activePlayerWon ? "text-green-400 font-semibold italic" : "text-red-400 font-semibold italic";
  }

  function servedRetalClass() {
    return "text-cyan-300 font-semibold italic";
  }

  function battleLogRowStyle(report, meta) {
    const isPlayerAttack = meta.attackerName === player.name;
    if (isPlayerAttack) {
      return { background: "linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.055) 18%, rgba(245, 158, 11, 0.02))" };
    }
    return {};
  }

  function retalConnectorPlan(pageItems) {
    const rowMap = new Map();
    const byId = new Map();
    pageItems.forEach((r, idx) => {
      if (r?.id) byId.set(r.id, idx);
    });
    const addPiece = (rowIndex, piece) => {
      if (!rowMap.has(rowIndex)) rowMap.set(rowIndex, []);
      rowMap.get(rowIndex).push(piece);
    };
    const pairsByKey = new Map();
    pageItems.forEach((r) => {
      const pair = retalPairForReport(r, battleLogMeta(r));
      if (!pair?.sourceReportId || !pair?.retalReportId) return;
      if (!byId.has(pair.sourceReportId) || !byId.has(pair.retalReportId)) return;
      const key = `${pair.sourceReportId}::${pair.retalReportId}`;
      if (!pairsByKey.has(key)) {
        pairsByKey.set(key, {
          sourceIndex: byId.get(pair.sourceReportId),
          retalIndex: byId.get(pair.retalReportId),
          activePlayerWon: Boolean(pair.activePlayerWon),
        });
      }
    });
    const laneCount = 5;
    const laneIntervals = Array.from({ length: laneCount }, () => []);
    const pairs = [...pairsByKey.values()]
      .filter((p) => p.sourceIndex !== p.retalIndex)
      .map((p) => ({ ...p, top: Math.min(p.sourceIndex, p.retalIndex), bottom: Math.max(p.sourceIndex, p.retalIndex) }))
      .sort((a, b) => (a.top - b.top) || ((b.bottom - b.top) - (a.bottom - a.top)));
    pairs.forEach((pair) => {
      let lane = laneIntervals.findIndex((intervals) => intervals.every((iv) => pair.bottom < iv.top || pair.top > iv.bottom));
      if (lane < 0) lane = laneIntervals.reduce((best, intervals, idx) => intervals.length < laneIntervals[best].length ? idx : best, 0);
      laneIntervals[lane].push({ top: pair.top, bottom: pair.bottom });
      const color = pair.activePlayerWon ? "#22c55e" : "#ef4444";
      const label = pair.activePlayerWon ? "Successful retal link" : "Failed retal link";
      for (let rowIndex = pair.top; rowIndex <= pair.bottom; rowIndex += 1) {
        const terminal = rowIndex === pair.sourceIndex ? "source" : rowIndex === pair.retalIndex ? "retal" : null;
        const direction = rowIndex === pair.top ? "down" : rowIndex === pair.bottom ? "up" : "through";
        addPiece(rowIndex, { kind: "completed", lane, color, label, terminal, direction });
      }
    });
    pageItems.forEach((r, rowIndex) => {
      const record = retalRecordForSourceReport(retalRecords || [], r.id);
      if (!record || record.usedAt || !record.activatedAt || !record.expiresAt || displayNow > record.expiresAt) return;
      const usedPairAlreadyVisible = [...pairsByKey.values()].some((pair) => pair.sourceIndex === rowIndex || pair.retalIndex === rowIndex);
      if (usedPairAlreadyVisible) return;
      const occupied = new Set((rowMap.get(rowIndex) || []).map((p) => p.lane));
      let lane = 0;
      while (occupied.has(lane) && lane < laneCount - 1) lane += 1;
      addPiece(rowIndex, { kind: "pending", lane, color: "#38bdf8", label: "Pending retal link" });
    });
    return rowMap;
  }

  function retalConnectorPiece(piece, idx) {
    const laneX = 7 + piece.lane * 8;
    const widthToClock = Math.max(10, 44 - laneX);
    const line = { position: "absolute", borderColor: piece.color, opacity: 0.95, pointerEvents: "none" };
    const parts = [];
    if (piece.kind === "completed") {
      const top = piece.direction === "down" ? "50%" : "0";
      const bottom = piece.direction === "up" ? "50%" : "0";
      parts.push(<span key="v" style={{ ...line, left: laneX, top, bottom, borderLeftWidth: 2 }} />);
      if (piece.terminal) {
        parts.push(<span key="h" style={{ ...line, left: laneX, top: "50%", width: widthToClock, borderTopWidth: 2 }} />);
        parts.push(<span key="dot" style={{ position: "absolute", left: laneX + widthToClock - 2, top: "calc(50% - 2px)", width: 4, height: 4, background: piece.color, borderRadius: 999, opacity: 0.95 }} />);
      }
    } else if (piece.kind === "pending") {
      parts.push(<span key="v" style={{ ...line, left: laneX, top: 3, bottom: "50%", borderLeftWidth: 2, opacity: 0.85 }} />);
      parts.push(<span key="h" style={{ ...line, left: laneX, top: "50%", width: Math.min(18, widthToClock), borderTopWidth: 2, opacity: 0.85 }} />);
    }
    return <span key={`${piece.kind}-${piece.lane}-${idx}`} title={piece.label}>{parts}</span>;
  }

  function retalConnectorCell(connectorPlan, rowIndex) {
    const pieces = connectorPlan.get(rowIndex) || [];
    return <td className="p-0 align-stretch" style={{ width: 52, minWidth: 52 }}><div style={{ position: "relative", height: "100%", minHeight: 34 }}>{pieces.map(retalConnectorPiece)}</div></td>;
  }

  function retalClockForReport(report, meta = null) {
    const pair = retalPairForReport(report, meta);
    if (pair?.kind === "retalBattle") return <span className={retalOutcomeClass(pair.activePlayerWon)}>{retalOutcomeLabel(pair.activePlayerWon)}</span>;
    const record = retalRecordForSourceReport(retalRecords || [], report.id);
    if (!record) {
      // Fallback is only for older incoming reports where the retal record was not persisted.
      // It should not invent bot-held retals or counter-retals.
      if (report?.defender === player.name && report?.attackerWon && report?.createdAt) {
        const fallbackExpiry = Number(report.createdAt || 0) + retalWindowMsForSettings(roundSettings);
        if (displayNow <= fallbackExpiry) return <span className="text-orange-100">{compactHms(Math.max(0, Math.ceil((fallbackExpiry - displayNow) / 1000)))}</span>;
        return <span className="text-orange-700">Expired</span>;
      }
      return <span className="text-orange-800">--</span>;
    }
    if (record.usedAt) {
      const usedReport = pair?.usedReport || worldReports.find((r) => r.id === record.usedByReportId);
      if (usedReport) return <button className={`${servedRetalClass()} underline decoration-current hover:text-orange-100`} title="Retal used; open the served retal report" onClick={() => { setBattleReport(usedReport.lines || [usedReport.text]); setPage("report"); }}>Served</button>;
      return <span className={servedRetalClass()}>Served</span>;
    }
    if (record.activatedAt && record.expiresAt) {
      if (displayNow > record.expiresAt) return <span className="text-orange-700">Expired</span>;
      return <span className="text-red-400 font-bold">{compactHms(Math.max(0, Math.ceil((record.expiresAt - displayNow) / 1000)))}</span>;
    }
    const normalSeconds = 2 * 60 * 60;
    const roundSeconds = Math.max(1, Math.floor(normalSeconds / Math.max(1, gameSpeed())));
    return <span className="text-orange-500" title={`Dormant retal right: ${compactHms(normalSeconds)} normal / ${compactHms(roundSeconds)} in ${gameName}. Clock starts when the holder next logs in/checks in.`}>Waiting</span>;
  }

  function renderBattleLog() {
    const reports = worldReports.filter((r) => {
      const text = String(r.text || "");
      return r.attacker === player.name || r.defender === player.name || text.includes(player.name);
    });
    const opponentNames = Array.from(new Set(reports.map((r) => {
      const meta = battleLogMeta(r);
      return meta.attackerName === player.name ? meta.defenderName : meta.attackerName;
    }).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const filteredReports = battleLogOpponent === "All opponents" ? reports : reports.filter((r) => {
      const meta = battleLogMeta(r);
      const opponent = meta.attackerName === player.name ? meta.defenderName : meta.attackerName;
      return opponent === battleLogOpponent;
    });
    const pageSize = 100;
    const pageCount = Math.max(1, Math.ceil(filteredReports.length / pageSize));
    const safePage = Math.min(Math.max(1, battleLogPage), pageCount);
    const pageItems = filteredReports.slice((safePage - 1) * pageSize, safePage * pageSize);
    const connectorPlan = retalConnectorPlan(pageItems);
    return <Panel title="Battle Log">
      <p className="mb-3 text-orange-200">Battle reports involving your empire. Power columns show the attacker/defender condition at battle initiation. Newest reports are shown first.</p>
      <div className="flex gap-2 flex-wrap mb-3 items-center"><label className="text-orange-300">Opponent</label><select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={battleLogOpponent} onChange={(e) => { setBattleLogOpponent(e.target.value); setBattleLogPage(1); }}><option>All opponents</option>{opponentNames.map((name) => <option key={name}>{name}</option>)}</select><span className="text-orange-200">Showing {pageItems.length ? `${fmt((safePage - 1) * pageSize + 1)}-${fmt((safePage - 1) * pageSize + pageItems.length)} of ${fmt(filteredReports.length)}` : "0"} reports.</span></div>
      {filteredReports.length ? <><table className="w-full text-xs md:text-sm">
        <thead>
          <tr className="text-orange-300 bg-[#240B02]">
            <th className="text-left p-1">Attacker</th>
            <th className="text-right p-1">Start Power</th>
            <th className="text-left p-1">Alliance</th>
            <th className="text-left p-1">Time</th>
            <th className="text-left p-1">Alliance</th>
            <th className="text-right p-1">Start Power</th>
            <th className="text-left p-1">Defender</th>
            <th className="text-center p-1">Retal</th>
            <th className="text-center p-1" title="Retal link">↔</th>
            <th className="text-left p-1">Retal Clock</th>
            <th className="text-right p-1">Win %</th>
            <th className="text-right p-1">View</th>
          </tr>
        </thead>
        <tbody>{pageItems.map((r, i) => {
          const meta = battleLogMeta(r);
          const rowStyle = battleLogRowStyle(r, meta);
          return <tr key={r.id || `${r.text}-${i}`} className="border-b border-orange-950" style={rowStyle}>
            <td className="p-1"><PlayerLink name={meta.attackerName} /></td>
            <td className="p-1 text-right text-orange-100">{fmt(meta.attackerPower)}</td>
            <td className="p-1"><AllianceLink name={meta.attackerAlliance} /></td>
            <td className="p-1 text-orange-300 whitespace-nowrap">{newsTimeLabel(r)}</td>
            <td className="p-1"><AllianceLink name={meta.defenderAlliance} /></td>
            <td className="p-1 text-right text-orange-100">{fmt(meta.defenderPower)}</td>
            <td className="p-1"><PlayerLink name={meta.defenderName} /></td>
            <td className="p-1 text-center">{meta.retal ? "Y" : "N"}</td>
            {retalConnectorCell(connectorPlan, i)}
            <td className="p-1 whitespace-nowrap">{retalClockForReport(r, meta)}</td>
            <td className="p-1 text-right text-orange-100">{Number(meta.winPct || 0).toFixed(0)}%</td>
            <td className="p-1 text-right"><button className="classic-btn antro-action-btn" onClick={() => { setBattleReport(r.lines || [r.text]); setPage("report"); }}>View</button></td>
          </tr>;
        })}</tbody>
      </table><Pagination page={safePage} pageCount={pageCount} setPage={setBattleLogPage} /></> : <p>No battle reports involving your empire yet.</p>}
    </Panel>;
  }

  function renderAllianceProfile() {
    const allAlliances = getDemoAlliances();
    const a = allAlliances.find((x) => String(x.name).toLowerCase() === String(allianceProfileName).toLowerCase());
    if (!a) return <Panel title={`Alliance Profile: ${allianceProfileName}`}><p>Alliance not found.</p><div className="mt-4"><button className="classic-btn antro-action-btn" onClick={() => setPage("alliances")}>Back to Alliances</button></div></Panel>;
    const currentAlliance = normaliseAlliance(alliance);
    const isOwnAlliance = Boolean(currentAlliance && currentAlliance.name === a.name);
    const atWarWithAlliance = sidesAreAtWar(ownWarSideKeys(), allianceSideKeys(a.name));
    const canActOnAllianceDiplomacy = !isOwnAlliance && canManageDiplomacy();
    const members = [...a.members].sort((x, y) => (y.power || 0) - (x.power || 0));
    return <Panel title={`Alliance Profile: ${a.name}`}>
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-orange-100 tracking-wide">{a.name}</h2>
        <p className="mt-2 text-orange-300 italic">{a.announcement || "..."}</p>
      </div>
      <OldTable rows={[
        ["Leader", <PlayerLink name={a.leader} />],
        ["Members", fmt(members.length)],
        ["Total Power", fmt(a.totalPower)],
        ["Total Land", fmt(a.totalLand)],
        ["Diplomacy", <span className={diplomacyStateClass(a.diplomacy)}>{a.diplomacy}</span>]
      ]} />
      <Panel title="Members">
        <table className="w-full text-sm">
          <thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Empire</th><th className="text-left p-1">{speciesDisplayLabel()}</th><th className="text-right p-1">Power</th><th className="text-right p-1">Land</th><th className="text-right p-1">Experience</th></tr></thead>
          <tbody>{members.map((m) => <tr key={m.id || m.name} className="border-b border-orange-950"><td className="p-1"><PlayerLink name={m.name} /></td><td className="p-1">{m.race}</td><td className="p-1 text-right">{fmt(m.power)}</td><td className="p-1 text-right">{fmt(m.land)}</td><td className="p-1 text-right">{fmt(m.totalExperience ?? m.experience)}</td></tr>)}</tbody>
        </table>
      </Panel>
      <div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => setPage("alliances")}>Back to Alliances</button>{!isOwnAlliance && <button className="classic-btn antro-action-btn" onClick={() => joinAlliance(a.name)} disabled={members.length + 1 > ALLIANCE_MEMBER_LIMIT}>{members.length + 1 > ALLIANCE_MEMBER_LIMIT ? "Full" : "Request to join alliance"}</button>}{!isOwnAlliance && <button className="classic-btn antro-action-btn" onClick={() => atWarWithAlliance ? sendDiplomacyRequestToSide("peace", "alliance", a.name) : declareWarOnSide("alliance", a.name)} disabled={!canActOnAllianceDiplomacy}>{atWarWithAlliance ? "Request Peace" : "Declare War"}</button>}</div>
    </Panel>;
  }

  function renderProfile() {
    const p = getDemoPlayers().find((x) => x.name === profileName) || getDemoPlayers()[0];
    const privateSource = p.name === player.name ? { ...player, raceKey: player.race } : getPrivateOpponentByName(p.name);
    const sameAlliance = alliance && p.alliance === alliance.name;
    const fullAccess = adminMode || p.name === player.name || (sameAlliance && (isAllianceAdmin(player.name, alliance) || allianceShareEnabledMembers.includes(p.name)));
    const raceKey = privateSource?.raceKey || privateSource?.race || player.race;
    const resourceRows = fullAccess && privateSource ? [
      [<span className="text-orange-200 font-bold">Resources</span>, ""],
      ["Cardisium", fmt(privateSource.cards || 0)],
      ["Banked Cardisium", fmt(privateSource.banked || 0)],
      ["Food", fmt(privateSource.food || 0)],
      ["Water", fmt(privateSource.water || 0)],
      ["Energy", fmt(privateSource.energy || 0)],
      ["Scanners", fmt(privateSource.scanners || 0)],
      ["Missiles", fmt(privateSource.missiles || 0)],
      ["Free Land", fmt(privateSource.freeLand || 0)],
      ["Built Land", fmt(totalBuildings(privateSource.buildings || {}))],
      ["Total Land", fmt(totalEmpireLand(privateSource))],
    ] : [];
    const mineralRows = fullAccess && privateSource ? [
      [<span className="text-orange-200 font-bold">Minerals</span>, ""],
      ...mineralOrder.map((m) => [m, fmt((privateSource.minerals || {})[m] || 0)])
    ] : [];
    const buildingRows = fullAccess && privateSource ? [
      [<span className="text-orange-200 font-bold">Buildings</span>, ""],
      ...buildingOrder.map(([id, label]) => [label, fmt((privateSource.buildings || {})[id] || 0)])
    ] : [];
    const armyDetailRows = fullAccess && privateSource ? [
      [<span className="text-orange-200 font-bold">Army</span>, ""],
      ["Army Power", fmt(armyPower(raceKey, privateSource.army || []))],
      ["Stack Order", (privateSource.stack || []).join(", ")],
      ["Doctrine", privateSource.botDoctrine || "Player/manual"],
      ...armyRows(raceKey, privateSource.army || []).map((r) => [`${r.name} row`, `${fmt(r.number)} units · ${fmt(r.power)} power · ${r.percent.toFixed(1)}%`])
    ] : [];
    const privateRows = fullAccess && privateSource ? [
      ["Visible To You", adminMode ? "Admin/debug full profile" : "Alliance shared/admin full profile"],
      ...resourceRows,
      ...mineralRows,
      ...buildingRows,
      ...armyDetailRows
    ] : [];
    const atWarWithProfile = isAtWarWithPlayer(p);
    const alliedWithProfile = isAlliedWithPlayer(p);
    const profilePlayerInAlliance = Boolean(p.alliance && p.alliance !== "None");
    return <Panel title={`Player Profile: ${p.name}`}><p className="mb-3 text-orange-200">{fullAccess ? "Full profile view is enabled for admin/alliance access." : "Public player information only."}</p><OldTable rows={[["Player ID", p.id], ["Player Name", p.name], [speciesDisplayLabel(), p.race], ["Alliance", <AllianceLink name={p.alliance} />], ["Diplomacy", p.name === player.name ? "Self" : atWarWithProfile ? <span className="text-red-300">War</span> : alliedWithProfile ? <span className="text-green-300">Ally</span> : "Neutral"], ["Total Land", fmt(p.land)], ["Total Population", fmt(p.pop)], ["Total Power", fmt(p.power)], ["Protection", protectionValueLabel(p)], ["Wins/Losses (Total)", winLossRecordLabel(p)], ["Experience (Total)", experienceRecordLabel(p)], ["Last Seen", p.lastSeen], ...(adminMode && privateSource?.lastSeenAt ? [["Last Seen Timestamp", new Date(privateSource.lastSeenAt).toLocaleTimeString()]] : []), ...privateRows]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => { selectTargetName(p.name); setPage("war"); }} disabled={p.name === player.name || alliedWithProfile || isAttackProtected(p)}>Set as War Target</button>{!profilePlayerInAlliance && <button className="classic-btn antro-action-btn" onClick={() => atWarWithProfile ? sendDiplomacyRequestToSide("peace", "player", p.name) : declareWarOnSide("player", p.name)} disabled={p.name === player.name || !canManageDiplomacy()}>{atWarWithProfile ? "Request Peace" : "Declare War"}</button>}<button className="classic-btn antro-action-btn" onClick={() => { setMessageTo(p.name); setPage("messages"); }} disabled={p.name === player.name}>Message Player</button><button className="classic-btn antro-action-btn" onClick={() => { setSpyTarget(p.name); setPage("spy"); }} disabled={p.name === player.name}>Spy on Player</button></div></Panel>;
  }

  function renderSelfTests() {
    if (!adminMode) return <Panel title="Private AntrophAI prototype"><p className="text-orange-200">Project notes, changelog, provenance and test tools are available only in admin mode.</p></Panel>;
    const selectedChange = prototypeChangelog.find((entry) => entry.version === selectedChangelogVersion) || prototypeChangelog[0];
    return <Panel title="To Do / Project Log">
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="classic-btn antro-action-btn" onClick={() => setTodoSubPage("todo")}>To Do</button>
        <button className="classic-btn antro-action-btn" onClick={() => setTodoSubPage("changelog")}>Changelog</button>
        <button className="classic-btn antro-action-btn" onClick={() => setTodoSubPage("tests")}>Self Tests</button>
      </div>
      {todoSubPage === "todo" && <>
        <Panel title="Current Development Notes">
          <OldTable rows={[
            ["Current Version", PROTOTYPE_VERSION],
            ["Current Priority", "Playtest active bots, admin time controls, and classic combat feel"],
            ["Multi-tab Status", "Use one active state-changing tab for now; extra tabs are safe mainly for viewing"],
            ["Multi-tab Future", "Add cross-tab save detection before serious multi-tab play"],
            ["Prototype Tidy-up", "Pending after bot pass: split constants, pure rules, page components, and storage helpers"],
            ["Local Dev", "Run npm run dev, then open the localhost link in Chrome"]
          ]} />
        </Panel>
        <Panel title="Future Tutorial Note">
          <p className="mb-2 text-orange-200">Add an automated new-player tutorial later: join game, set up player, join alliance, build economy, power up, attack bot players, receive bot attacks back, and use prompted skip-time steps to progress through the staged lesson.</p>
          <p className="text-orange-300">Possible source clue: user may have made an old forum post about this in the recovered AntrophAI material.</p>
        </Panel>
        <Panel title="Active Bot Note"><p className="mb-2 text-orange-200">v0.40.0 bots are rule-based rather than true AI. They grow, sleep, bank, rotate stacks and raid each other using rough old-player doctrines.</p><p className="text-orange-300">This is intentionally tunable: some bots use sound stack logic, while a few use naive/random veteran-myth logic so the round still has exploitable players.</p></Panel>
        <Panel title="XP System Note"><p className="mb-2 text-orange-200">Classic AntrophAI reportedly awarded experience from defence as well as attack. The prototype currently treats XP mainly as an attack/battle placeholder, so defensive XP needs adding when the reward system is revisited.</p><p className="text-orange-300">Planned rule: XP is fighting-only. Turret damage by itself should not generate experience; future XP should reward battle quality, useful power connection, and meaningful combat damage rather than economy actions.</p></Panel>
        <Panel title="Current Playtest Notes"><p className="mb-2 text-orange-200">Starvation review carried out in v0.40.30: population growth now targets the supported population cap, and food/water shortage causes controlled attrition rather than an abrupt half-population cliff. Continue testing the attrition rate against old AntrophAI memory.</p><p className="mb-2 text-orange-200">Bots still need a social threat model: a rank-one, unaffiliated land/power leader should attract resentment, coordinated attacks, and alliance attention rather than being ignored.</p><p className="text-orange-300">Alliance diplomacy is still mostly a placeholder. Future bot logic should include alliance enemies, grudges, retaliation, and anti-elite conspiracy behaviour.</p></Panel>
        <Panel title="Playtest Follow-up Notes"><p className="mb-2 text-orange-200">Market listing workflow: listing fields should stay populated, and sell/buy forms should provide fill/select helpers for repeated market actions.</p><p className="mb-2 text-orange-200">Combat/report checks: confirm player attacks always enter War news, appear in Battle Log, and link back to the correct report.</p><p className="mb-2 text-orange-200">Routing/access: long-term hosted AntrophAI should preserve old direct pages such as /build, /barracks, /barracksdisband, /war and /status; disband must remain accessible without completing barracks training.</p><p className="text-orange-300">Bot pressure: elite/alliance bots should eventually treat unaffiliated rank-one leaders as political threats and coordinate attacks or diplomacy accordingly.</p></Panel>
        <Panel title="Engineering Cleanup Note">
          <p className="mb-2 text-orange-200">Prototype function tidy-up is not complete yet. The app still works as a single large App.jsx, which is fine for fast reconstruction but awkward for long-term development.</p>
          <p className="mb-2 text-orange-200">Recommended next cleanup: extract constants/data, pure game-rule helpers, localStorage/page-update helpers, and individual page render components into separate files while keeping behaviour unchanged.</p>
          <p className="text-orange-300">Also add a later multi-tab guard so old tabs cannot accidentally overwrite newer saved state.</p>
        </Panel>
      </>}
      {todoSubPage === "changelog" && <>
        <Panel title="Version Changelog">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-orange-300">Version:</span>
            <select className="bg-black border border-orange-900 text-orange-100 px-2 py-1" value={selectedChangelogVersion} onChange={(e) => setSelectedChangelogVersion(e.target.value)}>
              {prototypeChangelog.map((entry) => <option key={entry.version} value={entry.version}>{entry.version} - {entry.title}</option>)}
            </select>
          </div>
          <OldTable rows={[["Version", selectedChange.version], ["Date", selectedChange.date], ["Title", selectedChange.title]]} />
          <h3 className="mt-4 mb-2 text-orange-300 font-bold">Changes</h3>
          <ul className="list-disc pl-6 text-orange-100 space-y-1">{selectedChange.changes.map((item, i) => <li key={`change-${i}`}>{item}</li>)}</ul>
          <h3 className="mt-4 mb-2 text-orange-300 font-bold">Next / Notes</h3>
          <ul className="list-disc pl-6 text-orange-200 space-y-1">{selectedChange.next.map((item, i) => <li key={`next-${i}`}>{item}</li>)}</ul>
        </Panel>
      </>}
      {todoSubPage === "tests" && <Panel title="Prototype Self Tests">
        <OldTable rows={selfTests.map((t) => [t.name, t.passed ? "PASS" : "FAIL"])} />
        <div className="mt-4"><button className="classic-btn antro-action-btn" onClick={resetLocalSave}>Reset Local Prototype Save</button></div>
      </Panel>}
    </Panel>;
  }


  function renderPersistentStats() {
    if (activeGameMode === "hosted" && hostedRoundState.summary) return renderHostedPersistentStats();
    const now = Date.now();
    const gmtClock = new Date(now).toLocaleString("en-GB", { timeZone: "UTC", hour12: false, weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
    const elapsedSeconds = Math.max(0, (now - (player.lastUpdatedAt || now)) / 1000);
    const tickSeconds = typeof realSecondsPerTick === "function" ? realSecondsPerTick() : 1800;
    const speed = typeof gameSpeed === "function" ? gameSpeed() : 1;
    const ticksWaiting = typeof dueGameTicks === "function" ? dueGameTicks(elapsedSeconds, speed) : 0;
    const tickEquivalentWaiting = typeof tickEquivalentForElapsed === "function" ? tickEquivalentForElapsed(elapsedSeconds, speed) : 0;
    return <aside className="border border-orange-800 bg-black/80 h-fit text-xs">
      <h2 className="bg-[#240B02] border-b border-orange-800 px-2 py-1 text-orange-300 font-bold">{gameName}</h2>
      <div className="border-b border-orange-900 px-2 py-1 text-orange-200 bg-[#120500]">{gmtClock}</div>
      <h2 className="bg-[#240B02] border-b border-orange-800 px-2 py-1 text-orange-300 font-bold">Empire Values</h2>
      <div className="p-2">
        <OldTable rows={[["Power", fmt(power)], ["Protection", protectionValueLabel(player)], ["Land", fmt(land)], ["Built Land", fmt(totalBuildings(player.buildings))], ["Free Land", fmt(player.freeLand)], [currencyLabel, fmt(player.cards)], ["Bank funds", `${compactFmt(player.banked)}/${compactFmt(caps.bankCap)}`], ["Population", fmt(player.pop)], [resourceLabel("food"), fmt(player.food)], [resourceLabel("water"), fmt(player.water)], [resourceLabel("energy"), fmt(player.energy)], [resourceLabel("missiles"), `${fmt(player.missiles)} / ${fmt(missileCapacity())}`]]} />
        <h3 className="mt-3 mb-1 text-orange-300 font-bold">Army</h3>
        <OldTable rows={(races[player.race]?.units || races.human.units).map(([name], i) => [name, fmt((player.army || [])[i] || 0)])} />
        <h3 className="mt-3 mb-1 text-orange-300 font-bold">Buildings</h3>
        <OldTable rows={buildingOrder.map(([id, name]) => [buildingLabel(id), fmt((player.buildings || {})[id] || 0)])} />
        <h3 className="mt-3 mb-1 text-orange-300 font-bold">Minerals</h3>
        <OldTable rows={mineralOrder.map((m) => [mineralLabel(m), fmt((player.minerals || {})[m] || 0)])} />
        {adminMode && <div className="mt-3 border border-red-900 bg-red-950/30 p-2 text-red-200"><div className="font-bold text-red-300 mb-1">Admin timing</div><OldTable rows={[["Game Speed", `${speed}x`], ["Seconds / Tick", Number(tickSeconds).toFixed(1)], ["Elapsed", `${elapsedSeconds.toFixed(1)}s`], ["Ticks Waiting", fmt(ticksWaiting)], ["Tick Eq.", Number(tickEquivalentWaiting).toFixed(3)]]} /></div>}
      </div>
    </aside>;
  }

  function renderHostedPersistentStats() {
    const hosted = getHostedShellSnapshot();
    if (!hosted.summary) {
      return <aside className="border border-orange-800 bg-black/80 h-fit text-xs">
        <h2 className="bg-[#240B02] border-b border-orange-800 px-2 py-1 text-orange-300 font-bold">Hosted DEV Round</h2>
        <div className="p-2 text-orange-200">Redeem a real invite token and enter the hosted round to load canonical server state.</div>
      </aside>;
    }

    return <aside className="border border-cyan-700 bg-black/80 h-fit text-xs">
      <h2 className="bg-[#0b1d24] border-b border-cyan-800 px-2 py-1 text-cyan-200 font-bold">Hosted DEV Round</h2>
      <div className="border-b border-cyan-900 px-2 py-1 text-cyan-100 bg-[#071015]">{hosted.roundName} · {hosted.roundKey}</div>
      <div className="p-2">
        <OldTable rows={[
          ["You are", hosted.playerLabel],
          ["Player id", hosted.playerId ? maskStableIdentifier(hosted.playerId) : "—"],
          ["Grant id", hosted.hostedGrantId ? maskStableIdentifier(hosted.hostedGrantId) : "—"],
          ["Current tick", hosted.currentTick],
          ["Race", hosted.raceLabel || "Unknown"],
          ["Land", fmt(Math.max(0, Math.floor(hosted.land)))],
          ["Power", fmt(Math.max(0, Math.floor(hosted.power)))],
          ["Money", fmt(Math.max(0, Math.floor(hosted.money)))],
          ["Factories", fmt(Math.max(0, Math.floor(hosted.factoryCount)))],
          ["Queued", fmt(Math.max(0, Math.floor(hosted.queuedCount)))],
          ["Processed", fmt(Math.max(0, Math.floor(hosted.processedCount)))],
          ["Other players", hosted.otherPlayerSummary],
        ]} />
        <div className="mt-3 text-orange-200 text-[11px] leading-relaxed">
          Canonical hosted state comes from the game-service. Local browser saves stay separate.
        </div>
      </div>
    </aside>;
  }

  function currentRoundKeyFromProfile() {
    if (roundProfile === "Godlike Warfare") return "glw";
    if (roundProfile === "Intro Game") return "intro";
    return selectedRoundKey || "glw";
  }
  function registeredSlotForRound(roundKey = selectedRoundKey) {
    return liveRoundSlotIndex(roundSlotIndex).find((slot) => canonicalRoundKeyForSlot(slot) === roundKey);
  }
  function enterSelectedRound(targetPage = "status") {
    const slot = registeredSlotForRound(selectedRoundKey);
    if (slot?.slotKey) return switchRoundSlot(slot.slotKey);
    setPlayerNameSetupComplete(false);
    setEntryStage("species");
    setPage(targetPage);
  }
  function roundClockRows(roundKey = selectedRoundKey, startedAt = null) {
    const slot = registeredSlotForRound(roundKey);
    const slotPayload = slot?.slotKey ? safeLoadRoundSlot(slot.slotKey) : null;
    const start = startedAt || slotPayload?.roundStartedAt || roundStartTimestampForKey(roundKey);
    const speed = roundSpeedForSavedSlot(roundKey, slotPayload, slot);
    const snap = roundClockSnapshot(roundKey, start, Date.now(), speed);
    return [["Game clock", formatRoundClock(snap)], ["Speed used", `${speed}x`], ["Total duration", `${GAME_TOTAL_TICKS} ticks / 90 IG-speed days`], ["Projected end", new Date(snap.realEndAt).toLocaleString()]];
  }
  function enterCurrentGame(targetPage = "status") {
    const name = cleanStoredName(player.name, "SONAR");
    setPlayerNameDraft(name);
    setSelectedSpeciesKey(races[player.race] ? player.race : selectedSpeciesKey);
    setPlayerNameSetupComplete(true);
    setEntryStage("game");
    setPage(targetPage);
  }
  function returnToBaseScreen() {
    setSelectedRoundKey("glw");
    setSelectedSpeciesKey(races[player.race] ? player.race : selectedSpeciesKey);
    setPlayerNameDraft(cleanStoredName(player.name, "SONAR"));
    setEntryStage("glw");
    setPlayerNameSetupComplete(false);
    setGlwRaceRegistered(true);
    setActiveGameMode("local");
    setHostedDiagnosticsOpen(false);
    setPage("status");
    addLog("Returned to the GLW launcher. Current game state preserved.", "Other");
  }

  function confirmPlayerName() {
    const name = cleanStoredName(playerNameDraft, "");
    if (!name) return addLog("Enter an empire name first.");
    const requestedRoundKey = selectedRoundKey === "intro" ? "intro" : "glw";
    const speciesKey = races[selectedSpeciesKey] ? selectedSpeciesKey : "lithi";
    const speciesName = races[speciesKey]?.name || raceNameFromKey(speciesKey);
    const slotKey = activeRoundSlotKey || makeRoundSlotKey(requestedRoundKey);
    setActiveRoundSlotKey(slotKey);
    try { if (typeof window !== "undefined") window.localStorage.setItem(ROUND_SLOT_CURRENT_KEY, slotKey); } catch {}
    resetToFreshRound(requestedRoundKey);
    setSelectedRoundKey(requestedRoundKey);
    setPlayer((p) => ({ ...p, name, race: speciesKey }));
    setMessages((old) => old.map((m) => ({ ...m, to: m.to === "SONAR" ? name : m.to, from: m.from === "SONAR" ? name : m.from })));
    const round = accountRounds.find((r) => r.key === requestedRoundKey) || accountRounds[0];
    const adminRoundName = cleanSingleLineText(gameName || roundProfile || "Admin Round", TEXT_LIMITS.gameName) || "Admin Round";
    const entryLabel = requestedRoundKey === "admin-start" ? adminRoundDisplayName(adminRoundName) : (round?.name || defaultRoundSlotLabel(requestedRoundKey));
    const entryRoundName = requestedRoundKey === "admin-start" ? adminRoundName : (round?.name || defaultRoundSlotLabel(requestedRoundKey));
    const entry = { slotKey, label: entryLabel, roundKey: requestedRoundKey, roundName: entryRoundName, playerName: name, speciesKey, version: PROTOTYPE_VERSION, savedAt: Date.now() };
    const nextIndex = upsertRoundSlotIndexEntry(roundSlotIndex, entry);
    setRoundSlotIndex(nextIndex);
    safeWriteRoundSlotIndex(nextIndex);
    setGlwRaceRegistered(true);
    setPlayerNameSetupComplete(true);
    setEntryStage("game");
    setPage("status");
    addLog(`Empire name set to ${name}. Species registered as ${speciesName}. Joined ${round?.name || "selected round"}.`, "Other");
  }
  function libraryOpenButton(label, target, extra = {}) {
    return <button className="classic-btn antro-action-btn" onClick={() => { Object.entries(extra).forEach(([kind, value]) => { if (kind === "race") setSelectedHelpRace(value); if (kind === "building") setSelectedHelpBuilding(value); if (kind === "outcome") setSelectedBattleOutcome(value); }); setPage(target); }}>{label}</button>;
  }

  function renderLibraryAssetNote(entry = {}) {
    const status = libraryStatusLabel(entry.status || entry.originStatus || "missing");
    const path = entry.thumb || entry.image || entry.raceThumb || entry.racePlate || entry.originFile || "No asset path yet";
    return <span className="text-orange-600">{status} · {path}</span>;
  }

  function libraryUnitEntry(manifestUnits = {}, unitName = "") {
    const key = libraryKeyFromName(unitName);
    const compactKey = String(unitName).toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
    return manifestUnits[key] || manifestUnits[compactKey] || {};
  }

  function renderLibraryImage(src, alt, variant = "thumb") {
    if (!src) return <span className="text-orange-700">Artwork pending</span>;
    const isPlate = variant === "plate";
    const isDossierThumb = variant === "dossierThumb";
    const className = isPlate
      ? "w-full max-w-3xl border border-orange-900 bg-black object-cover"
      : isDossierThumb
        ? "w-40 md:w-56 border border-orange-900 bg-black object-contain p-1"
        : "w-28 md:w-36 border border-orange-900 bg-black object-cover";
    const style = isPlate ? { aspectRatio: "16 / 9" } : isDossierThumb ? { maxHeight: "9rem" } : { aspectRatio: "16 / 9" };
    return <img src={src} alt={alt || "Field Manual artwork"} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} className={className} style={style} />;
  }

  function openLibraryImage(src, title, caption = "") {
    if (!src) return;
    setLibraryImageViewer({ src, title: title || "Library image", caption });
  }

  function renderLibraryImageViewer() {
    if (!libraryImageViewer?.src) return null;
    return <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" onClick={() => setLibraryImageViewer(null)}>
      <div className="w-[min(96vw,1100px)] border border-orange-700 bg-black p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-between gap-3 items-start mb-2"><div><div className="text-orange-300 font-bold">{libraryImageViewer.title}</div>{libraryImageViewer.caption ? <div className="text-xs text-orange-600">{libraryImageViewer.caption}</div> : null}</div><button className="classic-btn antro-action-btn" onClick={() => setLibraryImageViewer(null)}>Close</button></div>
        <img src={libraryImageViewer.src} alt={libraryImageViewer.title || "Library image"} className="w-full border border-orange-900 bg-black object-contain" style={{ maxHeight: "78vh" }} />
      </div>
    </div>;
  }


  function renderRaceArchiveImage(plate) {
    if (!plate) return null;
    return <figure className="race-archive-image-plate">
      <div className="race-archive-image-frame">
        <img src={plate.src} alt={plate.title || "Archive plate"} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; const fallback = event.currentTarget.nextElementSibling; if (fallback) fallback.style.display = "flex"; }} />
        <div className="race-archive-image-placeholder" style={{ display: "none" }}>
          <div className="text-cyan-100 font-bold">{plate.title}</div>
          <div className="text-cyan-300/70 text-sm mt-1">{plate.placeholder || "Image plate awaiting supplied artwork"}</div>
        </div>
      </div>
      {plate.caption ? <figcaption className="race-archive-caption">{plate.caption}</figcaption> : null}
    </figure>;
  }

  function renderRaceArchiveTop(archive, activeRace, mode = "story") {
    const raceButton = (key) => {
      const enabled = Boolean(raceArchivePages[key]);
      const label = races[key]?.name || key;
      return <button key={key} className={`race-archive-race-btn ${key === activeRace ? "active" : ""}`} disabled={!enabled} onClick={() => { if (enabled) { setSelectedHelpRace(key); setSelectedArchivePlateIndex(null); } }} title={enabled ? `${label} illustrated archive` : `${label} archive pending`}>{label}</button>;
    };
    return <div className="race-archive-top">
      <div className="race-archive-banner">
        <div className="race-archive-brand"><span>ANTROPH</span><span className="race-archive-ai">AI</span></div>
        <div className="race-archive-version">Illustrated Race Archive · {PROTOTYPE_VERSION}</div>
      </div>
      <div className="race-archive-selector">{archiveRaceOrder.map(raceButton)}</div>
      <div className="race-archive-actions race-archive-nav-buttons" aria-label="Illustrated archive navigation">
        <button className="race-archive-nav-btn race-archive-nav-btn-primary" onClick={() => { setSelectedArchivePlateIndex(null); setPage("raceLibrary"); }}>Back to Field Guide</button>
        {mode === "plates"
          ? <button className="race-archive-nav-btn race-archive-nav-btn-secondary" onClick={() => { setSelectedArchivePlateIndex(null); setPage("raceArchive"); }}>Return to Race Archive</button>
          : <button className="race-archive-nav-btn race-archive-nav-btn-secondary" onClick={() => { setSelectedArchiveGallery("archivePlates"); setSelectedArchivePlateIndex(null); setPage("raceArchivePlates"); }}>Next: Archive Plates</button>}
      </div>
    </div>;
  }

  function renderRaceArchivePage(raceKey = selectedHelpRace) {
    const archive = raceArchivePages[raceKey] || raceArchivePages.relu;
    const activeRace = archive.race || raceKey || "relu";
    return <div className={`race-archive-page race-archive-${activeRace}`}>
      {renderRaceArchiveTop(archive, activeRace, "story")}
      <main className="race-archive-body">
        <header className="race-archive-header">
          <div className="race-archive-kicker">Illustrated Archive Prototype</div>
          <h1>{archive.title}</h1>
          <p>{archive.subtitle}</p>
        </header>
        <section className="race-archive-classification">
          {archive.classification.map(([label, value]) => <div key={label} className="race-archive-classification-row"><span>{label}</span><strong>{value}</strong></div>)}
        </section>
        {archive.sections.map((section) => <section key={section.id} className="race-archive-section">
          <div className="race-archive-section-text">
            {section.eyebrow ? <div className="race-archive-eyebrow">{section.eyebrow}</div> : null}
            <h2>{section.title}</h2>
            {(section.body || []).map((paragraph, idx) => <p key={`${section.id}-${idx}`}>{paragraph}</p>)}
          </div>
          {renderRaceArchiveImage(section.plate)}
        </section>)}
        <footer className="race-archive-footer race-archive-nav-buttons" aria-label="Illustrated archive footer navigation">
          <button className="race-archive-nav-btn race-archive-nav-btn-primary" onClick={() => { setSelectedArchivePlateIndex(null); setPage("raceLibrary"); }}>Back to Field Guide</button>
          <button className="race-archive-nav-btn race-archive-nav-btn-secondary" onClick={() => { setSelectedArchiveGallery("archivePlates"); setSelectedArchivePlateIndex(null); setPage("raceArchivePlates"); }}>Next: Archive Plates</button>
        </footer>
      </main>
    </div>;
  }

  function archiveGalleryCollections(archive) {
    return [
      {
        key: "archivePlates",
        label: "Archive Plates",
        kicker: "Archive Plates",
        title: "Non-canon and exploratory plates",
        subtitle: "Recovered visual studies, doctrine sketches and development records",
        description: [
          "This section preserves strong visual material that is useful to keep, but not necessarily correct enough for the main race archive page.",
          "Items can be retained as development studies, discarded explorations, doctrine sketches or visual references without turning every image into canon."
        ],
        assetRoot: "/assets/race_archive_plates/",
        plates: archive.archivePlates || []
      },
      {
        key: "battleMaterial",
        label: "Battle Material",
        kicker: "Battle Material",
        title: "Combat studies and battlefield material",
        subtitle: "Engagement studies, battlefield variants and military visual records",
        description: [
          "This section is for shared battle studies: useful combat images, action explorations, battlefield moods and war-material that should not displace the calmer main race archive pages.",
          "This is a single cross-race folder/gallery, not one folder per race. Images may be mixed, comparative, wrong-species, superseded or simply useful as battle reference."
        ],
        assetRoot: "/assets/race_archive_battle_material/",
        sharedFolder: true,
        plates: sharedArchiveGalleries.battleMaterial || []
      },
      {
        key: "mixed",
        label: "Mixed",
        kicker: "Mixed",
        title: "Mixed visual archive",
        subtitle: "Unsorted, cross-purpose and difficult-to-place image studies",
        description: [
          "This section is for good images that do not sit neatly in the main archive, archive plates, or battle material folders.",
          "Use it as one shared holding folio for visually useful but creatively wrong, cross-cutting or hard-to-classify material."
        ],
        assetRoot: "/assets/race_archive_mixed/",
        sharedFolder: true,
        plates: sharedArchiveGalleries.mixed || []
      }
    ];
  }

  function renderRaceArchivePlatesPage(raceKey = selectedHelpRace) {
    const archive = raceArchivePages[raceKey] || raceArchivePages.relu;
    const activeRace = archive.race || raceKey || "relu";
    const galleries = archiveGalleryCollections(archive);
    const selectedGallery = galleries.find((gallery) => gallery.key === selectedArchiveGallery) || galleries[0];
    const plates = selectedGallery.plates || [];
    const currentIndex = typeof selectedArchivePlateIndex === "number" && plates.length ? ((selectedArchivePlateIndex % plates.length) + plates.length) % plates.length : null;
    const currentPlate = currentIndex === null ? null : plates[currentIndex];
    const shiftPlate = (delta) => { if (plates.length) setSelectedArchivePlateIndex((currentIndex === null ? 0 : currentIndex) + delta); };
    const raceFolder = activeRace === "relu" ? "ReLu" : activeRace === "lithi" ? "Lithi" : activeRace.charAt(0).toUpperCase() + activeRace.slice(1);
    return <div className={`race-archive-page race-archive-${activeRace}`}>
      {renderRaceArchiveTop(archive, activeRace, "plates")}
      <main className="race-archive-body">
        <header className="race-archive-header race-archive-plates-header">
          <div className="race-archive-kicker">{selectedGallery.kicker}</div>
          <h1>{archive.title}</h1>
          <p>{selectedGallery.subtitle}</p>
        </header>
        <nav className="race-archive-gallery-tabs" aria-label={`${archive.title} archive gallery sections`}>
          {galleries.map((gallery) => <button key={gallery.key} className={`race-archive-gallery-tab ${gallery.key === selectedGallery.key ? "active" : ""}`} onClick={() => { setSelectedArchiveGallery(gallery.key); setSelectedArchivePlateIndex(null); }}>
            <span>{gallery.label}</span>
            <small>{(gallery.plates || []).length ? `${(gallery.plates || []).length} images` : "Awaiting pack"}</small>
          </button>)}
        </nav>
        <section className="race-archive-section race-archive-plates-intro">
          <div className="race-archive-section-text">
            <div className="race-archive-eyebrow">{selectedGallery.kicker}</div>
            <h2>{selectedGallery.title}</h2>
            {(selectedGallery.description || []).map((paragraph, idx) => <p key={`${selectedGallery.key}-intro-${idx}`}>{paragraph}</p>)}
            <p className="race-archive-asset-path-note">Expected folder: <code>{selectedGallery.sharedFolder ? selectedGallery.assetRoot : `${selectedGallery.assetRoot}${raceFolder}/`}</code></p>
          </div>
        </section>
        {plates.length ? <section className="race-archive-plate-grid" aria-label={`${archive.title} ${selectedGallery.label.toLowerCase()}`}>
          {plates.map((plate, idx) => <button key={plate.key || plate.src || idx} className="race-archive-plate-thumb" onClick={() => setSelectedArchivePlateIndex(idx)}>
            <span className="race-archive-plate-thumb-frame"><img src={plate.src} alt={plate.title || `${selectedGallery.label} ${idx + 1}`} loading="lazy" /></span>
            <span className="race-archive-plate-thumb-title">{plate.title || `${selectedGallery.label} ${idx + 1}`}</span>
            {plate.note ? <span className="race-archive-plate-thumb-note">{plate.note}</span> : null}
          </button>)}
        </section> : <section className="race-archive-empty-plates">
          <div className="race-archive-section-text">
            <div className="race-archive-eyebrow">Awaiting image pack</div>
            <h2>{selectedGallery.label} pending</h2>
            <p>{selectedGallery.sharedFolder ? `No ${selectedGallery.label.toLowerCase()} images have been supplied yet. This is a shared cross-race gallery; place files directly in ${selectedGallery.assetRoot}.` : `No ${selectedGallery.label.toLowerCase()} images have been supplied for ${archive.title} yet. The thumbnail gallery and full-screen viewer are ready for the next race-sorted image pack.`}</p>
          </div>
        </section>}
        <footer className="race-archive-footer race-archive-nav-buttons" aria-label="Archive gallery footer navigation">
          <button className="race-archive-nav-btn race-archive-nav-btn-primary" onClick={() => { setSelectedArchivePlateIndex(null); setPage("raceArchive"); }}>Return to Race Archive</button>
          <button className="race-archive-nav-btn race-archive-nav-btn-secondary" onClick={() => { setSelectedArchivePlateIndex(null); setPage("raceLibrary"); }}>Back to Field Guide</button>
        </footer>
      </main>
      {currentPlate ? <div className="race-archive-fullscreen" role="dialog" aria-modal="true" aria-label={`${archive.title} ${selectedGallery.label} fullscreen viewer`}>
        <button className="race-archive-fullscreen-return" onClick={() => { setSelectedArchivePlateIndex(null); setPage("raceArchive"); }}>Return to Race Archive</button>
        <button className="race-archive-fullscreen-arrow race-archive-fullscreen-arrow-left" onClick={() => shiftPlate(-1)} aria-label={`Previous ${selectedGallery.label}`}>‹</button>
        <img src={currentPlate.src} alt={currentPlate.title || selectedGallery.label} />
        <button className="race-archive-fullscreen-arrow race-archive-fullscreen-arrow-right" onClick={() => shiftPlate(1)} aria-label={`Next ${selectedGallery.label}`}>›</button>
      </div> : null}
    </div>;
  }

  function renderSignalAssistance() {
    return <Panel title="Signal for Assistance">
      <p className="mb-3 text-orange-200">This GLW build is a single-player test version of AntrophAI. It is not balanced, finished, or fully documented yet. The aim is to test whether the core game loop feels alive: building, training, attacking, missiles, revives, rankings, timers, and late-game decision making.</p>
      <p className="mb-4 text-orange-100">Please report anything that feels wrong, unclear, boring, too slow, too fast, too easy, too punishing, or just right.</p>
      <h3 className="text-orange-300 font-bold mb-2">Known uncertain areas</h3>
      <ul className="list-disc pl-6 text-orange-200 space-y-1 mb-4">
        <li>Scanner/scout formulas are partly reconstructed and may not match the original game.</li>
        <li>Factory effects and construction timing may need tuning.</li>
        <li>Research times and science lab scaling may need tuning.</li>
        <li>Missile damage and missile capacity are being rebuilt from memory.</li>
        <li>LRC behaviour is not yet fully reconstructed.</li>
        <li>Bot/player late-game balance is provisional.</li>
        <li>Race advantages and revive behaviour are still being tested.</li>
        <li>Some wording is deliberately hybrid/IP-safe rather than original retro wording.</li>
      </ul>
      <h3 className="text-orange-300 font-bold mb-2">Useful feedback</h3>
      <ul className="list-disc pl-6 text-orange-200 space-y-1 mb-4">
        <li>Did any formula feel wildly off?</li>
        <li>Did missiles, attacks, revives, or land gains produce surprising results?</li>
        <li>Did any page feel unnecessary, missing, or confusing?</li>
        <li>Do you remember how any original Antrophia mechanic worked?</li>
        <li>Do you have gut-feel suggestions for new features that would fit the spirit of the game?</li>
      </ul>
      <p className="mb-4 text-orange-100">Please let us know what triggered it, what happened and what should have happened.</p>
      <Panel title="Create Debug File">
        <label className="block text-orange-300 mb-1">Tester comment</label>
        <textarea className="w-full min-h-28 bg-black border border-orange-900 text-orange-100 px-2 py-1 mb-3" value={debugComment} onChange={(e) => setDebugComment(cleanMultiLineText(e.target.value, 1000))} placeholder="What triggered it, what happened, and what should have happened" />
        <div className="flex gap-2 flex-wrap">
          <button className="classic-btn antro-action-btn" onClick={() => exportDebugJson(debugComment)}>Create Debug File</button>
          <button className="classic-btn antro-action-btn" onClick={() => setDebugComment("")}>Clear Comment</button>
        </div>
      </Panel>
    </Panel>;
  }

  function renderHelp() {
    const raceCount = Object.keys(libraryArtManifest.races || {}).length;
    const buildingCount = buildingOrder.length;
    const outcomeCount = Object.keys(libraryArtManifest.battleOutcomes || {}).length;
    const recordsCount = (recordsManifest.records || []).length;
    return <>
      <Panel title="AntrophAI Field Manual">
        <p className="mb-3 text-orange-100">A compact field-manual catalogue for AntrophAI's visible world: races, units, buildings and battle outcome records. It explains what things are, not how to optimise or exploit them.</p>
        <div className="mb-3 border border-orange-900 bg-[#120500] px-3 py-2 text-xs text-orange-200 whitespace-pre-line"><span className="text-orange-300 font-bold">Field Manual Note:</span> {libraryArtManifest.fieldManualNote || "Field Manual records are compiled from recovered intelligence, intercepted doctrine, battlefield reports and incomplete archive material. They are descriptive, not strategic. Where text and imagery conflict with live game values, the game values are authoritative."}</div>
        <OldTable rows={[
          ["Records", <span>{recordsCount} milestone records · {libraryOpenButton("Open", "records")}</span>],
          ["Race Records", <span>{raceCount} race entries · {libraryOpenButton("Open", "raceLibrary")}</span>],
          ["Building Records", <span>{buildingCount} live building entries · {libraryOpenButton("Open", "buildingLibrary")}</span>],
          ["Battle Outcome Archive", <span>{outcomeCount} outcome bands · {libraryOpenButton("Open", "battleOutcomes")}</span>],
          ["Artwork policy", "Large dossier art belongs here, not in the core command loop."],
          ["Mechanics policy", "Player-facing entries stay descriptive and avoid hidden formula detail."]
        ]} />
      </Panel>
      <Panel title="Archive Notes">
        <p className="text-orange-200">Retro play remains text-first. The Field Manual can later show small thumbnails or dossier plates when approved assets exist, while War, Build, Barracks and other action pages stay compact and practical.</p>
      </Panel>
    </>;
  }

  function renderRaceLibrary() {
    const entries = Object.entries(libraryArtManifest.races || {});
    return <>
      <Panel title={`${speciesDisplayLabel()} Records`}>
        <p className="mb-3 text-orange-200">Reference summaries for known races. Origin prose and dossier art are prepared as assets, but this first scaffold keeps the page compact.</p>
        <table className="w-full text-sm border-collapse"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">{speciesDisplayLabel()}</th><th className="text-left p-1">Plate</th><th className="text-left p-1">Identity</th><th className="text-left p-1">Homeworld</th>{adminMode ? <th className="text-left p-1">Asset</th> : null}<th className="text-right p-1">Open</th></tr></thead><tbody>{entries.map(([key, r]) => <tr key={key} className="border-b border-orange-950 align-top"><td className="p-1 text-orange-300">{r.displayName || races[key]?.name || key}</td><td className="p-1">{renderLibraryImage(r.raceThumb, `${r.displayName || key} species thumbnail`, "thumb")}</td><td className="p-1 text-orange-100">{r.identity || r.originSummary || "Reference pending"}</td><td className="p-1 text-orange-200">{r.homeworld || "Pending"}</td>{adminMode ? <td className="p-1">{renderLibraryAssetNote(r)}</td> : null}<td className="p-1 text-right"><button className="classic-btn antro-action-btn" onClick={() => setSelectedHelpRace(key)}>Open</button></td></tr>)}</tbody></table>
      </Panel>
      {renderRaceDetail(selectedHelpRace)}
    </>;
  }

  function renderRaceDetail(raceKey) {
    const manifestRace = (libraryArtManifest.races || {})[raceKey] || {};
    const race = races[raceKey] || races.human;
    const manifestUnits = (libraryArtManifest.units || {})[raceKey] || {};
    const unitStats = race.unitStats || [];
    return <Panel title={`${manifestRace.displayName || race.name || raceKey} Dossier`}>
      <div className="mb-3">{renderLibraryImage(manifestRace.racePlate || manifestRace.raceThumb, `${manifestRace.displayName || race.name || raceKey} race plate`, "plate")}</div>
      <OldTable rows={[
        ["Identity", manifestRace.identity || "Reference pending"],
        ["Doctrine", manifestRace.doctrine || "Reference pending"],
        ["Homeworld", manifestRace.homeworld || "Pending"],
        ...(manifestRace.homeworldNote ? [["Homeworld note", manifestRace.homeworldNote]] : []),
        ["Origin", manifestRace.originSummary || "Origin prose pending"],
        ...(adminMode ? [["Origin file", manifestRace.originFile || "Not supplied"], ["Artwork", renderLibraryAssetNote(manifestRace)]] : [])
      ]} />
      {manifestRace.originProse ? <div className="mt-3 border border-orange-950 bg-black/50 p-3 text-sm leading-relaxed text-orange-200 max-w-5xl"><div className="flex items-center justify-between gap-3 mb-2"><div className="text-orange-300 font-bold">Origin Record</div>{raceArchivePages[raceKey] ? <button className="classic-btn antro-action-btn" onClick={() => { setSelectedHelpRace(raceKey); setPage("raceArchive"); }}>Open Illustrated Archive</button> : null}</div><div className="whitespace-pre-line">{manifestRace.originProse}</div></div> : raceArchivePages[raceKey] ? <div className="mt-3 border border-orange-950 bg-black/50 p-3 text-sm leading-relaxed text-orange-200 max-w-5xl"><div className="flex items-center justify-between gap-3"><div className="text-orange-300 font-bold">Origin Record</div><button className="classic-btn antro-action-btn" onClick={() => { setSelectedHelpRace(raceKey); setPage("raceArchive"); }}>Open Illustrated Archive</button></div></div> : null}
      <h3 className="text-orange-300 font-bold mt-4 mb-2">Units</h3>
      <table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1 w-10">Tier</th><th className="text-left p-1 w-56">Dossier</th><th className="text-left p-1 w-40">Unit</th><th className="text-left p-1">Field Manual record</th>{adminMode ? <th className="text-left p-1">Asset</th> : null}</tr></thead><tbody>{unitStats.map((u, i) => { const m = libraryUnitEntry(manifestUnits, u.name); return <tr key={`${raceKey}-${u.name}`} className="border-b border-orange-950 align-top"><td className="p-1 text-orange-300">{i + 1}</td><td className="p-1">{(m.image || m.thumb) ? <div className="flex flex-col gap-1 items-start">{renderLibraryImage(m.image || m.thumb, `${u.name} dossier preview`, "dossierThumb")}<button className="classic-btn antro-action-btn" onClick={() => openLibraryImage(m.image || m.thumb, `${u.name} dossier image`, `${manifestRace.displayName || race.name || raceKey} · Tier ${i + 1}`)}>View</button></div> : <span className="text-orange-700">Artwork pending</span>}</td><td className="p-1 text-orange-100"><div className="font-bold text-sm">{u.name}</div><div className="text-xs text-orange-500 mt-1">Power {fmt(u.cost)}</div>{m.type ? <div className="text-[11px] text-orange-500 mt-1 leading-snug">{m.type}</div> : null}</td><td className="p-1 text-orange-100 leading-relaxed"><div className="text-base leading-snug">{m.role || "Role pending"}</div>{m.notes ? <div className="text-sm text-orange-400 mt-1 leading-relaxed max-w-6xl">{m.notes}</div> : null}{m.canonNote ? <div className="text-xs text-orange-600 mt-1 leading-relaxed max-w-6xl">Canon note: {m.canonNote}</div> : null}</td>{adminMode ? <td className="p-1">{renderLibraryAssetNote(m)}</td> : null}</tr>; })}</tbody></table>
      <p className="text-xs text-orange-700 mt-3">Unit power is already visible in the normal Barracks context; hidden matchup mechanics are intentionally not shown here.</p>
    </Panel>;
  }

  function renderBuildingLibrary() {
    const manifestBuildings = libraryArtManifest.buildings || {};
    return <>
      <Panel title="Building Records">
        <p className="mb-3 text-orange-200">Reference entries for live prototype buildings. Descriptions are deliberately broad and player-facing.</p>
        <table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Building</th><th className="text-left p-1">Summary</th>{adminMode ? <th className="text-left p-1">Asset</th> : null}<th className="text-right p-1">Open</th></tr></thead><tbody>{buildingOrder.map(([id, label]) => { const entry = manifestBuildings[id] || { displayName: label, summary: "Reference entry pending.", status: "missing" }; return <tr key={id} className="border-b border-orange-950"><td className="p-1 text-orange-300">{label}</td><td className="p-1 text-orange-100">{entry.summary}</td>{adminMode ? <td className="p-1">{renderLibraryAssetNote(entry)}</td> : null}<td className="p-1 text-right"><button className="classic-btn antro-action-btn" onClick={() => setSelectedHelpBuilding(id)}>View</button></td></tr>; })}</tbody></table>
      </Panel>
      {renderBuildingDetail(selectedHelpBuilding)}
    </>;
  }

  function renderBuildingDetail(buildingId) {
    const found = buildingOrder.find(([id]) => id === buildingId);
    const label = found?.[1] || buildingId;
    const entry = (libraryArtManifest.buildings || {})[buildingId] || { displayName: label, summary: "Reference entry pending.", status: "missing" };
    return <Panel title={`${label} Reference`}>
      <OldTable rows={[
        ["Summary", entry.summary || "Reference pending"],
        ["Status", libraryStatusLabel(entry.status)],
        ["Artwork", renderLibraryAssetNote(entry)],
        ["Gameplay note", "Uses existing prototype building data; no mechanics are changed by this Field Manual entry."],
        ["Player-facing limit", "Exact formulas and tuning values stay out of the public catalogue unless already exposed elsewhere."]
      ]} />
    </Panel>;
  }

  function renderRecords() {
    const records = recordsManifest.records || [];
    const defenderHolds = recordsManifest.defenderHolds || [];
    const alliancePlaceholders = recordsManifest.allianceRecordPlaceholders || [];
    const outcomeCount = Object.keys(libraryArtManifest.battleOutcomes || {}).length;
    const featuredRecords = recordsFeaturedManifest || [];
    return <>
      <Panel title="Records">
        <p className="mb-2 text-orange-100">Archived battlefield events, notable incidents and historically significant player actions. They are milestone records, not mobile badges.</p>
        <div className="mb-3 border border-orange-900 bg-[#120500] px-3 py-2 text-orange-300 text-sm">{recordsManifest.framingLine || "The record preserves what can be known. The battlefield decides what is true."}</div>
        <table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Record</th><th className="text-left p-1">Archive card</th><th className="text-left p-1">Category</th><th className="text-left p-1">Archive description</th><th className="text-left p-1">State</th>{adminMode ? <th className="text-left p-1">Trigger note</th> : null}</tr></thead><tbody>{records.map((record) => { const sealed = Boolean(record.hiddenUntilUnlocked); const visibleTitle = sealed ? "Unknown record" : record.title; return <tr key={record.key} className="border-b border-orange-950 align-top"><td className="p-1 text-orange-100 w-44"><div className="font-bold text-orange-200">{visibleTitle}</div>{sealed ? <div className="text-xs text-orange-700 mt-1">Legendary record hidden until discovered.</div> : null}</td><td className="p-1 w-44">{!sealed && (record.thumb || record.art) ? <div className="flex flex-col gap-1 items-start">{renderLibraryImage(record.thumb || record.art, `${record.title} record card`, "thumb")}<button className="classic-btn antro-action-btn" onClick={() => openLibraryImage(record.art || record.thumb, `${record.title} record`, record.category)}>View</button></div> : <div className="border border-orange-950 bg-[#080300] px-2 py-6 text-center text-orange-700">Sealed archive</div>}</td><td className="p-1 text-orange-300">{sealed ? "Legendary" : record.category}</td><td className="p-1 text-orange-100 leading-relaxed">{sealed ? "The archive contains a sealed entry. Its conditions are not yet public." : record.description}</td><td className="p-1 text-orange-600">{libraryStatusLabel(record.status)}</td>{adminMode ? <td className="p-1 text-orange-700">{record.trigger}</td> : null}</tr>; })}</tbody></table>
        <p className="text-xs text-orange-700 mt-3">Unlock triggers are scaffolded only. They can be connected incrementally as battle, bounty, retaliation and turret data exposes clean hooks.</p>
      </Panel>
      <Panel title="Featured Records Archive">
        <p className="text-orange-200 mb-3">Full record plates for earned archive views. These are not inserted into live battle reports yet; wide outcome banners remain the better report-facing format later.</p>
        <div className="grid md:grid-cols-2 gap-3">{featuredRecords.map((entry) => <div key={entry.key} className="border border-orange-950 bg-black/50 p-2">
          <div className="mb-2">{renderLibraryImage(entry.art, `${entry.displayName} featured record`, "plate")}</div>
          <div className="text-orange-300 font-bold">{entry.displayName}</div>
          <div className="text-xs text-orange-600 mb-1">{entry.perspective} · Band {entry.band} · {libraryStatusLabel(entry.status)}</div>
          <div className="text-sm text-orange-100 leading-relaxed mb-2">{entry.description}</div>
          <OldTable rows={[
            ["Usage", entry.usage],
            ["Placement", "Records page / archive unlock view / expanded detail panel"],
            ...(adminMode ? [["Source plate", entry.sourcePlate || "None"]] : [])
          ]} />
          <div className="mt-2"><button className="classic-btn antro-action-btn" onClick={() => openLibraryImage(entry.art, entry.displayName, `${entry.perspective} · ${entry.band}`)}>View</button></div>
        </div>)}</div>
      </Panel>
      <Panel title="Battle Outcome Archive">
        <p className="text-orange-200 mb-3">The existing offensive battle outcome plates remain a separate archive/gallery, not missing Records artwork.</p>
        <OldTable rows={[["Status", `${outcomeCount} offensive outcome bands already available`], ["Open archive", libraryOpenButton("Open Battle Outcome Archive", "battleOutcomes")], ["Note", "Outcome bands may later unlock as the player experiences them; Total Eclipse should remain rare and special."]]} />
      </Panel>
      <Panel title="Defender Holds Archive">
        <p className="text-orange-200 mb-3">Future defensive mirror of the Battle Outcome Archive. Placeholder only until Silas produces the defensive image set and the battle data exposes the right hooks.</p>
        <table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Defensive band</th><th className="text-left p-1">Working title</th><th className="text-left p-1">Status</th></tr></thead><tbody>{defenderHolds.map(([band, title]) => <tr key={band} className="border-b border-orange-950"><td className="p-1 text-orange-300">{band}</td><td className="p-1 text-orange-100">{title}</td><td className="p-1 text-orange-700">Placeholder</td></tr>)}</tbody></table>
      </Panel>
      <Panel title="Alliance Records">
        <p className="text-orange-200 mb-3">Future alliance/social records for shared broadcasts, Nexus events, @all messages and war moments.</p>
        <div className="grid md:grid-cols-2 gap-1 text-sm">{alliancePlaceholders.map((name) => <div key={name} className="border border-orange-950 bg-black/40 px-2 py-1 text-orange-300">{name} <span className="text-orange-700">/ future</span></div>)}</div>
      </Panel>
    </>;
  }

  function renderBattleOutcomes() {
    const entries = Object.entries(libraryArtManifest.battleOutcomes || {});
    const selected = (libraryArtManifest.battleOutcomes || {})[selectedBattleOutcome] || entries[0]?.[1] || {};
    return <>
      <Panel title="Battle Outcome Archive">
        <p className="mb-3 text-orange-200">Outcome bands for future report/achievement presentation. These are catalogue entries only; battle report art is not yet forced into normal reports.</p>
        <table className="w-full text-sm"><thead><tr className="text-orange-300 bg-[#240B02]"><th className="text-left p-1">Band</th><th className="text-left p-1">Plate</th><th className="text-left p-1">Name</th><th className="text-left p-1">Archive title</th><th className="text-left p-1">Status</th><th className="text-right p-1">Open</th></tr></thead><tbody>{entries.map(([key, entry]) => <tr key={key} className="border-b border-orange-950 align-top"><td className="p-1 text-orange-300">{entry.band}</td><td className="p-1">{renderLibraryImage(entry.thumb, `${entry.displayName || key} battle outcome thumbnail`, "thumb")}</td><td className="p-1 text-orange-100">{entry.displayName}</td><td className="p-1 text-orange-200">{entry.archiveTitle}</td><td className="p-1 text-orange-600">{libraryStatusLabel(entry.status)}</td><td className="p-1 text-right"><button className="classic-btn antro-action-btn" onClick={() => setSelectedBattleOutcome(key)}>View</button></td></tr>)}</tbody></table>
      </Panel>
      <Panel title={selected.displayName || "Outcome Detail"}>
        <div className="mb-3">{renderLibraryImage(selected.image || selected.thumb, `${selected.displayName || "Outcome"} battle outcome plate`, "plate")}</div>
        <OldTable rows={[
          ["Band", selected.band || "Pending"],
          ["Archive title", selected.archiveTitle || "Pending"],
          ["Usage", selected.usageNote || "Pending"],
          ["Artwork", renderLibraryAssetNote(selected)],
          ["Implementation", "Field Manual-only placeholder until report/achievement presentation is explicitly added."]
        ]} />
      </Panel>
    </>;
  }

  function renderNameSetup() {
    const selectedRound = accountRounds.find((r) => r.key === selectedRoundKey) || accountRounds[0];
    const speciesEntries = Object.keys(races).map((key) => {
      const manifest = libraryArtManifest.races?.[key] || {};
      const choose = chooseSpeciesManifest[key] || {};
      return { key, race: races[key], manifest, choose, trait: speciesTraits[key] || {} };
    });
    const selectedSpecies = races[selectedSpeciesKey] || races.lithi;
    const selectedManifest = libraryArtManifest.races?.[selectedSpeciesKey] || {};
    const selectedTrait = speciesTraits[selectedSpeciesKey] || {};
    const selectedStoryArt = storyArtManifest.species?.[selectedSpeciesKey] || {};
    const selectedChoose = chooseSpeciesManifest[selectedSpeciesKey] || {};
    const selectedBonusCard = modernSpeciesBonusCards[selectedSpeciesKey] || {};
    const doctrineImage = selectedChoose.bonusArt || selectedStoryArt.hero || selectedManifest.racePlate;
    const heroImage = selectedChoose.heroArt || selectedStoryArt.keeper || selectedManifest.racePlate;
    const selectedDisplayName = selectedChoose.displayName || selectedSpecies.name;
    const shell = (children) => <div className={`app-shell wording-modern species-${selectedSpeciesKey} min-h-screen bg-black text-orange-400 font-mono p-3 flex items-center justify-center`} style={{ backgroundImage: "radial-gradient(circle at top, #1b1208 0, #030100 38%, #000 100%)" }}>
      <div className="w-[min(98vw,1180px)] border border-orange-800 bg-black/90 p-5 shadow-2xl"><style>{`.app-shell{--antro-bg:#050100;--antro-panel-bg:rgba(0,0,0,.82);--antro-panel-header-bg:#240b02;--antro-border:#9a4b08;--antro-accent:#ffb15c;--species-accent:var(--antro-accent);--species-border:var(--antro-border);--species-glow:rgba(255,120,32,.14)}.wording-modern.species-human{--species-accent:#d6a15d;--species-border:#a46b32;--species-glow:rgba(242,192,120,.16)}.wording-modern.species-trysaur{--species-accent:#c05a1a;--species-border:#8c2f0c;--species-glow:rgba(255,92,24,.18)}.wording-modern.species-relu{--species-accent:#8fc6d8;--species-border:#5f8792;--species-glow:rgba(141,210,232,.18)}.wording-modern.species-lithi{--species-accent:#b98536;--species-border:#6d4216;--species-glow:rgba(224,162,74,.16)}.wording-modern.species-zarth{--species-accent:#d77b2a;--species-border:#a9581b;--species-glow:rgba(242,129,45,.2)}.wording-modern .antro-panel{border-color:var(--species-border);box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 28px var(--species-glow)}.wording-modern .antro-panel-title{border-color:var(--species-border);color:var(--species-accent)}.classic-btn{border:1px solid #9a4b08;background:#160701;color:#ffb15c;padding:4px 8px;font-size:14px}.classic-btn:hover{background:#321004;color:#ffe0b0}.species-select{border-color:var(--species-border);box-shadow:0 0 18px var(--species-glow)}.species-art-frame{border-color:var(--species-border);box-shadow:inset 0 0 30px rgba(0,0,0,.35),0 0 20px var(--species-glow)}`}</style>
        <div className="text-center mb-5"><h1 className="text-4xl md:text-5xl font-bold tracking-widest"><span className="text-orange-300">ANTROPH</span><span className="ml-1 text-cyan-200" style={{ textShadow: "0 0 6px #22d3ee, 0 0 14px #0ea5e9, 0 0 24px #38bdf8" }}>AI</span></h1><p className="text-orange-600 mt-1">{testerAccessModeLabel(testerAccessRecord)} · {PROTOTYPE_VERSION}</p></div>
        {children}
        <div className="mt-5 pt-3 border-t border-orange-950 text-xs text-orange-700 text-center">
          <div>Local prototype only. No server account or login is created in this build.</div>
          {testerAccessRecord?.accepted ? <button type="button" className="mt-2 text-[11px] text-orange-300 underline decoration-dotted hover:text-orange-100" onClick={clearTesterAccess}>Clear tester access</button> : null}
        </div>
      </div>
      {renderAdminAccessModal()}
      {renderRetroModeConfirmModal()}
    </div>;

    const isRealLauncherSave = (payload = {}) => Boolean(payload?.playerNameSetupComplete || payload?.glwRaceRegistered || payload?.entryStage === "game" || (payload?.player && cleanStoredName(payload.player.name, "SONAR") !== "SONAR"));
    const launcherSlotSummary = (slot = {}, payload = null) => {
      const slotPayload = payload || (slot.storageKey === SAVE_KEY ? safeLoadSave() : safeLoadRoundSlot(slot.slotKey));
      const playerRecord = slotPayload?.player || {};
      const roundKey = canonicalRoundKeyForSlot({ ...slot, ...slotPayload, slotKey: slot.slotKey });
      const roundName = launcherRoundNameForKey(roundKey);
      const playerName = cleanStoredName(playerRecord.name || slot.playerName || "SONAR", "SONAR");
      const speciesKey = playerRecord.race || slot.speciesKey || "lithi";
      const version = slotPayload?.saveStateVersion || slot.version || PROTOTYPE_VERSION;
      const savedAt = Number(slotPayload?.savedAt || slot.savedAt || Date.now()) || Date.now();
      const land = slotPayload?.player ? totalEmpireLand(slotPayload.player) : Number(slot.land || 0);
      const power = slotPayload?.player ? publicPowerForEmpire(slotPayload.player) : Number(slot.power || 0);
      const savedTitle = slotPayload?.gameName || slotPayload?.roundProfile || slot.roundName || slot.label || roundName;
      const roundShortLabel = launcherRoundShortLabelForKey(roundKey);
      const roundTitle = launcherRoundTitleForKey(roundKey);
      const roundSettingsSummary = launcherRoundSettingsSummary(roundKey, slotPayload?.roundSettings || null);
      return { ...slot, storageKey: slot.storageKey || roundSlotSaveKey(slot.slotKey), roundKey, roundName, roundTitle, roundShortLabel, savedTitle, label: slot.label || roundTitle, playerName, speciesKey, version, savedAt, land, power, localOnly: true, roundSettingsSummary, payload: slotPayload };
    };
    const launcherSlots = (() => {
      const slots = liveRoundSlotIndex(roundSlotIndex)
        .filter((slot) => {
          const roundKey = canonicalRoundKeyForSlot(slot);
          return roundKey === "glw" || roundKey === "intro";
        })
        .map((slot) => launcherSlotSummary(slot, safeLoadRoundSlot(slot.slotKey)))
        .filter(Boolean);
      const currentPayload = activeRoundSlotKey ? safeLoadRoundSlot(activeRoundSlotKey) : null;
      const legacyPayload = !currentPayload && activeRoundSlotKey ? safeLoadSave() : null;
      const fallbackPayload = currentPayload || legacyPayload;
      if (fallbackPayload && isRealLauncherSave(fallbackPayload) && !slots.some((slot) => slot.slotKey === activeRoundSlotKey)) {
        const fallbackRoundKey = canonicalRoundKeyForSlot({ ...fallbackPayload, slotKey: activeRoundSlotKey });
        slots.unshift(launcherSlotSummary({
          slotKey: activeRoundSlotKey,
          label: fallbackPayload.gameName || fallbackPayload.roundProfile || defaultRoundSlotLabel(fallbackRoundKey),
          roundKey: fallbackRoundKey,
          roundName: fallbackPayload.gameName || fallbackPayload.roundProfile || defaultRoundSlotLabel(fallbackRoundKey),
          playerName: cleanStoredName(fallbackPayload.player?.name || "SONAR", "SONAR"),
          speciesKey: fallbackPayload.player?.race || fallbackPayload.selectedSpeciesKey || "lithi",
          version: fallbackPayload.saveStateVersion || PROTOTYPE_VERSION,
          savedAt: fallbackPayload.savedAt || Date.now(),
          storageKey: roundSlotSaveKey(activeRoundSlotKey)
        }, fallbackPayload));
      }
      return slots.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
    })();
    const exportLauncherSlotDebug = (slot = {}) => {
      const slotPayload = safeLoadRoundSlot(slot.slotKey) || {};
      const payload = currentDebugExportPayload(`Launcher slot export: ${launcherRoundTitleForKey(canonicalRoundKeyForSlot(slot))}`);
      const now = Date.now();
      const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
      const slotSummary = launcherSlotSummary(slot, slotPayload);
      const filename = `antrophai_debug_${PROTOTYPE_VERSION}_slot_${slotSummary.slotKey}_${stamp}.json`;
      payload.generatedAt = now;
      payload.generatedAtIso = new Date(now).toISOString();
      payload.testerComment = `Launcher slot export: ${slotSummary.roundTitle}`;
      payload.selected = { ...payload.selected, page: "status", entryStage: "glw", selectedRoundKey: slotSummary.roundKey, selectedSpeciesKey: slotSummary.speciesKey, activeRoundSlotKey: slotSummary.slotKey };
      payload.roundSlots = { ...payload.roundSlots, activeRoundSlotKey: slotSummary.slotKey, currentStorageKey: slotSummary.storageKey, launcherSlot: slotSummary };
      payload.exportSummary = { version: PROTOTYPE_VERSION, slotKey: slotSummary.slotKey, roundKey: slotSummary.roundKey, roundShortLabel: slotSummary.roundShortLabel, roundName: slotSummary.roundName, savedTitle: slotSummary.savedTitle, localOnly: true, roundSettingsSummary: slotSummary.roundSettingsSummary };
      payload.savePayload = slotPayload;
      payload.slotContext = slotSummary;
      try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        console.warn("Debug export download failed", err);
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        const json = JSON.stringify(payload, null, 2);
        navigator.clipboard.writeText(json).then(() => addLog(`Admin: exported debug JSON (${filename}) and copied it to clipboard.`, "Admin")).catch(() => addLog(`Admin: exported debug JSON (${filename}); clipboard copy was blocked.`, "Admin"));
      } else {
        addLog(`Admin: exported debug JSON (${filename}).`, "Admin");
      }
    };
    const confirmLauncherSlotChange = (verb, slot) => {
      const title = launcherRoundTitleForKey(canonicalRoundKeyForSlot(slot));
      return confirm(`${verb} this ${title} slot? This only affects this browser's local save. It cannot be undone.`);
    };
    const resetLauncherSlot = (slot = {}) => {
      if (!slot?.slotKey || !confirmLauncherSlotChange("Reset", slot)) return;
      resetGlwLauncher(glwSeedMode, slot.slotKey, canonicalRoundKeyForSlot(slot));
      setLastUpdateSummary(`Reset local slot ${slot.roundTitle || launcherRoundTitleForKey(canonicalRoundKeyForSlot(slot))}.`);
    };
    const deleteLauncherSlot = (slot = {}) => {
      if (!slot?.slotKey || !confirmLauncherSlotChange("Delete", slot)) return;
      safeDeleteRoundSlot(slot.slotKey);
      removeRoundSlotFromIndex(slot.slotKey);
      if (slot.slotKey === activeRoundSlotKey) {
        safeDeleteStorageKey(SAVE_KEY);
        resetGlwLauncher(glwSeedMode, null, canonicalRoundKeyForSlot(slot));
        setLastUpdateSummary(`Deleted active local slot ${slot.roundTitle || launcherRoundTitleForKey(canonicalRoundKeyForSlot(slot))}.`);
      } else {
        setLastUpdateSummary(`Deleted local slot ${slot.roundTitle || launcherRoundTitleForKey(canonicalRoundKeyForSlot(slot))}.`);
      }
    };
    const renderLocalGameSlotsPanel = () => <Panel title="Local Game Slots">
      <p className="text-orange-200 mb-3">Saves are stored locally in this browser only. They are not stored on a server and are not shared between devices.</p>
      <div className="grid md:grid-cols-2 gap-2 mb-2">
        <button className="classic-btn antro-action-btn" onClick={() => resetGlwLauncher("start", GLW_LAUNCHER_SLOT_KEY, "glw")}>Start Godlike Warfare</button>
        <button className="classic-btn antro-action-btn" onClick={() => startIntroGameSlot("start")}>Start Intro Game</button>
      </div>
      <div className="grid md:grid-cols-2 gap-2 mb-3 text-xs text-orange-600">
        <div className="border border-orange-950 bg-black/50 p-2 leading-relaxed">Late-stage 4x war scenario with full revives.</div>
        <div className="border border-orange-950 bg-black/50 p-2 leading-relaxed">Slower 1x intro round: 1,000 land, 1,000,000 cards, no revives.</div>
      </div>
      <p className="text-xs text-orange-600 mb-3">Starting either round opens a separate local slot and will not overwrite the other one.</p>
      {launcherSlots.length ? <div className="grid gap-2">
        {launcherSlots.map((slot) => {
          const speciesName = races[slot.speciesKey]?.name || raceNameFromKey(slot.speciesKey);
          const isCurrent = slot.slotKey === activeRoundSlotKey;
          return <div key={slot.slotKey} className={`border p-3 bg-black/60 ${isCurrent ? "border-orange-300" : "border-orange-900"}`}>
            <div className="flex justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-orange-200">{slot.roundTitle || launcherRoundTitleForKey(slot.roundKey)}</span>
                  <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">{slot.roundShortLabel || launcherRoundShortLabelForKey(slot.roundKey)}</span>
                  <span className="text-[10px] uppercase tracking-wide border border-orange-700 bg-[#241004] text-orange-200 px-2 py-0.5">Local Slot</span>
                  {isCurrent ? <span className="text-[10px] uppercase tracking-wide border border-orange-500 bg-[#2a0d02] text-orange-200 px-2 py-0.5">Open Now</span> : null}
                </div>
                <div className="text-xs text-orange-500 mt-1">Short label: {slot.roundShortLabel || launcherRoundShortLabelForKey(slot.roundKey)} · Round name: {slot.roundName || launcherRoundNameForKey(slot.roundKey)}</div>
                <div className="text-xs text-orange-600 mt-1">Round key: {slot.roundKey} · Slot key: {slot.slotKey}</div>
                <div className="text-xs text-orange-600 mt-1">Player: {slot.playerName || "SONAR"} · Species: {speciesName}</div>
                <div className="text-xs text-orange-600 mt-1">Saved under: {slot.version || PROTOTYPE_VERSION} · Saved: {slot.savedAt ? new Date(slot.savedAt).toLocaleString() : "Not yet stamped"}</div>
                <div className="text-xs text-orange-600 mt-1">Land: {fmt(Number(slot.land || 0))} · Power: {compactFmt(Number(slot.power || 0))}</div>
                <div className="text-xs text-orange-700 mt-1">{isCurrent ? "This is the current open local slot in this browser." : "This slot is stored only in this browser."}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="classic-btn antro-action-btn" onClick={() => switchRoundSlot(slot.slotKey)}>Continue</button>
                <button className="classic-btn antro-action-btn" onClick={() => exportLauncherSlotDebug(slot)}>Export Debug File</button>
                <button className="classic-btn antro-action-btn" onClick={() => resetLauncherSlot(slot)}>Reset Slot / Restart Round</button>
                <button className="classic-btn antro-action-btn" onClick={() => deleteLauncherSlot(slot)}>Delete Slot</button>
              </div>
            </div>
          </div>;
        })}
      </div> : <div className="text-sm text-orange-600 border border-orange-950 p-3 bg-black/60">No local GLW or IG save found for this browser. Start Godlike Warfare or Intro Game to create one.</div>}
      <p className="text-xs text-orange-600 mt-3">Launcher slot exports work for the selected slot. In-game debug export remains available from the Save / Load screen too.</p>
    </Panel>;

    return shell(<>
      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <Panel title={glwRaceRegistered ? `${selectedRound.name} Launcher` : "Choose Species"}>
          <div className="grid lg:grid-cols-[280px_1fr] gap-4">
            <div>
              <label className="block text-orange-300 mb-1">Species</label>
              <select className="species-select w-full bg-black border text-orange-100 px-3 py-2 mb-3" value={selectedSpeciesKey} onChange={(e) => setSelectedSpeciesKey(e.target.value)} disabled={glwRaceRegistered}>
                {speciesEntries.map(({ key, race, choose }) => <option key={key} value={key}>{choose.displayName || race.name}</option>)}
              </select>
              {heroImage ? <img src={heroImage} alt={`${selectedDisplayName} hero image`} className="species-art-frame w-full h-52 object-cover border mb-2" /> : null}
              <div className="text-xs text-orange-600 leading-relaxed mb-3">{glwRaceRegistered ? "Species locked for this round. Use either reset button to choose again." : (selectedChoose.selectorLine || selectedBonusCard.doctrine || selectedTrait.summary || "Species profile")}</div>
              <label className="block text-orange-300 mb-1">Empire name</label>
              <input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-2 mb-2" value={playerNameDraft} maxLength={TEXT_LIMITS.playerName} onChange={(e) => setPlayerNameDraft(cleanSingleLineText(e.target.value, TEXT_LIMITS.playerName))} onKeyDown={(e) => { if (e.key === "Enter" && !glwRaceRegistered) confirmPlayerName(); }} disabled={glwRaceRegistered} />
              <div className="text-xs text-orange-600 mb-4">{selectedRoundKey === "intro" ? "Start seed: fresh Intro Game clock." : glwSeedMode === "late" ? "Late-war seed: 75% of ticks passed." : "Start seed: fresh GLW clock."}</div>
              <div className="flex gap-2 flex-wrap">
                {glwRaceRegistered ? <button className="classic-btn antro-action-btn" onClick={() => enterCurrentGame("status")}>Enter Game</button> : <button className="classic-btn antro-action-btn" onClick={confirmPlayerName}>Enter Game</button>}
                <button className="classic-btn antro-action-btn" onClick={() => resetGlwLauncher("start", selectedRoundKey === "intro" ? INTRO_LAUNCHER_SLOT_KEY : GLW_LAUNCHER_SLOT_KEY, selectedRoundKey === "intro" ? "intro" : "glw")}>Reset from Start</button>
                {selectedRoundKey === "glw" ? <button className="classic-btn antro-action-btn" onClick={() => resetGlwLauncher("late", GLW_LAUNCHER_SLOT_KEY, "glw")}>Reset from 75%</button> : null}
              </div>
              <div className="mt-4 border border-orange-950 bg-black/60 p-3 text-xs text-orange-500">
                <div className="text-orange-300 font-bold mb-2">Wording lock</div>
                <OldTable rows={[["Current", displayModel === "retro" ? "Retro wording" : "Hybrid AntrophAI"], ["Retro unlock", displayModel === "retro" ? "Unlocked" : "Password required"]]} />
                {displayModel === "retro" ? <button className="classic-btn antro-action-btn mt-2" onClick={lockHybridWording}>Return to Hybrid</button> : <div className="flex gap-2 flex-wrap mt-2"><input className="bg-black border border-orange-900 text-orange-100 px-2 py-1" type="password" placeholder="Retro password" value={retroWordingPasswordDraft} onChange={(e) => { setRetroWordingPasswordDraft(e.target.value); setRetroWordingError(""); }} onKeyDown={(e) => { if (e.key === "Enter") unlockRetroWording(); }} /><button className="classic-btn antro-action-btn" onClick={unlockRetroWording}>Unlock Retro</button></div>}
                {retroWordingError ? <div className="text-red-300 mt-2">{retroWordingError}</div> : null}
              </div>
            </div>
            <div className="border border-orange-950 bg-black/40 p-3">
              <div className="text-xs uppercase tracking-[0.28em] text-orange-700 mb-1">Browser-local {roundProfile} build</div>
              <h2 className="text-2xl text-orange-100 font-bold mb-2" style={{ color: "var(--species-accent)" }}>{selectedChoose.bonusTitle || selectedBonusCard.title || selectedTrait.trait || "Species doctrine"}</h2>
              {doctrineImage ? <img src={doctrineImage} alt={`${selectedDisplayName} doctrine image`} className="species-art-frame w-full max-h-72 object-cover border mb-3" /> : null}
              <p className="text-orange-100 leading-relaxed mb-3">{selectedChoose.flavourLine || selectedBonusCard.identityText || selectedTrait.summary || "Doctrine detail pending."}</p>
              {(() => {
                const clock = roundClockSnapshot(selectedRoundKey === "intro" ? "intro" : "glw", roundStartedAt, Date.now(), Number(roundSettings.gameSpeed) || 1);
                const remainingRealMs = Math.max(0, Number(clock.realEndAt || Date.now()) - Date.now());
                const totalRealMs = GAME_TOTAL_GAME_MS / Math.max(0.001, Number(clock.speed || roundSettings.gameSpeed || 1));
                return <OldTable rows={[["Round", selectedRound.name], ["Speed", `${roundSettings.gameSpeed || 1}x`], ["Explore", roundSettings.exploreEnabled === false ? "Disabled" : "Enabled"], ["Revives", roundSettings.revives || "Unknown"], ["Progress", `${Number(clock.percent || 0).toFixed(1)}% · ${fmt(clock.elapsedTicks || 0)}/${fmt(clock.totalTicks || GAME_TOTAL_TICKS)} ticks`], ["Time left", `${compactDdhhmmFromMs(remainingRealMs)}/${compactDdhhmmFromMs(totalRealMs)}`], ["Launcher", "Browser-local slots shown on the right"]]} />;
              })()}
            </div>
          </div>
        </Panel>
        <div className="grid gap-4">
          {renderLocalGameSlotsPanel()}
          {renderSharedMultiplayerPreviewPanel()}
        </div>
      </div>
    </>);
    if (entryStage === "account") return shell(<>
      <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-4">
        <Panel title="Register to AntrophAI"><p className="text-orange-200 mb-3">Create a local prototype access point before selecting a round. Public account handling will be added later.</p><OldTable rows={[["Access type", "Local private prototype"], ["Authentication", "Not connected yet"], ["Next step", "Choose a round"]]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => setEntryStage("rounds")}>Register / Continue</button><button className="classic-btn antro-action-btn" onClick={() => setEntryStage("rounds")}>Login to AntrophAI</button></div></Panel>
        <Panel title="AntrophAI.com layer"><p className="text-orange-200 leading-relaxed">This screen is the future account shell: register, login, then move between concurrent rounds without leaving the AntrophAI identity layer.</p><p className="text-orange-600 text-sm mt-3">Artwork placeholder: Silas login/terminal threshold image will sit here.</p></Panel>
      </div>
    </>);
    const roundSelectTabs = [
      ["rounds", "Round Select"],
      ["access", "Game Access & Display"],
      ["registration", "Current Registration"],
      ["saves", "Save / Load"],
      ["admin", "Game Admin"]
    ];
    const selectedRoundSlot = registeredSlotForRound(selectedRoundKey);
    const selectedRoundSlotPayload = safeLoadRoundSlot(selectedRoundSlot?.slotKey);
    const selectedRoundDisplayName = selectedRoundKey === "admin-start" && selectedRoundSlot ? adminRoundDisplayName(selectedRoundSlot.roundName || selectedRoundSlotPayload?.gameName || selectedRoundSlotPayload?.roundProfile || selectedRoundSlot.label) : selectedRound.name;
    const renderRoundTabButton = ([key, label]) => <button key={key} type="button" className={`classic-btn antro-action-btn ${roundSelectTab === key ? "ring-1 ring-orange-300 text-orange-100" : ""}`} onClick={() => setRoundSelectTab(key)}>{label}</button>;
    const renderRoundSelectTab = () => <Panel title="Round Select"><p className="text-orange-200 mb-3">Choose which game you are entering. Registration, display, saves and admin setup are split into tabs so this screen stays readable.</p>
      <div className="grid md:grid-cols-3 gap-3">{accountRounds.map((round) => { const slot = registeredSlotForRound(round.key); const slotPayload = safeLoadRoundSlot(slot?.slotKey); const clockSpeed = roundSpeedForSavedSlot(round.key, slotPayload, slot); const clock = roundClockSnapshot(round.key, slot?.roundStartedAt || slotPayload?.roundStartedAt || roundStartTimestampForKey(round.key), Date.now(), clockSpeed); const registeredRace = slot ? (races[slot.speciesKey]?.name || raceNameFromKey(slot.speciesKey)) : null; const roundCardName = round.key === "admin-start" && slot ? adminRoundDisplayName(slot.roundName || slotPayload?.gameName || slotPayload?.roundProfile || slot.label) : round.name; const roundCardDescription = round.key === "admin-start" && slot ? "Admin-controlled local round slot. Reset it from Game Admin to start a different profile." : round.description; return <button key={round.key} onClick={() => setSelectedRoundKey(round.key)} className={`text-left border p-3 bg-black/60 ${selectedRoundKey === round.key ? "border-orange-300 text-orange-100" : "border-orange-900 text-orange-300 hover:border-orange-600"}`}><div className="font-bold text-lg">{roundCardName}</div><div className="text-xs text-orange-600 mb-2">{slot ? "registered / live" : round.status.replace(/_/g, " ")} · {round.speed}</div><div className="text-sm text-orange-200 leading-relaxed">{roundCardDescription}</div><div className="text-xs text-orange-500 mt-2">Registration: {registeredRace || round.opens}<br />Start: {round.starts}<br />Clock: {formatRoundClock(clock)}</div></button>; })}</div>
      <div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => enterSelectedRound("status")}>{registeredSlotForRound(selectedRoundKey) ? "Enter Selected Round" : selectedRound.status === "admin_start" ? "Admin Start Setup" : selectedRound.status === "late_round" ? "Register for Late Round" : "Register for Starting Round"}</button><button className="classic-btn antro-action-btn" onClick={() => { const slot = registeredSlotForRound(selectedRoundKey); if (slot?.slotKey) switchRoundSlot(slot.slotKey); setPage("rankings"); setPlayerNameSetupComplete(true); setEntryStage("game"); }}>View Live Rankings</button><button className="classic-btn antro-action-btn" onClick={() => setEntryStage("account")}>Back</button></div>
    </Panel>;
    const renderAccessDisplayTab = () => <Panel title="Game Access & Display">
      <p className="text-orange-200 mb-3">Choose how AntrophAI should label the game and whether this session has admin/reference access.</p>
      <div className="grid md:grid-cols-[1.25fr_0.75fr] gap-4">
        <div className="border border-orange-950 bg-black/50 p-3">
          <div className="text-orange-300 font-bold mb-2">Display Model</div>
          <div className="grid gap-2">
            {["hybrid", "modern", "classic"].map((key) => {
              const option = DISPLAY_MODEL_OPTIONS[key];
              const locked = key !== "hybrid";
              if (locked) return <div key={key} className="text-left border border-orange-950 bg-black/40 p-2 text-orange-700">
                <div className="flex items-center gap-2"><span>○</span><span className="font-bold">{option.label} — locked to Hybrid in this build</span></div>
                <div className="text-xs text-orange-600 mt-1 ml-5">{option.short}</div>
              </div>;
              return <button key={key} type="button" onClick={() => chooseDisplayModel(key)} className={`text-left border p-2 bg-black/70 ${displayModel === key ? "border-orange-300 text-orange-100" : "border-orange-950 text-orange-300 hover:border-orange-700"}`}>
                <div className="flex items-center gap-2"><span>{displayModel === key ? "●" : "○"}</span><span className="font-bold">{option.label}</span></div>
                <div className="text-xs text-orange-500 mt-1 ml-5">{option.short}</div>
              </button>;
            })}
            {adminMode ? <button type="button" onClick={() => chooseDisplayModel("retro")} className={`text-left border p-2 bg-black/70 ${displayModel === "retro" ? "border-orange-300 text-orange-100" : "border-orange-950 text-orange-300 hover:border-orange-700"}`}>
              <div className="flex items-center gap-2"><span>{displayModel === "retro" ? "●" : "○"}</span><span className="font-bold">Retro Mode</span></div>
              <div className="text-xs text-orange-500 mt-1 ml-5">Old-player/reference presentation.</div>
            </button> : <div className="border border-orange-950 bg-black/40 p-2 text-orange-700"><div className="font-bold text-orange-500">Retro Mode</div><div className="text-xs mt-1">Available through Admin Access.</div></div>}
          </div>
          <p className="text-xs text-orange-600 mt-3">Recommended normal mode: Hybrid AntrophAI. Modern and Classic display-model choices are intentionally locked in this GLW handoff build; Retro remains admin-only reference mode.</p>
        </div>
        <div className="border border-orange-950 bg-black/50 p-3">
          <div className="text-orange-300 font-bold mb-2">Admin / Reference Access</div>
          <OldTable rows={[["Admin Access", adminMode ? "Enabled" : "Disabled"], ["Retro Mode", adminMode ? "Available" : "Locked"], ["Selected display", DISPLAY_MODEL_OPTIONS[displayModel]?.label || "Hybrid AntrophAI"]]} />
          <div className="flex gap-2 flex-wrap mt-3">{adminMode ? <button className="classic-btn antro-action-btn" onClick={disableAdminAccess}>Disable Admin Access</button> : <button className="classic-btn antro-action-btn" onClick={requestAdminAccess}>Enable Admin Access</button>}</div>
          <p className="text-xs text-orange-600 mt-3">Admin access enables reference tools and restricted display modes for testing and trusted old-player reference use.</p>
        </div>
      </div>
    </Panel>;
    const renderCurrentRegistrationTab = () => <Panel title="Current Registration"><p className="text-orange-200 mb-3">This local prototype saves by local round slot. Use this panel to move back into the active round after visiting the AntrophAI base layer.</p><OldTable rows={[["Empire", cleanStoredName(player.name, "SONAR")], [speciesDisplayLabel(), races[player.race]?.name || raceNameFromKey(player.race)], ["Current round profile", roundProfile], ["Selected base round", selectedRoundDisplayName], ["Selected round registration", selectedRoundSlot ? (races[selectedRoundSlot.speciesKey]?.name || raceNameFromKey(selectedRoundSlot.speciesKey)) : "Not registered"], ["Display model", DISPLAY_MODEL_OPTIONS[displayModel]?.label || "Hybrid AntrophAI"], ["Admin access", adminMode ? "Enabled" : "Disabled"], ["Open live slot", activeRoundSlotKey], ["State", "Autosaved in this browser"], ...roundClockRows(currentRoundKeyFromProfile(), roundStartedAt)]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={() => enterCurrentGame("status")}>Enter Active Round Slot</button><button className="classic-btn antro-action-btn" onClick={() => setEntryStage("species")}>Review Species Registration</button><button className="classic-btn antro-action-btn" onClick={() => saveActiveRoundSlot("Manual save")}>Save Slot Now</button></div></Panel>;
    const fixedLiveSlotId = (slot = {}) => {
      if (!slot?.slotKey || isSnapshotSlot(slot)) return null;
      if (slot.slotKey === ADMIN_ROUND_SLOT_KEY || canonicalRoundKeyForSlot(slot) === "admin-start") return "slot-3";
      const roundKeyForSlot = canonicalRoundKeyForSlot(slot);
      if (roundKeyForSlot === "intro") return "slot-1";
      if (roundKeyForSlot === "glw") return "slot-2";
      return null;
    };
    const liveSlotSortOrder = { "slot-1": 1, "slot-2": 2, "slot-3": 3 };
    const canonicalLiveRoundSlots = (slots = []) => {
      const chosen = new Map();
      (Array.isArray(slots) ? slots : []).forEach((slot) => {
        const id = fixedLiveSlotId(slot);
        if (!id) return;
        const existing = chosen.get(id);
        if (!existing || Number(slot.savedAt || 0) > Number(existing.savedAt || 0) || slot.slotKey === activeRoundSlotKey) chosen.set(id, slot);
      });
      return Array.from(chosen.entries()).sort((a, b) => (liveSlotSortOrder[a[0]] || 99) - (liveSlotSortOrder[b[0]] || 99)).map(([, slot]) => slot);
    };
    const liveSlotBadge = (slot = {}) => {
      const id = fixedLiveSlotId(slot);
      if (id === "slot-1") return "Slot 1 · Intro Game live autosave";
      if (id === "slot-2") return "Slot 2 · Godlike Warfare live autosave";
      if (id === "slot-3") return "Slot 3 · Admin Round live autosave";
      return "Live round autosave";
    };
    const snapshotBadge = (slot = {}) => isSnapshotSlot(slot) ? "Saved Snapshot · manual single-round copy" : "Local Copy · not assigned as the live autosave for a fixed slot";
    const renderSlotCard = (slot, kind = "live") => {
      const isCurrent = slot.slotKey === activeRoundSlotKey;
      const badge = kind === "snapshot" ? snapshotBadge(slot) : liveSlotBadge(slot);
      const deleteLabel = isSnapshotSlot(slot) ? "Delete Snapshot" : "Delete Copy";
      return <div key={slot.slotKey} className={`border p-2 bg-black/60 ${isCurrent ? "border-orange-300" : "border-orange-900"}`}><div className="flex justify-between gap-2 flex-wrap"><div><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-orange-200">{slotDisplayName(slot)}</span>{isCurrent ? <span className="text-[10px] uppercase tracking-wide border border-orange-500 bg-[#2a0d02] text-orange-200 px-2 py-0.5">Open Now</span> : null}</div><div className="text-xs text-orange-600">{slotMetaLine(slot)}</div><div className={`text-[11px] mt-1 ${kind === "snapshot" ? "text-orange-700" : "text-orange-400"}`}>{badge}</div>{kind === "live" ? <div className="text-[11px] text-orange-800">This is the one autosaving browser slot for this round type.</div> : <div className="text-[11px] text-orange-800">This is a stored copy. Loading it does not overwrite Intro / GLW / Admin unless you choose Load into Admin Round.</div>}</div><div className="flex gap-2 flex-wrap"><button className="classic-btn antro-action-btn" onClick={() => switchRoundSlot(slot.slotKey)} disabled={isCurrent}>Load</button>{adminMode && <button className="classic-btn antro-action-btn" onClick={() => loadRoundSlotIntoAdmin(slot.slotKey)} disabled={slot.slotKey === ADMIN_ROUND_SLOT_KEY}>Load into Admin Round</button>}{kind === "snapshot" ? <button className="classic-btn antro-action-btn" onClick={() => deleteSnapshotSlot(slot.slotKey)}>{deleteLabel}</button> : <button className="classic-btn antro-action-btn" onClick={() => resetLiveRoundSlot(slot.slotKey)}>Reset / Clear</button>}</div></div></div>;
    };
    const renderSaveLoadTab = () => {
      const slots = liveRoundSlotIndex(roundSlotIndex);
      const liveSlots = canonicalLiveRoundSlots(slots);
      const liveSlotKeys = new Set(liveSlots.map((slot) => slot.slotKey));
      const snapshotSlots = slots.filter((slot) => isSnapshotSlot(slot) || !liveSlotKeys.has(slot.slotKey));
      return <Panel title="Save / Load"><p className="text-orange-200 mb-3">Live round slots are the fixed autosaving games in this browser: Slot 1 is Intro Game, Slot 2 is Godlike Warfare, and Slot 3 is the Admin Round. Only one live autosave is shown for each slot. <span className="text-orange-300 font-bold">Open Now</span> marks the slot currently loaded in the app.</p><Panel title="Live Round Slots"><div className="grid gap-2 mb-2">{liveSlots.length ? liveSlots.map((slot) => renderSlotCard(slot, "live")) : <div className="text-sm text-orange-600 border border-orange-950 p-2 bg-black/60">No live round slots listed yet. Register for a round or create an admin round to start one.</div>}</div><p className="text-xs text-orange-600">Use Reset / Clear carefully: it clears the live autosave for that fixed slot in this browser.</p></Panel><Panel title="Saved Snapshots / Local Copies"><div className="grid gap-2 mb-2">{snapshotSlots.length ? snapshotSlots.map((slot) => renderSlotCard(slot, "snapshot")) : <div className="text-sm text-orange-600 border border-orange-950 p-2 bg-black/60">No manual snapshots or extra local copies yet.</div>}</div><div className="flex gap-2 flex-wrap mt-3"><button className="classic-btn antro-action-btn" onClick={saveCurrentStateAsNewSlot}>Create Snapshot from Current State</button><button className="classic-btn antro-action-btn" onClick={exportCurrentSave}>Export Current Save</button></div></Panel>{saveExportText ? <textarea className="w-full h-28 bg-black border border-orange-900 text-orange-100 text-xs p-2 mb-3" readOnly value={saveExportText} onFocus={(e) => e.target.select()} /> : null}<label className="block text-orange-300 mb-1">Import pasted save JSON</label><textarea className="w-full h-24 bg-black border border-orange-900 text-orange-100 text-xs p-2" value={saveImportDraft} onChange={(e) => setSaveImportDraft(e.target.value)} placeholder="Paste exported AntrophAI save here" /><div className="flex gap-2 flex-wrap mt-2"><button className="classic-btn antro-action-btn" onClick={importSaveAsNewSlot}>Import as New Slot</button><button className="classic-btn antro-action-btn" onClick={() => setSaveImportDraft("")}>Clear Import Box</button></div></Panel>;
    };
    const renderGameAdminTab = () => adminMode ? <>{renderRoundSetup()}<Panel title="Game Creation"><p className="text-orange-200 mb-3">Create or stamp a local round slot using the currently selected Round Select entry and the current Game Admin settings.</p><OldTable rows={[["Selected round", selectedRoundDisplayName], ["Selected profile", roundProfile], ["Game name", gameName], ["Existing registration", selectedRoundSlot ? "Already registered" : "None for selected round"], ["Admin slot behaviour", selectedRoundKey === "admin-start" ? "Reset/create overwrites the single Admin Round slot" : "Normal rounds keep separate local registrations"]]} /><div className="flex gap-2 flex-wrap mt-4">{selectedRoundKey === "admin-start" || !registeredSlotForRound(selectedRoundKey) ? <button className="classic-btn antro-action-btn" onClick={() => startNewRoundSlot(selectedRoundKey)}>{selectedRoundKey === "admin-start" ? "Reset / Create Admin Round" : "Start New Slot for Selected Round"}</button> : <span className="text-xs text-orange-600 self-center">Local registrations stay browser-local; use the Local Game Slots panel to create another GLW save or delete the one shown here.</span>}<button className="classic-btn antro-action-btn" onClick={applyRoundStartingValues}>Apply Starting Values</button></div></Panel></> : <Panel title="Game Admin"><p className="text-orange-200 mb-3">Game creation and round setup controls are available after Admin Access is enabled.</p><button className="classic-btn antro-action-btn" onClick={requestAdminAccess}>Enable Admin Access</button></Panel>;
    const renderSelectedRoundTab = () => roundSelectTab === "access" ? renderAccessDisplayTab() : roundSelectTab === "registration" ? renderCurrentRegistrationTab() : roundSelectTab === "saves" ? renderSaveLoadTab() : roundSelectTab === "admin" ? renderGameAdminTab() : renderRoundSelectTab();
    if (entryStage === "rounds") return shell(<>
      <Panel title="Round Select Controls"><div className="flex gap-2 flex-wrap">{roundSelectTabs.map(renderRoundTabButton)}</div></Panel>
      {renderSelectedRoundTab()}
    </>);
    return shell(<>
      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <Panel title={`Register for ${selectedRoundDisplayName}`}>
          <div className="grid lg:grid-cols-[280px_1fr] gap-4">
            <div>
              <label className="block text-orange-300 mb-1">Species</label>
              <select className="species-select w-full bg-black border text-orange-100 px-3 py-2 mb-3" value={selectedSpeciesKey} onChange={(e) => setSelectedSpeciesKey(e.target.value)}>
                {speciesEntries.map(({ key, race, choose }) => <option key={key} value={key}>{choose.displayName || race.name}</option>)}
              </select>
              {heroImage ? <img src={heroImage} alt={`${selectedDisplayName} hero image`} className="species-art-frame w-full h-52 object-cover border mb-2" /> : null}
              <div className="text-xs text-orange-600 leading-relaxed mb-3">{selectedChoose.selectorLine || selectedBonusCard.doctrine || selectedTrait.summary || "Species profile"}</div>
              <label className="block text-orange-300 mb-1">Empire name</label>
              <input className="w-full bg-black border border-orange-900 text-orange-100 px-2 py-2 mb-2" value={playerNameDraft} maxLength={TEXT_LIMITS.playerName} onChange={(e) => setPlayerNameDraft(cleanSingleLineText(e.target.value, TEXT_LIMITS.playerName))} onKeyDown={(e) => { if (e.key === "Enter") confirmPlayerName(); }} autoFocus />
              <div className="text-xs text-orange-600 mb-4">Maximum {TEXT_LIMITS.playerName} characters. Species skin and dossier preview update from the dropdown.</div>
              <div className="flex gap-2 flex-wrap"><button className="classic-btn antro-action-btn" onClick={confirmPlayerName}>{selectedRound.status === "admin_start" ? "Create Admin Round Slot" : selectedRound.status === "late_round" ? "Join Late Round" : "Join Game"}</button><button className="classic-btn antro-action-btn" onClick={() => setPlayerNameDraft("SONAR")}>Use SONAR</button><button className="classic-btn antro-action-btn" onClick={() => setEntryStage("rounds")}>Back to Rounds</button></div>
            </div>
            <div className="border border-orange-950 bg-black/40 p-3">
              <div className="text-xs uppercase tracking-[0.28em] text-orange-700 mb-1">Modern AntrophAI doctrine</div>
              <h2 className="text-2xl text-orange-100 font-bold mb-2" style={{ color: "var(--species-accent)" }}>{selectedChoose.bonusTitle || selectedBonusCard.title || selectedTrait.trait || "Species doctrine"}</h2>
              {doctrineImage ? <img src={doctrineImage} alt={`${selectedDisplayName} doctrine image`} className="species-art-frame w-full max-h-72 object-cover border mb-3" /> : null}
              <p className="text-orange-100 leading-relaxed mb-3">{selectedChoose.flavourLine || selectedBonusCard.identityText || selectedTrait.summary || "Doctrine detail pending."}</p>
              <div className="border border-orange-950 bg-black/70 p-3 text-sm text-orange-200 leading-relaxed">
                <div className="text-orange-300 font-bold mb-1">Effect</div>
                {selectedBonusCard.mechanicalText || selectedChoose.traitPanelText || "Effect pending."}
              </div>
            </div>
          </div>
        </Panel>
        <Panel title={`${selectedDisplayName} Species Dossier`}>
          <div className="text-xs uppercase tracking-[0.24em] text-orange-700 mb-1">Short form story</div>
          <p className="text-orange-100 leading-relaxed mb-4">{selectedChoose.shortStory || selectedBonusCard.identityText || selectedManifest.originSummary || "Species story pending."}</p>
          <OldTable rows={[
            ["Identity", selectedChoose.identity || selectedManifest.identity || selectedTrait.title || "Pending"],
            ["Origin", selectedChoose.origin || selectedManifest.homeworld || "Field Manual record pending"],
            ["Doctrine", selectedChoose.doctrine || selectedBonusCard.doctrine || selectedManifest.doctrine || "Doctrine pending"],
            ["Profile", selectedChoose.profile || selectedBonusCard.shortText || selectedTrait.summary || selectedManifest.originSummary || "Summary pending"]
          ]} />
          {selectedChoose.traitPanelText ? <div className="mt-3 border border-orange-950 bg-black/60 p-3 text-sm text-orange-200 leading-relaxed"><div className="text-orange-300 font-bold mb-1">Trait summary</div>{selectedChoose.traitPanelText}</div> : null}
          <button className="classic-btn mt-3" onClick={() => { setSelectedHelpRace(selectedSpeciesKey); setEntryStage("species"); }}>Field Manual dossier available after registration</button>
        </Panel>
      </div>
    </>);
  }


  const pages = { status: renderStatus, admin: renderAdmin, assistance: renderSignalAssistance, help: renderHelp, records: renderRecords, raceLibrary: renderRaceLibrary, raceArchive: renderRaceArchivePage, raceArchivePlates: renderRaceArchivePlatesPage, buildingLibrary: renderBuildingLibrary, battleOutcomes: renderBattleOutcomes, build: renderBuild, destroy: renderDestroy, explore: renderExplore, barracks: renderBarracks, disband: renderDisband, war: renderWar, report: renderReport, battlelog: renderBattleLog, profile: renderProfile, allianceProfile: renderAllianceProfile, rankings: renderRankings, news: renderNews, bonus: () => <Panel title={pageLabel("bonus")}><p className="mb-3">Follow the bonus link once every 24 hours to receive 500,000 {currencyLabel}.</p><OldTable rows={[["Bonus Window", "welcome to 2001"], ["Time Until Next Bonus", bonusCountdownLabel()], ["Reward", `500,000 ${currencyLabel}`]]} /><div className="flex gap-2 flex-wrap mt-4"><button className="classic-btn antro-action-btn" onClick={openBonusWindow}>Open Bonus Window</button><button className="classic-btn antro-action-btn" onClick={claimBonus} disabled={bonusSecondsRemaining() > 0}>Claim Bonus</button></div></Panel>, bank: renderBank, factories: renderFactories, mines: renderMines, market: renderMarket, science: renderScience, alliances: renderAlliances, messages: renderMessages, missiles: renderMissiles, online: renderOnline, shops: renderShops, spy: renderSpyCenter, search: renderSearch, todo: renderSelfTests };

  function renderMainContent() {
    if (activeGameMode === "hosted" && hostedRoundState.summary) {
      if (page === "status") return renderStatus();
      if (page === "build") return renderBuild();
      if (page === "barracks") return renderBarracks();
      if (page === "explore") return renderExplore();
      if (page === "science") return renderScience();
      if (page === "bank") return renderBank();
      if (page === "todo") return renderHostedDiagnosticsPanel();
      return renderHostedPageUnavailable(page);
    }

    return typeof pages[page] === "function" ? pages[page]() : renderStatus();
  }

  if (!testerAccessRecord?.accepted) return renderTesterAccessGate();
  if (hydrated && !playerNameSetupComplete) return renderNameSetup();

  if (page === "raceArchive") return renderRaceArchivePage(selectedHelpRace);
  if (page === "raceArchivePlates") return renderRaceArchivePlatesPage(selectedHelpRace);

  return <div className={`app-shell wording-${activeReportTextMode} species-${activeSpeciesSkinKey} min-h-screen bg-black text-orange-400 font-mono p-3`} style={{ backgroundImage: "radial-gradient(circle at top, #1b1208 0, #030100 38%, #000 100%)" }}><style>{`.app-shell{--antro-bg:#050100;--antro-panel-bg:rgba(0,0,0,.82);--antro-panel-header-bg:#240b02;--antro-border:#9a4b08;--antro-accent:#ffb15c;--species-accent:var(--antro-accent);--species-border:var(--antro-border);--species-glow:rgba(255,120,32,.14)}.wording-modern.species-human{--species-accent:#d6a15d;--species-border:#a46b32;--species-glow:rgba(242,192,120,.16)}.wording-modern.species-trysaur{--species-accent:#c05a1a;--species-border:#8c2f0c;--species-glow:rgba(255,92,24,.18)}.wording-modern.species-relu{--species-accent:#8fc6d8;--species-border:#5f8792;--species-glow:rgba(141,210,232,.18)}.wording-modern.species-lithi{--species-accent:#b98536;--species-border:#6d4216;--species-glow:rgba(224,162,74,.16)}.wording-modern.species-zarth{--species-accent:#a66bff;--species-border:#6b3fb0;--species-glow:rgba(166,107,255,.22)}.wording-modern .antro-panel{border-color:var(--species-border)}.wording-modern .antro-panel-title{border-color:var(--species-border)}.classic-btn{border:1px solid #9a4b08;background:#160701;color:#ffb15c;padding:4px 8px;font-size:14px}.classic-btn:hover{background:#321004;color:#ffe0b0}.classic-btn:disabled{opacity:.45;cursor:not-allowed}.admin-btn{border:1px solid #b91c1c;background:#180000;color:#fecaca;padding:4px 8px;font-size:12px}.admin-btn:hover{background:#450a0a;color:#fff}.admin-btn:disabled{opacity:.45;cursor:not-allowed}.page-flash{animation:pageFlash .14s ease-out}@keyframes pageFlash{0%{filter:brightness(.35)}100%{filter:brightness(1)}}`}</style>{pageFlash && <div className="fixed inset-0 pointer-events-none bg-black/65 z-50" />}{renderAdminAccessModal()}{renderRetroModeConfirmModal()}
  {renderLibraryImageViewer()}{messagePopup && <div className="fixed top-4 right-4 z-[60] w-[min(92vw,420px)] border border-orange-500 bg-black text-orange-100 shadow-2xl p-3">
    <div className="flex justify-between gap-3 items-start mb-2"><div><div className="text-orange-300 font-bold">Message received</div><div className="text-xs text-orange-500">From {messagePopup.from}</div></div><button className="classic-btn antro-action-btn" onClick={() => setMessagePopup(null)}>x</button></div>
    <div className="text-sm whitespace-pre-wrap max-h-40 overflow-auto border-t border-orange-950 pt-2">{displayMessageBody(messagePopup).slice(0, 700)}{displayMessageBody(messagePopup).length > 700 ? "..." : ""}</div>
    <div className="flex gap-2 flex-wrap mt-3">{messagePopup.reportId ? <button className="classic-btn antro-action-btn" onClick={() => openMessageReport(messagePopup)}>View Report</button> : null}<button className="classic-btn antro-action-btn" onClick={() => { setPage("messages"); setMessagePopup(null); }}>Open Messages</button><button className="classic-btn antro-action-btn" onClick={() => setMessagePopup(null)}>Dismiss</button></div>
  </div>}<header className="border border-orange-800 bg-black/80 mb-3"><div className="p-4 flex items-center gap-4"><div className="w-20 h-20 rounded-full border border-orange-700" style={{ background: "radial-gradient(circle at 35% 30%, #ff9d2e, #6d2508 45%, #120400 70%)" }} /><div><h1 className="text-3xl md:text-5xl font-bold tracking-widest"><span className="text-orange-300">ANTROPH</span><span className="ml-1 text-cyan-200" style={{ textShadow: "0 0 6px #22d3ee, 0 0 14px #0ea5e9, 0 0 24px #38bdf8" }}>AI</span></h1><p className="text-orange-600">{activeGameMode === "hosted" && hostedRoundState.summary ? `Invite-token hosted session · ${PROTOTYPE_VERSION} · canonical server round state` : `Private AntrophAI prototype · ${PROTOTYPE_VERSION} · GLW single-round build`}</p></div></div><nav className="antro-top-nav border-t border-orange-900 p-2 flex flex-wrap gap-2"><button className="classic-btn antro-action-btn" onClick={returnToBaseScreen}>{activeGameMode === "hosted" && hostedRoundState.summary ? "Return to Local Launcher" : "Return to Launcher"}</button>{adminMode && <MenuButton label="Project Log" page="todo" current={page} setPage={navigatePage} />}<MenuButton label="Field Manual" page="help" current={page} setPage={navigatePage} /><button className={`px-2 py-1 border text-xs md:text-sm ${adminMode ? "bg-red-900/80 border-red-300 text-red-100" : "bg-black border-red-800 text-red-400 hover:text-red-100"}`} onClick={() => { if (adminMode) { disableAdminAccess(); } else { requestAdminAccess(); } }}>Validate Identity</button><MenuButton label="View the Roster" page="rankings" current={page} setPage={navigatePage} /><MenuButton label="Signal for Assistance" page="assistance" current={page} setPage={navigatePage} /></nav></header><div className="grid xl:grid-cols-[190px_1fr_250px] md:grid-cols-[190px_1fr] gap-3"><aside className="border border-orange-800 bg-black/80 p-2 h-fit"><div className="antro-lhs-nav">{navItems.map(({ originalLabel, key: target }) => <MenuButton key={target} label={pageLabel(target) || originalLabel} originalLabel={originalLabel} icon={navIconByPage[target]} page={target} current={page} setPage={navigatePage} activeTone="identity" />)}{renderAdminSidebar()}</div></aside><main className={pageFlash ? "page-flash" : ""}>{renderMainContent()}</main>{renderPersistentStats()}</div></div>;
}
