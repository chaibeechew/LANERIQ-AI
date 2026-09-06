function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function validSha(v){return /^[0-9a-f]{40}$/i.test(String(v||''))}
const PLATFORMS=freeze(['ios','android'])
const NETWORKS=freeze(['wifi','4g','5g','weak'])

export const MOBA_DEVICE_NETWORK_LAB_V17=freeze({
  version:'moba-device-network-lab-v17',
  realDeviceRequired:true,
  platforms:PLATFORMS,
  networks:NETWORKS,
  systems:freeze(['real-device-matrix','reconnect','background-resume','thermal-run','frame-time','crash-free-session']),
  truthRule:'V17 requires measured evidence from real iOS and Android devices on the exact build. Simulators and synthetic network profiles can exercise the harness but cannot certify the device envelope.'
})

export function buildMobaDeviceNetworkMatrix({buildSha=''}={}){
  return freeze({version:MOBA_DEVICE_NETWORK_LAB_V17.version,buildSha:validSha(buildSha)?buildSha:null,cases:freeze(PLATFORMS.flatMap(platform=>NETWORKS.map(network=>freeze({platform,network,realDeviceRequired:true,reconnectRequired:true,backgroundResumeRequired:true,thermalRunRequired:true})))),truthRule:MOBA_DEVICE_NETWORK_LAB_V17.truthRule})
}

function key(platform,network){return `${platform}:${network}`}
export function evaluateMobaDeviceNetworkEvidence({buildSha='',runs=[]}={}){
  const byKey=new Map((Array.isArray(runs)?runs:[]).map(r=>[key(r?.platform,r?.network),r]))
  const caseResults=[]
  for(const platform of PLATFORMS)for(const network of NETWORKS){
    const r=byKey.get(key(platform,network))||{}
    const checks=freeze({realDevice:r.realDevice===true,measured:r.measured===true&&r.synthetic!==true,trustedCollector:r.trustedCollector===true,exactBuild:validSha(buildSha)&&r.buildSha===buildSha,reconnect:r.reconnectVerified===true,backgroundResume:r.backgroundResumeVerified===true,thermal:r.thermalCritical!==true&&finite(r.thermalMinutes,0)>=15,frameTime:finite(r.frameTimeP95Ms,Infinity)<=33.4,crashFree:finite(r.crashFreeSessionRate,0)>=0.995})
    caseResults.push(freeze({platform,network,passed:Object.values(checks).every(Boolean),checks}))
  }
  const passed=validSha(buildSha)&&caseResults.every(r=>r.passed)
  return freeze({version:MOBA_DEVICE_NETWORK_LAB_V17.version,passed,buildSha:validSha(buildSha)?buildSha:null,totalCases:caseResults.length,passedCases:caseResults.filter(r=>r.passed).length,cases:freeze(caseResults),realDeviceEvidenceVerified:passed,productionReady:false,deviceIdentifiersExposed:false,zeroCrashGuarantee:false,truthRule:MOBA_DEVICE_NETWORK_LAB_V17.truthRule})
}
