import { getControlTowerAuthContext } from "./control-tower-auth.js";
import {
  controlTowerAuthErrorResponse,
  controlTowerMutationGuard,
} from "./control-tower-http.js";

export async function requireControlTowerApi(request, { mutation = false } = {}) {
  if (mutation) {
    const mutationError = controlTowerMutationGuard(request);
    if (mutationError) return { ok: false, response: mutationError };
  }

  const auth = await getControlTowerAuthContext();
  if (!auth.ok) return { ok: false, response: controlTowerAuthErrorResponse(auth) };
  return { ok: true, ...auth };
}
