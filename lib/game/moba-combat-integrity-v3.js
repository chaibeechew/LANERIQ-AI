import {applyDamage,castAbility,distance,grantExperience,markHeroDead} from "./moba-runtime-v1.js";

function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,finite(value,min)));}
function text(value,max=160){return String(value??"").trim().slice(0,max);}
function alive(hero){return Boolean(hero&&!hero.dead&&hero.health>0);}
function validSlot(value){const slot=text(value,4).toUpperCase();return["Q","W","E","R"].includes(slot)?slot:null;}
function heroForPlayer(state,playerId){const heroId=state?.owners?.get(text(playerId,128));return state?.match?.heroes?.find(hero=>hero.id===heroId)||null;}
function heroIndex(state,heroId){return state?.match?.heroes?.findIndex(hero=>hero.id===heroId)??-1;}

export const MOBA_COMBAT_INTEGRITY_V3=Object.freeze({
  version:"moba-combat-integrity-v3",
  authoritative:true,
  clientTargetTrusted:false,
  clientHitTrusted:false,
  clientDamageTrusted:false,
  clientHealTrusted:false,
  clientShieldTrusted:false,
  clientStructureDamageTrusted:false,
  serverTickFutureTolerance:4,
  serverTickHistoryWindow:60,
  systems:[
    "server-owned-skillshot-collision","server-owned-aoe-target-resolution","self-cast-dash-shield","server-owned-cc-duration","server-owned-heal-shield",
    "bounded-client-tick-window","first-hit-skillshot-resolution","server-owned-structure-damage","core-protection-gate","objective-reward","duplicate-action-replay"
  ],
  truthRule:"Combat Integrity V3 proves deterministic server-side validation contracts only. It does not prove a live relay, real latency performance or commercial multiplayer production readiness."
});

function violation(state,playerId,code,severity=1,detail=""){
  const pid=text(playerId,128),current=state.violations.get(pid)||{score:0,total:0,events:[]};
  const next={score:current.score+Math.max(1,severity),total:current.total+1,events:[...current.events,{tick:state.tick,code,detail:text(detail,160)}].slice(-60)};
  state.violations.set(pid,next);return next;
}
function validateEnvelope(state,input={}){
  const pid=text(input.playerId,128),action=text(input.actionId,160),seq=Math.floor(finite(input.sequence,-1));
  if(!pid||!state?.owners?.has(pid))return{ok:false,reason:"player_not_bound"};
  if(!action)return{ok:false,reason:"action_id_required"};
  const seen=state.processedActions.get(pid)||new Map();
  if(seen.has(action))return{ok:false,replayed:true,result:seen.get(action),reason:"duplicate_action"};
  const previous=state.lastSequence.get(pid)||0;
  if(seq<=previous){violation(state,pid,"stale_sequence",1,`${seq}<=${previous}`);return{ok:false,reason:"stale_sequence"};}
  if(seq>previous+64){violation(state,pid,"sequence_jump",2,`${previous}->${seq}`);return{ok:false,reason:"sequence_jump"};}
  if(input.serverTick!=null){const claimed=Math.floor(finite(input.serverTick,-1)),delta=claimed-state.tick;if(delta>MOBA_COMBAT_INTEGRITY_V3.serverTickFutureTolerance){violation(state,pid,"future_tick_claim",2,String(delta));return{ok:false,reason:"future_tick"};}if(delta<-MOBA_COMBAT_INTEGRITY_V3.serverTickHistoryWindow){violation(state,pid,"stale_tick_claim",1,String(delta));return{ok:false,reason:"stale_tick"};}}
  return{ok:true,pid,action,seq,seen};
}
function remember(state,checked,result){state.lastSequence.set(checked.pid,checked.seq);checked.seen.set(checked.action,result);if(checked.seen.size>128){const first=checked.seen.keys().next().value;checked.seen.delete(first);}return result;}
function rewardKill(state,sourceIndex,targetIndex){const target=state.match.heroes[targetIndex];if(!target||target.dead||target.health>0)return false;state.match.heroes[targetIndex]=markHeroDead(target,state.now,state.config.hero.respawnBase,state.now);if(sourceIndex>=0){let source=state.match.heroes[sourceIndex];source={...source,gold:source.gold+state.config.economy.killGold,kills:(source.kills||0)+1};source=grantExperience(source,160,state.config.hero.maxLevel);state.match.heroes[sourceIndex]=source;}return true;}
function applyServerAbilityDamage(state,sourceIndex,targetIndex,ability){const source=state.match.heroes[sourceIndex],target=state.match.heroes[targetIndex],scale=1+(source.level-1)*.035,result=applyDamage(target,(ability.damage||0)*scale,{type:"magic",sourceId:source.id});state.match.heroes[targetIndex]=result.target;rewardKill(state,sourceIndex,targetIndex);return result;}
function pointDistanceToSegment(point,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=point.x-a.x,wy=point.y-a.y,len2=vx*vx+vy*vy;if(len2<=.0001)return Math.hypot(wx,wy);const t=clamp((wx*vx+wy*vy)/len2,0,1),px=a.x+t*vx,py=a.y+t*vy;return Math.hypot(point.x-px,point.y-py);}
function normalizeAim(input,source){let x=finite(input.aimX,0),y=finite(input.aimY,0);const mag=Math.hypot(x,y);if(mag<.001){x=source.team==="blue"?1:-1;y=0;return{x,y};}return{x:x/mag,y:y/mag};}
function aimPointForAbility(input,source,ability){if(input.targetX!=null||input.targetY!=null){const tx=finite(input.targetX,source.x),ty=finite(input.targetY,source.y),dx=tx-source.x,dy=ty-source.y,d=Math.hypot(dx,dy);if(d<=ability.range)return{x:tx,y:ty};const m=d||1;return{x:source.x+dx/m*ability.range,y:source.y+dy/m*ability.range};}const aim=normalizeAim(input,source);return{x:source.x+aim.x*ability.range,y:source.y+aim.y*ability.range};}
function activeEnemies(state,source){return state.match.heroes.map((hero,index)=>({hero,index})).filter(({hero})=>alive(hero)&&hero.team!==source.team);}
function applyCrowdControl(state,targetIndex,ability){const target=state.match.heroes[targetIndex],now=state.now;if(!target)return;if(ability.slow>0){const duration=clamp(1.2+(ability.slow*.8),.5,3);target.statuses={...(target.statuses||{}),slowUntil:Math.max(target.statuses?.slowUntil||0,now+duration)};}if(ability.stun>0){const duration=clamp(ability.stun,.1,2.5);target.statuses={...(target.statuses||{}),stunUntil:Math.max(target.statuses?.stunUntil||0,now+duration)};}}
function publicHero(hero){return{id:hero.id,health:Math.round(hero.health),maxHealth:Math.round(hero.maxHealth),resource:Math.round(hero.resource),shield:Math.round(hero.shield||0),x:Number(hero.x.toFixed(2)),y:Number(hero.y.toFixed(2)),dead:hero.dead,statuses:{...hero.statuses},cooldowns:{...hero.cooldowns}};}

export function submitMobaAbilityIntentV3(state,input={}){
  const checked=validateEnvelope(state,input);if(!checked.ok)return checked.replayed?checked.result:checked;
  const source=heroForPlayer(state,checked.pid),sourceIndex=source?heroIndex(state,source.id):-1;if(!alive(source)||sourceIndex<0)return remember(state,checked,{ok:false,reason:"hero_unavailable"});
  if((source.statuses?.stunUntil||0)>state.now)return remember(state,checked,{ok:false,reason:"stunned"});
  const slot=validSlot(input.slot),ability=state.config.hero.abilities.find(item=>item.slot===slot);if(!ability)return remember(state,checked,{ok:false,reason:"invalid_ability"});
  if(input.damage!=null){violation(state,checked.pid,"client_damage_claim",3,String(input.damage));}
  if(input.hitIds!=null){violation(state,checked.pid,"client_hit_claim",2,JSON.stringify(input.hitIds).slice(0,120));}
  if(input.heal!=null){violation(state,checked.pid,"client_heal_claim",2,String(input.heal));}
  if(input.shield!=null){violation(state,checked.pid,"client_shield_claim",2,String(input.shield));}
  const cast=castAbility(source,ability);if(!cast.ok){violation(state,checked.pid,"ability_cooldown_or_resource_bypass",2,slot||"");return remember(state,checked,{ok:false,reason:"ability_unavailable"});}
  state.match.heroes[sourceIndex]=cast.hero;
  const sourceAfterCast=state.match.heroes[sourceIndex],kind=String(ability.kind||"").toLowerCase();let hits=[],totalDamage=0,totalAbsorbed=0;

  if(kind==="dash_shield"){
    const aim=normalizeAim(input,sourceAfterCast),dash=clamp(ability.range,0,180);sourceAfterCast.x=clamp(sourceAfterCast.x+aim.x*dash,28,state.config.map.width-28);sourceAfterCast.y=clamp(sourceAfterCast.y+aim.y*dash,35,state.config.map.height-35);
  }else if(kind==="aoe"||kind==="ultimate_aoe"){
    const center=aimPointForAbility(input,sourceAfterCast,ability),radius=Math.max(8,ability.radius||60);
    const targets=activeEnemies(state,sourceAfterCast).filter(({hero})=>distance(hero,center)<=radius);
    for(const {index} of targets){const result=applyServerAbilityDamage(state,sourceIndex,index,ability);applyCrowdControl(state,index,ability);hits.push(state.match.heroes[index].id);totalDamage+=result.damage||0;totalAbsorbed+=result.absorbed||0;}
  }else if(kind==="skillshot"){
    const end=aimPointForAbility(input,sourceAfterCast,ability),radius=Math.max(8,ability.radius||20),start={x:sourceAfterCast.x,y:sourceAfterCast.y};
    const candidates=activeEnemies(state,sourceAfterCast).filter(({hero})=>pointDistanceToSegment(hero,start,end)<=radius+18).sort((a,b)=>distance(start,a.hero)-distance(start,b.hero));
    const first=candidates[0];if(first){const result=applyServerAbilityDamage(state,sourceIndex,first.index,ability);applyCrowdControl(state,first.index,ability);hits=[state.match.heroes[first.index].id];totalDamage=result.damage||0;totalAbsorbed=result.absorbed||0;}
  }else{
    const targetId=text(input.targetId,128),targetIndex=heroIndex(state,targetId),target=targetIndex>=0?state.match.heroes[targetIndex]:null;
    if(target&&alive(target)&&target.team!==sourceAfterCast.team&&distance(sourceAfterCast,target)<=ability.range+8){const result=applyServerAbilityDamage(state,sourceIndex,targetIndex,ability);applyCrowdControl(state,targetIndex,ability);hits=[target.id];totalDamage=result.damage||0;totalAbsorbed=result.absorbed||0;}
  }

  state.eventSequence+=1;
  return remember(state,checked,{ok:true,type:"ability",slot:ability.slot,kind:ability.kind,eventSequence:state.eventSequence,serverTick:state.tick,hits,totalDamage,totalAbsorbed,source:publicHero(state.match.heroes[sourceIndex])});
}

function findStructure(state,id){const key=text(id,128);if(key==="blue-core")return state.match.structures.blueCore;if(key==="red-core")return state.match.structures.redCore;return state.match.structures.towers.find(item=>item.id===key)||null;}
function coreProtected(state,core){return state.match.structures.towers.some(tower=>tower.team===core.team&&tower.health>0);}
export function submitMobaStructureAttackV3(state,input={}){
  const checked=validateEnvelope(state,input);if(!checked.ok)return checked.replayed?checked.result:checked;
  const source=heroForPlayer(state,checked.pid),sourceIndex=source?heroIndex(state,source.id):-1;if(!alive(source)||sourceIndex<0)return remember(state,checked,{ok:false,reason:"hero_unavailable"});
  if(input.damage!=null)violation(state,checked.pid,"client_structure_damage_claim",3,String(input.damage));
  const structure=findStructure(state,input.structureId);if(!structure||structure.team===source.team||structure.health<=0)return remember(state,checked,{ok:false,reason:"invalid_structure"});
  if(structure.kind==="core"&&coreProtected(state,structure))return remember(state,checked,{ok:false,reason:"core_protected"});
  const lastAttack=Number.isFinite(source.lastAttackAt)?source.lastAttackAt:-Infinity;if(state.now-lastAttack<state.config.hero.attackCooldown){violation(state,checked.pid,"structure_attack_cooldown_bypass",2);return remember(state,checked,{ok:false,reason:"attack_cooldown"});}
  if(distance(source,structure)>state.config.hero.attackRange+36){violation(state,checked.pid,"impossible_structure_range",2,structure.id||structure.kind);return remember(state,checked,{ok:false,reason:"out_of_range"});}
  source.lastAttackAt=state.now;const serverDamage=Math.max(1,Math.round(source.attackDamage*.72*(1+(source.level-1)*.025)));structure.health=Math.max(0,structure.health-serverDamage);let reward=0,winner=null;
  if(structure.health<=0&&structure.kind==="tower"){reward=state.config.economy.towerGold;source.gold+=reward;}
  if(structure.health<=0&&structure.kind==="core"){winner=structure.team==="blue"?"red":"blue";state.match.status="finished";state.match.winner=winner;}
  state.eventSequence+=1;
  return remember(state,checked,{ok:true,type:"structure_attack",structureId:structure.id||`${structure.team}-core`,damage:serverDamage,health:structure.health,destroyed:structure.health<=0,reward,winner,eventSequence:state.eventSequence,serverTick:state.tick});
}

export function evaluateMobaCombatIntegrityV3(evidence={}){
  const checks={skillshotServerHit:evidence.skillshotServerHit===true,aoeServerTargets:evidence.aoeServerTargets===true,selfCastDashShield:evidence.selfCastDashShield===true,ccServerDuration:evidence.ccServerDuration===true,structureServerDamage:evidence.structureServerDamage===true,coreProtection:evidence.coreProtection===true,tickWindow:evidence.tickWindow===true,forgedClaimsRejected:evidence.forgedClaimsRejected===true};
  const score=Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100);
  return{score,passed:score===100,checks,missing:Object.entries(checks).filter(([,value])=>!value).map(([key])=>key),productionReady:false,truthRule:MOBA_COMBAT_INTEGRITY_V3.truthRule};
}
