import {createHash} from "node:crypto";
function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function validSha(v){return /^[0-9a-f]{40}$/i.test(String(v||""))}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){const out={};for(const k of Object.keys(value).sort())out[k]=stable(value[k]);return out}return value}
function digest(value){return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex")}
export const MOBA_REPLAY_SPECTATOR_V1=freeze({version:"moba-replay-spectator-v1",authoritativeEventsOnly:true,spectatorDelayDefaultTicks:200,systems:freeze(["hash-chain","monotonic-event-sequence","checkpoint-seek","spectator-delay","team-visibility","private-event-redaction","tamper-detection"])})
export function createMobaReplayLog({matchId="",buildSha=""}={}){return{version:MOBA_REPLAY_SPECTATOR_V1.version,matchId:String(matchId).slice(0,120),buildSha:validSha(buildSha)?buildSha:null,events:[],checkpoints:[],headHash:"0".repeat(64)}}
export function appendMobaReplayEvent(log,{sequence,tick,type,payload={},visibility="public",checkpoint=false}={}){
  const seq=Math.floor(finite(sequence,-1)),t=Math.floor(finite(tick,-1));const last=log.events.at(-1);if(seq<0||t<0)return{ok:false,reason:"invalid_sequence_or_tick"};if(last&&(seq<=last.sequence||t<last.tick))return{ok:false,reason:"non_monotonic_event"};
  const core={sequence:seq,tick:t,type:String(type||"event").slice(0,64),payload:stable(payload),visibility:String(visibility||"public").slice(0,32)},hash=digest({previousHash:log.headHash,...core}),event={...core,previousHash:log.headHash,hash};log.events.push(event);log.headHash=event.hash;if(checkpoint)log.checkpoints.push({tick:t,sequence:seq,eventIndex:log.events.length-1,hash:event.hash});return{ok:true,event}
}
export function verifyMobaReplayChain(log){let previous="0".repeat(64);for(const e of log.events){const expected=digest({previousHash:previous,sequence:e.sequence,tick:e.tick,type:e.type,payload:stable(e.payload),visibility:e.visibility});if(e.previousHash!==previous||e.hash!==expected)return{valid:false,sequence:e.sequence};previous=e.hash}return{valid:true,headHash:previous,count:log.events.length}}
function visible(e,team){if(e.visibility==="public")return true;if(e.visibility==="private")return false;return team&&e.visibility===`team:${team}`}
export function buildMobaSpectatorFeed(log,{currentTick,delayTicks=200,team=null}={}){const maxTick=Math.max(0,Math.floor(finite(currentTick))-Math.max(0,Math.floor(finite(delayTicks,200))));return{version:log.version,matchId:log.matchId,delayedToTick:maxTick,events:log.events.filter(e=>e.tick<=maxTick&&visible(e,team)).map(e=>({sequence:e.sequence,tick:e.tick,type:e.type,payload:e.payload,hash:e.hash}))}}
export function seekMobaReplay(log,targetTick=0){const tick=Math.max(0,Math.floor(finite(targetTick))),checkpoint=[...log.checkpoints].reverse().find(c=>c.tick<=tick)||null,start=checkpoint?checkpoint.eventIndex:0;return{checkpoint,events:log.events.slice(start).filter(e=>e.tick<=tick).map(e=>({...e}))}}
