import assert from "node:assert/strict";
import fs from "node:fs";
import { buildGenerationQualityDiagnostics,buildQualityGateRescueInstruction } from "../lib/generator/quality-gate-rescue.js";
import { buildGenerationQualityPreflight,buildGenerationQualityPreflightInstruction,summarizeGenerationQualityPreflight,GENERATION_QUALITY_PREFLIGHT_POLICY } from "../lib/generator/quality-recovery-intelligence.js";

const route=fs.readFileSync("app/api/generate/route.js","utf8");

assert.match(route,/function generationQualityGateFailure\(message\)/);
assert.match(route,/function qualityGateError\(message,diagnostics\)/);
assert.match(route,/function withQualityPreflight\(diagnostics,preflight\)/);
assert.match(route,/Soolen Super Brain could not verify the generated specification after autonomous repair attempts/);
assert.match(route,/Generated app failed final verification:/);
assert.match(route,/QUALITY_GATE_RESCUE_ATTEMPTS/);
assert.match(route,/APP_GENERATE_QUALITY_RESCUE_ATTEMPTS/);
assert.match(route,/buildGenerationQualityDiagnostics/);
assert.match(route,/buildQualityGateRescueInstruction/);
assert.match(route,/buildGenerationQualityPreflight/);
assert.match(route,/buildGenerationQualityPreflightInstruction/);
assert.match(route,/summarizeGenerationQualityPreflight/);
assert.match(route,/qualityPreflightBrief/);
assert.match(route,/runCriticChecks/);
assert.match(route,/targeted-rescue-exhausted/);
assert.match(route,/qualityGateRescue:\{attempted:/);
assert.match(route,/qualityPreflight:qualityPreflightSummary/);
assert.match(route,/preflightRiskIds:diagnostics\?\.preflight\?\.riskIds\|\|\[\]/);
assert.match(route,/code:"GENERATION_QUALITY_GATE_NOT_MET"/);
assert.match(route,/diagnostics:diagnostics\|\|undefined/);
assert.match(route,/retryable:true\},422\)/);
assert.match(route,/restoreFailedAppBuilderCreate/);
assert.match(route,/refundAiCredits/);
assert.match(route,/console\.warn\("AI BUILD APP & WEB quality gate:",JSON\.stringify/);
assert.match(route,/console\.error\("AI BUILD APP & WEB error:",error\)/);
assert.match(route,/\},500\);/);

const catchIndex=route.indexOf("}catch(error){");
const refundIndex=route.indexOf("refundAiCredits(userId",catchIndex);
const qualityIndex=route.indexOf('if(error?.code==="GENERATION_QUALITY_GATE_NOT_MET"||generationQualityGateFailure(message))',catchIndex);
const unknownErrorIndex=route.indexOf('console.error("AI BUILD APP & WEB error:",error)',catchIndex);
const preflightIndex=route.indexOf("const qualityPreflight=buildGenerationQualityPreflight");
const adultIndex=route.indexOf("const adult=await runSoolenAdultMode");
const rescueLoopIndex=route.indexOf("for(let attempt=1;attempt<=QUALITY_GATE_RESCUE_ATTEMPTS;attempt+=1)");
const persistenceIndex=route.indexOf("const persistence=await persistBuilderGeneratedProject",rescueLoopIndex);
assert.ok(preflightIndex>=0&&adultIndex>preflightIndex,"Preventive quality preflight must run before the first Adult Mode generation candidate.");
assert.ok(rescueLoopIndex>=0,"Generate route must include bounded targeted quality rescue attempts.");
assert.ok(persistenceIndex>rescueLoopIndex,"Quality rescue and final verification must complete before project persistence.");
assert.ok(catchIndex>=0&&refundIndex>catchIndex,"Generate catch must preserve automatic financial restoration.");
assert.ok(qualityIndex>refundIndex,"Quality-gate response must happen after entitlement/credit restoration.");
assert.ok(unknownErrorIndex>qualityIndex,"Expected quality-gate failures must return before unknown exceptions are logged as server errors.");

const diagnostics=buildGenerationQualityDiagnostics({
  report:{
    passed:false,
    selfTest:{ok:true,errors:[]},
    execution:{ok:false,errors:["Missing runtime route /checkout at https://example.invalid/debug"]},
    selfHeal:{passed:false,issues:[{severity:"error",message:"Accessibility contract failed for owner@example.com"}]},
  },
  review:{passed:true,failed:[]},
  stage:"targeted-rescue-exhausted",
  attempts:2,
  maxAttempts:2,
});
assert.deepEqual(diagnostics.failedGateIds,["execution","self_heal"]);
assert.equal(diagnostics.primaryGate,"execution");
assert.equal(diagnostics.rescueAttempts,2);
assert.equal(diagnostics.maxRescueAttempts,2);
assert.equal(diagnostics.retryable,true);
assert.ok(diagnostics.userMessage.includes("runtime execution"));
assert.ok(diagnostics.userMessage.includes("quality and self-heal"));
assert.ok(!JSON.stringify(diagnostics).includes("example.invalid"),"Public diagnostics must redact URLs.");
assert.ok(!JSON.stringify(diagnostics).includes("owner@example.com"),"Public diagnostics must redact email addresses.");

const rescueInstruction=buildQualityGateRescueInstruction(diagnostics,2,2);
assert.match(rescueInstruction,/TARGETED QUALITY-GATE RESCUE 2\/2/);
assert.match(rescueInstruction,/runtime execution \[execution\]/);
assert.match(rescueInstruction,/quality and self-heal \[self_heal\]/);
assert.match(rescueInstruction,/Do not weaken, bypass, remove or relabel a verification requirement/);
assert.match(rescueInstruction,/Return the full corrected specification only/);

const preflight=buildGenerationQualityPreflight({
  idea:"Build a real estate CRM with login, agent/admin roles, property listings, appointment booking, image uploads, Stripe payments, WhatsApp notifications and live chat.",
  industryPlan:{label:"Real Estate CRM",pages:["Dashboard","Listings","Clients","Appointments","Billing","Settings"],data:["Property","Client","Appointment"],workflows:["lead follow-up","appointment booking","payment confirmation"],roles:["agent","admin"]},
  requirements:{requiredFeatures:["authentication","payments","live chat","uploads"]},
  assetCount:4,
  referenceCount:2,
});
assert.equal(preflight.schemaVersion,1);
assert.equal(preflight.privacySafe,true);
assert.equal(preflight.storesRawUserPrompt,false);
assert.equal(preflight.predictsFailureProbability,false);
assert.equal(preflight.riskBand,"high");
for(const id of ["route_graph","data_workflow","security_permissions","external_integration","media_integrity","realtime_state"]){
  assert.ok(preflight.riskIds.includes(id),`Expected deterministic preflight risk ${id}`);
}
assert.ok(preflight.preventiveDirectives.some(item=>item.includes("every navigation/action target")));
assert.ok(preflight.preventiveDirectives.some(item=>item.includes("external services as integration-ready only")));
assert.ok(preflight.preventiveDirectives.some(item=>item.includes("loading, error, empty, retry/fallback")));
const preflightInstruction=buildGenerationQualityPreflightInstruction(preflight);
assert.match(preflightInstruction,/SOOLEN PREVENTIVE QUALITY PREFLIGHT/);
assert.match(preflightInstruction,/This is not a failure probability/);
assert.match(preflightInstruction,/Route and navigation graph \[route_graph\]/);
assert.match(preflightInstruction,/External integration truth boundary \[external_integration\]/);
assert.match(preflightInstruction,/Do not weaken or bypass any quality, security, privacy or truth boundary/);
const preflightSummary=summarizeGenerationQualityPreflight(preflight);
assert.deepEqual(preflightSummary.riskIds,preflight.riskIds);
assert.equal(preflightSummary.storesRawUserPrompt,false);
assert.equal(preflightSummary.predictsFailureProbability,false);
assert.ok(!JSON.stringify(preflightSummary).includes("real estate"),"Public preflight summary must not echo raw customer intent.");
assert.equal(GENERATION_QUALITY_PREFLIGHT_POLICY.noDedicatedServerRequired,true);
assert.equal(GENERATION_QUALITY_PREFLIGHT_POLICY.zeroPaidEmbeddingDependency,true);
assert.equal(GENERATION_QUALITY_PREFLIGHT_POLICY.rawPromptStorage,false);

const neutralPreflight=buildGenerationQualityPreflight({idea:"Build a simple personal notes app"});
assert.equal(neutralPreflight.riskBand,"normal");
assert.equal(neutralPreflight.riskIds.length,0);
assert.ok(neutralPreflight.preventiveDirectives.length>=5,"Baseline quality prevention must remain active for simple apps too.");

console.log("✓ Generate quality-gate failures are recoverable 422 responses with a stable error code and safe diagnostics");
console.log("✓ Preventive quality preflight runs before first generation and targets deterministic pressure areas without claiming failure probability");
console.log("✓ Exhausted Adult Mode verification receives bounded targeted rescue attempts before persistence/refund");
console.log("✓ Failed generation still restores entitlement/refunds credits before returning");
console.log("✓ Diagnostics identify failing gates without leaking URLs/email addresses; preflight summary does not echo customer intent");
console.log("✓ Unknown exceptions remain 500 errors and keep server-error logging");