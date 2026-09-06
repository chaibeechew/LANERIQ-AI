import { requireControlTowerApi } from "../../../../../lib/control-tower-api.js";
import { controlTowerJson } from "../../../../../lib/control-tower-http.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const auth = await requireControlTowerApi(request);
    if (!auth.ok) return auth.response;
    const status = await getControlTowerLiveStatus();
    return controlTowerJson({ ...status, capabilities: auth.capabilities });
  } catch {
    return controlTowerJson({ error: "Unable to load Control Tower status." }, 500);
  }
}
