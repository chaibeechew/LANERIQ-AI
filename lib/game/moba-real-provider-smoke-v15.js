function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function validSha(v){return /^[0-9a-f]{40}$/i.test(String(v||''))}

export const MOBA_REAL_PROVIDER_SMOKE_V15=freeze({
  version:'moba-real-provider-smoke-v15',
  providerNeutral:true,
  realProviderRequired:true,
  syntheticCanPass:false,
  playersPerMatch:10,
  teamSize:5,
  systems:freeze(['ticket-lifecycle','ten-player-roster','relay-join','authoritative-match','reconnect-smoke','result-integrity','measured-preview-envelope']),
  truthRule:'V15 can automate and evaluate a real Provider smoke run, but it cannot mark the provider verified without trusted measured evidence from the exact hosted build.'
})

export function buildMobaRealProviderSmokePlan({buildSha='',region='auto'}={}){
  return freeze({version:MOBA_REAL_PROVIDER_SMOKE_V15.version,buildSha:validSha(buildSha)?buildSha:null,region:String(region||'auto').slice(0,64),players:10,teamSize:5,steps:freeze(['create-ticket','status-ticket','cancel-auxiliary-ticket','allocate-authoritative-host','join-relay-10-players','complete-5v5-match','force-one-reconnect','verify-authoritative-result','collect-measured-telemetry']),secretsExposed:false,productionTrafficRequired:false,truthRule:MOBA_REAL_PROVIDER_SMOKE_V15.truthRule})
}

function uniquePlayers(roster=[]){return new Set(roster.map(p=>String(p?.playerId||'')).filter(Boolean)).size}
function teamCount(roster=[],team){return roster.filter(p=>p?.team===team).length}

export function evaluateMobaRealProviderSmokeEvidence(evidence={}){
  const roster=Array.isArray(evidence.roster)?evidence.roster:[]
  const checks=freeze({
    trustedCollector:evidence.trustedCollector===true,
    measured:evidence.measured===true&&evidence.synthetic!==true,
    exactBuildBound:validSha(evidence.buildSha)&&evidence.buildSha===evidence.deploymentBuildSha,
    providerTicketCreated:evidence.providerTicketCreated===true,
    providerStatusChecked:evidence.providerStatusChecked===true,
    providerCancelChecked:evidence.providerCancelChecked===true,
    authoritativeHost:evidence.authoritativeHost===true,
    relayJoined:evidence.relayJoined===true,
    matchmakingVerified:evidence.matchmakingVerified===true,
    tenUniquePlayers:roster.length===10&&uniquePlayers(roster)===10,
    fiveBlue:teamCount(roster,'blue')===5,
    fiveRed:teamCount(roster,'red')===5,
    fullMatchCompleted:evidence.fullMatchCompleted===true,
    reconnectVerified:evidence.reconnectVerified===true,
    authoritativeResult:evidence.authoritativeResult===true,
    latencyP95:finite(evidence.latencyP95Ms,Infinity)<=250,
    packetLoss:finite(evidence.packetLossPct,Infinity)<=5,
    crashRate:finite(evidence.crashRatePct,Infinity)<=0.1,
  })
  const passed=Object.values(checks).every(Boolean)
  return freeze({version:MOBA_REAL_PROVIDER_SMOKE_V15.version,passed,liveProviderVerified:passed,productionReady:false,checks,buildSha:validSha(evidence.buildSha)?evidence.buildSha:null,evidenceLevel:passed?'measured-preview':'unverified',zeroCrashGuarantee:false,truthRule:MOBA_REAL_PROVIDER_SMOKE_V15.truthRule})
}
