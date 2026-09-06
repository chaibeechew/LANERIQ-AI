function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clamp(v,a,b){return Math.max(a,Math.min(b,finite(v,a)))}
function dist(a,b){return Math.hypot(finite(a?.x)-finite(b?.x),finite(a?.y)-finite(b?.y))}
const TEAM=new Set(["blue","red"])

export const MOBA_VISION_AUTHORITY_V1=freeze({
  version:"moba-vision-authority-v1",authoritative:true,clientVisibilityTrusted:false,
  systems:freeze(["hero-vision","minion-vision","structure-vision","ward-vision","ward-expiry","server-fog-filter","hidden-enemy-redaction"]),
  truthRule:"Fog-of-war is filtered on the server. Hidden enemy coordinates, health, cooldowns and private events are never sent merely because a client claims visibility."
})

export function createMobaVisionState(){return{version:MOBA_VISION_AUTHORITY_V1.version,wards:[],wardSequence:0}}
export function placeMobaWard(state,{team,x,y,now=0,duration=90,radius=240}={}){
  if(!TEAM.has(team))return{ok:false,reason:"invalid_team"};
  state.wardSequence+=1;
  const ward={id:`ward-${state.wardSequence}`,team,x:clamp(x,0,1200),y:clamp(y,0,720),radius:clamp(radius,100,300),expiresAt:finite(now)+clamp(duration,10,180)};
  const active=state.wards.filter(w=>w.expiresAt>finite(now)&&w.team===team);
  const other=state.wards.filter(w=>w.expiresAt>finite(now)&&w.team!==team);
  state.wards=[...other,...active.slice(-2),ward];
  return{ok:true,ward}
}
export function expireMobaWards(state,now=0){state.wards=state.wards.filter(w=>w.expiresAt>finite(now));return state}
export function computeMobaTeamVision({team,heroes=[],minions=[],structures=[],visionState={wards:[]},now=0}={}){
  if(!TEAM.has(team))return{team:null,sources:[]};
  const sources=[];
  for(const h of heroes)if(h.team===team&&!h.dead)sources.push({x:h.x,y:h.y,radius:190,kind:"hero"});
  for(const m of minions)if(m.team===team&&m.health>0)sources.push({x:m.x,y:m.y,radius:125,kind:"minion"});
  for(const s of structures)if(s.team===team&&!s.destroyed&&s.health>0)sources.push({x:s.x??(team==="blue"?220:980),y:s.y??360,radius:s.kind==="core"?230:210,kind:"structure"});
  for(const w of visionState.wards||[])if(w.team===team&&w.expiresAt>finite(now))sources.push({x:w.x,y:w.y,radius:w.radius,kind:"ward"});
  return{team,sources}
}
export function isMobaPointVisible(vision,point){return Boolean(vision?.sources?.some(s=>dist(s,point)<=finite(s.radius,0)))}
export function filterMobaSnapshotForTeam(snapshot,{team,vision}={}){
  const allies=[],enemies=[];
  for(const hero of snapshot?.heroes||[]){
    if(hero.team===team)allies.push({...hero});
    else if(isMobaPointVisible(vision,hero))enemies.push({...hero,visible:true});
  }
  return{...snapshot,heroes:[...allies,...enemies],fogFiltered:true,team,hiddenEnemyCount:Math.max(0,(snapshot?.heroes||[]).filter(h=>h.team!==team).length-enemies.length)}
}
