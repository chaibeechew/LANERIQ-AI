import { createHash } from "node:crypto";

export const CONTROL_TOWER_EVIDENCE_KINDS = Object.freeze([
  "github_pr",
  "github_ci",
  "vercel_deployment",
  "supabase_migration",
  "benchmark",
  "security",
  "screenshot",
  "manual",
]);

const KIND_SET = new Set(CONTROL_TOWER_EVIDENCE_KINDS);
const SECRET_KEY = /(?:token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key|service[_-]?role)/i;

function text(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeValue(value, depth = 0) {
  if (depth > 5) return "[max-depth]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return String(value).slice(0, 1000);

  const out = {};
  for (const [key, entry] of Object.entries(value).slice(0, 100)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : sanitizeValue(entry, depth + 1);
  }
  return out;
}

export function sanitizeControlTowerEvidenceSnapshot(snapshot) {
  return sanitizeValue(snapshot && typeof snapshot === "object" ? snapshot : {});
}

export function validateControlTowerEvidenceInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const releaseId = text(source.releaseId, 80);
  const kind = text(source.kind, 40).toLowerCase();
  const title = text(source.title, 240);
  const summary = text(source.summary, 4000);
  const externalRef = text(source.externalRef, 1000) || null;

  if (!releaseId) return { ok: false, error: "Release is required." };
  if (!KIND_SET.has(kind)) return { ok: false, error: "Invalid evidence kind." };
  if (!title) return { ok: false, error: "Evidence title is required." };

  const snapshot = sanitizeControlTowerEvidenceSnapshot(source.snapshot);
  const capturedAt = new Date().toISOString();
  const canonical = JSON.stringify({ releaseId, kind, title, externalRef, snapshot });
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
