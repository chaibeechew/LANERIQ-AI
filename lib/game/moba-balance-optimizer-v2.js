import {simulateMobaHeroBalance} from "./moba-balance-lab-v1.js";
function freeze(v){return Object.freeze(v)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
export const MOBA_BALANCE_OPTIMIZER_V2=freeze({version:"moba-balance-optimizer-v2",simulationOnly:true,maxIterations:8,maxSingleStatPct:.08,systems:freeze(["bounded-patch-search","win-rate-target","ttk-signal","ability-budget","reversible-candidate-history","no-auto-live-patch"])})
export function proposeMobaBalancePatch({hero={},report={}}={}){
  const delta=finite(report.winRate,50)-50;if(Math.abs(delta)<2.5)return{direction:"hold",changes:[]};
  const nerf=delta>0,sign=nerf?-1:1,changes=[{path:"stats.attackDamage",pct:sign*.025},{path:"stats.maxHealth",pct:sign*.018}];
  const abilities=Array.isArray(hero.abilities)?hero.abilities:[];const top=abilities.map((a,i)=>({i,damage:finite(a.damage)})).sort((a,b)=>b.damage-a.damage)[0];if(top)changes.push({path:`abilities.${top.i}.damage`,pct:sign*.04});if(top)changes.push({path:`abilities.${top.i}.cooldown`,pct:-sign*.03});
  return{direction:nerf?"nerf":"buff",changes}
}
function get(root,path){return path.split(".").reduce((o,k)=>o?.[k],root)}
function set(root,path,value){const parts=path.split("."),last=parts.pop();let cur=root;for(const p of parts)cur=cur[p];cur[last]=value}
export function applyMobaBalancePatch(hero,patch){const next=clone(hero);for(const c of patch.changes||[]){const current=finite(get(next,c.path));const pct=clamp(finite(c.pct),-.08,.08);set(next,c.path,Number((current*(1+pct)).toFixed(4)))}return next}
export function optimizeMobaHeroBalance({hero={},iterations=6,matchesPerIteration=1000,seed=2026}={}){
  let current=clone(hero),best=null;const history=[],limit=Math.max(1,Math.min(8,Math.floor(finite(iterations,6))));
  for(let i=0;i<limit;i++){const report=simulateMobaHeroBalance({hero:current,matches:matchesPerIteration,seed:seed+i}),distance=Math.abs(report.winRate-50);if(!best||distance<best.distance)best={hero:clone(current),report,distance};const patch=proposeMobaBalancePatch({hero:current,report});history.push({iteration:i+1,winRate:report.winRate,recommendation:report.recommendation,patch});if(patch.direction==="hold")break;current=applyMobaBalancePatch(current,patch)}
  return{version:MOBA_BALANCE_OPTIMIZER_V2.version,evidenceLevel:"simulation_only",bestHero:best.hero,bestReport:best.report,iterations:history.length,history,productionPatchApproved:false,requiresPlaytest:true,truthRule:"Optimizer candidates are reversible simulation proposals only; measured player telemetry and release gates remain mandatory."}
}
