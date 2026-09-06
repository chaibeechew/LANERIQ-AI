function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rng(seed=123456789){let x=(Number(seed)||123456789)>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000}}

export const MOBA_BALANCE_LAB_V1=freeze({version:'moba-balance-lab-v1',simulationOnly:true,realPlayerEvidence:false,maxMatchesPerRun:10000,systems:freeze(['power-model','role-benchmarks','monte-carlo-duels','five-v-five-bot-mass-simulation','ttk-estimate','outlier-detection','buff-nerf-recommendation'])})

const BENCHMARKS=Object.freeze({
  tank:{maxHealth:1450,attackDamage:54,attackCooldown:.9,armor:54,resistance:42,abilityDps:28,utility:125},
  fighter:{maxHealth:1180,attackDamage:72,attackCooldown:.72,armor:36,resistance:30,abilityDps:45,utility:65},
  assassin:{maxHealth:900,attackDamage:82,attackCooldown:.62,armor:24,resistance:22,abilityDps:66,utility:38},
  mage:{maxHealth:880,attackDamage:50,attackCooldown:.86,armor:20,resistance:28,abilityDps:72,utility:55},
  marksman:{maxHealth:920,attackDamage:70,attackCooldown:.58,armor:22,resistance:22,abilityDps:54,utility:35},
  support:{maxHealth:1040,attackDamage:48,attackCooldown:.82,armor:30,resistance:36,abilityDps:30,utility:145}
})

function heroModel(hero={}){
  const s=hero.stats||hero
  const abilities=Array.isArray(hero.abilities)?hero.abilities:[]
  const avgResist=(finite(s.armor)+finite(s.resistance))/2
  const effectiveHealth=finite(s.maxHealth,1000)*(1+avgResist/100)
  const basicDps=finite(s.attackDamage,60)/Math.max(.25,finite(s.attackCooldown,.75))
  let abilityDps=0,utility=0,burst=0
  for(const a of abilities){const cd=Math.max(1,finite(a.cooldown,8)),damage=finite(a.damage),shield=finite(a.shield),heal=finite(a.heal),slow=finite(a.slow),stun=finite(a.stunSeconds);abilityDps+=damage/cd;utility+=(shield+heal)/cd+slow*45+stun*35;burst+=damage+shield*.3+heal*.25}
  const mobility=finite(s.moveSpeed,180)/180
  const range=finite(s.attackRange,100)/100
  const power=effectiveHealth*.052+basicDps*.72+abilityDps*1.15+utility*.72+mobility*18+range*8
  return{effectiveHealth,basicDps,abilityDps,utility,burst,power}
}
function benchmarkHero(role){const b=BENCHMARKS[role]||BENCHMARKS.fighter;return{role,stats:{maxHealth:b.maxHealth,attackDamage:b.attackDamage,attackCooldown:b.attackCooldown,armor:b.armor,resistance:b.resistance,moveSpeed:180,attackRange:role==='marksman'?235:role==='mage'||role==='support'?160:90},abilities:[{cooldown:8,damage:b.abilityDps*8,shield:b.utility*2,heal:0,slow:0,stunSeconds:0}]}}
function winProbability(a,b){const pa=heroModel(a).power,pb=heroModel(b).power;return clamp(.5+(pa-pb)/Math.max(180,pa+pb),.08,.92)}
function duel(hero,enemy,matches,random){const p=winProbability(hero,enemy),hm=heroModel(hero),em=heroModel(enemy);let wins=0,ttk=0;for(let i=0;i<matches;i++){const variance=(random()-.5)*.18,win=random()<clamp(p+variance,.03,.97);if(win)wins++;const dps=Math.max(25,(hm.basicDps+hm.abilityDps)*(win?1:.84));const targetEhp=win?em.effectiveHealth:hm.effectiveHealth;ttk+=targetEhp/dps*(.88+random()*.28)}return{wins,winRate:wins/matches,avgTtkSeconds:ttk/matches}}

export function simulateMobaHeroBalance({hero={},matches=1000,seed=1337}={}){
  const count=Math.max(100,Math.min(MOBA_BALANCE_LAB_V1.maxMatchesPerRun,Math.floor(finite(matches,1000)))),random=rng(seed),roles=Object.keys(BENCHMARKS),base=Math.floor(count/roles.length),remainder=count%roles.length,matchups=[];let weightedWins=0,total=0,ttkTotal=0
  roles.forEach((role,index)=>{const samples=base+(index<remainder?1:0),r=duel(hero,benchmarkHero(role),samples,random);matchups.push(freeze({role,winRate:Number((r.winRate*100).toFixed(1)),avgTtkSeconds:Number(r.avgTtkSeconds.toFixed(2)),samples}));weightedWins+=r.wins;total+=samples;ttkTotal+=r.avgTtkSeconds*samples})
  const winRate=total?weightedWins/total:0.5,model=heroModel(hero),oneShotRisk=model.burst>model.effectiveHealth*.72,high=winRate>.58,low=winRate<.42
  const recommendation=high?'nerf_review':low?'buff_review':'within_simulation_band'
  return freeze({version:MOBA_BALANCE_LAB_V1.version,evidenceLevel:'simulation_only',matches:total,winRate:Number((winRate*100).toFixed(1)),avgTtkSeconds:Number((ttkTotal/Math.max(1,total)).toFixed(2)),powerScore:Number(model.power.toFixed(2)),matchups:freeze(matchups),outliers:freeze({highWinRate:high,lowWinRate:low,oneShotRisk}),recommendation,realPlayerEvidence:false,productionBalanceVerified:false,truthRule:'Bot/Monte-Carlo simulation is a pre-playtest balance signal only. It does not prove live player win rate, latency behavior or Production balance.'})
}

function teamPower(team=[]){let total=0,roles=new Set;for(const hero of team){const m=heroModel(hero);total+=m.power;roles.add(hero?.role||'fighter')}const coverage=Math.min(1,roles.size/5);return total*(.9+.1*coverage)}
export function simulateMobaBotMassMatches({blueTeam=[],redTeam=[],matches=10000,seed=2026}={}){
  const count=Math.max(100,Math.min(MOBA_BALANCE_LAB_V1.maxMatchesPerRun,Math.floor(finite(matches,10000)))),random=rng(seed),bp=teamPower(blueTeam),rp=teamPower(redTeam),base=clamp(.5+(bp-rp)/Math.max(300,bp+rp),.08,.92);let blueWins=0,duration=0
  for(let i=0;i<count;i++){const p=clamp(base+(random()-.5)*.16,.03,.97);if(random()<p)blueWins++;duration+=720+(random()-.5)*240+Math.abs(bp-rp)*.08}
  const blueRate=blueWins/count
  return freeze({version:MOBA_BALANCE_LAB_V1.version,evidenceLevel:'simulation_only',matches:count,blueWinRate:Number((blueRate*100).toFixed(1)),redWinRate:Number(((1-blueRate)*100).toFixed(1)),avgMatchSeconds:Number((duration/count).toFixed(1)),balanceDeltaPct:Number((Math.abs(blueRate-.5)*200).toFixed(1)),recommendation:Math.abs(blueRate-.5)>.08?'team_balance_review':'within_simulation_band',realPlayers:false,crashEvidence:false,productionBalanceVerified:false,truthRule:'Mass Bot Simulation estimates balance behavior under a deterministic model; it is not a substitute for real-player telemetry or live load testing.'})
}
