import assert from 'node:assert/strict';
import {buildLivingCharacterManifest} from '../lib/ai/avatar-character-core.js';
import {appendLivingAvatarVoiceChunk,createLivingAvatarSession,tickLivingAvatarSession} from '../lib/ai/avatar-session-orchestrator.js';
import {avatarWebGLReadiness} from '../lib/ai/avatar-webgl-renderer-runtime.js';
import {estimateAvatarVisemeTimeline} from '../lib/ai/avatar-browser-voice-runtime.js';
import {buildAvatarIdentityDNA,evaluateAvatarIdentityDrift} from '../lib/ai/avatar-identity-runtime.js';
import {solveAvatarTwoBoneIK} from '../lib/ai/avatar-ik-motion-runtime.js';
import {evaluateAvatarProductionMetrics} from '../lib/ai/avatar-production-quality.js';
import {buildCharacterContinuitySnapshot,buildCharacterDeviceHandoff,validateCharacterHandoff} from '../lib/ai/avatar-cross-device-runtime.js';

const manifest=buildLivingCharacterManifest({characterId:'lc_v4_smoke',type:'presenter',style:'3d',persona:'clear',voiceStyle:'warm',motionProfile:'expressive',language:'en',continuityKey:'smoke'});
assert.equal(manifest.schemaVersion,4);assert.equal(manifest.interfaces.advancedFace.channels,52);assert.equal(manifest.readiness.identityV2,true);assert.equal(manifest.readiness.webgl3DRendererCode,true);assert.equal(manifest.readiness.realtime3DRenderer,false);assert.equal(manifest.readiness.liveVoiceProvider,false);

let session=createLivingAvatarSession(manifest,{sessionId:'lc_v4_smoke_session',nowMs:0,performanceSignals:{deviceTier:'high',batteryLevel:.9,thermalState:'nominal'}});assert.equal(session.contract,'laneriq-living-avatar-session-v3');assert.equal(session.renderer.profile,'performance');assert.equal(session.renderer.maxFaceChannels,52);
session=appendLivingAvatarVoiceChunk(session,{chunkId:'smoke-voice-1',startMs:0,durationMs:800,visemes:[{atMs:0,viseme:'aa',weight:.8},{atMs:400,viseme:'ee',weight:.7}],final:true});const tick=tickLivingAvatarSession(session,{nowMs:250,playbackMs:250,attentionTarget:{x:.3,y:-.1,z:0,confidence:1,kind:'user'},actionKind:'show',speechEnergy:.9});assert.equal(tick.frame.state,'speaking');assert.equal(tick.frame.audioClock.contract,'laneriq-avatar-audio-clock-v1');assert.equal(tick.frame.face52.contract,'laneriq-face-52-v1');assert.equal(tick.frame.face52.channels.length,52);assert.equal(tick.frame.body.contract,'laneriq-avatar-body-rig-v1');assert.equal(tick.frame.motion.contract,'laneriq-avatar-motion-intelligence-v1');assert.equal(tick.frame.surface.contract,'laneriq-avatar-2.5d-frame-v1');

assert.equal(avatarWebGLReadiness().webglRendererCode,true);assert.ok(estimateAvatarVisemeTimeline('LANERIQ living character').length>1);const identity=buildAvatarIdentityDNA(manifest,{signatureTraits:['clear eyes','signature jacket'],voiceAnchor:'smoke-voice'});assert.equal(evaluateAvatarIdentityDrift(identity,{...identity}).valid,true);const ik=solveAvatarTwoBoneIK({root:{x:0,y:0,z:0},joint:{x:.5,y:0,z:0},end:{x:1,y:0,z:0},target:{x:.7,y:.35,z:0},pole:{x:0,y:0,z:1}});assert.equal(ik.reachable,true);

const continuity=buildCharacterContinuitySnapshot({manifest,runtimeState:tick.session.runtime,deviceClass:'ios',revision:3,updatedAtMs:1000}),handoff=buildCharacterDeviceHandoff({snapshot:continuity,targetDeviceClass:'android'});assert.equal(validateCharacterHandoff(handoff,{characterId:manifest.characterId,ageMs:1000}).valid,true);assert.equal(continuity.privacy.rawAssetIncluded,false);assert.equal(continuity.privacy.persistentMemoryIncluded,false);
const production=evaluateAvatarProductionMetrics({p95FrameMs:30,p95VoiceStartMs:500,p95LipSyncErrorMs:80,p95BargeInStopMs:120,crashRate:.001,thermalSeriousRate:.01,batteryDrainPctPerHour:10,peakMemoryMb:260,sessionRecoveryRate:.999,continuitySuccessRate:.999});assert.equal(production.passed,true);assert.equal(evaluateAvatarProductionMetrics({}).passed,false);
console.log('LANERIQ Avatar Full-System v4 smoke passed: Session v3 emits synchronized voice/audio, 52-channel face, motion intelligence and mobile surface while WebGL/browser voice/identity/IK CODE readiness stays separate from high-fidelity/native/external LIVE evidence.');
