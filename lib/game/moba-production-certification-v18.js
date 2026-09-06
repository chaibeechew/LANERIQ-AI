import {createHash} from 'node:crypto'
import {buildMobaRealProviderSmokePlan,evaluateMobaRealProviderSmokeEvidence} from './moba-real-provider-smoke-v15.js'
import {decideMobaSelfHealingAction,evaluateMobaTelemetryWindow} from './moba-live-self-healing-v16.js'
import {buildMobaDeviceNetworkMatrix,evaluateMobaDeviceNetworkEvidence} from './moba-device-network-lab-v17.js'

function freeze(v){return Object.freeze(v)}
function validSha(v){return /^[0-9a-f]{40}$/i.test(String(v||''))}
function sameSha(...values){return values.length>0&&values.every(validSha)&&values.every(v=>v===values[0])}

export const MOBA_PRODUCTION_CERTIFICATION_V18=freeze({
  version:'moba-production-certification-v18',
  exactShaRequired:true,
  autoReleaseFailClosed:true,
  zeroCrashGuarantee:false,
  zeroBugGuarantee:false,
  systems:freeze(['exact-sha-chain','provider-smoke-certificate','telemetry-health','capacity-certificate','device-envelope','edge-protection','rollback-proof','signed-native-build','release-decision']),
  truthRule:'V18 can issue an evidence-scoped Production certificate only when all external evidence is trusted, exact-build bound and complete. Missing live evidence always blocks release.'
})

export function evaluateMobaProductionReleaseGate(input={}){
  const shaOk=sameSha(input.githubMainSha,input.vercelProductionSha,input.runtimeSha)
  const provider=input.providerSmoke||{}
  const telemetry=input.telemetry||{}
  const device=input.deviceLab||{}
  const capacity=input.capacity||{}
  const exact=input.githubMainSha
  const checks=freeze({
    exactShaChain:shaOk,
    providerSmoke:provider.passed===true&&provider.liveProviderVerified===true&&provider.buildSha===exact,
    telemetryTrusted:telemetry.trusted===true&&telemetry.healthy===true&&telemetry.exactBuildBound===true&&telemetry.buildSha===exact,
    capacityCertified:capacity.productionCertified===true&&capacity.buildSha===exact,
    regionalFailover:input.regionalFailoverVerified===true,
    edgeProtection:input.edgeProtectionVerified===true,
    rollback:input.rollbackVerified===true,
    deviceLab:device.passed===true&&device.realDeviceEvidenceVerified===true&&device.buildSha===exact,
    signedNativeBuild:input.signedNativeBuildEvidence===true,
    productionTelemetry:input.productionTelemetryVerified===true,
  })
  const productionReady=Object.values(checks).every(Boolean)
  const blockers=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k)
  return freeze({version:MOBA_PRODUCTION_CERTIFICATION_V18.version,productionReady,releaseDecision:productionReady?'release_eligible':'release_blocked',checks,blockers,exactBuildSha:shaOk?exact:null,zeroCrashGuarantee:false,zeroBugGuarantee:false,truthRule:MOBA_PRODUCTION_CERTIFICATION_V18.truthRule})
}

export function createMobaProductionCertificate(input={}){
  const gate=evaluateMobaProductionReleaseGate(input)
  if(!gate.productionReady)return freeze({issued:false,gate,certificate:null})
  const scope=freeze({version:MOBA_PRODUCTION_CERTIFICATION_V18.version,buildSha:gate.exactBuildSha,providerEvidence:'verified',capacityEvidence:'verified',deviceEvidence:'verified',rollback:'verified',edgeProtection:'verified'})
  const id=createHash('sha256').update(JSON.stringify(scope)).digest('hex')
  return freeze({issued:true,gate,certificate:freeze({certificateId:id,scope,zeroCrashGuarantee:false,zeroBugGuarantee:false})})
}

export function buildMobaV15V18CreatorStatus({buildSha='',providerEvidence={},telemetryEvidence={},capacityEvidence={},deviceRuns=[],production={}}={}){
  const providerPlan=buildMobaRealProviderSmokePlan({buildSha})
  const providerSmoke=evaluateMobaRealProviderSmokeEvidence(providerEvidence)
  const telemetry=evaluateMobaTelemetryWindow(telemetryEvidence)
  const recovery=decideMobaSelfHealingAction({telemetry:telemetryEvidence,consecutiveBreaches:production.consecutiveBreaches||0,providerHealthy:production.providerHealthy!==false,regionHealthy:production.regionHealthy!==false,canary:production.canary!==false,ranked:production.ranked!==false})
  const deviceMatrix=buildMobaDeviceNetworkMatrix({buildSha})
  const deviceLab=evaluateMobaDeviceNetworkEvidence({buildSha,runs:deviceRuns})
  const gate=evaluateMobaProductionReleaseGate({...production,githubMainSha:production.githubMainSha||'',vercelProductionSha:production.vercelProductionSha||'',runtimeSha:production.runtimeSha||'',providerSmoke,telemetry,capacity:capacityEvidence,deviceLab})
  let nextAction='connect_and_run_real_provider_smoke'
  if(providerSmoke.passed)nextAction='collect_live_telemetry_and_capacity'
  if(providerSmoke.passed&&telemetry.healthy&&capacityEvidence.productionCertified===true)nextAction='run_real_device_network_lab'
  if(providerSmoke.passed&&telemetry.healthy&&capacityEvidence.productionCertified===true&&deviceLab.passed)nextAction='verify_exact_sha_and_issue_production_certificate'
  if(gate.productionReady)nextAction='production_release_eligible'
  return freeze({version:MOBA_PRODUCTION_CERTIFICATION_V18.version,providerPlan,providerSmoke,telemetry,recovery,deviceMatrix,deviceLab,releaseGate:gate,nextAction,productionReady:gate.productionReady,zeroCrashGuarantee:false,zeroBugGuarantee:false,truthRule:MOBA_PRODUCTION_CERTIFICATION_V18.truthRule})
}
