import { createAdminClient } from "../supabase/admin.js";

const LEDGER_FIELDS = "id, project_id, sequence_no, attestation_id, production_sha, version_id, report_hash, user_binding_hash, session_binding_hash, previous_hash, entry_hash, created_at";

function fail(code) {
  return Object.freeze({ ok: false, code });
}

function success(payload = {}) {
  return Object.freeze({ ok: true, ...payload });
}

export function createProductionEvidenceLedgerAdapter({ createClient = createAdminClient } = {}) {
  return Object.freeze({
    id: "production-evidence-ledger-adapter-v1",

    async appendOwnedRecord(input) {
      try {
        const admin = createClient();
        const { data, error } = await admin.rpc("append_production_evidence_ledger", {
          p_owner_id: input.userId,
          p_project_id: input.projectId,
          p_attestation_id: input.attestationId,
          p_production_sha: input.productionSha,
          p_version_id: input.versionId,
          p_report_hash: input.reportHash,
          p_user_binding_hash: input.userBindingHash,
          p_session_binding_hash: input.sessionBindingHash,
        });
        const receipt = Array.isArray(data) ? data[0] : data;
        if (error || !receipt?.ledger_id || !receipt?.ledger_entry_hash) return fail("PRODUCTION_EVIDENCE_LEDGER_APPEND_FAILED");
        return success({ receipt });
      } catch {
        return fail("PRODUCTION_EVIDENCE_LEDGER_UNAVAILABLE");
      }
    },

    async listOwnedChain({ userId, projectId }) {
      try {
        const admin = createClient();
        const { data: project, error: projectError } = await admin
          .from("apps")
          .select("id")
          .eq("id", projectId)
          .eq("owner_id", userId)
          .single();
        if (projectError || !project?.id) return fail("PROJECT_NOT_FOUND");

        const { data, error } = await admin
          .from("production_evidence_ledger")
          .select(LEDGER_FIELDS)
          .eq("project_id", projectId)
          .order("sequence_no", { ascending: true });
        if (error) return fail("PRODUCTION_EVIDENCE_LEDGER_UNAVAILABLE");
        return success({ entries: Array.isArray(data) ? data : [] });
      } catch {
        return fail("PRODUCTION_EVIDENCE_LEDGER_UNAVAILABLE");
      }
    },
  });
}
