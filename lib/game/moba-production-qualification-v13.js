import {evaluateMobaLivePreviewActivation,readMobaLiveDeploymentContext,sanitizeMobaProviderReadiness} from "./multiplayer-live-activation-v12.js";

const SHA=/^[a-f0-9]{7,64}$/i;
function text(v,m=160){return String(v??"").trim().slice(0,m);}
function finite(v,f=Infinity){const n=Number(v);return Number.isFinite(n)?n:f;}
function bool(v){return v===true;}
function arr(v){return Array.isArray(v)?v:[];}
function hasAll(values,required){const set=new Set(arr(values).map(v=>String(v).toLowerCase()));return required.every(v=>set.has(v));}
function sameSha(a,b){const x=text(a,64),y=text(b,64);return Boolean(SHA.test(x)&&SHA.test(y)&&x===y);}
function result(layer,name,checks,extra={}){const passed=Object.values(checks).every(Boolean);return Object.freeze({layer,name,passed,checks:Object.freeze(checks),...extra});}

export const MOBA_PRODUCTION_QUALIFICATION_V13=Object.freeze({
  version:"moba-production-qualification-v13",
  providerNeutral:true,
  dedicatedLanerIqServerRequired:false,
  layers:Object.freeze([
    "provider-adapter-qualification",
    "ten-player-preview-match",
    "network-capacity-fault-soak",
    "real-ios-android-device-envelope",
    "exact-sha-production-certification"
  ]),
  creatorConfigurationRequired:false,
  syntheticEvidenceAccepted:false,
  zeroCrashGuarantee:false,
  zeroBugGuarantee:false,
  truthRule:"V13 automates five production-qualification layers but never promotes modeled, synthetic, Preview-only or client-supplied claims into Production evidence. Every Live layer must be backed by trusted platform-collected evidence bound to the exact build."
});

export function evaluateMobaProviderQualification({providerConfig={},deployment=readMobaLiveDeploymentContext(),evidence={}}={}){
  const provider=sanitizeMobaProviderReadiness(providerConfig);
  const preview=evaluateMobaLivePreviewActivation({provider,deployment});
  const capabilities=evidence?.capabilities||{};
  const checks={
    providerConfigured:provider.configured===true,
    providerNotCostBlocked:provider.blockedByCostPolicy!==true,
    statusCheckReady:provider.statusCheckReady===true,
    cancellationReady:provider.cancellationReady===true,
    exactBuildBound:deployment.exactBuildBound===true,
    hostedRuntime:deployment.hostedRuntime===true,
    platformCollector:evidence?.trustedCollector===true,
    authoritativeHost:capabilities.authoritativeHost===true,
    relay:capabilities.relay===true,
    matchmaking:capabilities.matchmaking===true,
    telemetry:capabilities.telemetry===true,
    reconnect:capabilities.reconnect===true,
    regionalFailover:capabilities.regionalFailover===true,
    adapterHealthVerified:evidence?.healthVerified===true,
    buildMatch:sameSha(deployment.buildSha,evidence?.buildSha)
  };
  return result(1,"Provider Adapter Qualification",checks,{previewContractReady:preview.livePreviewReady===true,buildSha:deployment.buildSha||null,productionReady:false,providerIdentityExposed:false,credentialExposed:false});
}

export function evaluateMobaTenPlayerPreview({expectedBuildSha="",evidence={}}={}){
  const teams=evidence?.teams||{};
  const checks={
    trustedCollector:evidence?.trustedCollector===true,
    measured:evidence?.source==="measured",
    exactBuildMatch:sameSha(expectedBuildSha,evidence?.buildSha),
    realProviderSession:evidence?.realProviderSession===true,
    uniquePlayers:Number(evidence?.uniquePlayers)===10,
    blueTeam:Number(teams?.blue)===5,
    redTeam:Number(teams?.red)===5,
    authoritativeSnapshots:evidence?.authoritativeSnapshots===true,
    serverAuthoritativeCombat:evidence?.serverAuthoritativeCombat===true,
    reconnectVerified:evidence?.reconnectVerified===true,
    resultAuthoritative:evidence?.resultAuthoritative===true,
    fullMatchCompleted:evidence?.fullMatchCompleted===true,
    latencyP95:finite(evidence?.latencyP95Ms)<=250,
    packetLoss:finite(evidence?.packetLossPct)<=5,
    crashEnvelope:finite(evidence?.crashRatePct)<=0.1
  };
  return result(2,"10-player Live Preview Match",checks,{verifiedPlayers:checks.uniquePlayers?10:0,latencyP95Ms:Number.isFinite(Number(evidence?.latencyP95Ms))?Number(evidence.latencyP95Ms):null,packetLossPct:Number.isFinite(Number(evidence?.packetLossPct))?Number(evidence.packetLossPct):null,productionReady:false});
}

export function evaluateMobaNetworkCapacityEnvelope({expectedBuildSha="",evidence={}}={}){
  const stages=arr(evidence?.stages).filter(s=>s?.source==="measured"&&s?.trustedCollector===true&&sameSha(expectedBuildSha,s?.buildSha));
  const passedTargets=new Set(stages.filter(s=>s?.passed===true&&finite(s?.serverTickP95Ms)<=50&&finite(s?.latencyP95Ms)<=250&&finite(s?.packetLossPct)<=5&&finite(s?.crashRatePct)<=0.1&&finite(s?.errorRatePct)<=1).map(s=>Number(s?.targetConcurrentPlayers)));
  const checks={
    trustedCollector:evidence?.trustedCollector===true,
    exactBuildMatch:sameSha(expectedBuildSha,evidence?.buildSha),
    measured1k:passedTargets.has(1000),
    measured5k:passedTargets.has(5000),
    measured10k:passedTargets.has(10000),
    soak:finite(evidence?.soakMinutes,0)>=60,
    faultInjection:evidence?.faultInjectionPassed===true,
    reconnectRecovery:evidence?.reconnectRecoveryPassed===true,
    regionalFailover:evidence?.regionalFailoverPassed===true,
    splitBrainPrevented:evidence?.splitBrainPrevented===true,
    rollbackVerified:evidence?.rollbackVerified===true
  };
  return result(3,"Network / Capacity / Fault / Soak",checks,{verifiedConcurrentPlayers:checks.measured10k?10000:checks.measured5k?5000:checks.measured1k?1000:0,productionReady:false});
}

function evaluateDevice(platform,expectedBuildSha,evidence={}){
  const profiles=arr(evidence?.networkProfiles);
  const checks={
    trustedCollector:evidence?.trustedCollector===true,
    realDevice:evidence?.realDevice===true,
    platform:evidence?.platform===platform,
    exactBuildMatch:sameSha(expectedBuildSha,evidence?.buildSha),
    wifi:hasAll(profiles,["wifi"]),
    cellular:hasAll(profiles,["4g","5g"]),
    degraded:hasAll(profiles,["weak"]),
    reconnect:evidence?.reconnectVerified===true,
    backgroundResume:evidence?.backgroundResumeVerified===true,
    thermal:evidence?.thermalRunPassed===true,
    frameP95:finite(evidence?.frameTimeP95Ms)<=33.4,
    crashFreeSessions:finite(evidence?.crashFreeSessionRate,0)>=0.995
  };
  return result(platform==="ios"?4.1:4.2,platform==="ios"?"iOS Real-device Envelope":"Android Real-device Envelope",checks);
}

export function evaluateMobaRealDeviceEnvelope({expectedBuildSha="",ios={},android={}}={}){
  const iosResult=evaluateDevice("ios",expectedBuildSha,ios),androidResult=evaluateDevice("android",expectedBuildSha,android);
  return result(4,"Real iOS + Android Device Envelope",{ios:iosResult.passed,android:androidResult.passed},{ios:iosResult,android:androidResult,productionReady:false});
}

export function evaluateMobaProductionCertification({expectedBuildSha="",layers={},evidence={}}={}){
  const gitSha=text(evidence?.githubMainSha,64),productionSha=text(evidence?.productionDeploymentSha,64),runtimeSha=text(evidence?.runtimeVerifiedSha,64);
  const checks={
    layer1:layers?.provider?.passed===true,
    layer2:layers?.preview?.passed===true,
    layer3:layers?.network?.passed===true,
    layer4:layers?.devices?.passed===true,
    productionTarget:evidence?.productionTarget===true,
    githubMainExact:sameSha(expectedBuildSha,gitSha),
    vercelProductionExact:sameSha(expectedBuildSha,productionSha),
    runtimeExact:sameSha(expectedBuildSha,runtimeSha),
    exactTripleSha:Boolean(gitSha&&gitSha===productionSha&&productionSha===runtimeSha),
    trustedCollector:evidence?.trustedCollector===true,
    productionTelemetry:evidence?.productionTelemetry===true,
    edgeProtection:evidence?.edgeProtectionVerified===true,
    capacityCertificate:Boolean(text(evidence?.capacityCertificateId,160)),
    rollback:evidence?.rollbackVerified===true,
    signedNativeEvidence:evidence?.signedNativeBuildEvidence===true
  };
  return result(5,"Production Certification",checks,{productionReady:Object.values(checks).every(Boolean),capacityCertificateId:text(evidence?.capacityCertificateId,160)||null,zeroCrashGuarantee:false,zeroBugGuarantee:false});
}

export function runMobaFiveLayerQualification({providerConfig={},deployment=readMobaLiveDeploymentContext(),providerEvidence={},previewEvidence={},networkEvidence={},deviceEvidence={},productionEvidence={}}={}){
  const expectedBuildSha=deployment?.buildSha||providerEvidence?.buildSha||previewEvidence?.buildSha||networkEvidence?.buildSha||productionEvidence?.productionDeploymentSha||"";
  const provider=evaluateMobaProviderQualification({providerConfig,deployment,evidence:providerEvidence});
  const preview=evaluateMobaTenPlayerPreview({expectedBuildSha,evidence:previewEvidence});
  const network=evaluateMobaNetworkCapacityEnvelope({expectedBuildSha,evidence:networkEvidence});
  const devices=evaluateMobaRealDeviceEnvelope({expectedBuildSha,ios:deviceEvidence?.ios||{},android:deviceEvidence?.android||{}});
  const production=evaluateMobaProductionCertification({expectedBuildSha,layers:{provider,preview,network,devices},evidence:productionEvidence});
  const ordered=[provider,preview,network,devices,production];
  const firstBlocked=ordered.find(x=>!x.passed)||null;
  return Object.freeze({
    version:MOBA_PRODUCTION_QUALIFICATION_V13.version,
    expectedBuildSha:SHA.test(expectedBuildSha)?expectedBuildSha:null,
    layers:Object.freeze({provider,preview,network,devices,production}),
    completedLayers:ordered.filter(x=>x.passed).length,
    nextRequiredLayer:firstBlocked?Math.ceil(firstBlocked.layer):null,
    productionReady:production.productionReady===true,
    creatorServerConfigurationRequired:false,
    syntheticEvidenceAccepted:false,
    zeroCrashGuarantee:false,
    zeroBugGuarantee:false,
    truthRule:MOBA_PRODUCTION_QUALIFICATION_V13.truthRule
  });
}

export function buildMobaCreatorQualificationStatus({providerConfig={},deployment=readMobaLiveDeploymentContext()}={}){
  const provider=sanitizeMobaProviderReadiness(providerConfig),preview=evaluateMobaLivePreviewActivation({provider,deployment});
  return Object.freeze({
    version:MOBA_PRODUCTION_QUALIFICATION_V13.version,
    fiveLayerPipeline:true,
    providerContractConnected:provider.configured===true,
    previewBuildReady:preview.livePreviewReady===true,
    currentEvidenceLevel:preview.livePreviewReady?"preview-contract-ready":"simulation-or-contract-pending",
    productionReady:false,
    nextActions:Object.freeze(["provider-live-qualification","10-player-measured-preview","1k-5k-10k-fault-soak","real-ios-android-envelope","exact-sha-production-certification"]),
    creatorServerConfigurationRequired:false,
    providerIdentityExposed:false,
    credentialExposed:false,
    truthRule:"Creators only choose gameplay/network intent. Platform operators connect providers and evidence collectors once; Production remains fail-closed until all five measured layers pass."
  });
}
