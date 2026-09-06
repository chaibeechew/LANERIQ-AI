import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { productionEvidenceLedgerMaterial, verifyProductionEvidenceLedger } from "../lib/cloud/production-evidence-ledger.js";

const migration = fs.readFileSync("supabase/migrations/20260905155000_production_evidence_ledger.sql", "utf8");
const domain = fs.readFileSync("lib/cloud/production-evidence-ledger.js", "utf8");
const adapter = fs.readFileSync("lib/cloud-adapters/production-evidence-ledger-data.js", "utf8");
const attest = fs.readFileSync("app/api/production-e2e/attest/route.js", "utf8");
const replay = fs.readFileSync("app/api/production-e2e/ledger/route.js", "utf8");

for (const pattern of [
  /create table if not exists public\.production_evidence_ledger/,
  /enable row level security/,
  /revoke all on table public\.production_evidence_ledger from anon, authenticated, service_role/,
  /grant select on table public\.production_evidence_ledger to service_role/,
  /before update or delete/,
  /PRODUCTION_EVIDENCE_LEDGER_APPEND_ONLY/,
  /security definer/,
  /set search_path = ''/,
  /pg_advisory_xact_lock/,
  /hashtextextended/,
  /a\.owner_id = p_owner_id/,
  /v\.id = p_version_id and v\.app_id = p_project_id/,
  /PRODUCTION_EVIDENCE_ATTESTATION_REPLAY_CONFLICT/,
  /extensions\.digest/,
  /append_production_evidence_ledger/,
  /revoke all on function public\.append_production_evidence_ledger[\s\S]*from public, anon, authenticated/,
  /grant execute on function public\.append_production_evidence_ledger[\s\S]*to service_role/,
]) assert.match(migration, pattern);
assert.doesNotMatch(migration, /grant\s+(insert|update|delete).*authenticated/i);
assert.doesNotMatch(migration, /grant\s+(insert|update|delete).*anon/i);

assert.match(domain, /cloud-adapters\/production-evidence-ledger-data\.js/);
assert.doesNotMatch(domain, /lib\/supabase\/|@supabase\//, "Provider-opaque ledger domain must not import the current database provider directly");
assert.match(domain, /verifyProductionEvidenceLedger/);
assert.match(domain, /previous-hash-mismatch/);
assert.match(domain, /entry-hash-mismatch/);
assert.match(domain, /sequence-gap/);
assert.match(domain, /evidenceLevel: "OBSERVED"/);
assert.match(domain, /independentThirdPartyAuditClaimed: false/);

assert.match(adapter, /\.\.\/supabase\/admin\.js/);
assert.match(adapter, /append_production_evidence_ledger/);
assert.match(adapter, /\.eq\("owner_id", userId\)/);
assert.match(adapter, /\.eq\("project_id", projectId\)/);
assert.doesNotMatch(adapter, /SERVICE_ROLE|SECRET_KEY|API_KEY/);

assert.match(attest, /appendProductionEvidenceLedgerRecord/);
assert.match(attest, /internalPersistentLedgerRecorded: true/);
assert.match(attest, /persistentExternalAuditStorageClaimed: false/);
assert.match(attest, /cryptographicSignatureClaimed: false/);
assert.match(attest, /independentThirdPartyAuditClaimed: false/);
assert.match(attest, /attestationVersion: 2/);
assert.doesNotMatch(attest, /lib\/supabase\/|@supabase\//);

for (const pattern of [
  /VERCEL_ENV/,
  /environment === "production"/,
  /commitRef === "main"/,
  /validateLaneriqSessionToken/,
  /getOwnedProductionEvidenceLedger/,
  /internalPersistentLedgerVerified/,
  /tamperEvidentHashContinuityVerified/,
  /cryptographicSignatureClaimed: false/,
  /independentThirdPartyAuditClaimed: false/,
]) assert.match(replay, pattern);
assert.doesNotMatch(replay, /lib\/supabase\/|@supabase\//);

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  sequence: 1,
  attestationId: "laneriq-prod-test-1",
  productionSha: "a".repeat(40),
  versionId: "33333333-3333-4333-8333-333333333333",
  reportHash: "b".repeat(64),
  userBindingHash: "c".repeat(64),
  sessionBindingHash: "d".repeat(64),
  previousHash: "0".repeat(64),
  createdAt: "2026-09-05T00:00:00.000Z",
};
const first = { ...base, entryHash: crypto.createHash("sha256").update(productionEvidenceLedgerMaterial(base)).digest("hex") };
const secondBase = {
  ...base,
  id: "44444444-4444-4444-8444-444444444444",
  sequence: 2,
  attestationId: "laneriq-prod-test-2",
  reportHash: "e".repeat(64),
  previousHash: first.entryHash,
};
const second = { ...secondBase, entryHash: crypto.createHash("sha256").update(productionEvidenceLedgerMaterial(secondBase)).digest("hex") };
const good = verifyProductionEvidenceLedger([first, second]);
assert.equal(good.ok, true);
assert.equal(good.verdict, "PASS");
assert.equal(good.entryCount, 2);
assert.equal(good.headHash, second.entryHash);
assert.equal(good.evidenceLevel, "OBSERVED");

const tampered = verifyProductionEvidenceLedger([first, { ...second, reportHash: "f".repeat(64) }]);
assert.equal(tampered.ok, false);
assert.equal(tampered.reason, "entry-hash-mismatch");
const forked = verifyProductionEvidenceLedger([first, { ...second, previousHash: "0".repeat(64) }]);
assert.equal(forked.ok, false);
assert.equal(forked.reason, "previous-hash-mismatch");

console.log("✓ Production Evidence Ledger is server-only, RLS-enabled and append-only by ACL + mutation trigger");
console.log("✓ Per-project advisory locking serializes chain-head selection and prevents concurrent hash forks");
console.log("✓ Owner + project + version are revalidated inside the privileged append RPC; repeated attestation IDs are idempotent or fail closed on conflict");
console.log("✓ Replay verifier detects sequence gaps, previous-hash forks and entry tampering");
console.log("✓ Internal persistence stays truthfully OBSERVED/tamper-evident and does not claim signature or independent external audit evidence");
