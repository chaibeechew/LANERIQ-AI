function freeze(v){return Object.freeze(v)}
function text(v,max=96){return String(v??"").trim().slice(0,max)}
const TEAM=new Set(["blue","red"])
const DEFAULT_ORDER=freeze([
  ["ban","blue"],["ban","red"],["ban","blue"],["ban","red"],["ban","blue"],["ban","red"],
  ["pick","blue"],["pick","red"],["pick","red"],["pick","blue"],["pick","blue"],["pick","red"],["pick","red"],["pick","blue"],["pick","blue"],["pick","red"]
])
export const MOBA_DRAFT_AUTHORITY_V1=freeze({version:"moba-draft-authority-v1",authoritative:true,bansPerTeam:3,picksPerTeam:5,systems:freeze(["server-turn-order","unique-hero-lock","ban-lock","pick-lock","role-coverage","side-swap-contract","draft-finalization"])})
export function createMobaDraft({heroPool=[],mode="ranked"}={}){return{version:MOBA_DRAFT_AUTHORITY_V1.version,mode:text(mode,32)||"ranked",heroPool:new Set(heroPool.map(x=>text(x,80)).filter(Boolean)),step:0,order:DEFAULT_ORDER.map(x=>[...x]),bans:{blue:[],red:[]},picks:{blue:[],red:[]},complete:false,events:[]}}
export function submitMobaDraftAction(state,{team,type,heroId,playerId="",role=""}={}){
  if(state.complete)return{ok:false,reason:"draft_complete"};const expected=state.order[state.step];if(!expected)return{ok:false,reason:"draft_complete"};if(!TEAM.has(team)||type!==expected[0]||team!==expected[1])return{ok:false,reason:"wrong_turn",expected:{type:expected[0],team:expected[1]}};
  const hero=text(heroId,80);if(!hero||!state.heroPool.has(hero))return{ok:false,reason:"hero_not_in_pool"};if(state.bans.blue.includes(hero)||state.bans.red.includes(hero)||state.picks.blue.some(x=>x.heroId===hero)||state.picks.red.some(x=>x.heroId===hero))return{ok:false,reason:"hero_already_locked"};
  if(type==="ban")state.bans[team].push(hero);else state.picks[team].push({heroId:hero,playerId:text(playerId,80),role:text(role,24)});
  state.events.push({step:state.step,type,team,heroId:hero});state.step+=1;state.complete=state.step>=state.order.length;return{ok:true,step:state.step,complete:state.complete}
}
export function evaluateMobaDraft(state){
  const roles=team=>new Set(state.picks[team].map(x=>x.role).filter(Boolean)).size;const checks={complete:state.complete,bluePicks:state.picks.blue.length===5,redPicks:state.picks.red.length===5,blueRoleCoverage:roles("blue")>=4,redRoleCoverage:roles("red")>=4,uniqueHeroes:new Set([...state.picks.blue,...state.picks.red].map(x=>x.heroId)).size===10};
  return{passed:Object.values(checks).every(Boolean),checks,bans:{blue:[...state.bans.blue],red:[...state.bans.red]},picks:{blue:state.picks.blue.map(x=>({...x})),red:state.picks.red.map(x=>({...x}))}}
}
export function buildMobaSideSwapDraft(state){return{mode:state.mode,bluePreviousPicks:state.picks.red.map(x=>x.heroId),redPreviousPicks:state.picks.blue.map(x=>x.heroId),sideSwap:true}}
