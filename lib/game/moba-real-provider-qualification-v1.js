import {cancelMultiplayerTicket,checkMultiplayerTicket,createMultiplayerTicket,getMultiplayerProviderConfig} from './multiplayer-provider-gateway.js'
import {evaluateMobaRealProviderSmokeEvidence} from './moba-real-provider-smoke-v15.js'

function freeze(v){return Object.freeze(v)}
function validSha(v){return /^[0-9a-f]{40}$/i.test(String(v||''))}
function safePlayerId(v){const s=String(v||'').trim();return /^[A-Za-z0-9._:-]{1,64}$/.test(s)?s:null}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)))}

export const MOBA_REAL_PROVIDER_QUALIFICATION_V1=freeze({
  version:'moba-real-provider-qualification-v1',
  providerNeutral:true,
  creatorVisibleSecrets:false,
  realProviderRequired:true,
  exactPlayers:10,
  productionReady:false,
  truthRule:'This runner can exercise the configured external multiplayer Provider, but it only returns verified=true when a trusted collector supplies real measured exact-build evidence. Missing Provider configuration or synthetic collection always fails closed.'
})

export function evaluateMobaProviderQualificationPrerequisites({buildSha='',playerIds=[],providerConfig=getMultiplayerProviderConfig(),collector}={}){
  const ids=(Array.isArray(playerIds)?playerIds:[]).map(safePlayerId).filter(Boolean)
  const unique=new Set(ids)
  const checks=freeze({
    exactBuild:validSha(buildSha),
    providerConfigured:providerConfig?.configured===true,
    providerNotCostBlocked:providerConfig?.blockedByCostPolicy!==true,
    tenPlayers:ids.length===10&&unique.size===10,
    trustedCollector:Boolean(collector&&collector.trusted===true&&typeof collector.collect==='function')
  })
  const ready=Object.values(checks).every(Boolean)
  let nextAction='run_real_provider_qualification'
  if(!checks.exactBuild)nextAction='bind_exact_preview_build'
  else if(providerConfig?.blockedByCostPolicy===true)nextAction='resolve_multiplayer_cost_policy'
  else if(!checks.providerConfigured)nextAction='connect_live_multiplayer_provider'
  else if(!checks.tenPlayers)nextAction='prepare_ten_real_qualification_players'
  else if(!checks.trustedCollector)nextAction='connect_trusted_match_telemetry_collector'
  return freeze({version:MOBA_REAL_PROVIDER_QUALIFICATION_V1.version,ready,checks,nextAction,playerIdsExposed:false,providerIdentityExposed:false,credentialExposed:false,productionReady:false})
}

export async function runMobaRealProviderQualification({buildSha='',appId='qualification',playerIds=[],region='auto',mode='5v5',collector,gateway={},maxPolls=30,pollIntervalMs=1000}={}){
  const providerConfig=(gateway.getConfig||getMultiplayerProviderConfig)()
  const pre=evaluateMobaProviderQualificationPrerequisites({buildSha,playerIds,providerConfig,collector})
  if(!pre.ready)return freeze({...pre,attempted:false,verified:false,liveProviderVerified:false})
  const create=gateway.create||createMultiplayerTicket,check=gateway.check||checkMultiplayerTicket,cancel=gateway.cancel||cancelMultiplayerTicket,wait=gateway.sleep||sleep
  const ids=playerIds.map(safePlayerId)
  let cancelChecked=false,statusChecked=false
  try{
    const auxiliary=await create({requestId:`moba-qual-cancel:${buildSha.slice(0,12)}:${ids[0]}`,appId,playerId:ids[0],mode:'qualification-cancel',region,partySize:1,teamSize:5})
    await cancel(auxiliary.ticketId);cancelChecked=true
    const tickets=[]
    for(let i=0;i<ids.length;i++)tickets.push(await create({requestId:`moba-qual:${buildSha.slice(0,12)}:${i}:${ids[i]}`,appId,playerId:ids[i],mode,region,partySize:1,teamSize:5}))
    let statuses=[]
    for(let poll=0;poll<Math.max(1,Math.min(120,Number(maxPolls)||30));poll++){
      statuses=[]
      for(const ticket of tickets)statuses.push(await check(ticket.ticketId))
      statusChecked=true
      if(statuses.every(s=>s.status==='matched'&&s.matchId))break
      if(statuses.some(s=>s.status==='failed'||s.status==='cancelled'))break
      if(poll<maxPolls-1)await wait(Math.max(0,Math.min(5000,Number(pollIntervalMs)||1000)))
    }
    const matchIds=statuses.map(s=>s.matchId).filter(Boolean)
    const sharedMatchId=matchIds.length===10&&new Set(matchIds).size===1?matchIds[0]:null
    if(!sharedMatchId)return freeze({version:MOBA_REAL_PROVIDER_QUALIFICATION_V1.version,attempted:true,verified:false,liveProviderVerified:false,nextAction:'investigate_matchmaking_or_provider_status',checks:freeze({...pre.checks,ticketLifecycle:true,statusChecked,cancelChecked,tenPlayersMatchedSameMatch:false}),productionReady:false})
    const collected=await collector.collect({matchId:sharedMatchId,buildSha,region,mode,players:ids.map((playerId,index)=>({playerId,ticketId:tickets[index].ticketId}))})
    const evidence={...collected,trustedCollector:true,measured:collected?.measured===true,synthetic:collected?.synthetic===true,buildSha,deploymentBuildSha:collected?.deploymentBuildSha||buildSha,providerTicketCreated:true,providerStatusChecked:statusChecked,providerCancelChecked:cancelChecked,matchmakingVerified:true}
    const evaluation=evaluateMobaRealProviderSmokeEvidence(evidence)
    return freeze({version:MOBA_REAL_PROVIDER_QUALIFICATION_V1.version,attempted:true,verified:evaluation.passed,liveProviderVerified:evaluation.liveProviderVerified,evidenceLevel:evaluation.evidenceLevel,checks:evaluation.checks,nextAction:evaluation.passed?'run_measured_capacity_and_device_qualification':'inspect_real_provider_smoke_evidence',matchIdExposed:false,ticketIdsExposed:false,playerIdsExposed:false,providerIdentityExposed:false,credentialExposed:false,productionReady:false,truthRule:MOBA_REAL_PROVIDER_QUALIFICATION_V1.truthRule})
  }catch(error){
    return freeze({version:MOBA_REAL_PROVIDER_QUALIFICATION_V1.version,attempted:true,verified:false,liveProviderVerified:false,nextAction:'inspect_provider_qualification_failure',errorCode:String(error?.code||'MULTIPLAYER_QUALIFICATION_FAILED').slice(0,100),providerIdentityExposed:false,credentialExposed:false,productionReady:false,truthRule:MOBA_REAL_PROVIDER_QUALIFICATION_V1.truthRule})
  }
}
