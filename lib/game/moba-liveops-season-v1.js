import {createHash} from "node:crypto";
function freeze(v){return Object.freeze(v)}
function validSha(v){return /^[0-9a-f]{40}$/i.test(String(v||""))}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object"){const o={};for(const k of Object.keys(v).sort())o[k]=stable(v[k]);return o}return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}
export const MOBA_LIVEOPS_SEASON_V1=freeze({version:"moba-liveops-season-v1",exactBuildBound:true,autoProductionWithoutEvidence:false,systems:freeze(["season-config-digest","ranked-window","hero-pool","canary-rollout","telemetry-promotion","rollback-plan","exact-build-binding"])})
export function createMobaSeasonConfig({seasonId,buildSha,startsAt,endsAt,rankedEnabled=true,heroPool=[],patchLabel=""}={}){
  const config={version:MOBA_LIVEOPS_SEASON_V1.version,seasonId:String(seasonId||"season").slice(0,64),buildSha:validSha(buildSha)?buildSha:null,startsAt:String(startsAt||""),endsAt:String(endsAt||""),rankedEnabled:Boolean(rankedEnabled),heroPool:[...new Set(heroPool.map(String))].sort(),patchLabel:String(patchLabel||"").slice(0,80)};return freeze({...config,configDigest:digest(config)})
}
export function buildMobaPatchRollout({currentConfig,nextConfig,canaryPct=5}={}){
  return{version:MOBA_LIVEOPS_SEASON_V1.version,fromDigest:currentConfig?.configDigest||null,toDigest:nextConfig?.configDigest||null,buildSha:nextConfig?.buildSha||null,stage:"canary",trafficPct:Math.max(1,Math.min(25,Number(canaryPct)||5)),rollbackReady:Boolean(currentConfig?.configDigest),rolloutComplete:false,productionCertified:false}
}
export function evaluateMobaPatchPromotion({rollout,telemetry={},providerSmoke={},integrityViolations=0,deviceEvidence=false}={}){
  const checks={exactBuild:validSha(rollout?.buildSha)&&telemetry.buildSha===rollout.buildSha,measured:telemetry.measured===true&&telemetry.synthetic!==true,healthy:telemetry.healthy===true,provider:providerSmoke.liveProviderVerified===true,rollbackReady:rollout?.rollbackReady===true,integrity:Number(integrityViolations)===0,deviceEvidence:deviceEvidence===true};const passed=Object.values(checks).every(Boolean);return{passed,checks,nextAction:passed?"promote_next_stage":"hold_or_rollback",productionCertified:false}
}
export function advanceMobaPatchRollout(rollout,evaluation){if(!evaluation?.passed)return{...rollout,stage:"rollback",trafficPct:0,rolloutComplete:false,productionCertified:false};if(rollout.trafficPct<25)return{...rollout,stage:"expanded_canary",trafficPct:25};if(rollout.trafficPct<50)return{...rollout,stage:"half",trafficPct:50};if(rollout.trafficPct<100)return{...rollout,stage:"full",trafficPct:100,rolloutComplete:true,productionCertified:false};return{...rollout}}
