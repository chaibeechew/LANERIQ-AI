import assert from "node:assert/strict";
import {
  MOBA_PRODUCTION_QUALIFICATION_V13,
  buildMobaCreatorQualificationStatus,
  evaluateMobaNetworkCapacityEnvelope,
  evaluateMobaProductionCertification,
  evaluateMobaProviderQualification,
  evaluateMobaRealDeviceEnvelope,
  evaluateMobaTenPlayerPreview,
  runMobaFiveLayerQualification,
} from "../lib/game/moba-production-qualification-v13.js";

const SHA="934a9a2dc1a265c752aec107ee7e79bb15576962";
const deployment={environment:"preview",buildSha:SHA,exactBuildBound:true,hostedRuntime:true};
const providerConfig={connected:true,configured:true,blockedByCostPolicy:false,statusEndpoint:"https://provider.example/status/{ticketId}",cancelEndpoint:"https://provider.example/cancel/{ticketId}"};
const providerEvidence={trustedCollector:true,healthVerified:true,buildSha:SHA,capabilities:{authoritativeHost:true,relay:true,matchmaking:true,telemetry:true,reconnect:true,regionalFailover:true}};
const previewEvidence={trustedCollector:true,source:"measured",buildSha:SHA,realProviderSession:true,uniquePlayers:10,teams:{blue:5,red:5},authoritativeSnapshots:true,serverAuthoritativeCombat:true,reconnectVerified:true,resultAuthoritative:true,fullMatchCompleted:true,latencyP95Ms:72,packetLossPct:.4,crashRatePct:0};
const stages=[1000,5000,10000].map(targetConcurrentPlayers=>({trustedCollector:true,source:"measured",buildSha:SHA,targetConcurrentPlayers,passed:true,serverTickP95Ms:31,latencyP95Ms:83,packetLossPct:.6,crashRatePct:.01,errorRatePct:.1}));
const networkEvidence={trustedCollector:true,buildSha:SHA,stages,soakMinutes:120,faultInjectionPassed:true,reconnectRecoveryPassed:true,regionalFailoverPassed:true,splitBrainPrevented:true,rollbackVerified:true};
const device=(platform)=>({trustedCollector:true,realDevice:true,platform,buildSha:SHA,networkProfiles:["wifi","4g","5g","weak"],reconnectVerified:true,backgroundResumeVerified:true,thermalRunPassed:true,frameTimeP95Ms:20,crashFreeSessionRate:.999});
const deviceEvidence={ios:device("ios"),android:device("android")};
const productionEvidence={trustedCollector:true,productionTarget:true,githubMainSha:SHA,productionDeploymentSha:SHA,runtimeVerifiedSha:SHA,productionTelemetry:true,edgeProtectionVerified:true,capacityCertificateId:"cap-ap-se-10k-001",rollbackVerified:true,signedNativeBuildEvidence:true};

assert.equal(MOBA_PRODUCTION_QUALIFICATION_V13.layers.length,5);
assert.equal(MOBA_PRODUCTION_QUALIFICATION_V13.creatorConfigurationRequired,false);
assert.equal(MOBA_PRODUCTION_QUALIFICATION_V13.syntheticEvidenceAccepted,false);

const empty=runMobaFiveLayerQualification({providerConfig:{},deployment});
assert.equal(empty.productionReady,false);
assert.equal(empty.nextRequiredLayer,1);
assert.equal(empty.creatorServerConfigurationRequired,false);

const provider=evaluateMobaProviderQualification({providerConfig,deployment,evidence:providerEvidence});
assert.equal(provider.passed,true);
assert.equal(provider.providerIdentityExposed,false);
assert.equal(provider.credentialExposed,false);

const preview=evaluateMobaTenPlayerPreview({expectedBuildSha:SHA,evidence:previewEvidence});
assert.equal(preview.passed,true);
assert.equal(preview.verifiedPlayers,10);
assert.equal(evaluateMobaTenPlayerPreview({expectedBuildSha:SHA,evidence:{...previewEvidence,uniquePlayers:9}}).passed,false);
assert.equal(evaluateMobaTenPlayerPreview({expectedBuildSha:SHA,evidence:{...previewEvidence,source:"synthetic"}}).passed,false);

const network=evaluateMobaNetworkCapacityEnvelope({expectedBuildSha:SHA,evidence:networkEvidence});
assert.equal(network.passed,true);
assert.equal(network.verifiedConcurrentPlayers,10000);
assert.equal(evaluateMobaNetworkCapacityEnvelope({expectedBuildSha:SHA,evidence:{...networkEvidence,stages:stages.filter(s=>s.targetConcurrentPlayers!==10000)}}).passed,false);

const devices=evaluateMobaRealDeviceEnvelope({expectedBuildSha:SHA,...deviceEvidence});
assert.equal(devices.passed,true);
assert.equal(evaluateMobaRealDeviceEnvelope({expectedBuildSha:SHA,ios:{...deviceEvidence.ios,buildSha:"aaaaaaaa"},android:deviceEvidence.android}).passed,false);

const layers={provider,preview,network,devices};
const production=evaluateMobaProductionCertification({expectedBuildSha:SHA,layers,evidence:productionEvidence});
assert.equal(production.passed,true);
assert.equal(production.productionReady,true);
assert.equal(production.zeroCrashGuarantee,false);
assert.equal(evaluateMobaProductionCertification({expectedBuildSha:SHA,layers,evidence:{...productionEvidence,runtimeVerifiedSha:"bbbbbbbb"}}).productionReady,false);

const full=runMobaFiveLayerQualification({providerConfig,deployment,providerEvidence,previewEvidence,networkEvidence,deviceEvidence,productionEvidence});
assert.equal(full.completedLayers,5);
assert.equal(full.nextRequiredLayer,null);
assert.equal(full.productionReady,true);
assert.equal(full.zeroCrashGuarantee,false);
assert.equal(full.zeroBugGuarantee,false);

const creator=buildMobaCreatorQualificationStatus({providerConfig,deployment});
assert.equal(creator.fiveLayerPipeline,true);
assert.equal(creator.creatorServerConfigurationRequired,false);
assert.equal(creator.productionReady,false);
assert.equal(creator.providerIdentityExposed,false);

console.log("✓ MOBA Production Qualification V13 passed: five-layer provider → 10-player Preview → 1K/5K/10K + fault/soak → iOS/Android → exact-SHA Production certification is fail-closed and never treats synthetic evidence as Production proof.");
