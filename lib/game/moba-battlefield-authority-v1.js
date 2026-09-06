function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clamp(v,a,b){return Math.max(a,Math.min(b,finite(v,a)))}
function text(v,max=96){return String(v??"").trim().slice(0,max)}

export const MOBA_BATTLEFIELD_AUTHORITY_V1=freeze({
  version:"moba-battlefield-authority-v1",authoritative:true,lanes:3,
  systems:freeze(["lane-wave-spawn","minion-motion","structure-chain","jungle-respawn","river-objective","epic-objective","objective-reward","objective-buff-window","idempotent-objective-kill"]),
  truthRule:"Lane waves, structures and neutral objectives are server-owned gameplay state. Client objective damage or reward claims are not authoritative."
})

const LANE_NAMES=freeze(["top","mid","bottom"])
function structureSet(team,lane){return[
  {id:`${team}-${lane}-outer`,team,lane,tier:1,kind:"tower",health:1800,maxHealth:1800,destroyed:false},
  {id:`${team}-${lane}-inner`,team,lane,tier:2,kind:"tower",health:2200,maxHealth:2200,destroyed:false},
  {id:`${team}-${lane}-inhibitor`,team,lane,tier:3,kind:"inhibitor",health:2600,maxHealth:2600,destroyed:false}
]}
export function createMobaBattlefieldAuthority({width=1200,height=720,laneY=[170,360,550],waveInterval=9}={}){
  return{
    version:MOBA_BATTLEFIELD_AUTHORITY_V1.version,time:0,width,height,laneY:[...laneY],waveInterval:clamp(waveInterval,5,20),wave:0,nextWaveAt:1,minionSequence:0,minions:[],
    structures:[...LANE_NAMES.flatMap(l=>structureSet("blue",l)),...LANE_NAMES.flatMap(l=>structureSet("red",l)),{id:"blue-core",team:"blue",kind:"core",tier:4,health:4200,maxHealth:4200,destroyed:false},{id:"red-core",team:"red",kind:"core",tier:4,health:4200,maxHealth:4200,destroyed:false}],
    neutrals:[
      {id:"river-sentinel",kind:"river",alive:true,respawnSeconds:90,rewardGold:120,buff:"vision-current",buffSeconds:70,respawnAt:0},
      {id:"aether-wyrm",kind:"epic",alive:true,respawnSeconds:240,rewardGold:300,buff:"aether-force",buffSeconds:150,respawnAt:0},
      {id:"void-titan",kind:"epic",alive:false,firstSpawnAt:600,respawnSeconds:360,rewardGold:450,buff:"siege-command",buffSeconds:180,respawnAt:600}
    ],
    teamBuffs:{blue:[],red:[]},processedObjectiveKills:new Set(),events:[]
  }
}
function spawnWave(state){
  state.wave+=1;const siege=state.wave%3===0;
  for(let lane=0;lane<3;lane++)for(const team of ["blue","red"]){
    const specs=[["melee",2,72],["ranged",1,68],...(siege?[["siege",1,54]]:[])];
    for(const [kind,count,speed] of specs)for(let i=0;i<count;i++){state.minionSequence+=1;state.minions.push({id:`m${state.minionSequence}`,team,lane,kind,x:team==="blue"?70:state.width-70,y:state.laneY[lane]+(i-1)*8,health:kind==="siege"?420:kind==="melee"?260:190,maxHealth:kind==="siege"?420:kind==="melee"?260:190,speed,alive:true,wave:state.wave});}
  }
  state.events.push({type:"wave_spawn",wave:state.wave,time:state.time});
}
export function advanceMobaBattlefield(state,dt=1/20){
  const step=clamp(dt,0,.25);state.time+=step;
  while(state.time>=state.nextWaveAt){spawnWave(state);state.nextWaveAt+=state.waveInterval;}
  for(const minion of state.minions)if(minion.alive){minion.x=clamp(minion.x+(minion.team==="blue"?1:-1)*minion.speed*step,35,state.width-35);}
  state.minions=state.minions.filter(m=>m.alive&&m.health>0).slice(-240);
  for(const n of state.neutrals){if(!n.alive&&state.time>=finite(n.respawnAt,n.firstSpawnAt||Infinity)){n.alive=true;n.respawnAt=0;state.events.push({type:"neutral_spawn",objectiveId:n.id,time:state.time});}}
  for(const team of ["blue","red"])state.teamBuffs[team]=state.teamBuffs[team].filter(b=>b.expiresAt>state.time);
  return state;
}
function structure(state,id){return state.structures.find(s=>s.id===text(id,96))||null}
export function canDamageMobaStructure(state,{attackingTeam,targetId}={}){
  const target=structure(state,targetId);if(!target||target.destroyed||target.team===attackingTeam)return{allowed:false,reason:"invalid_structure"};
  if(target.kind==="core"){const blockers=state.structures.filter(s=>s.team===target.team&&s.kind==="inhibitor"&&!s.destroyed);return blockers.length?{allowed:false,reason:"core_protected",blockers:blockers.map(x=>x.id)}:{allowed:true,target};}
  const laneChain=state.structures.filter(s=>s.team===target.team&&s.lane===target.lane&&s.tier<target.tier&&!s.destroyed);
  return laneChain.length?{allowed:false,reason:"previous_structure_alive",blockers:laneChain.map(x=>x.id)}:{allowed:true,target};
}
export function damageMobaStructure(state,{attackingTeam,targetId,serverDamage=0,actionId=""}={}){
  const allowed=canDamageMobaStructure(state,{attackingTeam,targetId});if(!allowed.allowed)return allowed;
  const dmg=clamp(serverDamage,0,800),target=allowed.target;target.health=Math.max(0,target.health-dmg);if(target.health<=0)target.destroyed=true;
  const winner=target.kind==="core"&&target.destroyed?attackingTeam:null;state.events.push({type:"structure_damage",targetId:target.id,team:attackingTeam,damage:dmg,destroyed:target.destroyed,winner,actionId:text(actionId,120),time:state.time});
  return{allowed:true,damage:dmg,health:target.health,destroyed:target.destroyed,winner};
}
export function defeatMobaNeutralObjective(state,{objectiveId,team,actionId}={}){
  const id=text(objectiveId,96),aid=text(actionId,120);if(!["blue","red"].includes(team))return{ok:false,reason:"invalid_team"};if(!aid)return{ok:false,reason:"action_id_required"};
  const replayKey=`${id}:${aid}`;if(state.processedObjectiveKills.has(replayKey))return{ok:false,replayed:true,reason:"duplicate_objective_kill"};
  const obj=state.neutrals.find(n=>n.id===id);if(!obj||!obj.alive)return{ok:false,reason:"objective_unavailable"};
  obj.alive=false;obj.respawnAt=state.time+obj.respawnSeconds;state.processedObjectiveKills.add(replayKey);
  const buff={id:obj.buff,objectiveId:obj.id,expiresAt:state.time+obj.buffSeconds};state.teamBuffs[team].push(buff);
  const event={type:"objective_kill",objectiveId:obj.id,team,rewardGold:obj.rewardGold,buff:obj.buff,buffExpiresAt:buff.expiresAt,time:state.time};state.events.push(event);
  return{ok:true,...event,respawnAt:obj.respawnAt};
}
export function mobaBattlefieldSnapshot(state){return{version:state.version,time:Number(state.time.toFixed(3)),wave:state.wave,nextWaveAt:Number(state.nextWaveAt.toFixed(3)),minions:state.minions.map(m=>({id:m.id,team:m.team,lane:m.lane,kind:m.kind,x:Number(m.x.toFixed(1)),y:Number(m.y.toFixed(1)),health:Math.round(m.health)})),structures:state.structures.map(s=>({id:s.id,team:s.team,lane:s.lane??null,kind:s.kind,tier:s.tier,health:Math.round(s.health),destroyed:s.destroyed})),neutrals:state.neutrals.map(n=>({id:n.id,kind:n.kind,alive:n.alive,respawnAt:n.respawnAt||0})),teamBuffs:{blue:state.teamBuffs.blue.map(b=>({...b})),red:state.teamBuffs.red.map(b=>({...b}))}}}
