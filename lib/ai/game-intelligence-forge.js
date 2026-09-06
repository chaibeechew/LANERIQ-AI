// LANERIQ AI Game Intelligence Forge
// Deterministic combat-design knowledge for original game content.
// This module plans abilities and avatar bindings; it does not claim rendered animation,
// engine integration, external-model output, multiplayer balance proof or store approval.

export const GAME_INTELLIGENCE_FORGE_VERSION="game-intelligence-forge-v1";

export const FORGE_TYPES=Object.freeze([
  {id:"ultimate",label:"Ultimate / 大招"},
  {id:"physical",label:"Physical Attack / 物理攻击"},
  {id:"magic",label:"Magic Attack / 魔法攻击"},
  {id:"kungfu",label:"Kungfu Attack / 功夫攻击"},
  {id:"defense",label:"Defense / 防御"},
  {id:"healing",label:"Healing / 补血"},
  {id:"treasure",label:"Treasure / 宝物"},
  {id:"weapon",label:"Weapon / 武器"},
  {id:"item",label:"Item / 道具"},
  {id:"summon",label:"Summon / 召唤"},
  {id:"transformation",label:"Transformation / 变身"},
]);

const TYPE_HINTS=Object.freeze({
  ultimate:[/ultimate|finisher|limit break|大招|终极|終極|必杀|必殺/i],
  physical:[/physical|melee|slash|strike|heavy attack|物理|斩|斬|重击|重擊/i],
  magic:[/magic|spell|element|fire|ice|lightning|雷|火|冰|魔法|法术|法術/i],
  kungfu:[/kung.?fu|martial art|wuxia|拳|掌|剑法|劍法|武侠|武俠|功夫|内功|內功|真气|真氣/i],
  defense:[/defen|shield|block|parry|guard|护盾|護盾|防御|防禦|格挡|格擋|减伤|減傷/i],
  healing:[/heal|health|hp|lifesteal|restore|补血|補血|回血|治疗|治療|复活|復活/i],
  treasure:[/treasure|relic|artifact|宝物|寶物|神器|圣物|聖物/i],
  weapon:[/weapon|sword|blade|staff|bow|gun|武器|剑|劍|刀|法杖|弓/i],
  item:[/item|potion|consumable|道具|药水|藥水|卷轴|卷軸/i],
  summon:[/summon|pet|spirit|clone|召唤|召喚|神兽|神獸|分身/i],
  transformation:[/transform|awaken|berserk|form|变身|變身|觉醒|覺醒|狂暴|神化/i],
});

const ELEMENTS=Object.freeze([
  ["lightning",/lightning|thunder|雷|电|電/i],
  ["fire",/fire|flame|burn|火|炎/i],
  ["ice",/ice|frost|freeze|冰|霜/i],
  ["wind",/wind|storm|风|風/i],
  ["light",/holy|light|radiant|光|圣|聖/i],
  ["dark",/dark|shadow|void|暗|影|虚空|虛空/i],
  ["nature",/nature|earth|plant|自然|土|木/i],
]);

function clean(value,max=1600){return String(value??"").trim().replace(/\s+/g," ").slice(0,max);}
function clamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function has(patterns,source){return patterns.some(pattern=>pattern.test(source));}
function titleCase(value){return String(value||"").replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());}

export function inferForgeTypes(idea="",preferred="ultimate"){
  const source=clean(idea).toLowerCase();
  const found=FORGE_TYPES.map(item=>item.id).filter(id=>has(TYPE_HINTS[id]||[],source));
  const safePreferred=FORGE_TYPES.some(item=>item.id===preferred)?preferred:"ultimate";
  return [...new Set([safePreferred,...found])];
}

export function inferForgeElement(idea=""){
  const source=clean(idea);
  return ELEMENTS.find(([,pattern])=>pattern.test(source))?.[0]||"adaptive";
}

function abilityName({types,element,idea}){
  if(/凤凰|鳳凰|phoenix/i.test(idea))return "Phoenix Rebirth / 凤凰涅槃";
  if((element==="lightning")&&(types.includes("kungfu")||/剑|劍|sword/i.test(idea)))return "Nine Heavens Thunderflash / 九霄雷影斩";
  if(types.includes("healing")&&types.includes("defense"))return "Vital Aegis / 生命圣盾";
  if(types.includes("transformation"))return `${titleCase(element)} Ascendant Form`;
  if(types.includes("summon"))return `${titleCase(element)} Guardian Invocation`;
  if(types.includes("ultimate"))return `${titleCase(element)} Sovereign Break`;
  return `${titleCase(element)} ${titleCase(types[0]||"combat")} Technique`;
}

export function buildGameIntelligenceForgePlan(input={}){
  const idea=clean(input.idea||input.prompt||"Design an original cinematic ultimate attack for a mobile action RPG.");
  const preferred=clean(input.type||"ultimate",40).toLowerCase();
  const types=inferForgeTypes(idea,preferred);
  const element=inferForgeElement(idea);
  const targetCount=Math.round(clamp(input.targetCount,1,20,5));
  const mode=["pve","pvp","hybrid"].includes(input.mode)?input.mode:"hybrid";
  const power=["balanced","heroic","boss","mythic"].includes(input.powerScale)?input.powerScale:"balanced";
  const avatarAssetId=clean(input.avatarAssetId,120);
  const avatarName=clean(input.avatarName||"Customer Avatar",120);
  const healing=types.includes("healing");
  const defense=types.includes("defense");
  const ultimate=types.includes("ultimate");
  const multiplier=power==="mythic"?5.2:power==="boss"?4.4:power==="heroic"?3.6:2.8;
  const cooldown=ultimate?clamp(input.cooldown,20,120,42):clamp(input.cooldown,3,60,12);
  const energy=ultimate?100:Math.round(clamp(input.energyCost,0,100,35));
  const name=abilityName({types,element,idea});
  const identityRule=avatarAssetId
    ?"Use the selected private customer avatar as the caster identity reference. Preserve recognizable outfit/character identity while allowing game-safe pose, rig, camera and VFX adaptation. Never expose the private asset outside the owner's project context."
    :"Use an original fictional caster by default; allow the customer to bind a private Avatar Library asset later.";

  const phases=[
    {id:"anticipation",label:"Anticipation",durationMs:ultimate?650:280,rule:"Readable wind-up, target telegraph and interrupt/cancel policy before impact."},
    {id:"engage",label:"Engage",durationMs:ultimate?900:420,rule:`Move or aim into a legal combat position without losing target clarity; cap primary targets at ${targetCount}.`},
    {id:"impact",label:"Impact",durationMs:ultimate?1300:520,rule:`Apply ${multiplier.toFixed(1)}x authored power budget across valid hits; separate gameplay hit frames from decorative VFX.`},
    {id:"finish",label:"Finish",durationMs:ultimate?900:350,rule:"Return control predictably, resolve knockback/status/heal, then start cooldown."},
  ];

  const effects=[];
  if(element!=="adaptive")effects.push(`${titleCase(element)} elemental damage/status package with readable resistance and immunity rules.`);
  if(healing)effects.push("Healing package supports direct heal, heal-over-time and damage-to-heal conversion; cap PvP sustain separately from PvE sustain.");
  if(defense)effects.push("Defense package supports shield, block/parry or damage reduction with clear duration, break condition and anti-invulnerability-loop rules.");
  if(types.includes("kungfu"))effects.push("Kungfu package separates stance, footwork, combo timing, qi/energy and counter windows so martial-arts motion remains readable and controllable.");
  if(types.includes("summon"))effects.push("Summon package defines lifetime, owner, target rules, despawn behavior, entity cap and mobile performance budget.");
  if(types.includes("transformation"))effects.push("Transformation package defines enter/exit states, stat delta, animation swap, resource drain and safe interruption/recovery.");
  if(types.includes("weapon"))effects.push("Weapon package defines weapon class, reach, attack cadence, hitbox ownership, rarity/progression hooks and cosmetic-versus-stat separation.");
  if(types.includes("treasure"))effects.push("Treasure package defines rarity, passive/active effect, acquisition rules, stacking constraints and duplicate handling.");
  if(types.includes("item"))effects.push("Item package defines charges, cooldown, inventory ownership, combat legality, feedback and save/load behavior.");

  return {
    version:GAME_INTELLIGENCE_FORGE_VERSION,
    idea,
    name,
    types,
    element,
    avatarBinding:{assetId:avatarAssetId||null,name:avatarName,privateCustomerAsset:Boolean(avatarAssetId),identityRule},
    combat:{mode,powerScale:power,targetCount,cooldownSeconds:Number(cooldown),energyCost:energy,damageBudgetMultiplier:multiplier,healingEnabled:healing,defenseEnabled:defense},
    phases,
    effects,
    balanceRules:[
      "Keep PvE and PvP coefficients independently tunable; never balance both modes with one hidden multiplier.",
      "Every burst, stun, heal, shield, execute and invulnerability effect needs a counter, cap, cooldown or resource cost.",
      "Damage/heal numbers are design targets until validated in the actual game runtime with telemetry and playtests.",
      "Preserve 60fps-oriented mobile readability: cap particles, simultaneous summons, screen shake, post-processing and full-screen flashes.",
      "Reduced-motion, high-contrast telegraphs, non-audio-only hit confirmation and large touch controls remain available.",
    ],
    media:{
      animationBrief:`Animate ${avatarName} performing ${name}: anticipation -> engage -> impact -> finish. Preserve character identity and silhouette. Gameplay hit timing must stay legible before cinematic flourish.`,
      vfxBrief:`Create original ${element} VFX for ${name}. Separate telegraph, hit flash, trail, area marker and finish burst. Avoid copied franchise motifs or logos.`,
      audioBrief:`Design layered original audio for ${name}: anticipation cue, movement/weapon layer, impact transient, elemental tail and finish accent. Keep important gameplay cues audible under music.`,
      iconBrief:`Create an original readable game-skill icon for ${name}, centered silhouette, strong shape language, no third-party character or brand marks.`,
    },
    exports:["LANERIQ AI Game","Unity design contract","Unreal design contract","Godot design contract","Roblox design contract","JSON ability spec","VFX/animation/audio briefs"],
    truthBoundary:"This is a combat-design and integration specification. Runtime damage, animation quality, balance, provider generation and production performance remain evidence-gated until executed and tested.",
  };
}

export function compileForgeToGameIdea(plan){
  if(!plan||plan.version!==GAME_INTELLIGENCE_FORGE_VERSION)throw new Error("A valid Game Intelligence Forge plan is required.");
  const avatar=plan.avatarBinding?.assetId
    ?`Bind private customer Avatar Library asset ${plan.avatarBinding.assetId} as the playable caster identity. Treat it as owner-scoped project input and do not make it reusable across users.`
    :"Create an original playable caster and keep a later private-avatar binding point.";
  return [
    "Create an original mobile action/RPG game experience with a playable combat loop, touch controls, enemies, health, progression, pause/restart, save/recovery and iOS + Android targets.",
    avatar,
    `GAME INTELLIGENCE FORGE ${plan.version}: ${plan.name}.`,
    `Customer intent: ${plan.idea}`,
    `Ability classes: ${plan.types.join(", ")}. Element: ${plan.element}. Mode: ${plan.combat.mode}. Power scale: ${plan.combat.powerScale}. Targets: up to ${plan.combat.targetCount}. Cooldown: ${plan.combat.cooldownSeconds}s. Energy cost: ${plan.combat.energyCost}.`,
    ...plan.phases.map(item=>`${item.label.toUpperCase()} (${item.durationMs}ms design target): ${item.rule}`),
    ...plan.effects.map(item=>`EFFECT: ${item}`),
    ...plan.balanceRules.map(item=>`BALANCE: ${item}`),
    `ANIMATION: ${plan.media.animationBrief}`,
    `VFX: ${plan.media.vfxBrief}`,
    `AUDIO: ${plan.media.audioBrief}`,
    "Build the ability as editable game data, not hard-coded visual-only choreography. Expose damage/heal/shield/status/cooldown/resource coefficients for later tuning.",
    "Use only original content. Do not copy commercial game characters, signature attacks, logos, maps, audio or distinctive protected visual identities.",
    `TRUTH: ${plan.truthBoundary}`,
  ].join("\n");
}
