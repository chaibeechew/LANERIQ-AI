import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server.js";
import {
  canAccessControlTower,
  canWaiveControlTowerGate,
  normalizeInternalRole,
} from "../../../../../lib/admin-access.js";
import {
  controlTowerGatePhase,
  isControlTowerGateWaivable,
} from "../../../../../lib/control-tower-governance.js";
import { sanitizeControlTowerEvidenceSnapshot } from "../../../../../lib/control-tower-evidence.js";
import {
  isControlTowerStorageMissing,
  validateControlTowerGateInput,
} from "../../../../../lib/control-tower-validation.js";

export const dynamic = "force-dynamic";

const GATE_SELECT = "id,release_id,gate_key,label,state,required,detail,evidence,checked_by,checked_at,created_at,updated_at";

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

async function requireControlTowerAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: json({ error: "Authentication required." }, 401) };
  const role = normalizeInternalRole(user.app_metadata?.role);
  if (!canAccessControlTower(role)) return { error: json({ error: "Control Tower access required." }, 403) };
  return { supabase, user, role };
}

export async function GET(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const releaseId = new URL(request.url).searchParams.get("releaseId")?.trim();
    let query = auth.supabase
      .from("control_tower_release_gates")
      .select(GATE_SELECT)
      .order("created_at", { ascending: true })
      .limit(200);
    if (releaseId) query = query.eq("release_id", releaseId);

    const { data, error } = await query;
    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ storageReady: false, gates: [] });
      throw error;
    }
    return json({ storageReady: true, gates: data || [] });
  } catch {
    return json({ error: "Unable to load Control Tower release gates." }, 500);
  }
}

export async function POST(request) {
  try {
    const auth = await requireControlTowerAdmin();
    if (auth.error) return auth.error;

    const input = await request.json().catch(() => ({}));
    const validation = validateControlTowerGateInput(input);
    if (!validation.ok) return json({ error: validation.error }, 400);

    if (controlTowerGatePhase(validation.value.gate_key) === "production") {
      return json({
        error: "Production identity gates are system-managed from live release truth and cannot be manually overridden.",
        code: "SYSTEM_MANAGED_GATE",
      }, 409);
    }

    if (validation.value.state === "waived") {
      if (!isControlTowerGateWaivable(validation.value.gate_key)) {
        return json({ error: "This release gate cannot be waived.", code: "NON_WAIVABLE_GATE" }, 409);
      }
      if (!canWaiveControlTowerGate(auth.role)) {
        return json({ error: "Owner or Super Admin approval is required to waive a release gate.", code: "WAIVER_APPROVAL_REQUIRED" }, 403);
      }
    }

    const { data: before, error: beforeError } = await auth.supabase
      .from("control_tower_release_gates")
      .select(GATE_SELECT)
      .eq("release_id", validation.value.release_id)
      .eq("gate_key", validation.value.gate_key)
      .maybeSingle();
    if (beforeError && !isControlTowerStorageMissing(beforeError)) throw beforeError;

    const payload = {
      ...validation.value,
      evidence: sanitizeControlTowerEvidenceSnapshot(validation.value.evidence),
      checked_by: validation.value.state === "pending" ? null : auth.user.id,
      checked_at: validation.value.state === "pending" ? null : new Date().toISOString(),
    };

    const { data, error } = await auth.supabase
      .from("control_tower_release_gates")
      .upsert(payload, { onConflict: "release_id,gate_key" })
      .select(GATE_SELECT)
      .single();

    if (error) {
      if (isControlTowerStorageMissing(error)) return json({ error: "Control Tower storage migration is not active in this environment." }, 503);
      if (error.code === "23503") return json({ error: "Referenced release does not exist." }, 409);
      throw error;
    }

    await auth.supabase.from("control_tower_audit_log").insert({
      actor_user_id: auth.user.id,
      action: before ? "release_gate_updated" : "release_gate_created",
      entity_type: "release_gate",
      entity_id: data.id,
      before_state: before || null,
      after_state: data,
      metadata: {
        actor_role: auth.role,
        waiver: data.state === "waived",
      },
    });

    return json({ gate: data }, before ? 200 : 201);
  } catch {
    return json({ error: "Unable to save Control Tower release gate." }, 500);
  }
}
