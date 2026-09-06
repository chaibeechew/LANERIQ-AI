import assert from 'node:assert/strict';
import {buildLivingCharacterManifest} from '../lib/ai/avatar-character-core.js';
import {buildAvatarEvidenceAttestation} from '../lib/ai/avatar-evidence-attestation-v2.js';
import {buildAvatarVerifierResult} from '../lib/ai/avatar-evidence-signature-verifier-v1.js';
import {createAvatarTrustedIssuerRegistry,registerAvatarTrustedIssuer} from '../lib/ai/avatar-trusted-issuer-registry-v1.js';
import {createAvatarEvidenceRegistry} from '../lib/ai/avatar-evidence-registry-v1.js';
import {buildAvatarEvidenceExecutionEnvelope,evaluateAvatarEvidenceExecutionIntake,getAvatarEvidenceExecutionIntakeReadiness} from '../lib/ai/avatar-evidence-execution-intake-v1.js';
import {buildAvatarEvidenceCampaign,evaluateAvatarEvidenceCampaign,getAvatarEvidenceCampaignOrchestratorReadiness,updateAvatarEvidenceCampaignTask} from '../lib/ai/avatar-evidence-campaign-orchestrator-v1.js';
import {appendAvatarHumanRating,buildAvatarHumanPerceptionPanel,evaluateAvatarHumanPerceptionPanel,getAvatarHumanPerceptionBenchmarkReadiness} from '../lib/ai/avatar-human-perception-benchmark-v1.js';
import {buildAvatarMarketReadinessScorecard,getAvatarMarketReadinessScorecardReadiness} from '../lib/ai/avatar-market-readiness-scorecard-v1.js';
import {buildAvatarFailureToFixPlan,getAvatarFailureToFixLoopReadiness} from '../lib/ai/avatar-failure-to-fix-loop-v1.js';

const sha='b'.repeat(40),releaseId='release-v50-test',buildId='build-v50',now=1_810_000_000_000,challengeNonce='v50_challenge_nonce_1234567890';
const manifest=buildLivingCharacterManifest({characterId:'lc_v50_contract',style:'3d'});
for(const flag of ['evidenceExecutionIntakeCode','evidenceCampaignOrchestratorCode','humanPerceptionBenchmarkCode','marketReadinessScorecardCode','failureToFixLoopCode'])assert.equal(manifest.readiness[flag],true);
for(const flag of ['realtime3DRenderer','liveVoiceProvider','motionGenerator','physicalDeviceBenchmark','crossDeviceEncryptedHandoffLive'])assert.equal(manifest.readiness[flag],false);

let issuers=createAvatarTrustedIssuerRegistry({createdAtMs:now-1000});
issuers=registerAvatarTrustedIssuer(issuers,{issuerId:'native-v50',issuerType:'native-host',trustLevel:'production',keyId:'kid-v50',keyFingerprint:'9'.repeat(64),allowedSources:['native-host'],allowedCapabilities:['realtime3drenderer'],validFromMs:now-60000,validUntilMs:now+86400000});
const attestation=buildAvatarEvidenceAttestation({capability:'realtime3DRenderer',headSha:sha,evidenceDigest:'8'.repeat(64),issuer:'native-v50',sourceType:'native-host',probeId:'native-v50-probe',observedAtMs:now-1000,expiresAtMs:now+3600000,attestationVerified:true,synthetic:false,selfReported:false,physicalDevice:true,platform:'ios',model:'iphone-v50',exactBuildId:buildId,claims:['native-renderer-probe-pass','high-fidelity-asset-ready']});
const verifierResult=buildAvatarVerifierResult({signatureVerified:true,keyId:'kid-v50',keyFingerprint:'9'.repeat(64),signatureAlgorithm:'ES256',verifier:'trusted-v50-adapter',verifiedAtMs:now});
const envelope=buildAvatarEvidenceExecutionEnvelope({releaseId,headSha:sha,buildId,challengeNonce,sourceType:'native-host',attestation,verifierResult,receivedAtMs:now});
const intake=evaluateAvatarEvidenceExecutionIntake({envelope,issuerRegistry:issuers,evidenceRegistry:createAvatarEvidenceRegistry({createdAtMs:now-1000}),expectedHeadSha:sha,nowMs:now,minimumTrust:'production'});assert.equal(intake.pass,true);assert.equal(intake.quarantined,false);
const rejectedIntake=evaluateAvatarEvidenceExecutionIntake({envelope:{...envelope,headSha:'c'.repeat(40)},issuerRegistry:issuers,evidenceRegistry:createAvatarEvidenceRegistry(),expectedHeadSha:sha,nowMs:now});assert.equal(rejectedIntake.pass,false);assert.equal(rejectedIntake.quarantined,true);

let campaign=buildAvatarEvidenceCampaign({releaseId,headSha:sha,buildId,capabilities:['realtime3DRenderer','liveVoiceProvider'],createdAtMs:now});
assert.equal(evaluateAvatarEvidenceCampaign(campaign).pass,false);
for(const task of campaign.tasks.filter(x=>x.capability==='realtime3DRenderer')){campaign=updateAvatarEvidenceCampaignTask(campaign,{taskId:task.taskId,state:'issued',atMs:now});campaign=updateAvatarEvidenceCampaignTask(campaign,{taskId:task.taskId,state:'completed',receiptRef:`receipt:${task.sourceType}`,atMs:now+1});}
assert.equal(evaluateAvatarEvidenceCampaign(campaign).byCapability.realtime3DRenderer.pass,true);assert.equal(evaluateAvatarEvidenceCampaign(campaign).pass,false);
for(const task of campaign.tasks.filter(x=>x.capability==='liveVoiceProvider')){campaign=updateAvatarEvidenceCampaignTask(campaign,{taskId:task.taskId,state:'issued',atMs:now});campaign=updateAvatarEvidenceCampaignTask(campaign,{taskId:task.taskId,state:'completed',receiptRef:`receipt:${task.sourceType}`,atMs:now+1});}
assert.equal(evaluateAvatarEvidenceCampaign(campaign).pass,true);

let panel=buildAvatarHumanPerceptionPanel({panelId:'panel-v50',releaseId,headSha:sha,minimumRaters:12,createdAtMs:now});
const scores={identity:4.6,naturalness:4.4,lipSync:4.5,emotion:4.4,gesture:4.3,eyeContact:4.4,voiceRealism:4.5,motionContinuity:4.4,uncannyComfort:4.3};
for(let i=0;i<12;i++)panel=appendAvatarHumanRating(panel,{raterIdHash:`rater-hash-${String(i).padStart(2,'0')}`,scores,baselinePreference:i<9?'laneriq':i<11?'tie':'baseline',consentConfirmed:true,completedAtMs:now+i});
const human=evaluateAvatarHumanPerceptionPanel(panel);assert.equal(human.pass,true);assert.ok(human.winRate>=.55);

const incomplete=buildAvatarMarketReadinessScorecard({integration:{pass:true}});assert.equal(incomplete.marketCompetitive,false);const fixPlan=buildAvatarFailureToFixPlan({scorecard:incomplete});assert.ok(fixPlan.fixes.length>0);
const runtimeActivations=Object.fromEntries(['native-renderer','neural-voice','neural-motion','secure-hardware','trusted-verifier'].map(x=>[x,{pass:true}]));
const full=buildAvatarMarketReadinessScorecard({integration:{pass:true},runtimeActivations,physicalCampaign:{pass:true},qualityClosure:{pass:true},humanBenchmark:human,trustedPromotion:{pass:true},rollout:{stage:'active'},commercialEvidence:{pricingReady:true,supportReady:true,privacyReady:true,termsReady:true}});assert.equal(full.score,100);assert.equal(full.marketCompetitive,true);assert.equal(buildAvatarFailureToFixPlan({scorecard:full}).ready,true);

for(const ready of [getAvatarEvidenceExecutionIntakeReadiness(),getAvatarEvidenceCampaignOrchestratorReadiness(),getAvatarHumanPerceptionBenchmarkReadiness(),getAvatarMarketReadinessScorecardReadiness(),getAvatarFailureToFixLoopReadiness()])assert.equal(ready.codeReady,true);
console.log('LANERIQ Avatar v5.0 Evidence Execution gate passed: privileged trusted intake, all-selected capability campaign completion, blind human perception benchmark, market readiness scorecard and failure-to-fix planning are CODE-ready while external LIVE flags remain false.');
