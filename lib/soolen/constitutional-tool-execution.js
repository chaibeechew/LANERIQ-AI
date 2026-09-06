import { runGuardedTool, planToolGuardrail } from "./tool-guardrail-runtime.js";
import { verifyConstitutionalExecutionToken, authorizeConstitutionalExecution } from "./constitutional-execution-token.js";

export const CONSTITUTIONAL_TOOL_EXECUTION_VERSION="1.0.0";

export async function runConstitutionallyGuardedTool(input={},deps={}){
  const plan=planToolGuardrail(input);
  const tokenRequired=plan.executionMode==="blocking-preflight"||plan.humanApprovalRequired||input.externalSideEffects===true||input.highRisk===true;
  let verification=null;
  if(tokenRequired){
    if(!input.constitutionalToken||!deps.tokenSecret)return Object.freeze({version:CONSTITUTIONAL_TOOL_EXECUTION_VERSION,executed:false,blocked:true,reason:"CONSTITUTIONAL_EXECUTION_TOKEN_REQUIRED",plan});
    verification=verifyConstitutionalExecutionToken(input.constitutionalToken,deps.tokenSecret,{scope:input.scope,action:input.action||input.toolName,principal:input.principal,authorityGrantDigest:input.authorityGrantDigest,nowMs:input.nowMs});
    const authorization=authorizeConstitutionalExecution({verification,toolGuardrailPassed:true,permissionScopeVerified:input.permissionScopeVerified===true,humanVetoAvailable:input.humanVetoAvailable===true});
    if(!authorization.allowed)return Object.freeze({version:CONSTITUTIONAL_TOOL_EXECUTION_VERSION,executed:false,blocked:true,reason:"CONSTITUTIONAL_AUTHORIZATION_BLOCKED",plan,verification,authorization});
  }
  const result=await runGuardedTool({...input,humanApproved:input.humanApproved===true},deps);
  return Object.freeze({...result,version:CONSTITUTIONAL_TOOL_EXECUTION_VERSION,constitutionalTokenRequired:tokenRequired,constitutionalTokenVerified:tokenRequired?verification?.valid===true:true,authorityExpanded:false,humanVetoPreserved:true});
}
