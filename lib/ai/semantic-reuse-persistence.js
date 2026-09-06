import crypto from "node:crypto";
import { createAdminClient } from "../supabase/admin.js";
import { buildReuseFingerprint } from "./semantic-reuse-network.js";

export const SEMANTIC_REUSE_PERSISTENCE_VERSION = "2026-09-05.1";
export const SEMANTIC_REUSE_PERSISTENCE_TABLE = "laneriq_semantic_cache";
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULT_CHARS = 500_000;

const runtime = globalThis.__LANERIQ_SEMANTIC_REUSE_PERSISTENCE_V1 || {
  lookups: 0,
  hits: 0,
  misses: 0,
  storeAttempts: 0,
  stores: 0,
  errors: 0,
  disabled: 0,
};
globalThis.__LANERIQ_SEMANTIC_REUSE_PERSISTENCE_V1 = runtime;

function sha(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function scopeHash(scope) {
  const clean = String(scope || "").trim();
  return clean ? sha(`scope:${clean}`) : "";
}

function normalizePurpose(value) {
  return String(value || "general").trim().toLowerCase().replace(/[^a-z0-9._:-]/g, "-").slice(0, 80) || "general";
}

function normalizeReuseClass(value) {
  return String(value || "private_result").trim().toLowerCase() === "blueprint" ? "blueprint" : "private_result";
}

function clampTtlMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_TTL_MS;
  return Math.max(30_000, Math.min(MAX_TTL_MS, Math.floor(number)));
}

export function semanticReusePersistenceEnabled(env = process.env) {
  const mode = String(env.LANERIQ_SEMANTIC_CACHE_PERSISTENCE || "auto").trim().toLowerCase();
  if (["0", "false", "off", "disabled"].includes(mode)) return false;
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return Boolean(url && key);
}

export function buildPersistentReuseKey({ scope, purpose = "general", keyMaterial, variant = "" } = {}) {
  const scopeId = scopeHash(scope);
  const rawKey = String(keyMaterial || "").trim();
  if (!scopeId || !rawKey) return Object.freeze({ valid: false, reason: "scope_or_key_required" });
  const normalizedPurpose = normalizePurpose(purpose);
  const fingerprint = buildReuseFingerprint({ keyMaterial: rawKey, variant, purpose: normalizedPurpose });
  return Object.freeze({
    valid: true,
    scopeHash: scopeId,
    purpose: normalizedPurpose,
    exactHash: fingerprint.exact,
  });
}

function persistenceMiss(reason, extra = {}) {
  runtime.misses += 1;
  return Object.freeze({ hit: false, exact: false, approximate: false, persistence: true, reason, ...extra });
}

export async function lookupPersistentSemanticReuse({
  scope,
  purpose = "general",
  keyMaterial,
  variant = "",
  env = process.env,
} = {}) {
  runtime.lookups += 1;
  const key = buildPersistentReuseKey({ scope, purpose, keyMaterial, variant });
  if (!key.valid) return persistenceMiss(key.reason);
  if (!semanticReusePersistenceEnabled(env)) {
    runtime.disabled += 1;
    return persistenceMiss("persistence_disabled");
  }

  try {
    const client = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from(SEMANTIC_REUSE_PERSISTENCE_TABLE)
      .select("result,reuse_class,created_at,expires_at")
      .eq("scope_hash", key.scopeHash)
      .eq("purpose", key.purpose)
      .eq("exact_hash", key.exactHash)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (error) {
      runtime.errors += 1;
      return persistenceMiss("persistence_lookup_error", { errorCode: String(error.code || "unknown").slice(0, 64) });
    }
    if (!data || typeof data.result !== "string" || !data.result) return persistenceMiss("persistent_miss");

    runtime.hits += 1;
    const createdAtMs = Date.parse(data.created_at || "");
    const expiresAtMs = Date.parse(data.expires_at || "");
    return Object.freeze({
      hit: true,
      exact: true,
      approximate: false,
      persistence: true,
      source: "persistent",
      result: data.result,
      reuseClass: normalizeReuseClass(data.reuse_class),
      ageMs: Number.isFinite(createdAtMs) ? Math.max(0, Date.now() - createdAtMs) : null,
      expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
    });
  } catch (error) {
    runtime.errors += 1;
    return persistenceMiss("persistence_lookup_exception", { errorCode: String(error?.code || error?.name || "exception").slice(0, 64) });
  }
}

export async function storePersistentSemanticReuse({
  scope,
  purpose = "general",
  keyMaterial,
  variant = "",
  reuseClass = "private_result",
  result,
  ttlMs,
  env = process.env,
} = {}) {
  runtime.storeAttempts += 1;
  const key = buildPersistentReuseKey({ scope, purpose, keyMaterial, variant });
  const text = typeof result === "string" ? result : "";
  if (!key.valid || !text || text.length > MAX_RESULT_CHARS) {
    return Object.freeze({ stored: false, persistence: true, reason: "unsafe_or_oversized" });
  }
  if (!semanticReusePersistenceEnabled(env)) {
    runtime.disabled += 1;
    return Object.freeze({ stored: false, persistence: true, reason: "persistence_disabled" });
  }

  const now = Date.now();
  const expiresAtMs = now + clampTtlMs(ttlMs);
  try {
    const client = createAdminClient();
    const { error } = await client
      .from(SEMANTIC_REUSE_PERSISTENCE_TABLE)
      .upsert({
        scope_hash: key.scopeHash,
        purpose: key.purpose,
        exact_hash: key.exactHash,
        reuse_class: normalizeReuseClass(reuseClass),
        result: text,
        created_at: new Date(now).toISOString(),
        last_accessed_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAtMs).toISOString(),
      }, { onConflict: "scope_hash,purpose,exact_hash", ignoreDuplicates: false });

    if (error) {
      runtime.errors += 1;
      return Object.freeze({ stored: false, persistence: true, reason: "persistence_store_error", errorCode: String(error.code || "unknown").slice(0, 64) });
    }
    runtime.stores += 1;
    return Object.freeze({ stored: true, persistence: true, expiresAt: expiresAtMs });
  } catch (error) {
    runtime.errors += 1;
    return Object.freeze({ stored: false, persistence: true, reason: "persistence_store_exception", errorCode: String(error?.code || error?.name || "exception").slice(0, 64) });
  }
}

export function getSemanticReusePersistenceTruth(env = process.env) {
  return Object.freeze({
    version: SEMANTIC_REUSE_PERSISTENCE_VERSION,
    configured: semanticReusePersistenceEnabled(env),
    table: SEMANTIC_REUSE_PERSISTENCE_TABLE,
    lookups: Number(runtime.lookups || 0),
    hits: Number(runtime.hits || 0),
    misses: Number(runtime.misses || 0),
    storeAttempts: Number(runtime.storeAttempts || 0),
    stores: Number(runtime.stores || 0),
    errors: Number(runtime.errors || 0),
    disabled: Number(runtime.disabled || 0),
    exactReuseOnly: true,
    rawPromptStored: false,
    scopeStoredAsHashOnly: true,
    maxTtlMs: MAX_TTL_MS,
    crossUserPrivateReuseAllowed: false,
    failOpenToExistingRouterOnPersistenceError: true,
    evidenceBoundary: "Persistent reuse stores only hashed scope/fingerprint plus bounded output and TTL. A cache failure is a miss; it never authorizes paid inference or cross-user reuse.",
  });
}
