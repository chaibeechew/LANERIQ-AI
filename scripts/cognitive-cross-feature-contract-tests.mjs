import assert from "node:assert/strict";
import fs from "node:fs";
import { createCognitiveEnvelope,cognitivePromptContract,getCognitiveTelemetrySnapshot,recordCognitiveTelemetry } from "../lib/soolen/cognitive-integration.js";
import { generateExternalImages } from "../lib/ai/image-generation-gateway.js";
import { startVideoRender } from "../lib/video/render-gateway.js";
import { evaluateRuntimeDefense,RUNTIME_DEFENSE_PIPELINE_VERSION } from "../services/malware-defense/lib/runtime-defense-pipeline.js";

const appAdmission=fs.readFileSync("lib/ai/app-builder-admission.js","utf8");
assert.match(appAdmission,/createCognitiveEnvelope\("app-builder"/);
assert.match(appAdmission,/cognitivePromptContract\(cognitive\)/);
assert.match(appAdmission,/recordCognitiveTelemetry/);
assert.match(appAdmission,/cognitiveTelemetryRawPromptStored:false/);

const appEnvelope=createCognitiveEnvelope("app-builder",{goal:"Build an owner-scoped app"});
assert.equal(appEnvelope.providerIndependent,true);assert.equal(appEnvelope.evidenceClass,"INTERNAL");assert.equal(appEnvelope.mayClaimProductionVerified,false);
const contract=cognitivePromptContract(appEnvelope);assert.match(contract,/Do not promote internal or simulated claims to Production evidence/);assert.match(contract,/least-privilege/);

for(const key of ["IMAGE_GENERATION_PROVIDER","IMAGE_GENERATION_ENDPOINT","VIDEO_RENDER_PROVIDER","VIDEO_RENDER_ENDPOINT","VIDEO_RENDER_STATUS_ENDPOINT"])delete process.env[key];
const image=await generateExternalImages({prompt:"contract image",mode:"image",style:"modern",palette:"auto",count:1});
assert.equal(image.configured,false);assert.equal(image.generated,false);assert.equal(image.cognitive.domain,"ai-image");assert.equal(image.cognitive.mayClaimProductionVerified,false);
const video=await startVideoRender({project:{id:"p1",name:"Contract",style:"mixed",device_class:"balanced",max_duration_seconds:30},version:{id:"v1",version_no:1,duration_seconds:5,source_request_id:"req-1"},editJson:{clips:[]},requestId:"req-1"});
assert.equal(video.configured,false);assert.equal(video.started,false);assert.equal(video.cognitive.domain,"ai-video");assert.equal(video.cognitive.mayClaimProductionVerified,false);

const now=Date.now();const hash="a".repeat(64);const defense=evaluateRuntimeDefense([
  {eventId:"scan",type:"SCAN_VERDICT",observedAt:new Date(now-50).toISOString(),data:{sha256:hash,verdict:"CLEAN",hashBound:true,evidenceSignatureVerified:true,independentProviderCount:2,processKey:"p1"}},
  {eventId:"exec",type:"EXECUTION_REQUEST",observedAt:new Date(now).toISOString(),data:{sha256:hash,pid:1,processKey:"p1"}},
]);
assert.equal(RUNTIME_DEFENSE_PIPELINE_VERSION,"LANERIQ-RUNTIME-DEFENSE-PIPELINE-2");assert.equal(defense.decisions[0].action,"ALLOW");assert.equal(defense.deterministicDecisionAuthority,true);assert.equal(defense.cognitiveMayOverrideEnforcement,false);assert.equal(defense.cognitive.domain,"malware-defense");assert.equal(defense.liveAntivirusClaimAllowed,false);

recordCognitiveTelemetry({domain:"app-builder",phase:"contract",envelope:appEnvelope,operationId:"contract-operation",outcome:"pass"});
const telemetry=getCognitiveTelemetrySnapshot();assert.ok(telemetry.eventCount>=1);assert.equal(telemetry.durable,false);assert.equal(telemetry.privacySafeMethodMetadataOnly,true);assert.ok(telemetry.events.every(e=>e.containsRawPrompt===false&&e.containsCustomerRawData===false&&e.containsSecrets===false));assert.ok(telemetry.events.every(e=>!("prompt" in e)&&!("customerData" in e)&&!("secret" in e)));

console.log("LANERIQ Cognitive cross-feature runtime contracts: PASS");
