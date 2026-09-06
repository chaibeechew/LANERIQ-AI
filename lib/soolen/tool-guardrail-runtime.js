export const TOOL_GUARDRAIL_RUNTIME_VERSION="1.0.0";

const HIGH_RISK_TOOL_PATTERNS=[/deploy/i,/production/i,/delete/i,/drop/i,/payment/i,/billing/i,/credential/i,/secret/i,/admin/i,/shell/i,/exec/i,/database/i];
function text(value,max=500){return String(value??"").trim().slice(0,max);}
function isHighRiskTool(name){return HIGH_RISK_TOOL_PATTERNS.some(pattern=>pattern.test(String(name||"")));}

export function planToolGuardrail(input={}){
  const toolName=text(input.toolName,160);
  if(!toolName)throw new Error("LANERIQ_TOOL_NAME_REQUIRED");
  const highRisk=isHighRiskTool(toolName)||input.highRisk===true;
  const destructive=input.destructive===true;
  const production=input.production===true;
  return Object.freeze({
    version:TOOL_GUARDRAIL_RUNTIME_VERSION,
    toolName,
    executionMode:highRisk||destructive||production?"blocking-preflight":"parallel-allowed",
    preflightRequired:true,
    postflightRequired:true,
    humanApprovalRequired:destructive||production||input.financial===true||input.critical===true,
    sandboxRequired:input.executable!==false,
    networkPermissionRequired:input.network===true,
    maySelfGrantPermissions:false,
    mayBypassTripwire:false,
  });
}

function normalizeGuardResult(value={}){
  return Object.freeze({allowed:value.allowed===true,tripwireTriggered:value.tripwireTriggered===true,reason:text(value.reason||"",500)});
}

export async function runGuardedTool(input={},deps={}){
  const plan=planToolGuardrail(input);
  if(typeof deps.execute!=="function")throw new Error("LANERIQ_TOOL_EXECUTOR_REQUIRED");
  if(plan.humanApprovalRequired&&input.humanApproved!==true)return Object.freeze({version:TOOL_GUARDRAIL_RUNTIME_VERSION,executed:false,blocked:true,reason:"HUMAN_APPROVAL_REQUIRED",plan});
  const pre=typeof deps.preflight==="function"?normalizeGuardResult(await deps.preflight({plan,input})):normalizeGuardResult({allowed:true});
  if(!pre.allowed||pre.tripwireTriggered)return Object.freeze({version:TOOL_GUARDRAIL_RUNTIME_VERSION,executed:false,blocked:true,reason:pre.reason||"PREFLIGHT_TRIPWIRE",preflight:pre,plan});
  const result=await deps.execute({plan,input});
  const post=typeof deps.postflight==="function"?normalizeGuardResult(await deps.postflight({plan,input,result})):normalizeGuardResult({allowed:true});
  if(!post.allowed||post.tripwireTriggered)return Object.freeze({version:TOOL_GUARDRAIL_RUNTIME_VERSION,executed:true,accepted:false,blocked:true,reason:post.reason||"POSTFLIGHT_TRIPWIRE",preflight:pre,postflight:post,plan,resultDigestOnly:true,result:null});
  return Object.freeze({version:TOOL_GUARDRAIL_RUNTIME_VERSION,executed:true,accepted:true,blocked:false,preflight:pre,postflight:post,plan,result});
}
