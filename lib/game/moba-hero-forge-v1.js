function freeze(v){return Object.freeze(v)}
function text(v,max=160){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max)}
function num(v,f,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):f}
const ROLES=Object.freeze({
  tank:{hp:1450,resource:420,move:165,attack:54,range:80,cooldown:.9,armor:54,resistance:42},
  fighter:{hp:1180,resource:420,move:185,attack:72,range:90,cooldown:.72,armor:36,resistance:30},
  assassin:{hp:900,resource:360,move:215,attack:82,range:82,cooldown:.62,armor:24,resistance:22},
  mage:{hp:880,resource:560,move:178,attack:50,range:155,cooldown:.86,armor:20,resistance:28},
  marksman:{hp:920,resource:390,move:182,attack:70,range:235,cooldown:.58,armor:22,resistance:22},
  support:{hp:1040,resource:520,move:180,attack:48,range:165,cooldown:.82,armor:30,resistance:36}
})
const ELEMENTS=new Set(['neutral','lightning','fire','ice','wind','light','dark','nature'])
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ELEMENT_LABEL={neutral:'Arc',lightning:'Thunder',fire:'Blaze',ice:'Frost',wind:'Gale',light:'Radiant',dark:'Umbral',nature:'Verdant'}

export const MOBA_HERO_FORGE_V1=freeze({version:'moba-hero-forge-v1',privateAvatarBinding:true,ownerScopedAssetRequiredForCustomerAvatar:true,systems:freeze(['avatar-binding','role-archetype','hero-stats','passive','qwer','targeting-shapes','damage-heal-shield-cc','runtime-compile','ai-game-handoff','originality-boundary'])})

function roleOf(v){const r=String(v||'fighter').toLowerCase();return ROLES[r]?r:'fighter'}
function elementOf(v){const e=String(v||'neutral').toLowerCase();return ELEMENTS.has(e)?e:'neutral'}
function ability(slot,name,kind,values={}){return freeze({slot,name,kind,damage:num(values.damage,0,0,1200),cooldown:num(values.cooldown,8,1,120),cost:num(values.cost,30,0,300),range:num(values.range,180,40,900),radius:num(values.radius,0,0,400),shield:num(values.shield,0,0,1000),heal:num(values.heal,0,0,1000),slow:num(values.slow,0,0,.8),stunSeconds:num(values.stunSeconds,0,0,4),dash:num(values.dash,0,0,260),targeting:text(values.targeting||kind,40)})}
function suite(role,element){
  const e=ELEMENT_LABEL[element]||'Arc'
  if(role==='assassin')return[
    ability('Q',`${e} Step`,'dash_strike',{damage:105,cooldown:5,cost:28,range:190,dash:140,targeting:'directional'}),
    ability('W',`${e} Veil`,'shield_dash',{cooldown:9,cost:35,range:120,shield:85,dash:90,targeting:'self'}),
    ability('E',`${e} Mark`,'single_target',{damage:90,cooldown:8,cost:38,range:220,slow:.25,targeting:'target'}),
    ability('R',`${e} Execution`,'ultimate_aoe',{damage:275,cooldown:42,cost:90,range:240,radius:110,stunSeconds:.55,targeting:'ground'})]
  if(role==='mage')return[
    ability('Q',`${e} Bolt`,'skillshot',{damage:120,cooldown:6,cost:34,range:320,radius:24,targeting:'line'}),
    ability('W',`${e} Ward`,'shield',{cooldown:10,cost:42,shield:100,range:80,targeting:'self'}),
    ability('E',`${e} Field`,'aoe',{damage:85,cooldown:11,cost:48,range:250,radius:105,slow:.32,targeting:'ground'}),
    ability('R',`${e} Cataclysm`,'ultimate_aoe',{damage:250,cooldown:45,cost:100,range:300,radius:145,stunSeconds:.7,targeting:'ground'})]
  if(role==='marksman')return[
    ability('Q',`${e} Piercer`,'skillshot',{damage:110,cooldown:5,cost:25,range:360,radius:18,targeting:'line'}),
    ability('W',`${e} Roll`,'dash',{cooldown:8,cost:30,range:120,dash:110,targeting:'directional'}),
    ability('E',`${e} Trap`,'aoe',{damage:65,cooldown:12,cost:35,range:250,radius:70,slow:.38,targeting:'ground'}),
    ability('R',`${e} Barrage`,'ultimate_aoe',{damage:225,cooldown:40,cost:80,range:350,radius:120,targeting:'cone'})]
  if(role==='tank')return[
    ability('Q',`${e} Charge`,'dash_strike',{damage:80,cooldown:7,cost:30,range:180,dash:120,stunSeconds:.45,targeting:'directional'}),
    ability('W',`${e} Bastion`,'shield',{cooldown:10,cost:35,shield:170,targeting:'self'}),
    ability('E',`${e} Lock`,'aoe',{damage:65,cooldown:11,cost:40,range:150,radius:90,slow:.42,targeting:'ground'}),
    ability('R',`${e} Fortress`,'ultimate_aoe',{damage:155,cooldown:48,cost:85,range:170,radius:130,shield:120,stunSeconds:1,targeting:'self_aoe'})]
  if(role==='support')return[
    ability('Q',`${e} Pulse`,'skillshot',{damage:65,cooldown:6,cost:28,range:280,radius:22,targeting:'line'}),
    ability('W',`${e} Grace`,'heal_shield',{cooldown:9,cost:42,range:190,heal:95,shield:55,targeting:'ally'}),
    ability('E',`${e} Sanctuary`,'aoe',{cooldown:12,cost:50,range:220,radius:100,heal:65,slow:.2,targeting:'ground'}),
    ability('R',`${e} Salvation`,'ultimate_aoe',{cooldown:50,cost:100,range:280,radius:150,heal:170,shield:120,targeting:'ground'})]
  return[
    ability('Q',`${e} Slash`,'skillshot',{damage:105,cooldown:6,cost:28,range:210,radius:22,targeting:'line'}),
    ability('W',`${e} Guard`,'dash_shield',{cooldown:9,cost:34,range:120,shield:90,dash:70,targeting:'self'}),
    ability('E',`${e} Breaker`,'aoe',{damage:90,cooldown:10,cost:40,range:165,radius:85,slow:.25,targeting:'ground'}),
    ability('R',`${e} Ascension`,'ultimate_aoe',{damage:235,cooldown:42,cost:85,range:210,radius:125,stunSeconds:.5,targeting:'ground'})]
}

export function buildMobaHeroSpec({heroName='',prompt='',avatarAssetId='',avatarName='',role='fighter',element='neutral'}={}){
  const r=roleOf(role),e=elementOf(element),base=ROLES[r],assetId=UUID.test(String(avatarAssetId||''))?String(avatarAssetId):null
  const name=text(heroName,80)||`${ELEMENT_LABEL[e]} ${r[0].toUpperCase()+r.slice(1)}`
  const abilities=suite(r,e)
  const passive=freeze({slot:'P',name:`${ELEMENT_LABEL[e]} Instinct`,kind:r==='support'?'ally_aura':r==='tank'?'damage_guard':r==='assassin'?'execute_window':'combat_passive',description:`Original ${e} ${r} passive tuned for MOBA counterplay and readable mobile combat.`})
  return freeze({version:MOBA_HERO_FORGE_V1.version,id:`hero-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'original'}`,name,role:r,element:e,prompt:text(prompt,900),avatarBinding:freeze({assetId,assetName:text(avatarName,160)||null,ownerScoped:assetId?true:false,private:assetId?true:false,crossUserReusable:false,rawUrlStored:false}),stats:freeze({maxHealth:base.hp,maxResource:base.resource,moveSpeed:base.move,attackDamage:base.attack,attackRange:base.range,attackCooldown:base.cooldown,armor:base.armor,resistance:base.resistance}),passive,abilities:freeze(abilities),combatTags:freeze([r,e,'mobile-readable','counterplay-required']),originality:freeze({required:true,copyCommercialHero:false,copyCommercialSkills:false,customerAvatarReferenceOnly:assetId?true:false}),truthRule:'Hero Forge produces an original editable MOBA specification. Private Avatar assets remain owner-scoped and are referenced by asset ID; runtime balance still requires simulation, playtest and live telemetry.'})
}

export function compileMobaHeroToRuntimeSpec(hero={}){
  return freeze({name:text(hero?.name,80)||'Original MOBA Hero',game:{moba:{maxHealth:hero?.stats?.maxHealth,maxResource:hero?.stats?.maxResource,moveSpeed:hero?.stats?.moveSpeed,attackDamage:hero?.stats?.attackDamage,attackRange:hero?.stats?.attackRange,attackCooldown:hero?.stats?.attackCooldown,armor:hero?.stats?.armor,resistance:hero?.stats?.resistance,abilities:(hero?.abilities||[]).map(a=>({slot:a.slot,name:a.name,kind:a.kind,cooldown:a.cooldown,cost:a.cost,damage:a.damage,range:a.range,radius:a.radius,shield:a.shield,slow:a.slow}))}},mobaHero:{...hero,avatarBinding:{...hero?.avatarBinding,assetId:null,assetName:null,selectedPrivateAsset:Boolean(hero?.avatarBinding?.assetId)}}})
}

export function compileMobaHeroGameIdea(hero={}){
  const assetRule=hero?.avatarBinding?.assetId?'Bind the hero only to the selected private owner-scoped Avatar supplied through the protected assetIds channel; never place its asset ID, signed URL or file name into model-visible text and never reuse it across users.':'Use an original fictional hero visual until the creator selects a private Avatar asset.'
  const skills=(hero?.abilities||[]).map(a=>`${a.slot} ${a.name}: ${a.kind}, damage ${a.damage}, cooldown ${a.cooldown}s, cost ${a.cost}, range ${a.range}, radius ${a.radius}, shield ${a.shield}, heal ${a.heal}, slow ${a.slow}, stun ${a.stunSeconds}s`).join('\n')
  return `Create an original 5v5 MOBA hero named ${text(hero?.name,80)}. Role: ${text(hero?.role,24)}. Element: ${text(hero?.element,24)}.\n${assetRule}\nPassive: ${text(hero?.passive?.name,80)} — ${text(hero?.passive?.description,240)}\n${skills}\nUse server-authoritative combat, readable mobile targeting, explicit counters, editable game data, Bot Training and separate simulated-vs-live balance evidence. Do not copy commercial heroes, maps, names, VFX or skill kits.`
}
