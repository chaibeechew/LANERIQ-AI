import assert from "node:assert/strict";
import { executeCognitiveCouncil, closeCognitiveRun, LANERIQ_COGNITIVE_RUNTIME_VERSION } from "../lib/soolen/cognitive-runtime.js";
import { appendFailureMemory, summarizeFailureMemory, MAX_FAILURE_MEMORY_RECORDS } from "../lib/soolen/failure-memory-store.js";
import { createBenchmarkCampaign, recordCampaignResult, finalizeBenchmarkCampaign } from "../lib/soolen/intelligence-campaign.js";
import { EVIDENCE_CLASSES } from "../lib/soolen/cognitive-os.js";
import { sanitizeMemoryJson, mergeProjectMemory, buildProjectMemoryBrief } from "../lib/project-memory.js";

let call=0;
const mockGenerate=async()=>{
  call+=1;
  if(call<=5)return {provider:`mock-${call}`,result:JSON.stringify({summary:`candidate ${call}`,recommendation:`path ${call}`,assumptions:[],risks:[],unknowns:[],confidence:.8})};
  return {provider:"mock-judge",result:JSON.stringify({winnerRole:"conservative",decision:"use reversible path",rationale:"lower execution risk",contradictions:[],unknowns:[],confidence:.9,requiresExternalVerification:false})};
};
const council=await executeCognitiveCouncil({goal:"Select a safe production architecture",complexity:.9,impact:.9,risk:"high",externalSideEffects:true,evidenceSummary:"internal contract evidence only",simulationRequired:true},{generate:mockGenerate});
assert.equal(LANERIQ_COGNITIVE_RUNTIME_VERSION,"1.0.0");assert.equal(council.councilExecuted,true);assert.equal(council.candidates.length,5);assert.equal(council.judge.winnerRole,"conservative");assert.equal(council.evidenceClass,EVIDENCE_CLASSES.INTERNAL);assert.equal(council.mayClaimProductionVerified,false);assert.ok(council.candidates.every(x=>/^[a-f0-9]{64}$/.test(x.responseDigest)));
const closed=closeCognitiveRun({critical:true,completed:true,testsPassed:true,securityPassed:true,privacyPassed:true,outputVerified:true,requiredEvidenceClass:EVIDENCE_CLASSES.PRODUCTION,observedEvidenceClass:EVIDENCE_CLASSES.INTERNAL,uncertainty:{evidenceCoverage:1,sourceAgreement:1,testCoverage:1,evidenceClass:EVIDENCE_CLASSES.INTERNAL}});assert.equal(closed.verdict.accepted,false);assert.ok(closed.failureMemory);assert.equal(closed.failureMemory.containsCustomerRawData,false);
let memory={};for(let i=0;i<MAX_FAILURE_MEMORY_RECORDS+5;i++)memory=appendFailureMemory(memory,{category:"test",failureCode:`F${i}`,strategy:"safe method",repairPattern:"retry bounded"});const summary=summarizeFailureMemory(memory,{limit:100});assert.equal(memory.intelligenceFailureMemory.length,MAX_FAILURE_MEMORY_RECORDS);assert.equal(summary.count,20);assert.equal(summary.containsSecrets,false);
const sanitized=sanitizeMemoryJson(memory);assert.equal(sanitized.intelligenceFailureMemory.length,MAX_FAILURE_MEMORY_RECORDS);assert.ok(sanitized.intelligenceFailureMemory.every(x=>x.containsCustomerRawData===false&&x.containsSecrets===false));
const rejected=sanitizeMemoryJson({intelligenceFailureMemory:[{failureCode:"BAD",raw_prompt:"customer private prompt",strategy:"x"}]});assert.equal(rejected.intelligenceFailureMemory.length,0);
const merged=mergeProjectMemory({},memory);assert.equal(merged.intelligenceFailureMemory.length,MAX_FAILURE_MEMORY_RECORDS);assert.match(buildProjectMemoryBrief(merged),/Safe prior failure patterns/);
let campaign=createBenchmarkCampaign({campaignId:"contract-campaign",evidenceClass:EVIDENCE_CLASSES.SIMULATED,casesPerDomain:2});assert.equal(campaign.caseCount,30);for(const item of campaign.cases)campaign=recordCampaignResult(campaign,{id:item.id,score:95,passed:true,evidenceClass:EVIDENCE_CLASSES.SIMULATED,externallyVerified:false,durationMs:10});const final=finalizeBenchmarkCampaign(campaign,{minimumOverall:90,minimumPassRate:.9});assert.equal(final.complete,true);assert.equal(final.benchmark.releaseQualified,true);assert.equal(final.mayClaimProductionVerified,false);assert.match(final.campaignDigest,/^[a-f0-9]{64}$/);
assert.throws(()=>recordCampaignResult(createBenchmarkCampaign({campaignId:"drift",evidenceClass:EVIDENCE_CLASSES.INTERNAL}),{id:"drift:reasoning:1",score:100,passed:true,evidenceClass:EVIDENCE_CLASSES.PRODUCTION}),/EVIDENCE_CLASS_DRIFT/);
console.log("LANERIQ Cognitive Runtime round 2 contract tests: PASS");
