import assert from 'node:assert/strict';
import {buildLivingCharacterManifest} from '../lib/ai/avatar-character-core.js';
import {buildAvatarEvidenceAttestation,evaluateAvatarEvidenceAttestation,getAvatarEvidenceAttestationV2Readiness} from '../lib/ai/avatar-evidence-attestation-v2.js';
import {evaluateAllAvatarLiveQuorums,evaluateAvatarEvidenceQuorum,getAvatarLiveEvidenceOrchestratorV2Readiness} from '../lib/ai/avatar-live-evidence-orchestrator-v2.js';
import {buildAvatarLiveDowngradePlan,buildAvatarLivePromotionDecision,getAvatarLivePromotionControllerV2Readiness} from '../lib/ai/avatar-live-promotion-controller-v2.js';

const sha='b'.repeat(40),now=1_800_000_000_000;
let digestIndex=0;const hex='abcdef0123456789';
function att({cap,source,issuer,claims=[],physical=false,platform='',model='',hardware=false,synthetic=false,selfReported=false,expiresAtMs=now+86400000}){const ch=hex[digestIndex++%hex.length];return buildAvatarEvidenceAttestation({capability:cap,headSha:sha,evidenceDigest:ch.repeat(64),issuer,sourceType:source,probeId:`${cap}:${source}:${issuer}`,observedAtMs:now-1000,expiresAtMs,attestationVerified:true,synthetic,selfReported,physicalDevice:physical,platform,model,hardwareBacked:hardware,exactBuildId:'build-v47',claims});}

const badSynthetic=att({cap:'realtime3DRenderer',source:'native-host',issuer:'synthetic-host',claims:['native-renderer-probe-pass'],physical:true,platform:'ios',model:'sim',synthetic:true});assert.equal(evaluateAvatarEvidenceAttestation(badSynthetic,{expectedHeadSha:sha,nowMs:now}).pass,false);
const selfReported=att({cap:'liveVoiceProvider',source:'provider-probe',issuer:'self-provider',claims:['external-neural-voice-pass'],selfReported:true});assert.equal(evaluateAvatarEvidenceAttestation(selfReported,{expectedHeadSha:sha,nowMs:now}).pass,false);
const expired=att({cap:'motionGenerator',source:'runtime-probe',issuer:'expired-runtime',claims:['neural-motion-generator-pass'],expiresAtMs:now-1});assert.equal(evaluateAvatarEvidenceAttestation(expired,{expectedHeadSha:sha,nowMs:now}).pass,false);

const evidence=[];
evidence.push(att({cap:'realtime3DRenderer',source:'github-ci',issuer:'github-renderer',claims:['frame-budget-pass']}));
evidence.push(att({cap:'realtime3DRenderer',source:'native-host',issuer:'native-ios',claims:['native-renderer-probe-pass','high-fidelity-asset-ready'],physical:true,platform:'ios',model:'iPhone-physical-A'}));
evidence.push(att({cap:'realtime3DRenderer',source:'physical-device-lab',issuer:'renderer-device-lab',claims:['frame-budget-pass'],physical:true,platform:'android',model:'Android-physical-A'}));

evidence.push(att({cap:'liveVoiceProvider',source:'github-ci',issuer:'github-voice',claims:['voice-latency-pass']}));
evidence.push(att({cap:'liveVoiceProvider',source:'provider-probe',issuer:'neural-voice-provider-attestor',claims:['external-neural-voice-pass','exact-phoneme-pass']}));
evidence.push(att({cap:'liveVoiceProvider',source:'physical-device-lab',issuer:'voice-device-lab',claims:['voice-latency-pass'],physical:true,platform:'ios',model:'iPhone-physical-B'}));
evidence.push(att({cap:'liveVoiceProvider',source:'physical-device-lab',issuer:'voice-device-lab',claims:['exact-phoneme-pass'],physical:true,platform:'android',model:'Android-physical-B'}));

evidence.push(att({cap:'motionGenerator',source:'github-ci',issuer:'github-motion',claims:['motion-quality-pass']}));
evidence.push(att({cap:'motionGenerator',source:'runtime-probe',issuer:'motion-runtime-attestor',claims:['neural-motion-generator-pass']}));
evidence.push(att({cap:'motionGenerator',source:'physical-device-lab',issuer:'motion-device-lab',claims:['collision-footlock-pass','motion-quality-pass'],physical:true,platform:'ios',model:'iPhone-physical-C'}));
evidence.push(att({cap:'motionGenerator',source:'physical-device-lab',issuer:'motion-device-lab',claims:['collision-footlock-pass'],physical:true,platform:'android',model:'Android-physical-C'}));

evidence.push(att({cap:'physicalDeviceBenchmark',source:'github-ci',issuer:'github-device',claims:['device-lab-matrix-pass']}));
for(const [platform,model,claims] of [['ios','iPhone-A',['ios-coverage','endurance-pass']],['ios','iPhone-B',['ios-coverage']],['android','Android-A',['android-coverage','endurance-pass']],['android','Android-B',['android-coverage']]])evidence.push(att({cap:'physicalDeviceBenchmark',source:'physical-device-lab',issuer:'physical-lab-attestor',claims,physical:true,platform,model}));

evidence.push(att({cap:'crossDeviceEncryptedHandoffLive',source:'github-ci',issuer:'github-continuity',claims:['anti-replay-pass','key-rotation-pass']}));
evidence.push(att({cap:'crossDeviceEncryptedHandoffLive',source:'secure-hardware',issuer:'secure-enclave-attestor',claims:['hardware-key-custody-pass'],physical:true,platform:'ios',model:'iPhone-secure-A',hardware:true}));
evidence.push(att({cap:'crossDeviceEncryptedHandoffLive',source:'secure-hardware',issuer:'keystore-attestor',claims:['hardware-key-custody-pass'],physical:true,platform:'android',model:'Android-secure-A',hardware:true}));
evidence.push(att({cap:'crossDeviceEncryptedHandoffLive',source:'physical-device-lab',issuer:'continuity-device-lab',claims:['cross-device-roundtrip-pass','anti-replay-pass','key-rotation-pass'],physical:true,platform:'android',model:'Android-secure-B'}));

const all=evaluateAllAvatarLiveQuorums({attestations:evidence,expectedHeadSha:sha,nowMs:now});assert.equal(all.allPassed,true);for(const q of Object.values(all.quorums)){assert.equal(q.pass,true);assert.equal(q.productionEligible,false);}
const wrongSha=evaluateAvatarEvidenceQuorum({capability:'realtime3DRenderer',attestations:evidence,expectedHeadSha:'c'.repeat(40),nowMs:now});assert.equal(wrongSha.pass,false);

const productionProbe=att({cap:'production-runtime',source:'runtime-probe',issuer:'production-runtime-attestor',claims:['production-runtime-probe-pass']});const manifest=buildLivingCharacterManifest({characterId:'lc_v47_evidence',type:'profile',style:'3d'});const approval={contract:'laneriq-production-release-controller-approval-v1',approved:true,headSha:sha,approvalId:'approval-v47',actorId:'production-release-controller'};
const decision=buildAvatarLivePromotionDecision({manifest,expectedMainSha:sha,quorums:all.quorums,productionProbeAttestation:productionProbe,releaseControllerApproval:approval,nowMs:now});assert.equal(decision.pass,true);for(const flag of ['realtime3DRenderer','liveVoiceProvider','motionGenerator','physicalDeviceBenchmark','crossDeviceEncryptedHandoffLive'])assert.equal(decision.requestedLiveFlags[flag],true);assert.equal(decision.automaticManifestMutation,false);assert.equal(manifest.readiness.realtime3DRenderer,false);
const incidentDecision=buildAvatarLivePromotionDecision({manifest,expectedMainSha:sha,quorums:all.quorums,productionProbeAttestation:productionProbe,releaseControllerApproval:approval,incidentBlockers:['avatar-renderer-crash'],nowMs:now});assert.equal(incidentDecision.pass,false);assert.equal(Object.values(incidentDecision.requestedLiveFlags).some(Boolean),false);
const downgrade=buildAvatarLiveDowngradePlan({currentLiveFlags:decision.requestedLiveFlags,expiredCapabilities:['liveVoiceProvider'],incidentCapabilities:['realtime3DRenderer']});assert.equal(downgrade.nextLiveFlags.liveVoiceProvider,false);assert.equal(downgrade.nextLiveFlags.realtime3DRenderer,false);assert.equal(downgrade.nextLiveFlags.motionGenerator,true);
assert.equal(getAvatarEvidenceAttestationV2Readiness().syntheticRejected,true);assert.equal(getAvatarLiveEvidenceOrchestratorV2Readiness().independentIssuerQuorum,true);assert.equal(getAvatarLivePromotionControllerV2Readiness().productionPromotionLive,false);
for(const key of ['liveEvidenceOrchestratorV2Code','livePromotionControllerV2Code'])assert.equal(manifest.readiness[key],true);

console.log('LANERIQ Avatar v4.7 LIVE Evidence gate passed: synthetic/self-report/stale/wrong-SHA evidence is rejected; capability-specific independent quorum, exact-main Production probe, Release Controller approval, incident blocking and evidence-expiry downgrade are fail-closed.');
