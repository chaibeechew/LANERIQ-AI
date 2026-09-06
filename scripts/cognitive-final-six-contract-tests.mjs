import assert from "node:assert/strict";
import fs from "node:fs";
import { EVIDENCE_CLASSES } from "../lib/soolen/cognitive-os.js";
import { runMultiProviderBenchmark } from "../lib/soolen/multi-provider-benchmark.js";
import { evaluateFeatureJudge, FEATURE_JUDGE_PROFILES } from "../lib/soolen/feature-judge.js";
import { executeCognitiveSelfHeal, planCognitiveSelfHeal } from "../lib/soolen/cognitive-self-heal.js";
import { evaluateProductionCognitiveGate } from "../lib/soolen/production-cognitive-gate.js";
import { getHumanCivilizationLaw } from "../lib/soolen/human-civilization-law.js";
import { createSupabaseCognitiveLedgerAdapter, createSupabaseBenchmarkEvidenceAdapter } from "../lib/soolen/supabase-cognitive-store.js";
import { configureCognitiveTelemetryPersistence, recordCognitiveTelemetry, flushCognitiveTelemetryPersistence, getCognitiveTelemetrySnapshot } from "../lib/soolen/cognitive-integration.js";

const migration=fs.readFileSync("supabase/migrations/20260906102500_cognitive_durability_layer.sql","utf8");
for(const table of ["cognitive_failure_memory","cognitive_event_ledger","cognitive_benchmark_evidence"]){
  assert.match(migration,new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration,new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
  assert.match(migration,new RegExp(`grant select, insert on public\\.${table} to authenticated`));
}
assert.doesNotMatch(migration,/security\s+definer/i);
assert.match(migration,/contains_raw_prompt = false/);
assert.match(migration,/contains_customer_raw_data = false/);
assert.match(migration,/contains_secrets = false/);
assert.match(migration,/evidence_class <> 'PRODUCTION' or externally_verified = true/);
assert.doesNotMatch(migration,/grant[^;]*update[^;]*authenticated/i);

const benchmark=await runMultiProviderBenchmark({campaignId:"contract-real-provider",providers:["provider-a","provider-b"],cases:[{id:"reason-1",domain:"reasoning",prompt:"Return a bounded plan."},{id:"code-1",domain:"coding",prompt:"Return a safe implementation outline."}]},{
  generate:async(prompt,provider)=>({provider,result:`${provider}:${prompt}`}),
  evaluate:async({actualProvider})=>({score:actualProvider==="provider-a"?95:93,passed:true,reason:"deterministic contract evaluator"}),
});
assert.equal(benchmark.realMultiProviderObserved,true);
assert.equal(benchmark.distinctExternalProviderCount,2);
assert.equal(benchmark.receiptCount,4);
assert.equal(benchmark.evidenceClass,EVIDENCE_CLASSES.MEASURED_OR_ATTESTED);
assert.equal(benchmark.mayClaimProductionVerified,false);
assert.ok(benchmark.receipts.every(row=>row.externallyVerified===false&&/^[a-f0-9]{64}$/.test(row.promptDigest)&&/^[a-f0-9]{64}$/.test(row.resultDigest)));

assert.deepEqual(Object.keys(FEATURE_JUDGE_PROFILES),["app-builder","malware-defense","ai-image","ai-video","production-release"]);
const appPass=evaluateFeatureJudge("app-builder",{testsPassed:true,securityPassed:true,ownershipRlsPassed:true,outputVerified:true,previewVerified:true,observedEvidenceClass:EVIDENCE_CLASSES.INTERNAL});
assert.equal(appPass.accepted,true);
const appBlock=evaluateFeatureJudge("app-builder",{testsPassed:true,securityPassed:true,ownershipRlsPassed:false,outputVerified:true,previewVerified:true,observedEvidenceClass:EVIDENCE_CLASSES.INTERNAL});
assert.equal(appBlock.accepted,false);assert.ok(appBlock.failed.includes("ownershipRlsPassed"));
const malwareBlock=evaluateFeatureJudge("malware-defense",{testsPassed:true,securityPassed:true,deterministicDecisionPreserved:false,ransomwareProtectionVerified:true,remediationVerified:true,falsePositiveGuardPassed:true,observedEvidenceClass:EVIDENCE_CLASSES.INTERNAL});
assert.equal(malwareBlock.accepted,false);assert.ok(malwareBlock.failed.includes("deterministicDecisionPreserved"));

const productionChecks={testsPassed:true,securityPassed:true,supabaseVerified:true,apiVerified:true,browserVerified:true,malwareVerified:true,appBuilderVerified:true,uiVerified:true,cognitiveDurabilityVerified:true,realProviderBenchmarkVerified:true,exactShaVerified:true};
const productionFeatureBlock=evaluateFeatureJudge("production-release",{...productionChecks,observedEvidenceClass:EVIDENCE_CLASSES.INTERNAL,requiredEvidenceClass:EVIDENCE_CLASSES.PRODUCTION,externalVerificationRequired:true});
assert.equal(productionFeatureBlock.accepted,false);assert.equal(productionFeatureBlock.mayClaimProductionVerified,false);

const productionSelfHealPlan=planCognitiveSelfHeal("production-release",productionFeatureBlock,{production:true});
assert.equal(productionSelfHealPlan.automaticRepairAllowed,false);
const productionSelfHeal=await executeCognitiveSelfHeal("production-release",{judge:productionFeatureBlock,production:true});
assert.equal(productionSelfHeal.accepted,false);assert.equal(productionSelfHeal.action,"human-review-required");

const initialAppJudge=evaluateFeatureJudge("app-builder",{testsPassed:true,securityPassed:true,ownershipRlsPassed:true,outputVerified:true,previewVerified:false,observedEvidenceClass:EVIDENCE_CLASSES.INTERNAL});
const repaired=await executeCognitiveSelfHeal("app-builder",{judge:initialAppJudge,maxRounds:2},{
  repair:async()=>({applied:true,rollbackAvailable:true,permissionEscalationRequested:false,safetyGateDisabled:false,qualityGateLowered:false}),
  verify:async()=>({testsPassed:true,securityPassed:true,ownershipRlsPassed:true,outputVerified:true,previewVerified:true,observedEvidenceClass:EVIDENCE_CLASSES.INTERNAL}),
});
assert.equal(repaired.accepted,true);assert.equal(repaired.rounds,1);assert.equal(repaired.permissionsEscalated,false);assert.equal(repaired.safetyGatesLowered,false);

const fakeClient={from(table){return{insert:async(payload)=>({data:{table,payload},error:null})};}};
const ledger=createSupabaseCognitiveLedgerAdapter(fakeClient,{ownerId:"00000000-0000-0000-0000-000000000001",migrationVerified:true});
await assert.rejects(()=>ledger.append({containsRawPrompt:true}),/PRIVATE_DATA_REJECTED/);
const benchmarkAdapter=createSupabaseBenchmarkEvidenceAdapter(fakeClient,{ownerId:"00000000-0000-0000-0000-000000000001",migrationVerified:true});
await assert.rejects(()=>benchmarkAdapter.append({campaignId:"x",caseId:"x",domain:"reasoning",providerClass:"p",evidenceClass:EVIDENCE_CLASSES.PRODUCTION,externallyVerified:false,promptDigest:"a".repeat(64),resultDigest:"b".repeat(64)}),/EXTERNAL_VERIFICATION_REQUIRED/);

configureCognitiveTelemetryPersistence({storageClass:"contract-ledger",productionVerified:true,append:async()=>({ok:true,eventDigest:"c".repeat(64)})});
recordCognitiveTelemetry({domain:"app-builder",phase:"contract",envelope:{reasoningMode:"deep",evidenceClass:EVIDENCE_CLASSES.INTERNAL,councilRequired:false,humanApprovalRequired:false},operationId:"private-operation-id-never-persisted-raw",outcome:"verified"});
await flushCognitiveTelemetryPersistence();
const telemetry=getCognitiveTelemetrySnapshot();
assert.equal(telemetry.durable,true);assert.ok(telemetry.durableWrites>=1);assert.equal(telemetry.persistenceFailures,0);assert.ok(telemetry.events.at(-1).operationDigest&&telemetry.events.at(-1).operationDigest!=="private-operation-id-never-persisted-raw");
configureCognitiveTelemetryPersistence(null);

const sha="a".repeat(40);
const law=getHumanCivilizationLaw();
const baseGate={githubMainSha:sha,vercelProductionSha:sha,runtimeVerifiedSha:sha,cognitiveOsGate:true,coreReleaseGate:true,ai100Gate:true,benchmarkFactoryGate:true,appBuilderGate:true,malwareDefenseGate:true,creativeMediaGate:true,failureMemoryMigrationApplied:true,failureMemoryRlsVerified:true,cognitiveLedgerMigrationApplied:true,cognitiveLedgerRlsVerified:true,durableLedgerWriteVerified:true,realMultiProviderBenchmarkVerified:true,distinctExternalProviders:2,benchmarkExternalAttestationVerified:true,featureJudgesVerified:true,cognitiveSelfHealVerified:true,supabaseVerified:true,apiVerified:true,browserVerified:true,malwareVerified:true,appBuilderVerified:true,uiVerified:true,humanCivilizationLawVerified:true,humanCivilizationLawDigest:law.lawDigest,constitutionalAlignmentVerified:true,humanSovereigntyVerified:true,humanCriticalVetoVerified:true,noDominationVerified:true,futureGenerationsReviewVerified:true,humanReleaseApproval:true};
const gatePass=evaluateProductionCognitiveGate(baseGate);assert.equal(gatePass.mayClaimProductionCognitiveClosed,true);assert.equal(gatePass.evidenceClass,EVIDENCE_CLASSES.PRODUCTION);assert.match(gatePass.manifestDigest,/^[a-f0-9]{64}$/);assert.equal(gatePass.humanCivilizationLaw.digest,law.lawDigest);
const shaBlock=evaluateProductionCognitiveGate({...baseGate,runtimeVerifiedSha:"b".repeat(40)});assert.equal(shaBlock.mayClaimProductionCognitiveClosed,false);assert.ok(shaBlock.failed.includes("exactShaConvergence"));
const providerBlock=evaluateProductionCognitiveGate({...baseGate,distinctExternalProviders:1});assert.equal(providerBlock.mayClaimProductionCognitiveClosed,false);assert.ok(providerBlock.failed.includes("atLeastTwoExternalProviders"));
const lawBlock=evaluateProductionCognitiveGate({...baseGate,humanCivilizationLawVerified:false});assert.equal(lawBlock.mayClaimProductionCognitiveClosed,false);assert.ok(lawBlock.failed.includes("humanCivilizationLawVerified"));
const lawDigestBlock=evaluateProductionCognitiveGate({...baseGate,humanCivilizationLawDigest:"0".repeat(64)});assert.equal(lawDigestBlock.mayClaimProductionCognitiveClosed,false);assert.ok(lawDigestBlock.failed.includes("humanCivilizationLawDigestCurrent"));
const sovereigntyBlock=evaluateProductionCognitiveGate({...baseGate,humanSovereigntyVerified:false});assert.equal(sovereigntyBlock.mayClaimProductionCognitiveClosed,false);assert.ok(sovereigntyBlock.failed.includes("humanSovereigntyVerified"));
const humanBlock=evaluateProductionCognitiveGate({...baseGate,humanReleaseApproval:false});assert.equal(humanBlock.mayClaimProductionCognitiveClosed,false);assert.ok(humanBlock.failed.includes("humanReleaseApproval"));

console.log("LANERIQ Cognitive OS final six contract tests: PASS");
