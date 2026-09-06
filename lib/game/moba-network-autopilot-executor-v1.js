import {MOBA_NETWORK_AUTOPILOT_V1} from "./moba-network-autopilot-v1.js";

function text(value,max=160){return String(value??"").trim().slice(0,max);}
const REQUIRED_METHODS=Object.freeze(["allocateAuthoritativeHost","attachRelay","openMatchmaking","startTelemetry"]);

export const MOBA_NETWORK_AUTOPILOT_EXECUTOR_V1=Object.freeze({
  version:"moba-network-autopilot-executor-v1",
  requiredAdapterMethods:REQUIRED_METHODS,
  automaticFallback:true,
  providerOpaque:true,
  credentialsExposedToCreator:false,
  truthRule:"Executor automation can operate connected provider adapters and fail over between them. It cannot create provider accounts/credentials or prove LIVE capacity without external evidence."
});

export function validateMobaNetworkProviderAdapter(adapter={}){const id=text(adapter?.id,96),missing=REQUIRED_METHODS.filter(name=>typeof adapter?.[name]!=="function");return{valid:Boolean(id)&&missing.length===0,id:id||null,missing,productionReady:false};}

function publicAttempt(id,status,reason=null){return Object.freeze({providerId:id,status,reason:reason?text(reason,120):null});}
function publicSession(id,host={},relay={},matchmaking={},telemetry={}){return Object.freeze({providerId:id,hostId:text(host?.hostId||host?.id,160)||null,relaySessionId:text(relay?.relaySessionId||relay?.sessionId||relay?.id,160)||null,matchmakingQueueId:text(matchmaking?.queueId||matchmaking?.ticketId||matchmaking?.id,160)||null,telemetrySessionId:text(telemetry?.telemetrySessionId||telemetry?.id,160)||null,providerEndpointExposed:false,providerCredentialExposed:false});}

export async function executeMobaNetworkAutopilot({plan,adapters=[],requestId="",appId=""}={}){
  if(!plan||plan.version!==MOBA_NETWORK_AUTOPILOT_V1.version)return{ok:false,reason:"invalid_autopilot_plan",attempts:[]};
  if(plan.decision!=="connect"||!plan.providerId)return{ok:false,reason:"simulation_only",fallbackToSimulation:true,attempts:[],productionEvidenceVerified:false};
  const byId=new Map((Array.isArray(adapters)?adapters:[]).map(adapter=>[text(adapter?.id,96),adapter]).filter(([id])=>id));
  const ids=[plan.providerId,...(Array.isArray(plan.fallbackProviderIds)?plan.fallbackProviderIds:[])],attempts=[];
  for(const id of ids){const adapter=byId.get(id),validated=validateMobaNetworkProviderAdapter(adapter||{});if(!validated.valid){attempts.push(publicAttempt(id,"skipped",validated.missing.length?`missing_adapter_methods:${validated.missing.join(",")}`:"adapter_not_connected"));continue;}
    try{
      const context={requestId:text(requestId,160),appId:text(appId,128),mode:plan.mode,region:plan.region,expectedConcurrentPlayers:plan.expectedConcurrentPlayers,expectedConcurrentMatches:plan.expectedConcurrentMatches};
      const host=await adapter.allocateAuthoritativeHost(context);
      if(!host||(host.hostId==null&&host.id==null))throw new Error("authoritative_host_id_missing");
      const relay=await adapter.attachRelay({...context,host});
      if(!relay||(relay.relaySessionId==null&&relay.sessionId==null&&relay.id==null))throw new Error("relay_session_id_missing");
      const matchmaking=await adapter.openMatchmaking({...context,host,relay});
      if(!matchmaking||(matchmaking.queueId==null&&matchmaking.ticketId==null&&matchmaking.id==null))throw new Error("matchmaking_queue_id_missing");
      const telemetry=await adapter.startTelemetry({...context,host,relay,matchmaking});
      attempts.push(publicAttempt(id,"connected"));
      return{ok:true,providerId:id,usedFallback:id!==plan.providerId,session:publicSession(id,host,relay,matchmaking,telemetry),attempts:Object.freeze(attempts),providerOpaque:true,creatorConfigurationRequired:false,productionEvidenceVerified:false,truthRule:MOBA_NETWORK_AUTOPILOT_EXECUTOR_V1.truthRule};
    }catch(error){attempts.push(publicAttempt(id,"failed",error?.message||"provider_execution_failed"));try{await adapter?.close?.({reason:"autopilot_attempt_failed"});}catch{}}
  }
  return{ok:false,reason:"all_connected_providers_failed",fallbackToSimulation:true,attempts:Object.freeze(attempts),providerOpaque:true,productionEvidenceVerified:false,truthRule:MOBA_NETWORK_AUTOPILOT_EXECUTOR_V1.truthRule};
}
