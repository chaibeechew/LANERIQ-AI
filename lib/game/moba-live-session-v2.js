function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,finite(value,min)));}
function text(value,max=160){return String(value??"").trim().slice(0,max);}

export const MOBA_LIVE_SESSION_V2=Object.freeze({
  version:"moba-live-session-v2",
  playersPerMatch:10,
  teamSize:5,
  reconnectGraceSeconds:45,
  resyncRequiredAfterReconnect:true,
  states:["forming","ready","running","degraded","finished","terminated"],
  productionEvidenceRequired:["liveRelay","matchmaking","authoritativeCombat","reconnectResync","antiCheat","loadTest","lossLatency","regionalFailover","iosDevice","androidDevice"]
});

export function buildMobaMatchmakingContract({mode="ranked",region="auto",partySize=1,skill=0,preferredRole="flex"}={}){
  const roles=["vanguard","fighter","assassin","mage","marksman","support","flex"];
  const role=roles.includes(preferredRole)?preferredRole:"flex";
  return{
    version:MOBA_LIVE_SESSION_V2.version,
    gameMode:text(mode,48)||"ranked",
    region:text(region,48)||"auto",
    teamSize:5,
    playersPerMatch:10,
    partySize:Math.round(clamp(partySize,1,5)),
    skill:clamp(skill,0,100000),
    preferredRole:role,
    constraints:{uniquePlayers:true,balancedTeams:true,noCrossTeamPartySplit:true,rolePreferenceIsSoft:true,authoritativeResultRequired:true},
    truthRule:"This is a matchmaking contract. It does not prove a live provider, queue population or successful match exists."
  };
}

export function validateMobaMatchedRoster(players=[]){
  const list=Array.isArray(players)?players:[],ids=list.map(p=>text(p?.playerId,128)).filter(Boolean),unique=new Set(ids),blue=list.filter(p=>p?.team==="blue"),red=list.filter(p=>p?.team==="red");
  const checks={tenPlayers:list.length===10,uniquePlayers:ids.length===10&&unique.size===10,blueFive:blue.length===5,redFive:red.length===5,validTeams:list.every(p=>["blue","red"].includes(p?.team)),noDuplicateSlots:new Set(list.map(p=>text(p?.slot,64))).size===list.length};
  return{valid:Object.values(checks).every(Boolean),checks,missing:Object.entries(checks).filter(([,value])=>!value).map(([key])=>key)};
}

export function createMobaLiveSession({matchId,region="auto",players=[]}={}){
  const roster=validateMobaMatchedRoster(players);
  return{
    version:MOBA_LIVE_SESSION_V2.version,
    matchId:text(matchId,160)||null,
    region:text(region,64)||"auto",
    status:roster.valid?"ready":"forming",
    createdAt:0,
    startedAt:null,
    endedAt:null,
    snapshotVersion:0,
    rosterValid:roster.valid,
    players:new Map((Array.isArray(players)?players:[]).map(item=>[text(item.playerId,128),{
      playerId:text(item.playerId,128),heroId:text(item.heroId,128),team:item.team,slot:text(item.slot,64),status:"connected",reconnectToken:text(item.reconnectToken,240)||null,disconnectedAt:null,reconnectDeadline:null,resyncRequired:false,resyncVersion:null,lastAckedSnapshot:0
    }])),
    evidence:{liveRelay:false,matchmaking:false,authoritativeCombat:false,reconnectResync:false,antiCheat:false,loadTest:false,lossLatency:false,regionalFailover:false,iosDevice:false,androidDevice:false},
  };
}

export function startMobaLiveSession(session,now=0){if(!session?.rosterValid||session.status!=="ready")return{ok:false,reason:"roster_not_ready",session};session.status="running";session.startedAt=finite(now);return{ok:true,session};}
export function setMobaReconnectToken(session,{playerId,reconnectToken}={}){const player=session?.players?.get(text(playerId,128)),token=text(reconnectToken,240);if(!player||!token)return{ok:false,reason:"invalid_reconnect_token"};player.reconnectToken=token;return{ok:true};}
export function markMobaDisconnected(session,{playerId,now=0,reason="network_lost"}={}){
  const player=session?.players?.get(text(playerId,128));if(!player||!["running","degraded"].includes(session.status))return{ok:false,reason:"player_or_session_invalid"};
  const at=finite(now);player.status="disconnected";player.disconnectedAt=at;player.reconnectDeadline=at+MOBA_LIVE_SESSION_V2.reconnectGraceSeconds;player.resyncRequired=true;player.resyncVersion=null;session.status="degraded";return{ok:true,reconnectDeadline:player.reconnectDeadline,reason:text(reason,96)};
}
export function resumeMobaPlayer(session,{playerId,reconnectToken,now=0}={}){
  const player=session?.players?.get(text(playerId,128)),token=text(reconnectToken,240),at=finite(now);if(!player||player.status!=="disconnected")return{ok:false,reason:"player_not_disconnected"};
  if(!player.reconnectToken||token!==player.reconnectToken)return{ok:false,reason:"reconnect_token_invalid"};
  if(player.reconnectDeadline!=null&&at>player.reconnectDeadline){player.status="expired";return{ok:false,reason:"reconnect_window_expired"};}
  player.status="resyncing";player.resyncRequired=true;session.snapshotVersion+=1;player.resyncVersion=session.snapshotVersion;return{ok:true,resyncRequired:true,resyncVersion:player.resyncVersion};
}
export function acknowledgeMobaResync(session,{playerId,snapshotVersion}={}){
  const player=session?.players?.get(text(playerId,128)),version=Math.floor(finite(snapshotVersion,-1));if(!player||player.status!=="resyncing")return{ok:false,reason:"player_not_resyncing"};
  if(version!==player.resyncVersion)return{ok:false,reason:"snapshot_version_mismatch"};player.status="connected";player.resyncRequired=false;player.lastAckedSnapshot=version;player.disconnectedAt=null;player.reconnectDeadline=null;player.resyncVersion=null;
  if([...session.players.values()].every(item=>item.status==="connected"))session.status="running";session.evidence.reconnectResync=true;return{ok:true};
}
export function canAcceptMobaInput(session,playerId){const player=session?.players?.get(text(playerId,128));return Boolean(player&&session.status==="running"&&player.status==="connected"&&!player.resyncRequired);}

export function expireMobaReconnects(session,now=0){const at=finite(now);let expired=0;for(const player of session.players.values()){if(player.status==="disconnected"&&player.reconnectDeadline!=null&&at>player.reconnectDeadline){player.status="expired";expired++;}}if(expired)session.status="degraded";return{expired,session};}

export function evaluateMobaLoadEvidence(metrics={}){
  const concurrentMatches=Math.max(0,Math.floor(finite(metrics.concurrentMatches))),players=Math.max(0,Math.floor(finite(metrics.concurrentPlayers))),tickP95=finite(metrics.serverTickP95Ms,Infinity),tickP99=finite(metrics.serverTickP99Ms,Infinity),latencyP95=finite(metrics.latencyP95Ms,Infinity),packetLoss=finite(metrics.packetLossPct,Infinity),reconnectSuccess=finite(metrics.reconnectSuccessRate,0),errorRate=finite(metrics.errorRatePct,Infinity),duration=finite(metrics.durationMinutes,0);
  const checks={concurrentMatches:concurrentMatches>=100,concurrentPlayers:players>=1000,tickP95:tickP95<=40,tickP99:tickP99<=50,latencyP95:latencyP95<=250,packetLoss:packetLoss<=5,reconnectSuccess:reconnectSuccess>=.99,errorRate:errorRate<=1,duration:duration>=30};
  return{passed:Object.values(checks).every(Boolean),checks,metrics:{concurrentMatches,players,tickP95,tickP99,latencyP95,packetLoss,reconnectSuccess,errorRate,duration},truthRule:"Load evidence passes only with measured server/network telemetry; synthetic defaults never count as proof."};
}

export function evaluateMobaProductionEvidence(evidence={}){
  const checks={liveRelay:evidence.liveRelay===true,matchmaking:evidence.matchmaking===true,authoritativeCombat:evidence.authoritativeCombat===true,reconnectResync:evidence.reconnectResync===true,antiCheat:evidence.antiCheat===true,loadTest:evidence.loadTest===true,lossLatency:evidence.lossLatency===true,regionalFailover:evidence.regionalFailover===true,iosDevice:evidence.iosDevice===true,androidDevice:evidence.androidDevice===true};
  const weights={liveRelay:12,matchmaking:10,authoritativeCombat:14,reconnectResync:10,antiCheat:10,loadTest:14,lossLatency:10,regionalFailover:8,iosDevice:6,androidDevice:6};
  const score=Object.entries(checks).reduce((sum,[key,value])=>sum+(value?weights[key]:0),0);
  return{score,productionReady:score===100,checks,missing:Object.entries(checks).filter(([,value])=>!value).map(([key])=>key),truthRule:"Do not claim commercial Live 5v5 MOBA production readiness until every real-provider, authoritative-combat, network/load/failover and iOS/Android device evidence gate passes."};
}
