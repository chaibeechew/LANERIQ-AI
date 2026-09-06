import assert from 'node:assert/strict'
import './moba-creator-productization-tests.mjs'
import './moba-technical-ceiling-tests.mjs'
import {buildMobaRealProviderSmokePlan,evaluateMobaRealProviderSmokeEvidence,MOBA_REAL_PROVIDER_SMOKE_V15} from '../lib/game/moba-real-provider-smoke-v15.js'
import {decideMobaSelfHealingAction,evaluateMobaTelemetryWindow,MOBA_LIVE_SELF_HEALING_V16} from '../lib/game/moba-live-self-healing-v16.js'
import {buildMobaDeviceNetworkMatrix,evaluateMobaDeviceNetworkEvidence,MOBA_DEVICE_NETWORK_LAB_V17} from '../lib/game/moba-device-network-lab-v17.js'
import {buildMobaV15V18CreatorStatus,createMobaProductionCertificate,evaluateMobaProductionReleaseGate,MOBA_PRODUCTION_CERTIFICATION_V18} from '../lib/game/moba-production-certification-v18.js'

const sha='a'.repeat(40)
assert.equal(MOBA_REAL_PROVIDER_SMOKE_V15.playersPerMatch,10)
assert.equal(buildMobaRealProviderSmokePlan({buildSha:sha}).players,10)
const roster=Array.from({length:10},(_,i)=>({playerId:`p${i+1}`,team:i<5?'blue':'red'}))
const providerEvidence={trustedCollector:true,measured:true,synthetic:false,buildSha:sha,deploymentBuildSha:sha,providerTicketCreated:true,providerStatusChecked:true,providerCancelChecked:true,authoritativeHost:true,relayJoined:true,matchmakingVerified:true,roster,fullMatchCompleted:true,reconnectVerified:true,authoritativeResult:true,latencyP95Ms:80,packetLossPct:.5,crashRatePct:0}
const provider=evaluateMobaRealProviderSmokeEvidence(providerEvidence)
assert.equal(provider.passed,true)
assert.equal(evaluateMobaRealProviderSmokeEvidence({...providerEvidence,synthetic:true}).passed,false)

assert.equal(MOBA_LIVE_SELF_HEALING_V16.trustedTelemetryRequired,true)
const healthyTelemetry={trustedCollector:true,measured:true,synthetic:false,buildSha:sha,deploymentBuildSha:sha,tickP95Ms:30,latencyP95Ms:90,packetLossPct:1,crashRatePct:.01,errorRatePct:.2,cpuPct:55,reconnectSuccessRate:.999}
assert.equal(evaluateMobaTelemetryWindow(healthyTelemetry).healthy,true)
assert.equal(decideMobaSelfHealingAction({telemetry:{...healthyTelemetry,latencyP95Ms:400},regionHealthy:false}).action,'region_failover')
assert.equal(decideMobaSelfHealingAction({telemetry:{...healthyTelemetry,crashRatePct:1},canary:true}).action,'rollback_canary')

assert.equal(MOBA_DEVICE_NETWORK_LAB_V17.realDeviceRequired,true)
const matrix=buildMobaDeviceNetworkMatrix({buildSha:sha})
assert.equal(matrix.cases.length,8)
const runs=matrix.cases.map(({platform,network})=>({platform,network,realDevice:true,measured:true,synthetic:false,trustedCollector:true,buildSha:sha,reconnectVerified:true,backgroundResumeVerified:true,thermalCritical:false,thermalMinutes:30,frameTimeP95Ms:20,crashFreeSessionRate:.999}))
const device=evaluateMobaDeviceNetworkEvidence({buildSha:sha,runs})
assert.equal(device.passed,true)
assert.equal(evaluateMobaDeviceNetworkEvidence({buildSha:sha,runs:runs.map((r,i)=>i===0?{...r,realDevice:false}:r)}).passed,false)

assert.equal(MOBA_PRODUCTION_CERTIFICATION_V18.autoReleaseFailClosed,true)
const telemetry=evaluateMobaTelemetryWindow(healthyTelemetry)
const capacity={productionCertified:true,buildSha:sha}
const gateInput={githubMainSha:sha,vercelProductionSha:sha,runtimeSha:sha,providerSmoke:provider,telemetry,capacity,deviceLab:device,regionalFailoverVerified:true,edgeProtectionVerified:true,rollbackVerified:true,signedNativeBuildEvidence:true,productionTelemetryVerified:true}
const gate=evaluateMobaProductionReleaseGate(gateInput)
assert.equal(gate.productionReady,true)
assert.equal(createMobaProductionCertificate(gateInput).issued,true)
assert.equal(evaluateMobaProductionReleaseGate({...gateInput,runtimeSha:'b'.repeat(40)}).productionReady,false)

const blocked=buildMobaV15V18CreatorStatus({buildSha:sha})
assert.equal(blocked.productionReady,false)
assert.equal(blocked.nextAction,'connect_and_run_real_provider_smoke')
assert.equal(blocked.zeroCrashGuarantee,false)
assert.equal(blocked.zeroBugGuarantee,false)

console.log('✓ MOBA V15–V18 passed: real-provider smoke, live telemetry/self-healing, real-device network lab and exact-SHA Production certification remain evidence-bound and fail-closed.')
