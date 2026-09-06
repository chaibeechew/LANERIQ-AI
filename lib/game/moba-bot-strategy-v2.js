function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clamp(v,a,b){return Math.max(a,Math.min(b,finite(v,a)))}
export const MOBA_BOT_STRATEGY_V2=freeze({version:"moba-bot-strategy-v2",deterministic:true,systems:freeze(["health-retreat","lane-pressure","objective-timing","teamfight-join","role-positioning","farm-efficiency","vision-priority","shop-recall","difficulty-risk-budget"])})
const ACTIONS=["retreat","recall_shop","contest_objective","join_teamfight","defend_lane","push_lane","farm_jungle","place_vision","farm_lane"]
export function scoreMobaBotActions(context={},difficulty="normal"){
  const hp=clamp(context.healthPct,.0,1),gold=finite(context.unspentGold),objective=finite(context.objectiveSeconds,999),allies=finite(context.alliesNearby),enemies=finite(context.enemiesNearby),lanePressure=clamp(context.lanePressure,-1,1),role=String(context.role||"fighter"),risk=difficulty==="hard"?1.12:difficulty==="easy"?.84:1;
  const score={retreat:(1-hp)*120+(enemies-allies)*18,recall_shop:gold>1600?55+gold/100:5,contest_objective:objective<18?(85-objective*2)+(allies-enemies)*10:8,join_teamfight:(allies+enemies>=4?70:8)+(role==="tank"||role==="support"?14:0),defend_lane:lanePressure<-.25?65+Math.abs(lanePressure)*30:10,push_lane:lanePressure>.2?55+lanePressure*25:18,farm_jungle:role==="assassin"||role==="fighter"?34:18,place_vision:role==="support"?58:22,farm_lane:35};
  score.retreat/=risk;score.contest_objective*=risk;score.join_teamfight*=risk;return score
}
export function chooseMobaBotAction(context={},difficulty="normal"){const scores=scoreMobaBotActions(context,difficulty),action=[...ACTIONS].sort((a,b)=>scores[b]-scores[a])[0];return{version:MOBA_BOT_STRATEGY_V2.version,action,score:Number(scores[action].toFixed(2)),scores}}
export function simulateMobaBotDecisionBatch({contexts=[],decisions=10000,difficulty="normal"}={}){const count=Math.max(100,Math.min(10000,Math.floor(finite(decisions,10000)))),distribution=Object.fromEntries(ACTIONS.map(a=>[a,0]));for(let i=0;i<count;i++){const context=contexts.length?contexts[i%contexts.length]:{};distribution[chooseMobaBotAction(context,difficulty).action]++}return{version:MOBA_BOT_STRATEGY_V2.version,evidenceLevel:"simulation_only",decisions:count,distribution,realPlayerEvidence:false}}
