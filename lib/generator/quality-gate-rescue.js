import { buildFailureRecoveryStrategyInstruction,summarizeFailureRecoveryPlan } from "./failure-pattern-intelligence.js";

const GATE_LABELS=Object.freeze({
  critic_contract:"build contract",
  self_test:"app structure",
  execution:"runtime execution",
  self_heal:"quality and self-heal",
});

function cleanIssue(value){
  return String(value??"")
    .replace(/https?:\/\/\S+/gi,"[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[email]")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,180);
}
function uniqueIssues(values=[]){
  return [...new Set(values.map(cleanIssue).filter(Boolean))].slice(0,4);
}
function gate(id,issues=[]){
  const safeIssues=uniqueIssues(issues);
  return {id,label:GATE_LABELS[id]||id,issueCount:safeIssues.length,issues:safeIssues};
}

export function buildGenerationQualityDiagnostics({report={},review=null,stage="final-verification",attempts=0,maxAttempts=0}={}){
  const failedGates=[];
  const criticFailures=Array.isArray(review?.failed)?review.failed:[];
  if(review?.passed===false||criticFailures.length){
    failedGates.push(gate("critic_contract",criticFailures.map(item=>item?.id||item?.repair||"Build contract check failed")));
  }

  const selfTestErrors=Array.isArray(report?.selfTest?.errors)?report.selfTest.errors:[];
  if(report?.selfTest?.ok===false||selfTestErrors.length){
    failedGates.push(gate("self_test",selfTestErrors.length?selfTestErrors:["Specification self-test failed"]));
  }

  const executionErrors=Array.isArray(report?.execution?.errors)?report.execution.errors:[];
  if(report?.execution?.ok===false||executionErrors.length){
    failedGates.push(gate("execution",executionErrors.length?executionErrors:["Runtime execution verification failed"]));
  }

  const selfHealErrors=Array.isArray(report?.selfHeal?.issues)
    ?report.selfHeal.issues.filter(issue=>issue?.severity==="error").map(issue=>issue?.message||issue?.code||"Self-heal quality check failed")
    :[];
  if(report?.selfHeal?.passed===false||selfHealErrors.length){
    failedGates.push(gate("self_heal",selfHealErrors.length?selfHealErrors:["Self-heal quality check failed"]));
  }

  if(!failedGates.length&&report?.passed===false){
    failedGates.push(gate("self_test",["Deterministic generation verification failed"]));
  }

  const safeAttempts=Math.max(0,Number(attempts)||0);
  const safeMaxAttempts=Math.max(safeAttempts,Number(maxAttempts)||0);
  const labels=failedGates.map(item=>item.label);
  const gateSummary=labels.length?labels.join(", "):"generation verification";
  const attemptSummary=safeAttempts>0?` after ${safeAttempts} targeted rescue attempt${safeAttempts===1?"":"s"}`:"";
  const userMessage=`LANERIQ automatically checked and repaired this build, but ${gateSummary} still did not pass${attemptSummary}. No project was finalized, and any reserved entitlement or charged credits were restored or refunded.`;
  const baseDiagnostics={
    stage:String(stage||"final-verification").slice(0,60),
    failedGateIds:failedGates.map(item=>item.id),
    failedGates,
    primaryGate:failedGates[0]?.id||null,
    issueCount:failedGates.reduce((sum,item)=>sum+item.issueCount,0),
    rescueAttempts:safeAttempts,
    maxRescueAttempts:safeMaxAttempts,
    retryable:true,
    summary:gateSummary,
    userMessage,
  };

  return {...baseDiagnostics,recoveryPlan:summarizeFailureRecoveryPlan(baseDiagnostics)};
}

export function buildQualityGateRescueInstruction(diagnostics={},attempt=1,maxAttempts=2){
  const failedGates=Array.isArray(diagnostics?.failedGates)?diagnostics.failedGates:[];
  const lines=failedGates.flatMap(item=>{
    const issues=Array.isArray(item?.issues)&&item.issues.length?item.issues:["Deterministic check failed"];
    return [`- ${item?.label||item?.id||"quality gate"} [${item?.id||"unknown"}]`,...issues.map(issue=>`  • ${cleanIssue(issue)}`)];
  });
  const rankedStrategyInstruction=buildFailureRecoveryStrategyInstruction(diagnostics,attempt,maxAttempts);
  return [
    `SOOLEN TARGETED QUALITY-GATE RESCUE ${Math.max(1,Number(attempt)||1)}/${Math.max(1,Number(maxAttempts)||1)}`,
    "The previous candidate was rejected by deterministic verification. Repair the failing gates below before changing anything else.",
    rankedStrategyInstruction,
    "Preserve all working pages, features, customer-selected app name, Brand Kit, language, theme, colors and wallpaper direction unless a listed gate requires a safety or accessibility correction.",
    "Do not weaken, bypass, remove or relabel a verification requirement. Do not invent external-provider success.",
    "Return the full corrected specification only, not a patch or explanation.",
    "FAILING GATES:",
    ...(lines.length?lines:["- generation verification [unknown]","  • Deterministic verification failed"]),
  ].join("\n");
}
