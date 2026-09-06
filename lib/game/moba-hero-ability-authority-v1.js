import {applyDamage,canCastAbility,distance,grantExperience,markHeroDead} from "./moba-runtime-v1.js";
import {applyMobaMovementControl} from "./moba-movement-cc-authority-v1.js";

function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp(v,a,b){return Math.max(a,Math.min(b,finite(v,a)));}
function text(v,max=160){return String(v??"").trim().slice(0,max);}
function alive(hero){return Boolean(hero&&!hero.dead&&hero.health>0);}
function heroForPlayer(state,playerId){const id=state?.owners?.get(text(playerId,128));return state?.match?.heroes?.find(h=>h.id===id)||null;}
function heroIndex(state,id){return state?.match?.heroes?.findIndex(h=>h.id===id)??-1;}
function violation(state,pid,code,severity=1,detail=""){const cur=state.violations.get(pid)||{score:0,total:0,events:[]};const next={score:cur.score+Math.max(1,severity),total:cur.total+1,events:[...cur.events,{tick:state.tick,code,detail:text(detail,160)}].slice(-60)};state.violations.set(pid,next);return next;}
function validateEnvelope(state,input={}){const pid=text(input.playerId,128),action=text(input.actionId,160),seq=Math.floor(finite(input.sequence,-1));if(!pid||!state.owners.has(pid))return{ok:false,reason:"player_not_bound"};if(!action)return{ok:false,reason:"action_id_required"};const seen=state.processedActions.get(pid)||new Map();if(seen.has(action))return{ok:false,replayed:true,result:seen.get(action),reason:"duplicate_action"};const previous=state.lastSequence.get(pid)||0;if(seq<=previous){violation(state,pid,"stale_sequence",1);return{ok:false,reason:"stale_sequence"};}if(seq>previous+64){violation(state,pid,"sequence_jump",2);return{ok:false,reason:"sequence_jump"};}return{ok:true,pid,action,seq,seen};}
function remember(state,c,result){state.lastSequence.set(c.pid,c.seq);c.seen.set(c.action,result);if(c.seen.size>128)c.seen.delete(c.seen.keys().next().value);return result;}
function normalizeAim(input,source){let x=finite(input.aimX),y=finite(input.aimY),m=Math.hypot(x,y);if(m<.001)return{x:source.team==="blue"?1:-1,y:0};return{x:x/m,y:y/m};}
function aimPoint(input,source,ability){if(input.targetX!=null||input.targetY!=null){const tx=finite(input.targetX,source.x),ty=finite(input.targetY,source.y),dx=tx-source.x,dy=ty-source.y,d=Math.hypot(dx,dy)||1,limit=finite(ability.range,180);return d<=limit?{x:tx,y:ty}:{x:source.x+dx/d*limit,y:source.y+dy/d*limit};}const a=normalizeAim(input,source);return{x:source.x+a.x*finite(ability.range,180),y:source.y+a.y*finite(ability.range,180)};}
function segmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,len=vx*vx+vy*vy;if(len<.0001)return Math.hypot(wx,wy);const t=clamp((wx*vx+wy*vy)/len,0,1),px=a.x+t*vx,py=a.y+t*vy;return Math.hypot(p.x-px,p.y-py);}
function spendAbility(hero,ability){if(!canCastAbility(hero,ability))return null;return{...hero,resource:Math.max(0,hero.resource-finite(ability.cost)),cooldowns:{...hero.cooldowns,[ability.slot]:finite(ability.cooldown,8)}};}
function heal(hero,amount){hero.health=Math.min(hero.maxHealth,hero.health+Math.max(0,finite(amount)));return hero;}
function shield(hero,amount){hero.shield=Math.min(3000,finite(hero.shield)+Math.max(0,finite(amount)));return hero;}
function cc(hero,ability,now){return applyMobaMovementControl(hero,{now,slowPct:finite(ability.slow),slowSeconds:ability.slow?clamp(1.2+finite(ability.slow)*.8,.5,3):0,stunSeconds:finite(ability.stun??ability.stunSeconds)});}
function rewardKill(state,sourceIndex,targetIndex){const t=state.match.heroes[targetIndex];if(!t||t.dead||t.health>0)return false;state.match.heroes[targetIndex]=markHeroDead(t,state.now,state.config.hero.respawnBase,state.now);let s=state.match.heroes[sourceIndex];s={...s,gold:s.gold+state.config.economy.killGold,kills:(s.kills||0)+1};state.match.heroes[sourceIndex]=grantExperience(s,160,state.config.hero.maxLevel);return true;}
function damage(state,sourceIndex,targetIndex,ability){const source=state.match.heroes[sourceIndex],target=state.match.heroes[targetIndex],scale=1+(source.level-1)*.035,r=applyDamage(target,finite(ability.damage)*scale,{type:"magic",sourceId:source.id});state.match.heroes[targetIndex]=r.target;cc(state.match.heroes[targetIndex],ability,state.now);rewardKill(state,sourceIndex,targetIndex);return r;}

export const MOBA_HERO_ABILITY_AUTHORITY_V1=Object.freeze({
  version:"moba-hero-ability-authority-v1",authoritative:true,clientHitTrusted:false,clientDamageTrusted:false,clientHealTrusted:false,clientShieldTrusted:false,
  systems:Object.freeze(["server-hero-kit-binding","hero-forge-kind-resolution","skillshot-first-hit","aoe-enemy-resolution","ally-heal-shield","dash","dash-strike","cc-to-movement","server-resource-cooldown","forged-claim-rejection"]),
  truthRule:"Hero Forge ability kinds are resolved from server-owned state. Client hit, damage, heal, shield and crowd-control claims are never authoritative."
});


function sanitizeAbility(a={}){return Object.freeze({slot:text(a.slot,4).toUpperCase(),name:text(a.name,80),kind:text(a.kind,40).toLowerCase(),damage:clamp(a.damage,0,1200),cooldown:clamp(a.cooldown,1,120),cost:clamp(a.cost,0,300),range:clamp(a.range,40,900),radius:clamp(a.radius,0,400),shield:clamp(a.shield,0,1200),heal:clamp(a.heal,0,1200),slow:clamp(a.slow,0,.8),stun:clamp(a.stun??a.stunSeconds,0,3),dash:clamp(a.dash,0,260)});}
export function bindMobaServerHeroKit(state,{heroId,heroSpec}={}){
  const id=text(heroId,128),hero=state?.match?.heroes?.find(h=>h.id===id),abilities=Array.isArray(heroSpec?.abilities)?heroSpec.abilities:[];
  if(!hero||abilities.length!==4)return{ok:false,reason:"invalid_hero_kit"};
  const kit=Object.freeze({heroId:id,role:text(heroSpec.role,24),element:text(heroSpec.element,24),abilities:Object.freeze(abilities.map(sanitizeAbility))});
  if(!state.serverHeroKits)state.serverHeroKits=new Map();state.serverHeroKits.set(id,kit);return{ok:true,kit};
}

export function submitMobaHeroAbilityIntent(state,input={}){
  const c=validateEnvelope(state,input);if(!c.ok)return c.replayed?c.result:c;
  const source=heroForPlayer(state,c.pid),si=source?heroIndex(state,source.id):-1;if(!alive(source)||si<0)return remember(state,c,{ok:false,reason:"hero_unavailable"});
  if(finite(source.statuses?.stunUntil)>finite(state.now))return remember(state,c,{ok:false,reason:"stunned"});
  const slot=text(input.slot,4).toUpperCase(),serverKit=state.serverHeroKits?.get(source.id),ability=(serverKit?.abilities||state.config.hero.abilities).find(a=>a.slot===slot);if(!ability)return remember(state,c,{ok:false,reason:"invalid_ability"});
  for(const [key,severity] of [["damage",3],["hitIds",2],["heal",2],["shield",2],["stun",2]])if(input[key]!=null)violation(state,c.pid,`client_${key}_claim`,severity,String(input[key]).slice(0,80));
  const kind=String(ability.kind||"").toLowerCase();
  if(kind==="heal_shield"){const ti=heroIndex(state,text(input.targetId,128)),target=ti>=0?state.match.heroes[ti]:source;if(!target||target.team!==source.team||!alive(target)||distance(source,target)>finite(ability.range,180)+8)return remember(state,c,{ok:false,reason:"invalid_ally_target"});}
  if(kind==="single_target"){const ti=heroIndex(state,text(input.targetId,128)),target=ti>=0?state.match.heroes[ti]:null;if(!target||target.team===source.team||!alive(target)||distance(source,target)>finite(ability.range,180)+8)return remember(state,c,{ok:false,reason:"invalid_target"});}
  const spent=spendAbility(source,ability);if(!spent){violation(state,c.pid,"ability_cooldown_or_resource_bypass",2,slot);return remember(state,c,{ok:false,reason:"ability_unavailable"});}
  state.match.heroes[si]=spent;
  const hits=[],healed=[],shielded=[];let totalDamage=0;
  const enemies=()=>state.match.heroes.map((hero,index)=>({hero,index})).filter(x=>alive(x.hero)&&x.hero.team!==spent.team);
  const allies=()=>state.match.heroes.map((hero,index)=>({hero,index})).filter(x=>alive(x.hero)&&x.hero.team===spent.team);
  const doDamage=index=>{const r=damage(state,si,index,ability);hits.push(state.match.heroes[index].id);totalDamage+=finite(r.damage);};

  if(["dash","dash_shield","shield_dash","dash_strike"].includes(kind)){
    const a=normalizeAim(input,state.match.heroes[si]),dashDistance=clamp(finite(ability.dash,ability.range),0,260),s=state.match.heroes[si];
    s.x=clamp(s.x+a.x*dashDistance,28,state.config.map.width-28);s.y=clamp(s.y+a.y*dashDistance,35,state.config.map.height-35);
    if(finite(ability.shield)>0){shield(s,ability.shield);shielded.push(s.id);}
    if(kind==="dash_strike"){
      const near=enemies().filter(x=>distance(x.hero,s)<=Math.max(55,finite(ability.radius,0)+28)).sort((a,b)=>distance(a.hero,s)-distance(b.hero,s))[0];
      if(near)doDamage(near.index);
    }
  }else if(kind==="shield"){
    shield(state.match.heroes[si],ability.shield);shielded.push(state.match.heroes[si].id);
  }else if(kind==="heal_shield"){
    const ti=heroIndex(state,text(input.targetId,128)),target=ti>=0?state.match.heroes[ti]:state.match.heroes[si];
    if(finite(ability.heal)>0){heal(target,ability.heal);healed.push(target.id);}if(finite(ability.shield)>0){shield(target,ability.shield);shielded.push(target.id);}
  }else if(kind==="skillshot"){
    const start={x:state.match.heroes[si].x,y:state.match.heroes[si].y},end=aimPoint(input,state.match.heroes[si],ability),radius=Math.max(8,finite(ability.radius,20));
    const first=enemies().filter(x=>segmentDistance(x.hero,start,end)<=radius+18).sort((a,b)=>distance(start,a.hero)-distance(start,b.hero))[0];if(first)doDamage(first.index);
  }else if(kind==="aoe"||kind==="ultimate_aoe"){
    const center=aimPoint(input,state.match.heroes[si],ability),radius=Math.max(8,finite(ability.radius,70));
    for(const x of enemies().filter(x=>distance(x.hero,center)<=radius))doDamage(x.index);
    if(finite(ability.heal)>0||finite(ability.shield)>0)for(const x of allies().filter(x=>distance(x.hero,center)<=radius)){
      if(finite(ability.heal)>0){heal(x.hero,ability.heal);healed.push(x.hero.id);}if(finite(ability.shield)>0){shield(x.hero,ability.shield);shielded.push(x.hero.id);}
    }
  }else if(kind==="single_target"){
    const ti=heroIndex(state,text(input.targetId,128));doDamage(ti);
  }else return remember(state,c,{ok:false,reason:"unsupported_hero_ability_kind"});

  state.eventSequence+=1;
  return remember(state,c,{ok:true,type:"hero_ability",slot,kind,eventSequence:state.eventSequence,serverTick:state.tick,hits:Object.freeze(hits),healed:Object.freeze(healed),shielded:Object.freeze(shielded),totalDamage:Math.round(totalDamage),source:{id:state.match.heroes[si].id,x:state.match.heroes[si].x,y:state.match.heroes[si].y,resource:state.match.heroes[si].resource,shield:state.match.heroes[si].shield}});
}
