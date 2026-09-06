import { NextResponse } from "next/server";
import {
  cancelBuilderGameMultiplayer,
  checkBuilderGameMultiplayer,
  getBuilderGameMultiplayerReadiness,
  startBuilderGameMultiplayer,
} from "../../../../../lib/cloud/game-multiplayer.js";

const MAX_REQUEST_BYTES = 24 * 1024;

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function respond(result) {
  const { status = 500, ...payload } = result || {};
  return json(payload, status);
}

export async function GET(request) {
  const appId = new URL(request.url).searchParams.get("appId") || "";
  return respond(await getBuilderGameMultiplayerReadiness({ appId }));
}

export async function POST(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_REQUEST_BYTES) return json({ ok: false, error: "Multiplayer request is too large." }, 413);
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "Invalid multiplayer request." }, 400);
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_REQUEST_BYTES) return json({ ok: false, error: "Multiplayer request is too large." }, 413);

  const appId = String(body?.appId || "").trim();
  const requestId = String(body?.requestId || "").trim();
  const action = ["start", "check", "cancel"].includes(body?.action) ? body.action : "start";

  if (action === "cancel") return respond(await cancelBuilderGameMultiplayer({ appId, requestId }));
  if (action === "check") return respond(await checkBuilderGameMultiplayer({ appId, requestId }));
  return respond(await startBuilderGameMultiplayer({
    appId,
    requestId,
    mode: body?.mode,
    region: body?.region,
    partySize: body?.partySize,
  }));
}
