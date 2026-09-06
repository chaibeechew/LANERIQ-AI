import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../lib/admin-access.js";

export const dynamic = "force-dynamic";

export default async function ControlTowerLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth?next=%2Fadmin%2Fcontrol-tower");
  }

  if (!canAccessControlTower(user.app_metadata?.role)) {
    redirect("/");
  }

  return children;
}
