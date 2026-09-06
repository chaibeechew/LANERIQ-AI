import { getControlTowerAuthContext } from "../../../../../lib/control-tower-auth.js";
import {
  controlTowerAuthErrorResponse,
  controlTowerJson,
} from "../../../../../lib/control-tower-http.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await getControlTowerAuthContext();
    if (!auth.ok) return controlTowerAuthErrorResponse(auth);
    const status = await getControlTowerLiveStatus();
    return controlTowerJson({ ...status, capabilities: auth.capabilities });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower status." }, 500);
  }
}
