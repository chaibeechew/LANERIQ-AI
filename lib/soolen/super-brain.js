// Soolen / LANERIQ AI Super Brain
// Core orchestration architecture. Customer private data is task-use-only by default.

import { createCognitiveRun, EVIDENCE_CLASSES } from "./cognitive-os.js";

export const SOOLEN_BRAIN_VERSION = "1.0.0";

export const BRAIN_MODULES = Object.freeze({
  intent: "intent",
  context: "context",
  reasoning: "reasoning",
  memory: "memory",
  failureMemory: "failure-memory",
  knowledge: "knowledge",
  experience: "experience",
  planner: "planner",
  specialists: "specialists",
  council: "multi-agent-council",
  simulation: "world-simulator",
  critic: "critic",
  judge: "judge",
  uncertainty: "uncertainty",
  device: "device",
  security: "security-trust",
  selfHealing: "self-healing",
  benchmark: "intelligence-benchmark",
  meta: "meta",
});

export const CUSTOMER_DATA_POLICY = Object.freeze({
  defaultUse: "current-task-only",
  trainGlobalModels: false,
  crossCustomerReuse: false,
  persistRawPrivateData: false,
  persistRawPrompt: false,
  learnReusableMethod: true,
  requireExplicitOptInForGlobalLearning: true,
});

function cleanText(value, max = 12000) { return String(value || "").trim().slice(0, max); }
function now() { return new Date().toISOString(); }

export function createBrainContext(input = {}) {
  return {
    id: input.id || `soolen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now(),
    goal: cleanText(input.goal),
    taskType: cleanText(input.taskType || "app-build", 100),
    executionTarget: input.executionTarget || "device",
    customerDataPolicy: { ...CUSTOMER_DATA_POLICY },
    permissions: {
      network: false,
      backgroundCompute: false,
      sharedCompute: false,
      privateDataReuse: false,
      ...(input.permissions || {}),
    },
    device: input.device || null,
    projectMemory: input.projectMemory || {},
    privateTaskContext: input.privateTaskContext || null,
  };
}

export function reason(context) {
  if (!context?.goal) throw new Error("SOOLEN_GOAL_REQUIRED");
  return {
    goal: context.goal,
    intent: context.taskType,
    constraints: ["user-authorized-scope-only","privacy-by-default","device-first","sandbox-required-for-executable-work","simulation-is-not-production-evidence","provider-independent-routing"],
    confidence: "needs-validation",
  };
}

export function plan(context, reasoning) {
  const appBuild = context.taskType === "app-build";
  const stages = appBuild
    ? ["understand","architecture","data-model","ui","implementation","test","security-review","repair","verify","preview","package"]
    : ["understand","storyboard","job-graph","render","validate","repair","merge","finish","verify","export"];
  return { id:`${context.id}-plan`, reasoning, stages:stages.map((name,index)=>({id:index+1,name,status:"pending"})), retryPolicy:{strategy:"affected-work-only",maxRetriesPerStage:3}, executionTarget:context.executionTarget };
}

export function selectSpecialists(planInput) {
  const names=planInput.stages.map(s=>s.name); const specialists=new Set(["planner","security","testing","evidence"]);
  if(names.includes("implementation"))specialists.add("coding"); if(names.includes("ui"))specialists.add("ui-ux"); if(names.includes("data-model"))specialists.add("database"); if(names.includes("render"))specialists.add("media"); if(names.includes("finish"))specialists.add("audio-captions");
  return [...specialists];
}

export function criticReview(result = {}) {
  const checks={completed:result.completed===true,testsPassed:result.testsPassed===true,securityPassed:result.securityPassed===true,privacyPassed:result.privacyPassed===true,outputVerified:result.outputVerified===true};
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  return {passed:failed.length===0,checks,failed,action:failed.length?"repair":"accept"};
}

export function extractReusableExperience({ outcome, privateDataIncluded = false } = {}) {
  return {createdAt:now(),reusable:!privateDataIncluded,category:cleanText(outcome?.category||"general",100),strategy:cleanText(outcome?.strategy||"",1000),success:outcome?.success===true,failureCode:cleanText(outcome?.failureCode||"",100),performanceClass:cleanText(outcome?.performanceClass||"",100),containsCustomerRawData:false};
}

export function metaEvaluate(experiences = []) {
  const safe=experiences.filter(x=>x&&x.containsCustomerRawData!==true); const grouped=new Map();
  for(const item of safe){const key=item.strategy||"unknown";const value=grouped.get(key)||{attempts:0,successes:0};value.attempts+=1;if(item.success)value.successes+=1;grouped.set(key,value);}
  return [...grouped.entries()].map(([strategy,v])=>({strategy,...v,successRate:v.attempts?v.successes/v.attempts:0})).sort((a,b)=>b.successRate-a.successRate);
}

export function createSuperBrainJob(input = {}) {
  const context=createBrainContext(input); const reasoning=reason(context); const jobPlan=plan(context,reasoning);
  const cognitive=createCognitiveRun({
    goal:context.goal,
    taskType:context.taskType,
    complexity:input.complexity ?? 0.5,
    impact:input.impact ?? 0.5,
    reversibility:input.reversibility ?? 0.7,
    risk:input.risk || "medium",
    externalSideEffects:input.externalSideEffects===true,
    destructive:input.destructive===true,
    financial:input.financial===true,
    production:input.production===true,
    requiresTools:input.requiresTools===true,
    requiresVision:input.requiresVision===true,
    requiresLongContext:input.requiresLongContext===true,
    requiredCapabilities:input.requiredCapabilities,
    simulationRequired:input.simulationRequired===true,
    metrics:input.metrics,
    criticalDependency:input.criticalDependency,
    primaryProvider:input.primaryProvider,
    uncertainty:input.uncertainty || {evidenceCoverage:0.75,sourceAgreement:0.8,testCoverage:0.5,evidenceClass:EVIDENCE_CLASSES.INTERNAL},
  });
  return {
    brainVersion:SOOLEN_BRAIN_VERSION,
    cognitiveOSVersion:cognitive.cognitiveOSVersion,
    context,
    reasoning,
    cognitive,
    plan:jobPlan,
    specialists:selectSpecialists(jobPlan),
    loop:["reason","cognitive-route","independent-council-when-required","simulate-when-required","plan","act","test","critic","judge","bounded-repair","verify","extract-safe-experience","failure-memory","meta-evaluate","benchmark"],
    status:"planned",
  };
}
