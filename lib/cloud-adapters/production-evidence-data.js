import { createAdminClient } from "../supabase/admin.js";

const PROJECT_FIELDS = "id, current_version_id, published_version_id, visibility, publish_status";

function fail(code) {
  return Object.freeze({ ok: false, code });
}

function success(payload = {}) {
  return Object.freeze({ ok: true, ...payload });
}

export function createProductionEvidenceDataAdapter({ createClient = createAdminClient } = {}) {
  return Object.freeze({
    id: "production-evidence-project-adapter-v1",

    async getOwnedProjectSnapshot({ userId, projectId }) {
      try {
        const admin = createClient();
        const { data: project, error } = await admin
          .from("apps")
          .select(PROJECT_FIELDS)
          .eq("id", projectId)
          .eq("owner_id", userId)
          .single();

        if (error || !project) return fail("PROJECT_NOT_FOUND");
        return success({ project });
      } catch {
        return fail("PROJECT_EVIDENCE_UNAVAILABLE");
      }
    },
  });
}
