// Browser-local persistence seam, extracted from App.jsx as-is.
// Everything that reads or writes localStorage for the local prototype save,
// round slots and the tester-access record lives here. During the server-authority
// migration this module stays the boundary for local-prototype state; hosted
// canonical state never flows through it.
import { SAVE_KEY, ROUND_SLOT_INDEX_KEY, roundSlotSaveKey } from "./roundSlots.js";
import { cleanSingleLineText } from "./gameMath.js";

export const TESTER_ACCESS_KEY = "antrophaiTesterAccessAccepted";
export const TESTER_ACCESS_ALLOWLIST = {
  "geddes-test": "geddes-test",
  "proteus-test": "proteus-test",
  "picket-test": "picket-test",
};

export function safeParseSave(raw) { try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
export function safeLoadStorageKey(storageKey = SAVE_KEY) { try { if (typeof window === "undefined") return null; return safeParseSave(window.localStorage.getItem(storageKey)); } catch { return null; } }
export function safeLoadSave() { return safeLoadStorageKey(SAVE_KEY); }
export function safeWriteStorageKey(storageKey, payload) { try { if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify(payload)); } catch {} }
export function safeWriteSave(payload) { safeWriteStorageKey(SAVE_KEY, payload); }
export function safeDeleteStorageKey(storageKey) { try { if (typeof window !== "undefined") window.localStorage.removeItem(storageKey); } catch {} }
export function safeLoadRoundSlot(slotKey) { return safeLoadStorageKey(roundSlotSaveKey(slotKey)); }
export function safeWriteRoundSlot(slotKey, payload) { if (!slotKey) return; safeWriteStorageKey(roundSlotSaveKey(slotKey), payload); }
export function safeReadRoundSlotIndex() { const index = safeLoadStorageKey(ROUND_SLOT_INDEX_KEY); return Array.isArray(index) ? index : []; }
export function safeWriteRoundSlotIndex(index = []) { safeWriteStorageKey(ROUND_SLOT_INDEX_KEY, Array.isArray(index) ? index : []); }
export function upsertRoundSlotIndexEntry(index = [], entry = {}) { const key = entry.slotKey; if (!key) return Array.isArray(index) ? index : []; const without = (Array.isArray(index) ? index : []).filter((item) => item?.slotKey !== key); return [{ ...entry, savedAt: entry.savedAt || Date.now() }, ...without].slice(0, 20); }
export function safeDeleteRoundSlot(slotKey) { try { if (typeof window !== "undefined") window.localStorage.removeItem(roundSlotSaveKey(slotKey)); } catch {} }
export function normaliseAccessGrant(value) {
  if (!value || typeof value !== "object") return null;
  const grantId = cleanSingleLineText(String(value.grantId || value.currentGrantId || "").trim(), 128);
  if (!grantId) return null;
  const currentGrantId = cleanSingleLineText(String(value.currentGrantId || grantId).trim(), 128) || grantId;
  const tokenId = cleanSingleLineText(String(value.tokenId || "").trim(), 128) || null;
  const testerLabel = cleanSingleLineText(String(value.testerLabel || "").trim(), 128) || null;
  const tokenHashPrefix = cleanSingleLineText(String(value.tokenHashPrefix || "").trim(), 32) || null;
  const issuedAt = cleanSingleLineText(String(value.issuedAt || "").trim(), 64) || null;
  const expiresAt = cleanSingleLineText(String(value.expiresAt || "").trim(), 64) || null;
  const lastRevalidatedAt = cleanSingleLineText(String(value.lastRevalidatedAt || "").trim(), 64) || null;
  return {
    grantId,
    currentGrantId,
    tokenId,
    testerLabel,
    tokenHashPrefix,
    issuedAt,
    expiresAt,
    lastRevalidatedAt,
    accessMode: "invite-token",
  };
}
export function normaliseTesterAccessRecord(value) {
  if (!value || typeof value !== "object" || !value.accepted) return null;
  const codeLabel = typeof value.codeLabel === "string" && value.codeLabel.trim() ? value.codeLabel.trim() : null;
  const acceptedAt = Number(value.acceptedAt || 0);
  const accessGrant = normaliseAccessGrant(value.accessGrant);
  const accessMode = value.accessMode === "invite-token" || Boolean(accessGrant) ? "invite-token" : "development-fallback";
  const testerLabel = typeof value.testerLabel === "string" && value.testerLabel.trim()
    ? cleanSingleLineText(value.testerLabel.trim(), 128)
    : accessGrant?.testerLabel || null;
  return {
    accepted: true,
    accessMode,
    codeLabel,
    testerLabel,
    acceptedAt: Number.isFinite(acceptedAt) && acceptedAt > 0 ? acceptedAt : null,
    accessGrant,
  };
}
export function safeLoadTesterAccess() { return normaliseTesterAccessRecord(safeLoadStorageKey(TESTER_ACCESS_KEY)); }
export function safeWriteTesterAccess(payload) { safeWriteStorageKey(TESTER_ACCESS_KEY, payload); }
export function safeClearTesterAccess() { try { if (typeof window !== "undefined") window.localStorage.removeItem(TESTER_ACCESS_KEY); } catch {} }
export function testerAccessRecordForCode(code) {
  const entered = String(code || "").trim().toLowerCase();
  const codeLabel = TESTER_ACCESS_ALLOWLIST[entered];
  if (!codeLabel) return null;
  return { accepted: true, accessMode: "development-fallback", codeLabel, testerLabel: null, acceptedAt: Date.now(), accessGrant: null };
}
export function testerAccessModeLabel(record) {
  if (!record?.accepted) return "";
  if (record.accessMode === "invite-token") {
    const testerLabel = record.testerLabel || record.accessGrant?.testerLabel || "";
    return testerLabel ? `Access: invite token | Tester: ${testerLabel}` : "Access: invite token";
  }
  return "Access: development fallback";
}
