import assert from 'node:assert/strict';
import {buildLivingCharacterManifest} from '../lib/ai/avatar-character-core.js';
import {buildAvatarEvidenceAttestation} from '../lib/ai/avatar-evidence-attestation-v2.js';
import {buildAvatarVerifierResult,getAvatarEvidenceSignatureVerifierReadiness} from '../lib/ai/avatar-evidence-signature-verifier-v1.js';
import {createAvatarTrustedIssuerRegistry,evaluateAvatarTrustedIssuer,getAvatarTrustedIssuerRegistryReadiness,registerAvatarTrustedIssuer,revokeAvatarTrustedIssuer} from '../lib/ai/avatar-trusted-issuer-registry-v1.js';
import {createAvatarEvidenceRegistry,evaluateAvatarEvidenceRegistryHealth,getAvatarEvidenceRegistryReadiness,revokeAvatarEvidenceRecord} from '../lib/ai/avatar-evidence-registry-v1.js';
import {evaluateAvatarEvidenceQuorum} from '../lib/ai/avatar-live-evidence-orchestrator-v2.js';
import {evaluateTrustedAvatarCapabilityQuorum,getAvatarTrustedLiveVerificationFabricReadiness,verifyAvatarEvidenceBatchForLive} from '../lib/ai/avatar-trusted-live-verification-fabric-v1.js';
import {buildAvatarProductionProbeChallenge,buildAvatarProductionProbeResponse,evaluateAvatarProductionProbeResponse,getAvatarProductionProbeEnvelopeReadiness} from '../lib/ai/avatar-production-probe-envelope-v1.js';
import {buildAvatarTrustedLivePromotionDecisionV3,getAvatarLivePromotionControllerV3Readiness} from '../lib/ai/avatar-live-promotion-controller-v3.js';
import {evaluateAvatarLiveLease,getAvatarLiveLeaseReadiness} from '../lib/ai/avatar-live-lease-v1.js';
import {buildAvatarLiveEvidenceMonitorSnapshot,evaluateAvatarLiveEvidenceMonitor,getAvatarLiveEvidenceMonitorReadiness} from '../lib/ai/avatar-live-evidence-monitor-v1.js';
import {buildAvatarVerifierAdapterReceipt,buildAvatarVerifierAdapterRequest,evaluateAvatarVerifierAdapterReceipt,getAvatarVerifierAdaptersReadiness} from '../lib/ai/avatar-verifier-adapters-v1.js';
import {getAvatarReleaseEvidenceBundleReadiness} from '../lib/ai/avatar-release-evidence-bundle-v1.js';
import {buildAvatarCapabilityTruthLedger} from '../lib/ai/avatar-production-quality.js';

const sha='a'.repeat(40),releaseId='release-v48-test',challengeNonce='challenge_nonce_v48_1234567890',now=1_800_000_000_000,capability='realtime3DRenderer';
const manifest=buildLivingCharacterManifest({characterId:'lc_v48_contract',type:'profile',style:'3d',language:'en'});
for(const flag of ['trustedIssuerRegistryCode','evidenceSignatureVerifierCode','evidenceRegistryCode','productionProbeEnvelopeCode','liveLeaseCode','releaseEvidenceBundleCode','verifierAdaptersCode','liveEvidenceMonitorCode','trustedLiveVerificationFabricCode','livePromotionControllerV3Code'])assert.equal(manifest.readiness[flag],true);
for(const flag of ['realtime3DRenderer','liveVoiceProvider','motionGenerator','physicalDeviceBenchmark','crossDeviceEncryptedHandoffLive'])assert.equal(manifest.readiness[flag],false);

let issuers=createAvatarTrustedIssuerRegistry({createdAtMs:now-1000});
const issuerDefs=[
  {issuerId:'native-verifier',issuerType:'native-host',keyId:'kid-native',keyFingerprint:'1'.repeat(64),allowedSources:['native-host']},
  {issuerId:'device-lab-verifier',issuerType:'device-lab',keyId:'kid-device',keyFingerprint:'2'.repeat(64),allowedSources:['physical-device-lab']},
  {issuerId:'github-ci-verifier',issuerType:'github-ci',keyId:'kid-ci',keyFingerprint:'3'.repeat(64),allowedSources:['github-ci']}
];
for(const def of issuerDefs)issuers=registerAvatarTrustedIssuer(issuers,{...def,trustLevel:'production',allowedCapabilities:[capability],validFromMs:now-60000,validUntilMs:now+86400000});
assert.equal(evaluateAvatarTrustedIssuer(issuers,{issuerId:'native-verifier',keyId:'kid-native',keyFingerprint:'1'.repeat(64),sourceType:'native-host',capability,nowMs:now,minimumTrust:'production'}).pass,true);

const make=(i,{issuer,sourceType,keyId,keyFingerprint,claims,physicalDevice=false,platform='',model=''})=>({
  attestation:buildAvatarEvidenceAttestation({capability,headSha:sha,evidenceDigest:String(i).repeat(64),issuer,sourceType,probeId:`probe-${i}`,observedAtMs:now-1000,expiresAtMs:now+3600000,attestationVerified:true,synthetic:false,selfReported:false,physicalDevice,platform,model,exactBuildId:'build-v48',claims}),
  verifierResult:buildAvatarVerifierResult({signatureVerified:true,keyId,keyFingerprint,signatureAlgorithm:'ES256',verifier:'trusted-test-adapter',verifiedAtMs:now})
});
const items=[
  make(4,{issuer:'native-verifier',sourceType:'native-host',keyId:'kid-native',keyFingerprint:'1'.repeat(64),physicalDevice:true,platform:'ios',model:'iphone-physical-a',claims:['native-renderer-probe-pass','high-fidelity-asset-ready']}),
  make(5,{issuer:'device-lab-verifier',sourceType:'physical-device-lab',keyId:'kid-device',keyFingerprint:'2'.repeat(64),physicalDevice:true,platform:'android',model:'android-physical-b',claims:['frame-budget-pass']}),
  make(6,{issuer:'github-ci-verifier',sourceType:'github-ci',keyId:'kid-ci',keyFingerprint:'3'.repeat(64),claims:['native-renderer-probe-pass']})
];

let evidenceRegistry=createAvatarEvidenceRegistry({createdAtMs:now-1000});
const fabric=verifyAvatarEvidenceBatchForLive({items,issuerRegistry:issuers,evidenceRegistry,expectedHeadSha:sha,challengeNonce,releaseId,nowMs:now,minimumTrust:'production'});
assert.equal(fabric.verified.length,3);assert.equal(fabric.rejected.length,0);evidenceRegistry=fabric.evidenceRegistry;assert.equal(evaluateAvatarEvidenceRegistryHealth(evidenceRegistry,{nowMs:now}).pass,true);
const trustedQuorum=evaluateTrustedAvatarCapabilityQuorum({fabricReport:fabric,capability,expectedHeadSha:sha,nowMs:now});assert.equal(trustedQuorum.pass,true);

// Legacy boolean-only v2 quorum may be complete, but v3 Production promotion must reject it because it is not a trusted-quorum contract.
const legacyQuorum=evaluateAvatarEvidenceQuorum({capability,attestations:items.map(x=>x.attestation),expectedHeadSha:sha,nowMs:now});assert.equal(legacyQuorum.pass,true);
const probeChallenge=buildAvatarProductionProbeChallenge({capability,headSha:sha,releaseId,challengeNonce:'prod_probe_nonce_123456789012345',issuedAtMs:now,expiresAtMs:now+600000});
const probeResponse=buildAvatarProductionProbeResponse({challenge:probeChallenge,probeId:'prod-probe-renderer',exactBuildId:'build-v48',observedHeadSha:sha,claims:['production-runtime-probe-pass'],attestationRef:items[0].attestation.evidenceDigest,completedAtMs:now+1000});
const probeEvaluation=evaluateAvatarProductionProbeResponse({challenge:probeChallenge,response:probeResponse,nowMs:now+2000,usedNonces:[]});assert.equal(probeEvaluation.pass,true);
const approval={contract:'laneriq-production-release-controller-approval-v1',approved:true,headSha:sha,releaseId,approvalId:'approval-v48',actorId:'production-release-control'};
const rejectedLegacy=buildAvatarTrustedLivePromotionDecisionV3({manifest,releaseId,expectedMainSha:sha,productionRuntimeSha:sha,buildId:'build-v48',trustedQuorums:{[capability]:legacyQuorum},productionProbeEvaluations:{[capability]:probeEvaluation},releaseControllerApproval:approval,issuerRegistryRevision:issuers.revision,evidenceRegistryRevision:evidenceRegistry.revision,nowMs:now});assert.equal(rejectedLegacy.requestedLiveFlags.realtime3DRenderer,false);

const promotion=buildAvatarTrustedLivePromotionDecisionV3({manifest,releaseId,expectedMainSha:sha,productionRuntimeSha:sha,buildId:'build-v48',trustedQuorums:{[capability]:trustedQuorum},productionProbeEvaluations:{[capability]:probeEvaluation},releaseControllerApproval:approval,issuerRegistryRevision:issuers.revision,evidenceRegistryRevision:evidenceRegistry.revision,nowMs:now,leaseTtlMs:3600000});
assert.equal(promotion.pass,true);assert.equal(promotion.requestedLiveFlags.realtime3DRenderer,true);assert.equal(promotion.requestedLiveFlags.liveVoiceProvider,false);assert.equal(promotion.leases.length,1);assert.equal(promotion.leases[0].evidenceBundleId,promotion.releaseEvidenceBundle.bundleId);assert.equal(manifest.readiness.realtime3DRenderer,false);
assert.equal(evaluateAvatarLiveLease(promotion.leases[0],{expectedHeadSha:sha,nowMs:now+1000}).pass,true);assert.equal(evaluateAvatarLiveLease(promotion.leases[0],{expectedHeadSha:sha,nowMs:now+7200000}).pass,false);

const adapterRequest=buildAvatarVerifierAdapterRequest({sourceType:'native-host',capability,headSha:sha,releaseId,challengeNonce:'adapter_nonce_123456789012345',probeId:'native-probe',exactBuildId:'build-v48',platform:'ios',model:'iphone-physical-a'});const adapterReceipt=buildAvatarVerifierAdapterReceipt({request:adapterRequest,passed:true,signatureVerified:true,verifiedClaims:adapterRequest.requirements,keyId:'kid-native',keyFingerprint:'1'.repeat(64),verifiedAtMs:now});assert.equal(evaluateAvatarVerifierAdapterReceipt({request:adapterRequest,receipt:adapterReceipt,nowMs:now+1000}).pass,true);

const revokedEvidenceRegistry=revokeAvatarEvidenceRecord(evidenceRegistry,{evidenceDigest:items[0].attestation.evidenceDigest,reason:'probe-invalidated',atMs:now+2000});const monitor=buildAvatarLiveEvidenceMonitorSnapshot({headSha:sha,evidenceRegistry:revokedEvidenceRegistry,leases:promotion.leases,activeIncidents:[{id:'inc-v48',capability,severity:'high',status:'open'}],nowMs:now+3000});const monitorEvaluation=evaluateAvatarLiveEvidenceMonitor(monitor);assert.equal(monitorEvaluation.healthy,false);assert.ok(monitorEvaluation.affectedCapabilities.includes(capability));
const revokedIssuerRegistry=revokeAvatarTrustedIssuer(issuers,{issuerId:'native-verifier',keyId:'kid-native',reason:'key-rotation',atMs:now+4000});assert.equal(evaluateAvatarTrustedIssuer(revokedIssuerRegistry,{issuerId:'native-verifier',keyId:'kid-native',keyFingerprint:'1'.repeat(64),sourceType:'native-host',capability,nowMs:now+5000,minimumTrust:'production'}).pass,false);

for(const ready of [getAvatarTrustedIssuerRegistryReadiness(),getAvatarEvidenceSignatureVerifierReadiness(),getAvatarEvidenceRegistryReadiness(),getAvatarProductionProbeEnvelopeReadiness(),getAvatarLiveLeaseReadiness(),getAvatarReleaseEvidenceBundleReadiness(),getAvatarVerifierAdaptersReadiness(),getAvatarLiveEvidenceMonitorReadiness(),getAvatarTrustedLiveVerificationFabricReadiness(),getAvatarLivePromotionControllerV3Readiness()])assert.equal(ready.codeReady,true);
const ledger=buildAvatarCapabilityTruthLedger({manifest,evidence:{}});assert.equal(ledger.code.trustedIssuerRegistry,true);assert.equal(ledger.code.livePromotionControllerV3,true);assert.equal(ledger.live.trustedIssuerVerification,false);assert.equal(ledger.live.activeLiveLease,false);
console.log('LANERIQ Avatar v4.8 trusted LIVE verification gate passed: legacy boolean-only evidence cannot enter v3 Production promotion; trusted issuer, signature verification, immutable evidence registry, challenge-response Production probe, expiring LIVE lease, release evidence bundle, verifier adapters and continuous monitor are CODE-ready while real verifier/provider/device LIVE status remains false.');
