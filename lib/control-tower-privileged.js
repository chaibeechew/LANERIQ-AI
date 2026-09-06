import { createAdminClient } from "./supabase/admin.js";

export function controlTowerPrivilegedRuntimeConfigured(env = process.env) {
  return Boolean(
    String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim() &&
    String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  );
}

export function getControlTowerPrivilegedClient() {
  if (!controlTowerPrivilegedRuntimeConfigured()) {
    const error = new Error("Control Tower privileged Supabase runtime is not configured.");
    error.code = "CONTROL_TOWER_PRIVILEGED_RUNTIME_MISSING";
    throw error;
  }
  return createAdminClient();
}
