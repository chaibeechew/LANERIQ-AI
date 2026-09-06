import { createClient as createProviderClient } from "../supabase/server.js";
import { createAdminClient as createProviderAdminClient } from "../supabase/admin.js";
import { getAppBuilderAccess } from "../app-builder-access.js";

function fail(code, detail = null) {
  return Object.freeze({ ok: false, code, detail });
}
function success(payload = {}) {
  return Object.freeze({ ok: true, ...payload });
}
function verified(user) {
  return Boolean(user?.confirmed_at || user?.email_confirmed_at || user?.phone_confirmed_at);
}
function sessionRow(row) {
  if (!row) return null;
  return Object.freeze({
    request_id: row.request_id,
    status: row.status || "reserved",
    provider_ticket_id: row.provider_ticket_id || null,
    match_id: row.match_id || null,
    region: row.region || null,
    provider_claim_token: row.provider_claim_token || null,
    provider_claimed_at: row.provider_claimed_at || null,
  });
}

export function createGameMultiplayerDataAdapter({
  createClient = createProviderClient,
  createAdminClient = createProviderAdminClient,
} = {}) {
  async function resolveContext({ appId }) {
    const client = await createClient();
    const { data: { user } = {}, error: userError } = await client.auth.getUser();
    if (userError || !user?.id) return fail("AUTHENTICATION_REQUIRED");
    if (!verified(user)) return fail("ACCOUNT_VERIFICATION_REQUIRED");
    const builderAccess = await getAppBuilderAccess(client, user.id);
    if (!builderAccess?.professional?.active) return fail("PRO_GAME_CREATOR_REQUIRED");
    const { data: project, error: projectError } = await client
      .from("apps")
      .select("id,current_version_id")
      .eq("id", appId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (projectError || !project) return fail("PROJECT_NOT_FOUND", projectError?.message || null);
    if (!project.current_version_id) return fail("PROJECT_VERSION_NOT_FOUND");
    const { data: version, error: versionError } = await client
      .from("app_versions")
      .select("id,specification")
      .eq("id", project.current_version_id)
      .eq("app_id", project.id)
      .maybeSingle();
    if (versionError || !version) return fail("PROJECT_VERSION_NOT_FOUND", versionError?.message || null);
    const specification = version.specification || {};
    if (specification?.productType !== "mobile_game" && specification?.game?.enabled !== true) return fail("PROJECT_NOT_GAME");
    return success({
      principal: Object.freeze({ principalId: user.id, verified: true }),
      builderAccess,
      project,
      version,
    });
  }

  async function readSession(admin, userId, appId, requestId) {
    const { data, error } = await admin
      .from("multiplayer_session_requests")
      .select("request_id,status,provider_ticket_id,match_id,region,provider_claim_token,provider_claimed_at")
      .eq("user_id", userId)
      .eq("app_id", appId)
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) return fail("MULTIPLAYER_SESSION_READ_FAILED", error.message);
    return success({ session: sessionRow(data) });
  }

  return Object.freeze({
    id: "compatibility-game-multiplayer-data-v1",

    async loadContext({ appId }) {
      return resolveContext({ appId });
    },

    async beginSubmission({ appId, requestId }) {
      const context = await resolveContext({ appId });
      if (!context.ok) return context;
      const userId = context.principal.principalId;
      const admin = createAdminClient();
      const { error: reserveError } = await admin.rpc("server_reserve_multiplayer_session", {
        p_user_id: userId,
        p_app_id: appId,
        p_request_id: requestId,
      });
      if (reserveError) return fail("MULTIPLAYER_SESSION_RESERVE_FAILED", reserveError.message);
      const { data: claim, error: claimError } = await admin.rpc("server_claim_multiplayer_provider_v2", {
        p_user_id: userId,
        p_app_id: appId,
        p_request_id: requestId,
      });
      if (claimError) return fail("MULTIPLAYER_PROVIDER_CLAIM_FAILED", claimError.message);
      let session = null;
      if (claim?.replayed || claim?.in_progress) {
        const existing = await readSession(admin, userId, appId, requestId);
        if (!existing.ok) return existing;
        session = existing.session;
      }
      return success({ principal: context.principal, builderAccess: context.builderAccess, claim, session });
    },

    async loadSession({ appId, requestId }) {
      const context = await resolveContext({ appId });
      if (!context.ok) return context;
      const admin = createAdminClient();
      const found = await readSession(admin, context.principal.principalId, appId, requestId);
      if (!found.ok) return found;
      return success({ principal: context.principal, builderAccess: context.builderAccess, session: found.session });
    },

    async finalizeSubmission({ appId, requestId, claimToken, status, providerTicketId, matchId, region }) {
      const context = await resolveContext({ appId });
      if (!context.ok) return context;
      const admin = createAdminClient();
      const { error } = await admin.rpc("server_finalize_multiplayer_provider_v2", {
        p_user_id: context.principal.principalId,
        p_app_id: appId,
        p_request_id: requestId,
        p_claim_token: claimToken,
        p_status: status,
        p_provider_ticket_id: providerTicketId || null,
        p_match_id: matchId || null,
        p_region: region || null,
      });
      if (error) return fail("MULTIPLAYER_PROVIDER_FINALIZE_FAILED", error.message);
      return success({ principal: context.principal });
    },

    async updateSession({ appId, requestId, status, providerTicketId, matchId, region }) {
      const context = await resolveContext({ appId });
      if (!context.ok) return context;
      const admin = createAdminClient();
      const { error } = await admin.rpc("server_update_multiplayer_session", {
        p_user_id: context.principal.principalId,
        p_app_id: appId,
        p_request_id: requestId,
        p_status: status,
        p_provider_ticket_id: providerTicketId || null,
        p_match_id: matchId || null,
        p_region: region || null,
      });
      if (error) return fail("MULTIPLAYER_SESSION_UPDATE_FAILED", error.message);
      return success({ principal: context.principal });
    },
  });
}
