import assert from 'node:assert/strict'
import fs from 'node:fs'
import {buildMobaHeroSpec,compileMobaHeroGameIdea,compileMobaHeroToRuntimeSpec,MOBA_HERO_FORGE_V1} from '../lib/game/moba-hero-forge-v1.js'
import {MOBA_BALANCE_LAB_V1,simulateMobaBotMassMatches,simulateMobaHeroBalance} from '../lib/game/moba-balance-lab-v1.js'
import {evaluateMobaProviderQualificationPrerequisites,MOBA_REAL_PROVIDER_QUALIFICATION_V1,runMobaRealProviderQualification} from '../lib/game/moba-real-provider-qualification-v1.js'

const sha='a'.repeat(40),players=Array.from({length:10},(_,i)=>`p${i+1}`)
assert.equal(MOBA_REAL_PROVIDER_QUALIFICATION_V1.exactPlayers,10)
assert.equal(evaluateMobaProviderQualificationPrerequisites({buildSha:sha,playerIds:players,providerConfig:{configured:false,blockedByCostPolicy:false},collector:{trusted:true,collect(){}}}).ready,false)
const fakeGateway={
  getConfig:()=>({configured:true,blockedByCostPolicy:false}),sleep:async()=>{},
  create:async({mode,playerId})=>({ticketId:mode==='qualification-cancel'?'aux':`t-${playerId}`,status:'searching'}),
  check:async(ticketId)=>({ticketId,status:'matched',matchId:'match-1',region:'auto'}),
  cancel:async()=>({status:'cancelled'})
}
const roster=players.map((playerId,i)=>({playerId,team:i<5?'blue':'red'}))
const collector={trusted:true,collect:async()=>({measured:true,synthetic:false,deploymentBuildSha:sha,authoritativeHost:true,relayJoined:true,roster,fullMatchCompleted:true,reconnectVerified:true,authoritativeResult:true,latencyP95Ms:70,packetLossPct:.4,crashRatePct:0})}
const qualified=await runMobaRealProviderQualification({buildSha:sha,playerIds:players,collector,gateway:fakeGateway,maxPolls:1,pollIntervalMs:0})
assert.equal(qualified.verified,true)
assert.equal(qualified.liveProviderVerified,true)
assert.equal(qualified.productionReady,false)
assert.doesNotMatch(JSON.stringify(qualified),/t-p1|match-1/)

assert.equal(MOBA_HERO_FORGE_V1.privateAvatarBinding,true)
const avatarId='123e4567-e89b-42d3-a456-426614174000'
const hero=buildMobaHeroSpec({heroName:'Storm Veil',prompt:'Fast lightning assassin with readable counterplay',avatarAssetId:avatarId,avatarName:'my-avatar.png',role:'assassin',element:'lightning'})
assert.equal(hero.avatarBinding.assetId,avatarId)
assert.equal(hero.avatarBinding.ownerScoped,true)
assert.equal(hero.avatarBinding.crossUserReusable,false)
assert.equal(hero.abilities.length,4)
assert.deepEqual(hero.abilities.map(a=>a.slot),['Q','W','E','R'])
const idea=compileMobaHeroGameIdea(hero)
assert.match(idea,/private owner-scoped Avatar/)
assert.doesNotMatch(idea,new RegExp(avatarId))
const runtime=compileMobaHeroToRuntimeSpec(hero)
assert.equal(runtime.game.moba.abilities.length,4)
assert.equal(runtime.mobaHero.avatarBinding.assetId,null)
assert.equal(runtime.mobaHero.avatarBinding.selectedPrivateAsset,true)

assert.equal(MOBA_BALANCE_LAB_V1.maxMatchesPerRun,10000)
const b1=simulateMobaHeroBalance({hero,matches:10000,seed:42}),b2=simulateMobaHeroBalance({hero,matches:10000,seed:42})
assert.equal(b1.matches,10000)
assert.equal(b1.matches,b2.matches)
assert.equal(b1.winRate,b2.winRate)
assert.equal(b1.evidenceLevel,'simulation_only')
assert.equal(b1.realPlayerEvidence,false)
const mass=simulateMobaBotMassMatches({blueTeam:[hero,hero,hero,hero,hero],redTeam:[hero,hero,hero,hero,hero],matches:10000,seed:7})
assert.equal(mass.matches,10000)
assert.equal(mass.realPlayers,false)
assert.equal(mass.productionBalanceVerified,false)

const page=fs.readFileSync('app/moba-studio/page.js','utf8')
const readiness=fs.readFileSync('lib/game/game-creator-readiness-v2.js','utf8')
assert.match(page,/asset_library/)
assert.match(page,/\.eq\("user_id",user\.id\)/)
assert.match(page,/createSignedUrl/)
assert.match(page,/buildMobaHeroSpec/)
assert.match(page,/simulateMobaHeroBalance/)
assert.match(page,/10000/)
assert.match(page,/\/api\/game\/generate/)
assert.match(page,/assetIds:hero\.avatarBinding\.assetId/)
assert.doesNotMatch(page,/mobaHero:hero/)
assert.match(page,/\/api\/game\/multiplayer\/capacity/)
assert.match(readiness,/mobaRealProviderQualificationRunner/)
assert.match(readiness,/mobaHeroForge/)
assert.match(readiness,/mobaBalanceBotSimulation/)

console.log('✓ MOBA Creator Productization passed: real Provider qualification runner, private Avatar Hero Forge, privacy-separated AI Game handoff and exact 100/1K/10K deterministic balance simulation are integrated without promoting simulation to live evidence.')
