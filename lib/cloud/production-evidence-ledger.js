import crypto from "node:crypto";
import { createProductionEvidenceLedgerAdapter } from "../cloud-adapters/production-evidence-ledger-data.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const SHA40 = /^[0-9a-f]{40}$/;
const ATTESTATION_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const ZERO_HASH = "0".repeat(64);

function clean(value, max = 200) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function normalizedRow(row) {
  return Object.freeze({
    id: clean(row?.id ?? row?.ledger_id, 80),
    projectId: clean(row?.project_id ?? row?.projectId, 80),
    sequence: Number(row?.sequence_no ?? row?.ledger_sequence ?? row?.sequence),
    attestationId: clean(row?.attestation_id ?? row?.attestationId, 160),
    productionSha: clean(row?.production_sha ?? row?.productionSha, 40).toLowerCase(),
    versionId: clean(row?.version_id ?? row?.versionId, 80),
    reportHash: clean(row?.report_hash ?? row?.reportHash, 64).toLowerCase(),
    userBindingHash: clean(row?.user_binding_hash ?? row?.userBindingHash, 64).toLowerCase(),
    sessionBindingHash: clean(row?.session_binding_hash ?? row?.sessionBindingHash, 64).toLowerCase(),
    previousHash: clean(row?.previous_hash ?? row?.ledger_previous_hash ?? row?.previousHash, 64).toLowerCase(),
    entryHash: clean(row?.entry_hash ?? row?.ledger_entry_hash ?? row?.entryHash, 64).toLowerCase(),
    createdAt: clean(row?.created_at ?? row?.ledger_created_at ?? row?.createdAt, 50) || null,
  });
}

export function productionEvidenceLedgerMaterial(input) {
  const row = normalizedRow(input);
  return [
    "laneriq-production-evidence-ledger-v1",
    row.projectId,
    String(row.sequence),
    row.previousHash,
    row.attestationId,
    row.productionSha,
    row.versionId,
    row.reportHash,
    row.userBindingHash,
    row.sessionBindingHash,
  ].join("\n");
}

export function verifyProductionEvidenceLedger(entries = []) {
  const rows = (Array.isArray(entries) ? entries : []).map(normalizedRow);
  if (!rows.length) return Object.freeze({ ok: false, verdict: "EVIDENCE_REQUIRED", reason: "no-evidence", entryCount: 0, headHash: ZERO_HASH });

  let previous = ZERO_HASH;
  let projectId = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const expectedSequence = index + 1;
    if (!UUID.test(row.projectId) || !UUID.test(row.versionId) || !ATTESTATION_ID.test(row.attestationId)) {
      return Object.freeze({ ok: false, verdict: "FAIL", reason: "identity-invalid", sequence: row.sequence || expectedSequence });
    }
    if (!SHA40.test(row.productionSha) || !SHA256.test(row.reportHash) || !SHA256.test(row.userBindingHash) || !SHA256.test(row.sessionBindingHash)) {
      return Object.freeze({ ok: false, verdict: "FAIL", reason: "digest-invalid", sequence: row.sequence || expectedSequence });
    }
    if (!Number.isSafeInteger(row.sequence) || row.sequence !== expectedSequence) {
      return Object.freeze({ ok: false, verdict: "FAIL", reason: "sequence-gap", sequence: row.sequence, expectedSequence });
    }
    if (projectId && row.projectId !== projectId) {
      return Object.freeze({ ok: false, verdict: "FAIL", reason: "project-chain-mixed", sequence: row.sequence });
    }
    projectId ||= row.projectId;
    if (row.previousHash !== previous) {
      return Object.freeze({ ok: false, verdict: "FAIL", reason: "previous-hash-mismatch", sequence: row.sequence, expectedPreviousHash: previous });
    }
    const expectedHash = sha256(productionEvidenceLedgerMaterial(row));
    if (row.entryHash !== expectedHash) {
      return Object.freeze({ ok: false, verdict: "FAIL", reason: "entry-hash-mismatch", sequence: row.sequence, expectedHash });
    }
    previous = row.entryHash;
  }

  return Object.freeze({
    ok: true,
    verdict: "PASS",
    chainVersion: 1,
    projectId,
    entryCount: rows.length,
    headHash: previous,
    appendOnly: true,
    evidenceLevel: "OBSERVED",
    truthBoundary: Object.freeze({
      internalPersistentLedgerVerified: true,
      tamperEvidentHashContinuityVerified: true,
      cryptographicSignatureClaimed: false,
      independentThirdPartyAuditClaimed: false,
    }),
  });
}

function validAppendInput(input) {
  return UUID.test(clean(input?.userId, 80)) &&
    UUID.test(clean(input?.projectId, 80)) &&
    UUID.test(clean(input?.versionId, 80)) &&
    ATTESTATION_ID.test(clean(input?.attestationId, 160)) &&
    SHA40.test(clean(input?.productionSha, 40).toLowerCase()) &&
    SHA256.test(clean(input?.reportHash, 64).toLowerCase()) &&
    SHA256.test(clean(input?.userBindingHash, 64).toLowerCase()) &&
    SHA256.test(clean(input?.sessionBindingHash, 64).toLowerCase());
}

export async function appendProductionEvidenceLedgerRecord(input = {}) {
  if (!validAppendInput(input)) return Object.freeze({ ok: false, code: "PRODUCTION_EVIDENCE_LEDGER_INPUT_INVALID" });
  const adapter = createProductionEvidenceLedgerAdapter();
  const result = await adapter.appendOwnedRecord(input);
  if (!result?.ok) return Object.freeze({ ok: false, code: result?.code || "PRODUCTION_EVIDENCE_LEDGER_UNAVAILABLE" });
  return Object.freeze({ ok: true, receipt: normalizedRow({
    ...result.receipt,
    project_id: input.projectId,
    attestation_id: input.attestationId,
    production_sha: input.productionSha,
    version_id: input.versionId,
    report_hash: input.reportHash,
    user_binding_hash: input.userBindingHash,
    session_binding_hash: input.sessionBindingHash,
  }) });
}

export async function getOwnedProductionEvidenceLedger({ userId, projectId } = {}) {
  if (!UUID.test(clean(userId, 80)) || !UUID.test(clean(projectId, 80))) {
    return Object.freeze({ ok: false, code: "PROJECT_NOT_FOUND" });
  }
  const adapter = createProductionEvidenceLedgerAdapter();
  const result = await adapter.listOwnedChain({ userId, projectId });
  if (!result?.ok) return Object.freeze({ ok: false, code: result?.code || "PRODUCTION_EVIDENCE_LEDGER_UNAVAILABLE" });
  const entries = Object.freeze((result.entries || []).map(normalizedRow));
  return Object.freeze({ ok: true, entries, verification: verifyProductionEvidenceLedger(entries) });
}
