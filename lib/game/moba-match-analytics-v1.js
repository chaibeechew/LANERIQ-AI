function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function player(stats,id){if(!stats.has(id))stats.set(id,{playerId:id,kills:0,deaths:0,assists:0,damage:0,healing:0,gold:0,objectives:0,vision:0,positions:0});return stats.get(id)}
export const MOBA_MATCH_ANALYTICS_V1=freeze({version:"moba-match-analytics-v1",authoritativeEventsRequired:true,rawChatExcluded:true,systems:freeze(["kda","damage","healing","gold","objectives","vision","teamfight-detection","mvp-score","team-summary","privacy-minimization"])})
export function detectMobaTeamfights(events=[],windowTicks=240){const kills=events.filter(e=>e.type==="kill").sort((a,b)=>a.tick-b.tick),groups=[];let group=[];for(const e of kills){if(group.length&&e.tick-group.at(-1).tick>windowTicks){if(group.length>=2)groups.push(group);group=[]}group.push(e)}if(group.length>=2)groups.push(group);return groups.map(g=>({startTick:g[0].tick,endTick:g.at(-1).tick,kills:g.length}))}
export function buildMobaMatchAnalytics({events=[],winner=null}={}){
  const stats=new Map(),teams={blue:{kills:0,objectives:0,gold:0},red:{kills:0,objectives:0,gold:0}};
  for(const e of events){const p=e.payload||{};
    if(e.type==="kill"){const k=player(stats,p.killerId);k.kills++;if(teams[p.killerTeam])teams[p.killerTeam].kills++;player(stats,p.victimId).deaths++;for(const id of p.assistIds||[])player(stats,id).assists++;}
    else if(e.type==="damage")player(stats,p.sourceId).damage+=Math.max(0,finite(p.amount));
    else if(e.type==="heal")player(stats,p.sourceId).healing+=Math.max(0,finite(p.amount));
    else if(e.type==="gold"){player(stats,p.playerId).gold+=Math.max(0,finite(p.amount));if(teams[p.team])teams[p.team].gold+=Math.max(0,finite(p.amount));}
    else if(e.type==="objective"){player(stats,p.playerId).objectives++;if(teams[p.team])teams[p.team].objectives++;}
    else if(e.type==="vision")player(stats,p.playerId).vision+=Math.max(0,finite(p.score,1));
    else if(e.type==="position")player(stats,p.playerId).positions++;
  }
  const players=[...stats.values()].map(s=>({...s,kda:Number(((s.kills+s.assists*.6)/Math.max(1,s.deaths)).toFixed(2)),mvpScore:Number((s.kills*4+s.assists*2-s.deaths*1.5+s.damage/1000+s.healing/1200+s.objectives*3+s.vision*.2).toFixed(2))})).sort((a,b)=>b.mvpScore-a.mvpScore);
  return{version:MOBA_MATCH_ANALYTICS_V1.version,winner,players,teams,teamfights:detectMobaTeamfights(events),mvp:players[0]?.playerId||null,rawChatIncluded:false}
}
