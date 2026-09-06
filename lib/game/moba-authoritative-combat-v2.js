import {applyDamage,castAbility,compileMobaRuntimeV1,createMatchState,distance,grantExperience,markHeroDead,respawnHero,tickHero} from "./moba-runtime-v1.js";

function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,finite(value,min)));}
function text(value,max=96){return String(value??"").trim().slice(0,max);}
function alive(hero){return Boolean(hero&&!hero.dead&&hero.health>0);}
function validSlot(value){const slot=text(value,4).toUpperCase();return["Q","W","E","R"].includes(slot)?slot:null;}

export const MOBA_AUTHORITATIVE_COMBAT_V2=Object.freeze({
  version:"moba-authoritative-combat-v2",
  authoritative:true,
  maxPlayers:10,
  teamSize:5,
  tickRate:20,
  clientDamageTrusted:false,
  clientHitTrusted:false,
  systems:[
    "server-owned-hero-state","monotonic-input-sequence","idempotent-action-id","server-range-validation","server-cooldown-validation","server-resource-validation",
    "server-damage-calculation","server-kill-respawn","server-xp-gold","movement-budget-validation","forged-damage-rejection","ownership-validation","violation-scoring","authoritative-resync-snapshot"
  ]
});

export function createMobaAuthoritativeCombat(specification={}){
  const config=compileMobaRuntimeV1(specification),match=createMatchState(config);
  return{
    version:MOBA_AUTHORITATIVE_COMBAT_V2.version,
    config,
    match,
    tickRate:MOBA_AUTHORITATIVE_COMBAT_V2.tickRate,
    tick:0,
    now:0,
    eventSequence:0,
    snapshotVersion:1,
    owners:new Map(),
    lastSequence:new Map(),
    lastInputAt:new Map(),
    processedActions:new Map(),
    violations:new Map(),
  };
}

export function bindMobaPlayer(state,{playerId,heroId}={}){
  const pid=text(playerId,128),hid=text(heroId,128),hero=state?.match?.heroes?.find(item=>item.id===hid);
  if(!pid||!hero||state.owners.has(pid)||[...state.owners.values()].includes(hid))return{ok:false,reason:"invalid_or_duplicate_binding"};
  state.owners.set(pid,hid);state.lastSequence.set(pid,0);state.lastInputAt.set(pid,0);state.processedActions.set(pid,new Map());state.violations.set(pid,{score:0,total:0,events:[]});
  return{ok:true,heroId:hid,team:hero.team};
}

function heroForPlayer(state,playerId){const heroId=state.owners.get(playerId);return state.match.heroes.find(hero=>hero.id===heroId)||null;}
function heroIndex(state,heroId){return state.match.heroes.findIndex(hero=>hero.id===heroId);}
function violation(state,playerId,code,severity=1,detail=""){
  const current=state.violations.get(playerId)||{score:0,total:0,events:[]};
  const next={score:current.score+Math.max(1,severity),total:current.total+1,events:[...current.events,{tick:state.tick,code,detail:text(detail,160)}].slice(-40)};
  state.violations.set(playerId,next);
  return{...next,action:next.score>=12?"disconnect":next.score>=7?"throttle":next.score>=3?"review":"monitor"};
}
function validateEnvelope(state,{playerId,sequence,actionId}={}){
  const pid=text(playerId,128),action=text(actionId,160),seq=Math.floor(finite(sequence,-1));
  if(!pid||!state.owners.has(pid))return{ok:false,reason:"player_not_bound"};
  if(!action)return{ok:false,reason:"action_id_required"};
  const seen=state.processedActions.get(pid)||new Map();if(seen.has(action))return{ok:false,replayed:true,reason:"duplicate_action",result:seen.get(action)};
  const previous=state.lastSequence.get(pid)||0;if(seq<=previous){violation(state,pid,"stale_sequence",1);return{ok:false,reason:"stale_sequence"};}
  if(seq>previous+64){violation(state,pid,"sequence_jump",2,`${previous}->${seq}`);return{ok:false,reason:"sequence_jump"};}
  return{ok:true,pid,action,seq,seen};
}
function remember(state,validated,result){state.lastSequence.set(validated.pid,validated.seq);validated.seen.set(validated.action,result);if(validated.seen.size>128){const first=validated.seen.keys().next().value;validated.seen.delete(first);}return result;}

export function submitMobaMovementIntent(state,input={}){
  const checked=validateEnvelope(state,input);if(!checked.ok)return checked.replayed?checked.result:checked;
  const hero=heroForPlayer(state,checked.pid);if(!alive(hero))return remember(state,checked,{ok:false,reason:"hero_unavailable"});
  const x=finite(input.x),y=finite(input.y);if(Math.abs(x)>1.001||Math.abs(y)>1.001){violation(state,checked.pid,"invalid_movement_axis",2);return remember(state,checked,{ok:false,reason:"invalid_axis"});}
  const now=finite(input.now,state.now),last=state.lastInputAt.get(checked.pid)||0,dt=last?Math.max(0,now-last):1/state.tickRate;
  if(last&&dt<1/120){violation(state,checked.pid,"movement_rate_limit",1);return remember(state,checked,{ok:false,reason:"rate_limited"});}
  const boundedDt=clamp(dt,1/state.tickRate,0.12),mag=Math.hypot(x,y)||1,nx=Math.abs(x)>1||Math.abs(y)>1?x/mag:x,ny=Math.abs(x)>1||Math.abs(y)>1?y/mag:y;
  const speed=state.config.hero.moveSpeed,maxStep=speed*boundedDt*1.12;
  const requestedScale=clamp(input.speedScale??1,0,1.25);if(requestedScale>1.001)violation(state,checked.pid,"client_speed_claim",2,String(requestedScale));
  const dx=nx*Math.min(speed*boundedDt,maxStep),dy=ny*Math.min(speed*boundedDt,maxStep);
  hero.x=clamp(hero.x+dx,28,state.config.map.width-28);hero.y=clamp(hero.y+dy,35,state.config.map.height-35);state.lastInputAt.set(checked.pid,now);
  return remember(state,checked,{ok:true,type:"movement",heroId:hero.id,x:hero.x,y:hero.y,serverTick:state.tick});
}

function serverDamageAbility(state,source,target,ability){
  const levelScale=1+(source.level-1)*.035,raw=(ability.damage||0)*levelScale;
  return applyDamage(target,raw,{type:"magic",sourceId:source.id});
}
function serverDamageBasic(state,source,target){const raw=source.attackDamage*(1+(source.level-1)*.045);return applyDamage(target,raw,{type:"physical",sourceId:source.id});}
function finishKill(state,sourceIndex,targetIndex){
  const source=state.match.heroes[sourceIndex],target=state.match.heroes[targetIndex];if(!target||target.dead||target.health>0)return;
  state.match.heroes[targetIndex]=markHeroDead(target,state.now,state.config.hero.respawnBase,state.now);
  if(source&&sourceIndex>=0){let rewarded={...source,gold:source.gold+state.config.economy.killGold,kills:(source.kills||0)+1};rewarded=grantExperience(rewarded,160,state.config.hero.maxLevel);state.match.heroes[sourceIndex]=rewarded;}
}

export function submitMobaCombatIntent(state,input={}){
  const checked=validateEnvelope(state,input);if(!checked.ok)return checked.replayed?checked.result:checked;
  const source=heroForPlayer(state,checked.pid),sourceIndex=source?heroIndex(state,source.id):-1;if(!alive(source)||sourceIndex<0)return remember(state,checked,{ok:false,reason:"hero_unavailable"});
  const kind=text(input.kind,32).toLowerCase(),targetId=text(input.targetId,128),targetIndex=heroIndex(state,targetId),target=targetIndex>=0?state.match.heroes[targetIndex]:null;
  if(!target||!alive(target)||target.team===source.team){violation(state,checked.pid,"invalid_target",1,targetId);return remember(state,checked,{ok:false,reason:"invalid_target"});}
  if(input.damage!=null){violation(state,checked.pid,"client_damage_claim",3,String(input.damage));}
  let result=null;
  if(kind==="basic_attack"){
    const lastAttack=Number.isFinite(source.lastAttackAt)?source.lastAttackAt:-Infinity;
    if(state.now-lastAttack<state.config.hero.attackCooldown){violation(state,checked.pid,"attack_cooldown_bypass",2);return remember(state,checked,{ok:false,reason:"attack_cooldown"});}
    if(distance(source,target)>state.config.hero.attackRange+8){violation(state,checked.pid,"impossible_attack_range",2);return remember(state,checked,{ok:false,reason:"out_of_range"});}
    source.lastAttackAt=state.now;result=serverDamageBasic(state,source,target);state.match.heroes[targetIndex]=result.target;finishKill(state,sourceIndex,targetIndex);
  }else if(kind==="ability"){
    const slot=validSlot(input.slot),ability=state.config.hero.abilities.find(item=>item.slot===slot);if(!ability)return remember(state,checked,{ok:false,reason:"invalid_ability"});
    const cast=castAbility(source,ability);if(!cast.ok){violation(state,checked.pid,"ability_cooldown_or_resource_bypass",2,slot||"");return remember(state,checked,{ok:false,reason:"ability_unavailable"});}
    if(distance(source,target)>ability.range+Math.max(8,ability.radius||0)){violation(state,checked.pid,"impossible_ability_range",2,slot||"");return remember(state,checked,{ok:false,reason:"out_of_range"});}
    state.match.heroes[sourceIndex]=cast.hero;result=serverDamageAbility(state,cast.hero,target,ability);state.match.heroes[targetIndex]=result.target;finishKill(state,sourceIndex,targetIndex);
  }else{return remember(state,checked,{ok:false,reason:"unsupported_combat_intent"});}
  state.eventSequence+=1;
  const targetAfter=state.match.heroes[targetIndex],sourceAfter=state.match.heroes[sourceIndex];
  return remember(state,checked,{ok:true,type:kind,eventSequence:state.eventSequence,serverTick:state.tick,source:{id:sourceAfter.id,health:sourceAfter.health,resource:sourceAfter.resource,gold:sourceAfter.gold,kills:sourceAfter.kills},target:{id:targetAfter.id,health:targetAfter.health,shield:targetAfter.shield,dead:targetAfter.dead},damage:result.damage||0,absorbed:result.absorbed||0});
}

export function advanceMobaAuthority(state,dt=1/20){
  const step=clamp(dt,1/120,.1);state.tick+=1;state.now+=step;
  for(let i=0;i<state.match.heroes.length;i++){let hero=state.match.heroes[i];if(hero.dead){if(state.now>=hero.respawnAt){hero=respawnHero(hero,state.config,{x:hero.team==="blue"?90:state.config.map.width-90,y:state.config.map.laneY[i%3]});state.match.heroes[i]=hero;}continue}state.match.heroes[i]=tickHero(hero,step);state.match.heroes[i].gold+=state.config.economy.passiveGoldPerSecond*step;}
  return state;
}

export function authoritativeMobaSnapshot(state,{playerId=null}={}){
  const self=playerId?heroForPlayer(state,text(playerId,128)):null;
  return{version:state.snapshotVersion,tick:state.tick,time:Number(state.now.toFixed(4)),eventSequence:state.eventSequence,selfId:self?.id||null,heroes:state.match.heroes.map(hero=>({id:hero.id,team:hero.team,role:hero.role,x:Number(hero.x.toFixed(2)),y:Number(hero.y.toFixed(2)),level:hero.level,health:Math.round(hero.health),maxHealth:Math.round(hero.maxHealth),resource:Math.round(hero.resource),shield:Math.round(hero.shield||0),gold:Math.floor(hero.gold),kills:hero.kills||0,deaths:hero.deaths||0,assists:hero.assists||0,dead:hero.dead,respawnAt:hero.respawnAt,cooldowns:{...hero.cooldowns}})),structures:{blueCore:{...state.match.structures.blueCore},redCore:{...state.match.structures.redCore},towers:state.match.structures.towers.map(t=>({...t}))}};
}

export function mobaAntiCheatState(state,playerId){const item=state.violations.get(text(playerId,128))||{score:0,total:0,events:[]};return{...item,action:item.score>=12?"disconnect":item.score>=7?"throttle":item.score>=3?"review":"monitor"};}
