// Hosted game-service and invite-token-service API client.
// Extracted from App.jsx as-is for the server-authority migration: this module owns
// service URLs, request transport (12s timeout, JSON-or-raw parsing) and the
// user-facing failure messages for hosted calls. It performs no React state updates;
// callers own loading/error state and response-to-state mapping.
import { cleanSingleLineText } from "./gameMath.js";

export const INVITE_TOKEN_SERVICE_URL = String(import.meta.env.VITE_INVITE_TOKEN_SERVICE_URL || "https://antrophai-glwtest-passkey.onrender.com").replace(/\/+$/, "");
export const INVITE_TOKEN_SERVICE_HOST = (() => {
  try {
    return INVITE_TOKEN_SERVICE_URL ? new URL(INVITE_TOKEN_SERVICE_URL).host : null;
  } catch {
    return null;
  }
})();
export const GAME_SERVICE_URL = String(import.meta.env.VITE_GAME_SERVICE_URL || "https://antrophai-game-service-dev.onrender.com").replace(/\/+$/, "");
export const MULTIPLAYER_PREVIEW_ROUND_KEY = "shared-dev-001";

// Hosted construction contract. game-service v0.43.2 (game-service/src/server.js in
// this repo) honours the requested buildingKey for all five canonical building
// types, rejects unknown keys with 400 invalid_building_key, and requires a grant
// identity on queued orders. The client therefore queues any canonical key and
// additionally verifies the buildingKey echoed back in the queue response, so a
// stale deployment that still coerces every order to "factory" (v0.43.1 behaviour)
// is surfaced as an error instead of silently misreported as success.
export const HOSTED_QUEUE_BUILD_ENDPOINT = "/api/dev/actions/queue-build-factory";
export const HOSTED_QUEUE_TRAIN_ENDPOINT = "/api/dev/actions/queue-train-units";
export const HOSTED_QUEUE_EXPLORE_ENDPOINT = "/api/dev/actions/queue-explore";
export const HOSTED_QUEUE_SCIENCE_ENDPOINT = "/api/dev/actions/queue-science";
// Bank deposit/withdraw are INSTANT actions (not due-orders): they mutate money
// and banked immediately, mirroring the local Bank screen.
export const HOSTED_BANK_DEPOSIT_ENDPOINT = "/api/dev/actions/bank-deposit";
export const HOSTED_BANK_WITHDRAW_ENDPOINT = "/api/dev/actions/bank-withdraw";
// Shop purchase is also INSTANT and self-only (no order book / Market here).
export const HOSTED_SHOP_BUY_ENDPOINT = "/api/dev/actions/shop-buy";
// Orders finish after a real duration (in round ticks) but only apply when the
// player visits the matching screen; the visit calls this endpoint.
export const HOSTED_COMPLETE_DUE_ENDPOINT = "/api/dev/actions/complete-due";
// Seven research fields with the reference labels (src/App.jsx scienceLabel).
export const HOSTED_SCIENCE_FIELDS = ["agriculture", "combat", "crime", "housing", "population", "banking", "turrets"];
export const HOSTED_SCIENCE_LABELS = {
  agriculture: "Agriculture",
  combat: "Combat",
  crime: "Crime",
  housing: "Housing",
  population: "Population",
  banking: "Banking",
  turrets: "Turrets",
};
export function hostedScienceLabel(field) { return HOSTED_SCIENCE_LABELS[field] || String(field || ""); }
export const HOSTED_BUILDING_ORDER = ["living_area", "factory", "barracks", "bank", "science_labs", "nutrition_suppliers", "water_purifiers", "power_plants"];
export const HOSTED_BUILDING_LABELS = {
  living_area: "Living Area",
  factory: "Factory",
  barracks: "Barracks",
  bank: "Bank",
  science_labs: "Science Lab",
  nutrition_suppliers: "Nutrition Supplier",
  water_purifiers: "Water Purifier",
  power_plants: "Power Plant",
};
export function hostedBuildingLabel(key) { return HOSTED_BUILDING_LABELS[key] || String(key || "").replace(/_/g, " "); }

async function requestJson(url, { method = "GET", headers, body, timeoutMs = 12_000 } = {}) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller?.signal,
    });
    const text = await response.text();
    let result = {};
    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        result = { raw: text };
      }
    }
    return { response, result };
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export function fetchGameServiceHealth() {
  return requestJson(`${GAME_SERVICE_URL}/health`, { method: "GET", headers: { "Accept": "application/json" } });
}
export function fetchDevRoundSummary(roundKey) {
  return requestJson(`${GAME_SERVICE_URL}/api/dev/round-summary?roundKey=${encodeURIComponent(roundKey)}`, { method: "GET", headers: { "Accept": "application/json" } });
}
export function postHostedRoundEnter(requestBody) {
  return requestJson(`${GAME_SERVICE_URL}/api/dev/hosted-round/enter`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: requestBody });
}
export function postResolvePlayerIdentity(requestBody) {
  return requestJson(`${GAME_SERVICE_URL}/api/dev/identity/resolve-player`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: requestBody });
}
export function postDevAction(endpointPath, requestBody) {
  return requestJson(`${GAME_SERVICE_URL}${endpointPath}`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: requestBody });
}
export function postInviteTokenRedeem(payload) {
  return requestJson(`${INVITE_TOKEN_SERVICE_URL}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
}

export function makeInviteTokenClientNonce() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
export function inviteTokenFailureMessage(code) {
  switch (code) {
    case "empty_token":
      return "Enter an invite token first.";
    case "token_invalid":
      return "This invite token was not recognised.";
    case "token_claimed":
      return "This invite token has already been claimed.";
    case "token_revoked":
      return "This invite token is no longer active.";
    case "token_expired":
      return "This invite token is no longer active.";
    case "build_not_allowed":
      return "This invite token is not available for this build.";
    case "rate_limited":
      return "Too many invite redemption attempts. Please try again later.";
    case "service_unavailable":
      return "The invite service could not be reached. Please try again later.";
    default:
      return "The invite token could not be redeemed.";
  }
}
export function maskStableIdentifier(value, prefixLength = 6, suffixLength = 4) {
  const text = cleanSingleLineText(String(value || "").trim(), 256);
  if (!text) return "";
  if (text.length <= prefixLength + suffixLength + 1) return text;
  return `${text.slice(0, prefixLength)}…${text.slice(-suffixLength)}`;
}
export function hostedGameServiceFailureMessage() {
  return "Could not reach the hosted game service. Check the DEV game-service health endpoint.";
}
export function multiplayerPreviewFailureMessage(status, errorCode) {
  if (errorCode === "dev_endpoints_disabled") return "Shared multiplayer DEV preview is currently disabled.";
  if (errorCode === "round_not_found") return "Shared Multiplayer DEV round has not been seeded yet.";
  if (status >= 500 || errorCode === "supabase_not_configured" || errorCode === "service_unavailable") {
    return hostedGameServiceFailureMessage();
  }
  return "Shared multiplayer preview could not be loaded.";
}

export function multiplayerIdentityFailureMessage(status, errorCode) {
  if (errorCode === "dev_endpoints_disabled") return "Shared multiplayer identity resolution is currently disabled.";
  if (errorCode === "identity_not_provided") return "Your tester access exists, but no invite grant was available. Reset tester access and redeem a real invite token.";
  if (errorCode === "grant_not_found") return "No multiplayer access link exists for this grant. Resolve identity again after redeeming a fresh invite token.";
  if (errorCode === "invite_grant_not_found") return "This invite grant was not found in the token ledger. Redeem a fresh valid invite token.";
  if (errorCode === "invite_grant_not_active") return "This invite grant exists but is not active. Create or redeem a fresh unused invite token.";
  if (errorCode === "player_not_found") return "The player linked to that access grant was not found.";
  if (errorCode === "round_not_found") return "Shared Multiplayer DEV round has not been seeded yet.";
  if (status >= 500 || errorCode === "supabase_not_configured" || errorCode === "service_unavailable") {
    return hostedGameServiceFailureMessage();
  }
  return hostedGameServiceFailureMessage();
}

export function multiplayerDevActionFailureMessage(status, errorCode, playerLabel = "the selected player") {
  if (errorCode === "dev_endpoints_disabled") return "Shared multiplayer DEV actions are currently disabled.";
  if (errorCode === "identity_not_provided") return "Your tester access exists, but no invite grant was available. Reset tester access and redeem a real invite token.";
  if (errorCode === "grant_not_found") return "No multiplayer access link exists for this grant. Resolve identity again after redeeming a fresh invite token.";
  if (errorCode === "invite_grant_not_found") return "This invite grant was not found in the token ledger. Redeem a fresh valid invite token.";
  if (errorCode === "invite_grant_not_active") return "This invite grant exists but is not active. Create or redeem a fresh unused invite token.";
  if (errorCode === "invalid_amount") return "Factory build amount must be an integer between 1 and 10.";
  if (errorCode === "invalid_building_key") return "The hosted game service rejected that building type.";
  if (errorCode === "insufficient_funds") return "Not enough money for that order.";
  if (errorCode === "invalid_unit_slot") return "That unit slot is not valid.";
  if (errorCode === "train_cap_exceeded") return "That training order exceeds the per-order cap for your species.";
  if (errorCode === "invalid_screen") return "That completion screen is not supported by the hosted game service.";
  if (errorCode === "queue_train_units_failed") return "The training order could not be queued.";
  if (errorCode === "invalid_hours") return "Enter a whole number of explore hours.";
  if (errorCode === "invalid_spend") return "Enter how much money to spend on exploring.";
  if (errorCode === "explore_gain_exceeds_land") return "Explore rejected: the estimated return would exceed your existing land.";
  if (errorCode === "queue_explore_failed") return "The exploration could not be queued.";
  if (errorCode === "invalid_science_field") return "That research field is not valid.";
  if (errorCode === "no_science_labs") return "You have no completed Science Labs.";
  if (errorCode === "research_already_running") return "A research order for that field is already running.";
  if (errorCode === "queue_science_failed") return "The research order could not be queued.";
  if (errorCode === "no_banks") return "You have no completed Banks.";
  if (errorCode === "banks_full") return "Your banks are full.";
  if (errorCode === "no_banked_funds") return "You have no banked money to withdraw.";
  if (errorCode === "bank_deposit_failed") return "The deposit could not be completed.";
  if (errorCode === "bank_withdraw_failed") return "The withdrawal could not be completed.";
  if (errorCode === "item_not_sold") return "That item is not sold in the shop.";
  if (errorCode === "shop_buy_failed") return "The shop purchase could not be completed.";
  if (errorCode === "complete_due_failed") return "Finished orders could not be completed.";
  if (errorCode === "round_not_found") return "Shared Multiplayer DEV round has not been seeded yet.";
  if (errorCode === "player_not_found") return `${playerLabel} was not found in the shared round.`;
  if (errorCode === "player_not_joined") return `${playerLabel} is not joined to the shared round.`;
  if (errorCode === "tick_in_progress") return "A manual DEV tick is already running.";
  if (errorCode === "queue_build_factory_failed") return "The factory order could not be queued.";
  if (errorCode === "manual_tick_failed") return "The manual DEV tick could not be completed.";
  if (errorCode === "build_factory_failed") return "The legacy immediate proof could not be completed.";
  if (errorCode === "reset_proof_round_failed") return "The DEV proof state could not be reset.";
  if (status >= 500 || errorCode === "supabase_not_configured" || errorCode === "service_unavailable") {
    return hostedGameServiceFailureMessage();
  }
  return hostedGameServiceFailureMessage();
}

export function hostedRoundFailureMessage(status, errorCode) {
  if (errorCode === "dev_endpoints_disabled") return "Hosted DEV round entry is currently disabled.";
  if (errorCode === "identity_not_provided") return "Redeem a real invite token before entering a hosted round.";
  if (errorCode === "round_not_found") return "Shared Multiplayer DEV round has not been seeded yet.";
  if (errorCode === "invite_grant_not_found") return "This invite grant was not found in the token ledger. Redeem a fresh valid invite token.";
  if (errorCode === "invite_grant_not_active") return "This invite grant exists but is not active. Create or redeem a fresh unused invite token.";
  if (errorCode === "player_not_found") return "The hosted player linked to that grant was not found.";
  if (status >= 500 || errorCode === "supabase_not_configured" || errorCode === "service_unavailable") {
    return hostedGameServiceFailureMessage();
  }
  return "Hosted DEV round state could not be loaded.";
}
