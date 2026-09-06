function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,finite(value,min)));}
function text(value,max=128){return String(value??"").trim().slice(0,max);}
function alive(hero){return Boolean(hero&&!hero.dead&&hero.health>0);}

export const MOBA_MOVEMENT_CC_AUTHORITY_V1=Object.freeze({
  version:"moba-movement-cc-authority-v1",
  authoritative:true,
  clientSpeedTrusted:false,
  systems:Object.freeze(["stun-movement-lock","server-slow-multiplier","movement-budget","monotonic-input","idempotent-action","status-expiry","anti-speed-claim"]),
  truthRule:"Movement speed, stun and slow are server-owned. Client speed claims never increase authoritative displacement."
});

function heroForPlayer(state,playerId){const heroId=state?.owners?.get(text(playerId,128));return state?.match?.heroes?.find(hero=>hero.id===heroId)||null;}
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
  if(seq<=previous){violation(state,pid,"stale_sequence",1);return{ok:false,reason:"stale_sequence"};}
  if(seq>previous+64){violation(state,pid,"sequence_jump",2,`${previous}->${seq}`);return{ok:false,reason:"sequence_jump"};}
  return{ok:true,pid,action,seq,seen};
}
function remember(state,checked,result){
  state.lastSequence.set(checked.pid,checked.seq);checked.seen.set(checked.action,result);
  if(checked.seen.size>128){const first=checked.seen.keys().next().value;checked.seen.delete(first);}
  return result;
}

export function applyMobaMovementControl(hero,{now=0,slowPct=0,slowSeconds=0,stunSeconds=0}={}){
  if(!hero)return hero;
  const statuses={...(hero.statuses||{})};
  if(slowPct>0&&slowSeconds>0){
    statuses.slowPct=Math.max(finite(statuses.slowPct,0),clamp(slowPct,0,.8));
    statuses.slowUntil=Math.max(finite(statuses.slowUntil,0),finite(now,0)+clamp(slowSeconds,.1,5));
  }
  if(stunSeconds>0)statuses.stunUntil=Math.max(finite(statuses.stunUntil,0),finite(now,0)+clamp(stunSeconds,.1,3));
  hero.statuses=statuses;return hero;
}

export function clearExpiredMobaMovementControl(state){
  for(const hero of state?.match?.heroes||[]){
    const statuses={...(hero.statuses||{})};
    if(finite(statuses.slowUntil,0)<=finite(state.now,0)){statuses.slowUntil=0;statuses.slowPct=0;}
    if(finite(statuses.stunUntil,0)<=finite(state.now,0))statuses.stunUntil=0;
    hero.statuses=statuses;
  }
  return state;
}

export function submitMobaMovementIntentWithCc(state,input={}){
  const checked=validateEnvelope(state,input);if(!checked.ok)return checked.replayed?checked.result:checked;
  const hero=heroForPlayer(state,checked.pid);if(!alive(hero))return remember(state,checked,{ok:false,reason:"hero_unavailable"});
  const serverNow=finite(state.now,0),statuses=hero.statuses||{};
  if(finite(statuses.stunUntil,0)>serverNow)return remember(state,checked,{ok:false,reason:"stunned",serverTick:state.tick});
  const x=finite(input.x),y=finite(input.y);
  if(Math.abs(x)>1.001||Math.abs(y)>1.001){violation(state,checked.pid,"invalid_movement_axis",2);return remember(state,checked,{ok:false,reason:"invalid_axis"});}
  const now=finite(input.now,serverNow),last=state.lastInputAt.get(checked.pid)||0,dt=last?Math.max(0,now-last):1/state.tickRate;
  if(last&&dt<1/120){violation(state,checked.pid,"movement_rate_limit",1);return remember(state,checked,{ok:false,reason:"rate_limited"});}
  const boundedDt=clamp(dt,1/state.tickRate,.12),mag=Math.hypot(x,y)||1,nx=Math.abs(x)>1||Math.abs(y)>1?x/mag:x,ny=Math.abs(x)>1||Math.abs(y)>1?y/mag:y;
  const slowActive=finite(statuses.slowUntil,0)>serverNow,slowPct=slowActive?clamp(statuses.slowPct,0,.8):0,speedMultiplier=1-slowPct;
  const baseSpeed=finite(hero.moveSpeed,finite(state.config?.hero?.moveSpeed,180)),speed=baseSpeed*speedMultiplier;
  const requestedScale=clamp(input.speedScale??1,0,1.25);if(requestedScale>1.001)violation(state,checked.pid,"client_speed_claim",2,String(requestedScale));
  const dx=nx*speed*boundedDt,dy=ny*speed*boundedDt;
  hero.x=clamp(hero.x+dx,28,state.config.map.width-28);hero.y=clamp(hero.y+dy,35,state.config.map.height-35);state.lastInputAt.set(checked.pid,now);
  return remember(state,checked,{ok:true,type:"movement",heroId:hero.id,x:hero.x,y:hero.y,serverTick:state.tick,slowPct,speedMultiplier});
}
