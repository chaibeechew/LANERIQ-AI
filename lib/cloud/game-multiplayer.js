import { createGameMultiplayerDataAdapter } from "../cloud-adapters/game-multiplayer-data.js";
import {
  cancelMultiplayerTicket,
  checkMultiplayerTicket,
  createMultiplayerTicket,
  getMultiplayerProviderConfig,
  MultiplayerGatewayError,
} from "../game/multiplayer-provider-gateway.js";
import {
  evaluateMobaLivePreviewActivation,
  readMobaLiveDeploymentContext,
  sanitizeMobaProviderReadiness,
} from "../game/multiplayer-live-activation-v12.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function adapter() {
  return createGameMultiplayerDataAdapter();
}
function fail(code, status, error, extra = {}) {
  return Object.freeze({ ok: false, status, code, error, ...extra });
}
function success(payload = {}) {
  return Object.freeze({ ok: true, status: 200, ...payload });
}
function mapDataFailure(result) {
  const code = result?.code || "MULTIPLAYER_CLOUD_DATA_FAILED";
  if (code === "AUTHENTICATION_REQUIRED") return fail(code, 401, "Authentication required.");
  if (code === "ACCOUNT_VERIFICATION_REQUIRED") return fail(code, 403, "Account verification is required.");
  if (code === "PRO_GAME_CREATOR_REQUIRED") return fail(code, 403, "Live multiplayer integration is a Professional Game Creator capability.");
  if (["PROJECT_NOT_FOUND", "PROJECT_VERSION_NOT_FOUND", "PROJECT_NOT_GAME"].includes(code)) return fail(code, 404, "Owned mobile Game project not found.");
  return fail(code, 500, "Unable to access multiplayer project data.");
}
function publicSession(row, providerConnected = true) {
  if (!row) return null;
  return Object.freeze({
    requestId: row.request_id,
    status: row.status || "reserved",
    matchReady: row.status === "matched",
    region: row.region || null,
    submissionClaimed: Boolean(row.provider_claim_token),
    liveProviderConnected: providerConnected === true,
    productionEvidenceVerified: false,
  });
}
function validInput(appId, requestId = null) {
  if (!UUID.test(String(appId || "").trim())) return fail("PROJECT_ID_INVALID", 400, "A valid Game project is required.");
  if (requestId !== null && !REQUEST_ID.test(String(requestId || "").trim())) return fail("MULTIPLAYER_REQUEST_ID_INVALID", 400, "A stable multiplayer request ID is required.");
  return null;
}
async function authorizedContext(appId) {
  const result = await adapter().loadContext({ appId });
  return result?.ok ? result : mapDataFailure(result);
}
function providerFailure(error) {
  if (error instanceof MultiplayerGatewayError) return fail(error.code, error.status, "The live multiplayer service is unavailable right now.");
  return fail("MULTIPLAYER_CLOUD_ERROR", 500, "Unable to process multiplayer matchmaking right now.");
}

export function publicGameMultiplayerCloudBoundary() {
  return Object.freeze({
    providerOpaqueRouteLayer: true,
    dataProviderIsolated: true,
    networkProviderIsolated: true,
    providerEndpointsExposed: false,
    providerCredentialsExposed: false,
    matchmakingMigrated: true,
    livePreviewEvidenceBound: true,
    productionEvidenceVerified: false,
  });
}

export async function getBuilderGameMultiplayerReadiness({ appId }) {
  const invalid = validInput(appId);
  if (invalid) return invalid;
  const context = await authorizedContext(appId);
  if (!context.ok) return context;
  const config = getMultiplayerProviderConfig();
  const provider = sanitizeMobaProviderReadiness(config);
  const deployment = readMobaLiveDeploymentContext();
  const activation = evaluateMobaLivePreviewActivation({ provider, deployment });
  return success({
    readiness: Object.freeze({
      provider,
      deployment,
      activation,
      productionEvidenceVerified: false,
    }),
  });
}

export async function startBuilderGameMultiplayer({ appId, requestId, mode = "5v5", region = "auto", partySize = 1 }) {
  const invalid = validInput(appId, requestId);
  if (invalid) return invalid;
  const context = await authorizedContext(appId);
  if (!context.ok) return context;
  const config = getMultiplayerProviderConfig();
  if (config.blockedByCostPolicy) return fail("MULTIPLAYER_COST_POLICY_BLOCKED", 403, "Live multiplayer is unavailable under the current cost policy.");
  if (!config.configured) return fail("LIVE_MULTIPLAYER_NOT_CONNECTED", 503, "Live 5v5 multiplayer is not connected yet. Local/bot game preview remains available, but LANERIQ AI will not claim real-player matchmaking.", { live: false });

  const begun = await adapter().beginSubmission({ appId, requestId });
  if (!begun?.ok) return mapDataFailure(begun);
  const claim = begun.claim || {};
  if (claim.replayed) {
    return success({
      replayed: true,
      session: publicSession(begun.session, true),
      note: "The exact matchmaking request already has a provider result; no duplicate ticket was created.",
    });
  }
  if (claim.in_progress) {
    return fail("MULTIPLAYER_SUBMISSION_IN_PROGRESS", 409, "The exact provider submission is already in progress.", {
      retryAfterMs: Number(claim.retry_after_ms) || 2000,
      session: publicSession(begun.session, true),
      note: "Retry the same request ID instead of starting another ticket.",
    });
  }
  if (!claim.claimed || !claim.claim_token) return fail("MULTIPLAYER_PROVIDER_CLAIM_FAILED", 500, "Unable to reserve multiplayer provider execution.");

  try {
    const ticket = await createMultiplayerTicket({
      requestId,
      appId,
      playerId: context.principal.principalId,
      mode: String(mode || "5v5").slice(0, 48),
      region: String(region || "auto").slice(0, 64),
      partySize,
      teamSize: 5,
    });
    const finalized = await adapter().finalizeSubmission({
      appId,
      requestId,
      claimToken: claim.claim_token,
      status: ticket.status,
      providerTicketId: ticket.ticketId,
      matchId: ticket.matchId,
      region: ticket.region,
    });
    if (!finalized?.ok) return mapDataFailure(finalized);
    return success({
      replayed: Boolean(claim.reclaimed),
      session: Object.freeze({
        requestId,
        status: ticket.status,
        matchReady: ticket.status === "matched",
        region: ticket.region || null,
        submissionClaimed: false,
        liveProviderConnected: true,
        productionEvidenceVerified: false,
      }),
      note: claim.reclaimed
        ? "Recovered the same provider submission with the same idempotency key after an uncertain acknowledgement."
        : "A real provider ticket was accepted. Production 5v5 remains evidence-gated until relay, load/failover and real-device tests pass.",
    });
  } catch (error) {
    const definitive = error instanceof MultiplayerGatewayError
      && error.status >= 400
      && error.status < 500
      && !["MULTIPLAYER_MATCHMAKING_TIMEOUT", "MULTIPLAYER_PROVIDER_UNREACHABLE"].includes(error.code);
    if (definitive) {
      await adapter().finalizeSubmission({
        appId,
        requestId,
        claimToken: claim.claim_token,
        status: "failed",
        providerTicketId: null,
        matchId: null,
        region: null,
      }).catch(() => null);
    }
    return providerFailure(error);
  }
}

export async function checkBuilderGameMultiplayer({ appId, requestId }) {
  const invalid = validInput(appId, requestId);
  if (invalid) return invalid;
  const context = await authorizedContext(appId);
  if (!context.ok) return context;
  const config = getMultiplayerProviderConfig();
  if (config.blockedByCostPolicy) return fail("MULTIPLAYER_COST_POLICY_BLOCKED", 403, "Live multiplayer is unavailable under the current cost policy.");
  if (!config.configured) return fail("LIVE_MULTIPLAYER_NOT_CONNECTED", 503, "Live multiplayer is not connected yet.", { live: false });

  const found = await adapter().loadSession({ appId, requestId });
  if (!found?.ok) return mapDataFailure(found);
  const record = found.session;
  if (!record) return fail("MULTIPLAYER_SESSION_NOT_FOUND", 404, "Multiplayer matchmaking request not found.");
  if (!record.provider_ticket_id) {
    return success({
      session: publicSession(record, true),
      note: record.provider_claim_token
        ? "A provider submission is still claimed; LANERIQ AI will not start a duplicate ticket."
        : "No live provider ticket exists for this request.",
    });
  }
  if (["matched", "cancelled", "failed"].includes(record.status)) return success({ checked: false, session: publicSession(record, true) });
  try {
    const checked = await checkMultiplayerTicket(record.provider_ticket_id);
    const updated = await adapter().updateSession({
      appId,
      requestId,
      status: checked.status,
      providerTicketId: record.provider_ticket_id,
      matchId: checked.matchId,
      region: checked.region,
    });
    if (!updated?.ok) return mapDataFailure(updated);
    const next = { ...record, status: checked.status, match_id: checked.matchId || record.match_id, region: checked.region || record.region };
    return success({
      checked: true,
      session: publicSession(next, true),
      note: checked.status === "matched"
        ? "Matchmaking reported a real match. Production readiness still requires verified live relay/device evidence."
        : "The real provider ticket remains in progress.",
    });
  } catch (error) {
    return providerFailure(error);
  }
}

export async function cancelBuilderGameMultiplayer({ appId, requestId }) {
  const invalid = validInput(appId, requestId);
  if (invalid) return invalid;
  const context = await authorizedContext(appId);
  if (!context.ok) return context;
  const config = getMultiplayerProviderConfig();
  if (config.blockedByCostPolicy) return fail("MULTIPLAYER_COST_POLICY_BLOCKED", 403, "Live multiplayer is unavailable under the current cost policy.");
  if (!config.configured) return fail("LIVE_MULTIPLAYER_NOT_CONNECTED", 503, "Live multiplayer is not connected yet.", { live: false });

  const found = await adapter().loadSession({ appId, requestId });
  if (!found?.ok) return mapDataFailure(found);
  const record = found.session;
  if (!record) return fail("MULTIPLAYER_SESSION_NOT_FOUND", 404, "Multiplayer matchmaking request not found.");
  if (!record.provider_ticket_id) return success({ session: publicSession(record, true) });
  if (!["cancelled", "failed", "matched"].includes(record.status)) {
    try {
      await cancelMultiplayerTicket(record.provider_ticket_id);
    } catch (error) {
      return providerFailure(error);
    }
    const updated = await adapter().updateSession({
      appId,
      requestId,
      status: "cancelled",
      providerTicketId: record.provider_ticket_id,
      matchId: record.match_id,
      region: record.region,
    });
    if (!updated?.ok) return mapDataFailure(updated);
    record.status = "cancelled";
  }
  return success({ session: publicSession(record, true) });
}
