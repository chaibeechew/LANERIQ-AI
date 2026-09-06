export async function appendControlTowerAudit(supabase, {
  action,
  entityType,
  entityId = null,
  beforeState = null,
  afterState = null,
  metadata = {},
}) {
  const { data, error } = await supabase.rpc("append_control_tower_audit", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_before_state: beforeState,
    p_after_state: afterState,
    p_metadata: metadata || {},
  });
  if (error) throw error;
  return data;
}
