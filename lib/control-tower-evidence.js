import { createHash } from "node:crypto";
import { isControlTowerUuid } from "./control-tower-validation.js";

export const CONTROL_TOWER_EVIDENCE_KINDS = Object.freeze([
  "github_pr",
  "github_ci",
  "vercel_deployment",
  "supabase_migration",
  "benchmark",
  "security",
  "screenshot",
  "manual",
  "backup_restore",
  "chaos_drill",
  "supply_chain",
  "observability",
  "capacity",
  "incident",
  "release_snapshot",
  "production_truth",
  "audit_integrity",
]);

const KIND_SET = new Set(CONTROL_TOWER_EVIDENCE_KINDS);
const SECRET_KEY = /(?:token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key|service[_-]?role|session|credential)/i;
const MAX_SNAPSHOT_BYTES = 64 * 1024;

function text(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeValue(value, depth = 0) {
  if (depth > 6) return "[max-depth]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object" || !value) return String(value ?? "").slice(0, 1000);

  const out = {};
  for (const [rawKey, entry] of Object.entries(value).slice(0, 100)) {
    const key = text(rawKey, 120);
    if (!key) continue;
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : sanitizeValue(entry, depth + 1);
  }
  return out;
}

export function sanitizeControlTowerEvidenceSnapshot(snapshot) {
  return sanitizeValue(snapshot && typeof snapshot === "object" ? snapshot : {});
}

export function validateControlTowerEvidenceInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = text(source.releaseId, 80).toLowerCase();
  const kind = text(source.kind, 40).toLowerCase();
  const title = text(source.title, 240);
  const summary = text(source.summary, 4000);
  const externalRef = text(source.externalRef, 500) || null;

  if (!isControlTowerUuid(releaseId)) return { ok: false, error: "A valid release id is required." };
  if (!KIND_SET.has(kind)) return { ok: false, error: "Invalid evidence kind." };
  if (!title) return { ok: false, error: "Evidence title is required." };

  const snapshot = sanitizeControlTowerEvidenceSnapshot(source.snapshot);
  const serializedSnapshot = JSON.stringify(snapshot);
  if (Buffer.byteLength(serializedSnapshot, "utf8") > MAX_SNAPSHOT_BYTES) {
    return { ok: false, error: "Evidence snapshot exceeds the 64 KB sanitized limit." };
  }

  const capturedAt = new Date().toISOString();
  const canonical = JSON.stringify({ releaseId, kind, externalRef, snapshot });
  const fingerprint = createHash("sha256").update(canonical).digest("hex");

  return {
    ok: true,
    value: {
      release_id: releaseId,
      item_type: "evidence",
      title,
      description: summary || null,
      stage: "verification",
      priority: "p2",
      external_ref: externalRef,
      metadata: {
        kind,
        fingerprint,
        captured_at: capturedAt,
        snapshot,
      },
    },
  };
}
