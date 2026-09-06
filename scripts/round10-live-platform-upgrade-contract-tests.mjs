import assert from "node:assert/strict";
import { createEvidenceRecord,evaluateEvidenceSet,buildLiveEvidenceClosureManifest } from "../lib/soolen/live-evidence-engine.js";
import { selectIntelligencePlan,evaluateRouterOutcome } from "../lib/soolen/intelligence-per-dollar-router.js";
import { createAppBuilderAttempt,recordAppBuilderStage,evaluateAppBuilderAttempt,aggregateAppBuilderSuccess,createRepairLoopBudget } from "../lib/ai/app-builder-success-runtime.js";
import { createAutonomousTaskPlan,executeAutonomousTask } from "../lib/soolen/autonomous-execution-runtime.js";
import { createProjectIntelligenceRecord,buildProjectIntelligenceContext,planNextProjectActions } from "../lib/soolen/long-term-project-intelligence.js";
import { classifyCognitiveFailure,createRootCauseGraph,planRepairCandidates } from "../lib/soolen/cognitive-self-heal-v2.js";
import { createTaskCostBudget,estimateExecutionCost,admitTaskSpend,optimizeInferenceBudget,summarizeUnitEconomics } from "../lib/soolen/cost-intelligence-engine.js";
import { classifyProductIntent,createIntentDrivenSurface,updateIntentSurface,createTrustPresentation } from "../lib/soolen/intent-driven-liui-runtime.js";

const sha="a".repeat(40);

// 1. LIVE Evidence Engine: CI cannot self-promote to Production.
const ci=createEvidenceRecord({class:"CI",candidateSha:sha,source:"round10-contract",verdict:"PASS",metadata:{suite:"round10"},observedAt:"2026-09-06T12:00:00Z"});
assert.equal(ci.containsSecrets,false);assert.equal(ci.class,"CI");
const ciEval=evaluateEvidenceSet([ci],{candidateSha:sha,targetClass:"CI",requiredSources:["round10-contract"]});
assert.equal(ciEval.accepted,true);assert.equal(ciEval.productionClaimAllowed,false);
const prodEval=evaluateEvidenceSet([ci],{candidateSha:sha,targetClass:"PRODUCTION",githubMainSha:sha,vercelProductionSha:sha,runtimeVerifiedSha:sha,humanReleaseApproval:false,liveEvidenceVerified:false});
assert.equal(prodEval.accepted,false);assert.ok(prodEval.failed.includes("insufficient-class:PRODUCTION"));
assert.ok(prodEval.failed.includes("human-release-approval"));
assert.throws(()=>createEvidenceRecord({class:"CI",candidateSha:sha,source:"bad",verdict:"PASS",metadata:{apiToken:"secret"}}),/FORBIDDEN_FIELD/);
const closure=buildLiveEvidenceClosureManifest({candidateSha:sha,lanes:{sha:true,supabase:true,providers:false},humanReleaseApproval:true});assert.equal(closure.verdict,"BLOCK");

// 2. Intelligence-per-Dollar Router: choose diverse Council under high complexity without breaking cost policy.
const plan=selectIntelligencePlan({complexity:.9,uncertainty:.75,requireProviderDiversity:true,providers:[
  {provider:"alpha",configured:true,liveVerified:true,quality:.95,reliability:.96,latencyScore:.7,costScore:.6,privacyScore:.9,estimatedCostUsd:.02},
  {provider:"beta",configured:true,liveVerified:true,quality:.91,reliability:.94,latencyScore:.8,costScore:.8,privacyScore:.85,estimatedCostUsd:.01},
  {provider:"gamma",configured:true,liveVerified:true,quality:.86,reliability:.9,latencyScore:.95,costScore:.95,privacyScore:.8,estimatedCostUsd:.005},
]});
assert.equal(plan.mode,"council");assert.ok(plan.distinctProviderCount>=2);assert.equal(plan.mayClaimBestModelInMarket,false);
const routerOutcome=evaluateRouterOutcome({baselineScore:80,routedScore:88,baselineCostUsd:.03,routedCostUsd:.03});assert.equal(routerOutcome.intelligencePerDollarImproved,true);

// 3. App Builder end-to-end success runtime.
let attempt=createAppBuilderAttempt({attemptId:"round10-app",candidateSha:sha,createdAt:"2026-09-06T12:00:00Z"});
for(const stage of ["architecture","generation","build","database","tests","security","preview"])attempt=recordAppBuilderStage(attempt,stage,{status:"PASS",durationMs:100,evidenceId:`ev-${stage}`,observedAt:"2026-09-06T12:01:00Z"});
const appResult=evaluateAppBuilderAttempt(attempt);assert.equal(appResult.workingAppSuccess,true);assert.equal(appResult.productionPublished,false);
const appAgg=aggregateAppBuilderSuccess([appResult]);assert.equal(appAgg.workingAppSuccessRate,1);assert.equal(appAgg.marketClaimEligible,false);
const repairBudget=createRepairLoopBudget({maxRounds:10});assert.equal(repairBudget.maxRounds,5);assert.equal(repairBudget.mayAutoPublishProduction,false);

// 4. Bounded autonomous execution with human veto and constitutional authorization.
const task=createAutonomousTaskPlan({taskId:"round10-task",goal:"Deploy a verified candidate",steps:[{id:"verify",action:"verify-runtime"},{id:"deploy",action:"production-deploy",highRisk:true,externalSideEffects:true}]});
const blocked=await executeAutonomousTask(task,{humanApproved:false,constutionalTokenVerified:false},{execute:async()=>({executed:true}),verify:async()=>({passed:true})});
assert.equal(blocked.status,"HUMAN_APPROVAL_REQUIRED");
const executed=await executeAutonomousTask(task,{humanApproved:true,constitutionalTokenVerified:true},{execute:async({step})=>({executed:true,rollbackAvailable:step.rollbackRequired}),verify:async({step})=>({passed:true,evidenceId:`e-${step.id}`})});
assert.equal(executed.accepted,true);assert.equal(executed.authorityExpanded,false);assert.equal(executed.productionClaimAllowed,false);

// 5. Long-term Project Intelligence remains project-scoped and private by default.
const goal=createProjectIntelligenceRecord({category:"goal",summary:"Reach Production exact-SHA closure",sourceRefs:["release-control"],confidence:.95,createdAt:"2026-09-06T12:00:00Z"});
const failure=createProjectIntelligenceRecord({category:"failure",summary:"Do not treat Preview as Production",sourceRefs:["truth-boundary"],confidence:1,createdAt:"2026-09-06T12:00:00Z"});
const context=buildProjectIntelligenceContext([goal,failure]);assert.equal(context.privateByDefault,true);assert.equal(context.crossUserReuseAllowed,false);
const next=planNextProjectActions(context);assert.ok(next.actions.some(x=>x.type==="advance-goal"));assert.ok(next.actions.some(x=>x.type==="avoid-known-failure"));
assert.throws(()=>createProjectIntelligenceRecord({category:"goal",summary:"bad",rawSecret:"x"}),/PRIVATE_DATA_FORBIDDEN/);

// 6. Cognitive Self-Heal 2.0 root-cause graph: security/authorization cannot auto-repair.
const authFailure=classifyCognitiveFailure({code:"RLS_FORBIDDEN",message:"authorization denied"});assert.equal(authFailure.category,"authorization");
const securityFailure=classifyCognitiveFailure({code:"SECURITY_INJECTION",message:"unsafe prompt injection"});assert.equal(securityFailure.category,"security");
const graph=createRootCauseGraph([{code:"BUILD_FAIL",message:"compile module failure"},{code:"SECURITY_INJECTION",message:"unsafe prompt injection"}]);
const repairs=planRepairCandidates(graph);assert.ok(repairs.candidates.some(x=>x.strategy==="repair-build-error"));assert.ok(repairs.candidates.some(x=>x.strategy==="quarantine-and-escalate"&&x.automaticAllowed===false));assert.equal(repairs.mayIncreasePermissions,false);

// 7. Cost Intelligence: no surprise spend, bounded inference budget and unit economics.
const zeroBudget=createTaskCostBudget({zeroCost:true,monthlyBudgetUsd:100,remainingMonthlyUsd:100,maxTaskCostUsd:10});assert.equal(zeroBudget.maxTaskCostUsd,0);
const estimate=estimateExecutionCost({inputTokens:1000,outputTokens:1000,inputUsdPerMillion:10,outputUsdPerMillion:20,candidateCount:2,verifierPasses:1});assert.ok(estimate.estimatedTotalUsd>0);
const spend=admitTaskSpend(zeroBudget,estimate);assert.equal(spend.allowed,false);assert.ok(spend.failed.includes("zero-cost-mode"));
const inference=optimizeInferenceBudget({complexity:.9,uncertainty:.8,risk:"critical",zeroCost:true});assert.ok(inference.candidateCount<=2);assert.ok(inference.verifierPasses<=1);
const economics=summarizeUnitEconomics([{costUsd:.01,success:true},{costUsd:.02,success:false}]);assert.equal(economics.sampleCount,2);assert.equal(economics.marketClaimEligible,false);

// 8. Intent-driven LIUI: interface follows intent while critical trust surfaces stay visible.
const classified=classifyProductIntent({goal:"Build a real estate website and publish it"});assert.equal(classified.intent,"app-builder");
const surface=createIntentDrivenSurface({goal:"Build a real estate website and publish it"});assert.equal(surface.intent,"app-builder");assert.equal(surface.cards[0].id,"goal");
const updated=updateIntentSurface(surface,{activeCard:"build",status:"working",keyboardOpen:true});assert.equal(updated.activeCard,"build");assert.equal(updated.secondaryChromeReduced,true);
const trust=createTrustPresentation(updated,{risk:"critical",production:true,externalSideEffects:true});assert.equal(trust.showEvidence,true);assert.equal(trust.showApproval,true);assert.equal(trust.mayHideCriticalWarning,false);

console.log("LANERIQ Round 10 / eight-part LIVE platform upgrade contracts: PASS");
