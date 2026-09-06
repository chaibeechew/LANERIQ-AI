import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import { canAccessControlTower } from "../../../../../lib/admin-access.js";
import { getControlTowerLiveStatus } from "../../../../../lib/control-tower-runtime.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return json({ error: "Authentication required." }, 401);
    }

    if (!canAccessControlTower(user.app_metadata?.role)) {
      return json({ error: "Control Tower access required." }, 403);
    }

    return json(await getControlTowerLiveStatus());
  } catch {
    return json({ error: "Unable to load Control Tower status." }, 500);
  }
}
