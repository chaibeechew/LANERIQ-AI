import { createClient } from "./supabase/server.js";
import {
  canAccessControlTower,
  controlTowerCapabilities,
  controlTowerRoleFromUser,
} from "./admin-access.js";

export async function getControlTowerAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, status: 401, code: "AUTHENTICATION_REQUIRED", message: "Authentication required." };
  }

  const role = controlTowerRoleFromUser(user);
  if (!canAccessControlTower(role)) {
    return { ok: false, status: 403, code: "CONTROL_TOWER_ACCESS_REQUIRED", message: "Control Tower access required." };
  }

  return {
    ok: true,
    supabase,
    user,
    role,
    capabilities: controlTowerCapabilities(role),
  };
}
