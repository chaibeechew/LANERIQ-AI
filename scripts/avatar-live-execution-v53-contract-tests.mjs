import assert from 'node:assert/strict';
import {buildLivingCharacterManifest} from '../lib/ai/avatar-character-core.js';
import {createAvatarLiveRuntimeDriverRegistry,registerAvatarLiveRuntimeDriver,evaluateAvatarLiveRuntimeDriver,getAvatarLiveRuntimeDriverRegistryReadiness} from '../lib/ai/avatar-live-runtime-driver-registry-v1.js';
import {createAvatarRuntimeCircuitBreaker,recordAvatarRuntimeDriverResult,canExecuteAvatarRuntimeDriver,getAvatarRuntimeCircuitBreakerReadiness} from '../lib/ai/avatar-runtime-circuit-breaker-v1.js';
import {runAvatarLiveProbe,getAvatarLiveProbeRunnerReadiness} from '../lib/ai/avatar-live-probe-runner-v1.js';
import {createAvatarSessionTelemetry,recordAvatarSessionTelemetryEvent,evaluateAvatarSessionTelemetry,getAvatarSessionTelemetryReadiness} from '../lib/ai/avatar-session-telemetry-v1.js';
import {createAvatarLiveRuntimeOrchestratorV53,runAvatarCapabilityLiveProbeV53,evaluateAvatarLiveRuntimeOrchestratorV53,buildAvatarRuntimeFallbackPlanV53,getAvatarLiveRuntimeOrchestratorV53Readiness} from '../lib/ai/avatar-live-runtime-orchestrator-v53.js';
import {createCompetitiveAvatarSession,recordCompetitiveAvatarTelemetryEvent,tickCompetitiveAvatarSession,evaluateCompetitiveAvatarSessionTelemetry} from '../lib/ai/avatar-competitive-runtime-v52.js';

const sha='c'.repeat(40),releaseId='release-v53',buildId='build-v53';
const nativeClaims=['exact-sha','release-id','challenge-nonce','probe-id','build-id','signed-receipt','native-runtime-version','physical-device-identity'];
let registry=createAvatarLiveRuntimeDriverRegistry();
registry=registerAvatarLiveRuntimeDriver(registry,{driverType:'native-renderer',driverId:'native-driver-v53',version:'1.0.0',capabilities:['realtime3DRenderer'],platforms:['ios','android'],productionAllowed:false,execute:async()=>({passed:true,signatureVerified:true,verifiedClaims:nativeClaims,keyId:'native-key',keyFingerprint:'a'.repeat(64)})});
assert.equal(evaluateAvatarLiveRuntimeDriver(registry,{driverType:'native-renderer',capability:'realtime3DRenderer',platform:'ios',environment:'preview'}).pass,true);
assert.equal(evaluateAvatarLiveRuntimeDriver(registry,{driverType:'native-renderer',capability:'realtime3DRenderer',platform:'ios',environment:'production'}).pass,false);
let breaker=createAvatarRuntimeCircuitBreaker({driverId:'native-driver-v53'});
const probe=await runAvatarLiveProbe({registry,breaker,driverType:'native-renderer',capability:'realtime3DRenderer',headSha:sha,releaseId,challengeNonce:'nonce-v53',probeId:'probe-native-v53',exactBuildId:buildId,platform:'ios',environment:'preview'});
assert.equal(probe.pass,true);assert.equal(probe.receipt.signatureVerified,true);assert.equal(probe.rawResultStored,false);

let failingRegistry=createAvatarLiveRuntimeDriverRegistry();
failingRegistry=registerAvatarLiveRuntimeDriver(failingRegistry,{driverType:'neural-voice',driverId:'voice-fail-v53',version:'1',capabilities:['liveVoiceProvider'],execute:async()=>({passed:false,signatureVerified:false,verifiedClaims:[]})});
let voiceBreaker=createAvatarRuntimeCircuitBreaker({driverId:'voice-fail-v53',failureThreshold:2,cooldownMs:5000});
for(let i=0;i<2;i++){const r=await runAvatarLiveProbe({registry:failingRegistry,breaker:voiceBreaker,driverType:'neural-voice',capability:'liveVoiceProvider',headSha:sha,releaseId,challengeNonce:`voice-nonce-${i}`,probeId:`voice-probe-${i}`,exactBuildId:buildId,environment:'preview'});voiceBreaker=r.breaker;assert.equal(r.pass,false);}assert.equal(canExecuteAvatarRuntimeDriver(voiceBreaker).allowed,false);

let telemetry=createAvatarSessionTelemetry({sessionId:'telemetry-v53',releaseId,headSha:sha,startedAtMs:900});
for(const event of [{type:'user-speech-end',atMs:1000},{type:'avatar-first-response',atMs:1420},{type:'barge-in-start',atMs:2000},{type:'voice-stopped',atMs:2100},{type:'lip-sync-sample',atMs:1500,valueMs:60},{type:'frame-sample',atMs:1500,valueMs:16}])telemetry=recordAvatarSessionTelemetryEvent(telemetry,event);
const telemetryEval=evaluateAvatarSessionTelemetry(telemetry);assert.equal(telemetryEval.pass,true);assert.equal(telemetryEval.metrics.responseStartMs,420);assert.equal(telemetry.privacy.rawAudioIncluded,false);

let orchestrator=createAvatarLiveRuntimeOrchestratorV53({releaseId,headSha:sha,exactBuildId:buildId,environment:'preview'});
let run=await runAvatarCapabilityLiveProbeV53(orchestrator,{registry,capability:'realtime3DRenderer',challengeNonce:'orchestrator-nonce',probeId:'orchestrator-native',platform:'ios'});orchestrator=run.orchestrator;const orchestrationEval=evaluateAvatarLiveRuntimeOrchestratorV53(orchestrator,{requiredCapabilities:['realtime3DRenderer']});assert.equal(orchestrationEval.pass,true);assert.equal(orchestrationEval.productionLive,false);
let opened=orchestrator.breakers.realtime3DRenderer;opened=recordAvatarRuntimeDriverResult(opened,{pass:false,errorCode:'x'});opened=recordAvatarRuntimeDriverResult(opened,{pass:false,errorCode:'x'});opened=recordAvatarRuntimeDriverResult(opened,{pass:false,errorCode:'x'});orchestrator={...orchestrator,breakers:{...orchestrator.breakers,realtime3DRenderer:opened}};const fallback=buildAvatarRuntimeFallbackPlanV53(orchestrator);assert.equal(fallback.actions[0].action,'renderer-downgrade');

const manifest=buildLivingCharacterManifest({characterId:'avatar_v53',type:'profile'});let competitive=createCompetitiveAvatarSession(manifest,{sessionId:'competitive-v53',releaseId,headSha:sha,platform:'ios',deviceTier:'high',ownerIdHash:'owner-v53',identityFingerprint:'identity-v53',nowMs:0});competitive=recordCompetitiveAvatarTelemetryEvent(competitive,{type:'user-speech-end',atMs:1000});competitive=recordCompetitiveAvatarTelemetryEvent(competitive,{type:'avatar-first-response',atMs:1400});competitive=recordCompetitiveAvatarTelemetryEvent(competitive,{type:'barge-in-start',atMs:2000});competitive=recordCompetitiveAvatarTelemetryEvent(competitive,{type:'voice-stopped',atMs:2100});let tick=tickCompetitiveAvatarSession(competitive,{nowMs:16,playbackMs:16,performanceSignals:{deviceTier:'high'}});competitive=tick.session;tick=tickCompetitiveAvatarSession(competitive,{nowMs:32,playbackMs:32,performanceSignals:{deviceTier:'high'}});competitive=tick.session;const liveTelemetry=evaluateCompetitiveAvatarSessionTelemetry(competitive);assert.equal(liveTelemetry.pass,true);assert.ok(liveTelemetry.metrics.p95LipSyncErrorMs<=80);assert.ok(liveTelemetry.metrics.p95FrameMs<=40);

for(const ready of [getAvatarLiveRuntimeDriverRegistryReadiness(),getAvatarRuntimeCircuitBreakerReadiness(),getAvatarLiveProbeRunnerReadiness(),getAvatarSessionTelemetryReadiness(),getAvatarLiveRuntimeOrchestratorV53Readiness()])assert.equal(ready.codeReady,true);
console.log('LANERIQ Avatar v5.3 live execution gate passed: injectable real runtime drivers, signed source-specific probe verification, timeout/circuit isolation, real session latency/lip-sync/frame telemetry, release-bound orchestration and deterministic local fallback are CODE-ready while real external drivers and Production LIVE remain evidence-gated.');
