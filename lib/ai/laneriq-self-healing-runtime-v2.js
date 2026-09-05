export const LANERIQ_SELF_HEALING_RUNTIME_CONTRACT="laneriq-self-healing-runtime-v2";

const SAFE_AUTO_ACTIONS=new Set(["pause_metered_work","degrade_noncritical_work","bounded_retry","verified_free_failover","quarantine_candidate","pause_privileged_writes","reduce_device_load"]);
function clean(value,max=160){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function list(value){return Array.isArray(value)?value:[];}

function actionFor(signal={}){
  const type=clean(signal?.type,48).toLowerCase();
  const severity=clean(signal?.severity,16).toLowerCase()||"warning";
  if(type==="cost_spike")return{action:"pause_metered_work",reason:"cost-anomaly",autoExecutable:true};
  if(type==="thermal_pressure")return{action:"reduce_device_load",reason:"thermal-protection",autoExecutable:true};
  if(type==="provider_failure")return signal?.verifiedFreeAvailable===true?{action:"verified_free_failover",reason:"verified-free-capacity-evidence",autoExecutable:true}:{action:"degrade_noncritical_work",reason:"provider-failure-no-verified-free-capacity",autoExecutable:true};
  if(type==="latency_spike")return{action:"degrade_noncritical_work",reason:"latency-protection",autoExecutable:true};
  if(type==="transient_api_error")return{action:"bounded_retry",reason:"transient-recovery",autoExecutable:true};
  if(type==="migration_mismatch")return{action:"pause_privileged_writes",reason:"schema-version-mismatch",autoExecutable:true};
  if(type==="memory_drift")return{action:"quarantine_candidate",reason:"memory-truth-drift",autoExecutable:true};
  if(type==="security_incident")return{action:"security_repair_proposal",reason:"security-incident",autoExecutable:false,requiresApproval:true};
  if(type==="data_corruption")return{action:"rollback_proposal",reason:"data-integrity-risk",autoExecutable:false,requiresApproval:true};
  if(type==="broken_user_flow")return{action:"code_repair_proposal",reason:"verified-user-flow-break",autoExecutable:false,requiresApproval:severity==="critical"};
  return{action:"investigate",reason:"unclassified-signal",autoExecutable:false,requiresApproval:true};
}

export function buildSelfHealingPlanV2({signals=[],mode="balanced",exactSha="",capabilityStage="code_ready"}={}){
  const normalized=list(signals).slice(0,32).map(signal=>({type:clean(signal?.type,48),severity:clean(signal?.severity,16)||"warning",evidence:clean(signal?.evidence,120),verifiedFreeAvailable:signal?.verifiedFreeAvailable===true}));
  const actions=normalized.map((signal,index)=>({id:`repair_${index+1}`,...actionFor(signal),signalType:signal.type,severity:signal.severity}));
  const zeroMode=["zero","free"].includes(clean(mode,24).toLowerCase());
  for(const item of actions){
    if(zeroMode&&item.action==="verified_free_failover")item.reason="zero-free-verified-capacity-only";
    if(!SAFE_AUTO_ACTIONS.has(item.action))item.autoExecutable=false;
  }
  return{contract:LANERIQ_SELF_HEALING_RUNTIME_CONTRACT,mode:clean(mode,24)||"balanced",exactSha:clean(exactSha,64),capabilityStage:clean(capabilityStage,32)||"code_ready",signals:normalized,actions,autoExecutionBounded:true,destructiveAutoRepairAllowed:false,privilegeEscalationAllowed:false,productionPromotionAllowed:false};
}

export function evaluateRepairAction(action={}, {authorityApproved=false,evidenceReady=false}={}){
  const safeAuto=action?.autoExecutable===true&&SAFE_AUTO_ACTIONS.has(action?.action);
  if(safeAuto)return{allowed:true,mode:"bounded_automatic",reason:"safe-reversible-control-action"};
  const allowed=authorityApproved===true&&evidenceReady===true;
  return{allowed,mode:allowed?"approved_candidate_repair":"blocked",reason:allowed?"authority-and-evidence-satisfied":"authority-or-evidence-missing"};
}

export const LANERIQ_SELF_HEALING_RUNTIME_INSTRUCTION=`
LANERIQ SELF-HEALING RUNTIME 2.0:
- Observe runtime, cost, provider, migration, memory, UI-flow and device-health signals; do not wait only for thrown exceptions.
- Automatic healing is limited to reversible control actions: bounded retry, pause/degrade, verified-free failover, candidate quarantine, privileged-write pause and device-load reduction.
- Provider failover is automatic only when free-capacity evidence is actually verified; otherwise degrade/pause rather than inventing availability or spend.
- Security repairs, data rollback, destructive changes, privilege changes and Production promotion are never autonomous side effects; create a repair proposal and require authority + evidence.
- ZERO/FREE failover may use verified-free capacity only; never convert an outage into silent paid spend.
- Preserve exact-version history and capability truth so a repair cannot make the system claim a higher LIVE stage than its evidence.
`;
