// LANERIQ AI Map + Avatar -> Super Game composition contract V1.
// This module stays provider-neutral. It converts a saved semantic world plus owner-scoped
// avatar asset references into instructions for the existing Game Creator runtime.

export const SUPER_GAME_FUSION_VERSION="1.0.0";
export const AI_MAP_WORLD_MODES=Object.freeze(["game_world","real_world"]);
export const AI_MAP_WORLD_TYPES=Object.freeze(["city","island","fantasy","space","battle_zone","property","business","adventure"]);
export const AI_MAP_STYLES=Object.freeze(["cinematic","futuristic","realistic","fantasy","minimal","tactical"]);
export const AI_MAP_SCALES=Object.freeze(["compact","district","open_world"]);
export const SUPER_GAME_GENRES=Object.freeze(["rpg","adventure","action","simulation","strategy","racing","survival"]);
export const SUPER_GAME_PLAY_MODES=Object.freeze(["open_world","story","mission","simulation","strategy"]);
export const SUPER_GAME_AVATAR_ROLES=Object.freeze(["player","companion","npc","enemy","merchant","guide"]);

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_REQUEST=/^[A-Za-z0-9._:-]{1,160}$/;
const COORDS=Object.freeze([
  [50,50],[25,28],[73,25],[22,72],[76,70],[50,14],[50,86],[10,48],[90,48]
]);
const ZONES=Object.freeze({
  city:["Central Nexus","Market District","Skyline Quarter","Green Commons","Innovation Yard","Transit Gate","Waterfront","Old Quarter","Landmark Ridge"],
  island:["Harbor Camp","Palm Coast","Highland Trail","Lagoon","Ruins","Cliff Pass","Jungle Basin","Reef Point","Volcanic Crown"],
  fantasy:["Citadel","Enchanted Market","Moonwood","Crystal Lake","Ancient Ruins","Mountain Pass","Dragon Vale","Village","Temple Gate"],
  space:["Orbital Hub","Research Ring","Cargo Port","Habitat Dome","Asteroid Field","Jump Gate","Mining Belt","Defense Array","Unknown Signal"],
  battle_zone:["Command Base","North Lane","East Ridge","South Depot","West Ruins","Extraction Point","Supply Yard","Watchtower","Final Objective"],
  property:["Property Hub","Residential Cluster","Retail Strip","School Zone","Park","Transit Node","Waterfront Homes","Business Quarter","Landmark"],
  business:["Business Hub","Retail Core","Office Cluster","Convention Zone","Food District","Transit Node","Hotel Quarter","Service Yard","Anchor Venue"],
  adventure:["Starting Camp","Crossroads","Hidden Grove","River Crossing","Ancient Site","Mountain Route","Village","Challenge Arena","Final Discovery"]
});
const HOOKS=Object.freeze({
  city:["missions","commerce","transit","social-npcs"],
  island:["exploration","survival","resource-gathering","discovery"],
  fantasy:["quests","combat","loot","dialogue"],
  space:["exploration","flight","resource-management","encounters"],
  battle_zone:["objectives","combat","spawn-control","extraction"],
  property:["property-discovery","routing","appointments","simulation"],
  business:["foot-traffic","commerce","routing","events"],
  adventure:["quests","exploration","puzzles","discoveries"]
});

function clean(value,max=4000){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}
function enumValue(value,allowed,fallback){const v=clean(value,80).toLowerCase();return allowed.includes(v)?v:fallback;}
function uniqueStrings(values,max=12){return [...new Set((Array.isArray(values)?values:[]).map(v=>clean(v,120)).filter(Boolean))].slice(0,max);}
function safeAssetId(value){const id=clean(value,80);return UUID.test(id)?id:null;}
function inferWorldType(prompt,requested){
  const req=enumValue(requested,AI_MAP_WORLD_TYPES,"");if(req)return req;
  const p=clean(prompt,4000).toLowerCase();
  const checks=[
    ["space",/space|planet|orbital|galaxy|asteroid|太空|宇宙/],
    ["fantasy",/fantasy|magic|dragon|kingdom|魔法|奇幻|王国|王國/],
    ["island",/island|tropical|lagoon|海岛|海島|岛屿|島嶼/],
    ["battle_zone",/battle|combat|warzone|arena|战场|戰場|竞技|競技/],
    ["property",/property|real estate|housing|apartment|房产|房地產|地产|地產/],
    ["business",/business|retail|office|commercial|商圈|商业|商業/],
    ["adventure",/adventure|quest|expedition|explore|冒险|冒險|探索/],
  ];
  return checks.find(([,pattern])=>pattern.test(p))?.[0]||"city";
}
function zoneCount(scale){return scale==="compact"?5:scale==="open_world"?9:7;}
function zoneKind(type,index){
  if(index===0)return"hub";
  const byType={battle_zone:["lane","ridge","depot","ruins","extraction","supply","watch","objective"],property:["residential","retail","education","park","transit","waterfront","business","landmark"],business:["retail","office","events","food","transit","hotel","service","anchor"]};
  return (byType[type]||["district","landmark","nature","challenge","transit","resource","social","objective"])[(index-1)%8];
}

export function createAiMapWorldManifest(input={}){
  const prompt=clean(input.prompt,4000);if(!prompt)throw new Error("AI_MAP_PROMPT_REQUIRED");
  const mode=enumValue(input.mode,AI_MAP_WORLD_MODES,"game_world");
  const worldType=inferWorldType(prompt,input.worldType);
  const style=enumValue(input.style,AI_MAP_STYLES,worldType==="fantasy"?"fantasy":"futuristic");
  const scale=enumValue(input.scale,AI_MAP_SCALES,"district");
  const names=ZONES[worldType]||ZONES.city;const count=zoneCount(scale);
  const zones=Array.from({length:count},(_,index)=>{
    const [x,y]=COORDS[index];
    return {id:`zone-${index+1}`,name:names[index]||`Zone ${index+1}`,kind:zoneKind(worldType,index),x,y,radius:index===0?10:7,description:`${names[index]||`Zone ${index+1}`} planned from the customer's map intent.`,gameplayHooks:index===0?["spawn","navigation",...(HOOKS[worldType]||[])].slice(0,5):[(HOOKS[worldType]||[])[index%(HOOKS[worldType]?.length||1)]||"exploration"]};
  });
  const routes=[];
  for(let index=1;index<zones.length;index++)routes.push({id:`route-${index}`,from:zones[index-1].id,to:zones[index].id,kind:index%3===0?"alternate":"primary"});
  if(zones.length>4)routes.push({id:"route-loop",from:zones[zones.length-1].id,to:zones[0].id,kind:"return"});
  if(zones.length>6)routes.push({id:"route-cross",from:zones[1].id,to:zones[4].id,kind:"shortcut"});
  const hooks=HOOKS[worldType]||HOOKS.city;
  return {
    version:SUPER_GAME_FUSION_VERSION,
    source:"laneriq-local-world-planner",
    mode,worldType,style,scale,prompt,
    title:clean(input.name,120)||`${names[0]} World`,
    zones,routes,
    spawnPoints:[
      {id:"spawn-player",zoneId:zones[0].id,role:"player"},
      {id:"spawn-npc",zoneId:zones[Math.min(1,zones.length-1)].id,role:"npc"},
      {id:"spawn-challenge",zoneId:zones[zones.length-1].id,role:"challenge"}
    ],
    gameplayHooks:hooks,
    layers:["terrain","navigation","objectives","encounters","economy","accessibility"],
    objectiveAnchors:zones.slice(-Math.min(3,zones.length)).map(zone=>zone.id),
    truth:{generatedSemanticPlan:true,liveGeospatialData:false,externalMapTilesUsed:false,worldFusionReady:true}
  };
}

export function normalizeAiMapWorldManifest(value={}){
  const mode=enumValue(value.mode,AI_MAP_WORLD_MODES,"game_world");const worldType=enumValue(value.worldType,AI_MAP_WORLD_TYPES,"city");const style=enumValue(value.style,AI_MAP_STYLES,"futuristic");const scale=enumValue(value.scale,AI_MAP_SCALES,"district");
  const rawZones=Array.isArray(value.zones)?value.zones:[];
  const zones=rawZones.slice(0,12).map((zone,index)=>({id:clean(zone?.id,60)||`zone-${index+1}`,name:clean(zone?.name,120)||`Zone ${index+1}`,kind:clean(zone?.kind,80)||"district",x:Math.max(0,Math.min(100,Number(zone?.x)||50)),y:Math.max(0,Math.min(100,Number(zone?.y)||50)),radius:Math.max(3,Math.min(15,Number(zone?.radius)||7)),description:clean(zone?.description,320),gameplayHooks:uniqueStrings(zone?.gameplayHooks,6)}));
  if(!zones.length)throw new Error("AI_MAP_WORLD_ZONES_REQUIRED");
  const zoneIds=new Set(zones.map(zone=>zone.id));
  const routes=(Array.isArray(value.routes)?value.routes:[]).slice(0,24).map((route,index)=>({id:clean(route?.id,60)||`route-${index+1}`,from:clean(route?.from,60),to:clean(route?.to,60),kind:clean(route?.kind,40)||"primary"})).filter(route=>zoneIds.has(route.from)&&zoneIds.has(route.to)&&route.from!==route.to);
  const spawnPoints=(Array.isArray(value.spawnPoints)?value.spawnPoints:[]).slice(0,12).map((spawn,index)=>({id:clean(spawn?.id,60)||`spawn-${index+1}`,zoneId:clean(spawn?.zoneId,60),role:clean(spawn?.role,40)||"npc"})).filter(spawn=>zoneIds.has(spawn.zoneId));
  return {version:SUPER_GAME_FUSION_VERSION,source:"laneriq-world-manifest",mode,worldType,style,scale,prompt:clean(value.prompt,4000),title:clean(value.title,120)||"LANERIQ World",zones,routes,spawnPoints,gameplayHooks:uniqueStrings(value.gameplayHooks,12),layers:uniqueStrings(value.layers,12),objectiveAnchors:uniqueStrings(value.objectiveAnchors,8).filter(id=>zoneIds.has(id)),truth:{generatedSemanticPlan:true,liveGeospatialData:false,externalMapTilesUsed:false,worldFusionReady:true}};
}

export function normalizeAvatarSelections(value=[]){
  const seen=new Set();const out=[];
  for(const item of Array.isArray(value)?value:[]){const assetId=safeAssetId(typeof item==="string"?item:item?.assetId);if(!assetId||seen.has(assetId))continue;seen.add(assetId);out.push({assetId,role:enumValue(item?.role,SUPER_GAME_AVATAR_ROLES,out.length?"npc":"player")});if(out.length>=8)break;}
  return out;
}

export function buildSuperGameFusionPrompt({idea,worldManifest,avatarSelections=[],genre="rpg",playMode="open_world"}={}){
  const userIdea=clean(idea,2600)||"Create an original mobile game from this world and its selected characters.";
  const world=normalizeAiMapWorldManifest(worldManifest);
  const avatars=normalizeAvatarSelections(avatarSelections);
  const safeGenre=enumValue(genre,SUPER_GAME_GENRES,"rpg");const safePlayMode=enumValue(playMode,SUPER_GAME_PLAY_MODES,"open_world");
  const zoneBrief=world.zones.map(zone=>`${zone.id}:${zone.name}[${zone.kind}] at ${Math.round(zone.x)},${Math.round(zone.y)}`).join("; ");
  const routeBrief=world.routes.map(route=>`${route.from}->${route.to}(${route.kind})`).join("; ");
  const avatarBrief=avatars.length?avatars.map((item,index)=>`authorized private avatar reference ${index+1} role=${item.role}`).join("; "):"no avatar references selected; create original in-game characters";
  return [
    `Create an original ${safeGenre} mobile game in ${safePlayMode} mode.`,
    `CUSTOMER GAME INTENT: ${userIdea}`,
    `LANERIQ AI MAP WORLD: title=${world.title}; type=${world.worldType}; style=${world.style}; scale=${world.scale}.`,
    `WORLD ZONES: ${zoneBrief}.`,
    `WORLD ROUTES: ${routeBrief||"connect zones through safe navigable paths"}.`,
    `WORLD GAMEPLAY HOOKS: ${world.gameplayHooks.join(", ")||"exploration, objectives"}.`,
    `WORLD SPAWN RULES: ${world.spawnPoints.map(item=>`${item.role}@${item.zoneId}`).join(", ")||`player@${world.zones[0].id}`}.`,
    `CHARACTER REFERENCES: ${avatarBrief}. Preserve selected avatar visual identity as an authorized private reference; do not infer real-person identity or sensitive attributes.`,
    "WORLD FUSION CONTRACT: Use the semantic zones and routes as gameplay structure, not as a decorative background. Place objectives, NPCs, encounters, traversal, save/checkpoint state and progression into the world topology. Keep the map playable on touch devices and preserve clear navigation/recovery.",
    "ORIGINALITY CONTRACT: Do not copy commercial game maps, characters, brands, missions or protected franchises. Generate original names, layouts, mechanics and content.",
    "TRUTH CONTRACT: The saved AI Map is a generated semantic world plan, not live geospatial truth. Do not claim live map tiles, real-world traffic, public multiplayer, store approval or real-device evidence unless separately verified."
  ].join("\n\n").slice(0,7900);
}

export function buildSuperGameFusionRequest({requestId,idea,worldManifest,avatarSelections,genre,playMode}={}){
  const id=clean(requestId,160);if(!SAFE_REQUEST.test(id))throw new Error("SUPER_GAME_REQUEST_ID_REQUIRED");
  const world=normalizeAiMapWorldManifest(worldManifest);const avatars=normalizeAvatarSelections(avatarSelections);
  return {requestId:id,idea:buildSuperGameFusionPrompt({idea,worldManifest:world,avatarSelections:avatars,genre,playMode}),industry:"games",productType:"mobile_game",assetIds:avatars.map(item=>item.assetId),superGameFusion:{version:SUPER_GAME_FUSION_VERSION,world:{title:world.title,mode:world.mode,worldType:world.worldType,style:world.style,scale:world.scale,zones:world.zones,routes:world.routes,spawnPoints:world.spawnPoints,gameplayHooks:world.gameplayHooks},avatars,genre:enumValue(genre,SUPER_GAME_GENRES,"rpg"),playMode:enumValue(playMode,SUPER_GAME_PLAY_MODES,"open_world"),semanticWorldRequired:true}};
}
