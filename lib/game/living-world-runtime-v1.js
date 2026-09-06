import {normalizeAiMapWorldManifest} from "./super-game-composer-v1.js";
import {normalizeLivingAvatarProfile,compileLivingAvatarGameBrief} from "./living-avatar-profile-v1.js";

export const LIVING_WORLD_RUNTIME_VERSION="1.0.0";
export const LIVING_WORLD_EVENT_TYPES=Object.freeze(["move","enter_location","complete_quest","defeat_boss","equip_asset","unequip_asset","set_flag","relationship_delta","story_fact","unlock_gate","vehicle_board","vehicle_exit","world_tick"]);
const EVENT_SET=new Set(LIVING_WORLD_EVENT_TYPES);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function text(v,max=1200){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}
function ids(value,max=32){return [...new Set((Array.isArray(value)?value:[]).map(v=>text(typeof v==="string"?v:v?.id,80)).filter(v=>UUID.test(v)))].slice(0,max);}
function strings(value,max=64,itemMax=120){return [...new Set((Array.isArray(value)?value:[]).map(v=>text(v,itemMax)).filter(Boolean))].slice(0,max);}
function clamp(n,min,max,fallback=0){const value=Number(n);return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}

export function compileLivingWorldHierarchy(worldManifest){
  const world=normalizeAiMapWorldManifest(worldManifest);
  const root={id:"world-root",kind:"world",name:world.title,parentId:null,sourceZoneId:null};
  const nodes=[root,...world.zones.map((zone,index)=>({id:`location:${zone.id}`,kind:zone.kind==="objective"?"mission_zone":zone.kind==="hub"?"city":"area",name:zone.name,parentId:"world-root",sourceZoneId:zone.id,index}))];
  const entries=[];
  for(const zone of world.zones){const lower=`${zone.name} ${zone.kind}`.toLowerCase();if(/dungeon|ruin|temple|cave|underground/.test(lower))entries.push({id:`sub:${zone.id}:dungeon`,kind:"dungeon",name:`${zone.name} Dungeon`,parentId:`location:${zone.id}`,sourceZoneId:zone.id,locked:true});}
  return{version:LIVING_WORLD_RUNTIME_VERSION,rootId:"world-root",nodes:[...nodes,...entries],truth:{semanticHierarchy:true,liveGeospatialHierarchy:false}};
}

export function compileTraversalGraph(worldManifest){
  const world=normalizeAiMapWorldManifest(worldManifest),zoneIds=new Set(world.zones.map(z=>z.id));
  const nodes=world.zones.map(zone=>{const lower=`${zone.name} ${zone.kind}`.toLowerCase();const hazards=[];if(/lava|volcan|fire|inferno/.test(lower))hazards.push("fire");if(/water|lagoon|reef|river|harbor/.test(lower))hazards.push("water");if(/mountain|cliff|ridge|summit/.test(lower))hazards.push("height");return{id:zone.id,name:zone.name,kind:zone.kind,hazards,walkable:true};});
  const edges=world.routes.filter(r=>zoneIds.has(r.from)&&zoneIds.has(r.to)).map(route=>({id:route.id,from:route.from,to:route.to,bidirectional:true,modes:["walk","run"],gate:null,hazards:[]}));
  return{version:LIVING_WORLD_RUNTIME_VERSION,nodes,edges,spawnPoints:world.spawnPoints,objectiveAnchors:world.objectiveAnchors,truth:{semanticTraversal:true,physicsMeshRendered:false,navmeshBaked:false,collisionVerified:false}};
}

export function createInitialLivingWorldState({worldManifest,avatars=[]}={}){
  const world=normalizeAiMapWorldManifest(worldManifest),spawn=world.spawnPoints.find(s=>s.role==="player")?.zoneId||world.zones[0]?.id||null;
  return{version:LIVING_WORLD_RUNTIME_VERSION,revision:0,clock:{tick:0,day:1,timeOfDay:"day"},currentLocation:spawn,activeAvatarId:avatars[0]?.avatarAssetId||null,vehicleAssetId:null,flags:{},inventory:[],equipped:{},completedQuests:[],defeatedBosses:[],unlockedGates:[],relationships:{},storyMemory:{canonicalFacts:[],recentEvents:[]},worldStatus:{weather:"clear",dangerLevel:"normal",economyState:"stable"}};
}

export function createLivingWorldManifest(input={}){
  const world=normalizeAiMapWorldManifest(input.worldManifest||input.world||{});
  const avatars=(Array.isArray(input.avatars)?input.avatars:[]).slice(0,24).map(normalizeLivingAvatarProfile);
  const traversal=compileTraversalGraph(world),hierarchy=compileLivingWorldHierarchy(world);
  const story={premise:text(input.storyIdea,2400),canonicalFacts:strings(input.canonicalFacts,80,240),questSeeds:(Array.isArray(input.questSeeds)?input.questSeeds:[]).slice(0,40).map((q,index)=>({id:text(q?.id,80)||`quest-${index+1}`,title:text(q?.title,160)||`Quest ${index+1}`,locationId:text(q?.locationId,80)||world.objectiveAnchors[index%Math.max(1,world.objectiveAnchors.length)]||world.zones[0]?.id||"",status:"available",prerequisites:strings(q?.prerequisites,8,80),outcomes:strings(q?.outcomes,8,120)})),eventRules:(Array.isArray(input.eventRules)?input.eventRules:[]).slice(0,60)};
  return{version:LIVING_WORLD_RUNTIME_VERSION,name:text(input.name,120)||`${world.title} Living World`,world:{manifest:world,hierarchy,traversal},avatars,sceneAssetIds:ids(input.sceneAssetIds||input.referenceAssetIds,32),forgeBlueprintIds:ids(input.forgeBlueprintIds,24),story,settings:{difficulty:text(input?.settings?.difficulty,40)||"normal",simulationMode:text(input?.settings?.simulationMode,40)||"single_player",persistentState:true},demo:{identitySyncRequired:true,videoProjectIds:[]},originality:{variationNonce:text(input.variationNonce,160)||null,ownerCorpusCheckRequired:true},truth:{unifiedWorldModel:true,persistentStateReady:true,realTimeMultiplayerVerified:false,renderedPhysics:false,renderedAvatarRig:false,renderedVoiceClone:false,renderedVideo:false}};
}

export function normalizeLivingWorldState(value={},manifest){
  const initial=createInitialLivingWorldState({worldManifest:manifest.world.manifest,avatars:manifest.avatars});
  return{...initial,...value,revision:Math.max(0,Math.floor(clamp(value.revision,0,1e9,initial.revision))),clock:{...initial.clock,...(value.clock||{})},flags:value.flags&&typeof value.flags==="object"?value.flags:{},inventory:ids(value.inventory,64),equipped:value.equipped&&typeof value.equipped==="object"?value.equipped:{},completedQuests:strings(value.completedQuests,200,80),defeatedBosses:strings(value.defeatedBosses,100,80),unlockedGates:strings(value.unlockedGates,100,80),relationships:value.relationships&&typeof value.relationships==="object"?value.relationships:{},storyMemory:{canonicalFacts:strings(value?.storyMemory?.canonicalFacts,200,240),recentEvents:(Array.isArray(value?.storyMemory?.recentEvents)?value.storyMemory.recentEvents:[]).slice(-80)},worldStatus:{...initial.worldStatus,...(value.worldStatus||{})}};
}

export function applyLivingWorldEvent(manifestInput,stateInput,eventInput={}){
  const manifest=createLivingWorldManifest(manifestInput),state=normalizeLivingWorldState(stateInput,manifest),type=text(eventInput.type,60).toLowerCase();if(!EVENT_SET.has(type))throw new Error("LIVING_WORLD_EVENT_TYPE_INVALID");
  const event={type,key:text(eventInput.key,160),actorRef:text(eventInput.actorRef,120),targetRef:text(eventInput.targetRef,120),locationId:text(eventInput.locationId,120),value:eventInput.value,payload:eventInput.payload&&typeof eventInput.payload==="object"?eventInput.payload:{}};
  const next=structuredClone(state);next.revision=state.revision+1;next.storyMemory.recentEvents=[...next.storyMemory.recentEvents,{type:event.type,key:event.key||null,actorRef:event.actorRef||null,targetRef:event.targetRef||null,locationId:event.locationId||null}].slice(-80);
  if(type==="move"||type==="enter_location"){const valid=new Set(manifest.world.traversal.nodes.map(n=>n.id));if(!valid.has(event.locationId))throw new Error("LIVING_WORLD_LOCATION_INVALID");next.currentLocation=event.locationId;}
  if(type==="complete_quest"&&event.targetRef)next.completedQuests=strings([...next.completedQuests,event.targetRef],200,80);
  if(type==="defeat_boss"&&event.targetRef)next.defeatedBosses=strings([...next.defeatedBosses,event.targetRef],100,80);
  if(type==="unlock_gate"&&event.targetRef)next.unlockedGates=strings([...next.unlockedGates,event.targetRef],100,80);
  if(type==="set_flag"&&event.targetRef)next.flags[event.targetRef]=event.value??true;
  if(type==="relationship_delta"&&event.targetRef)next.relationships[event.targetRef]=clamp(Number(next.relationships[event.targetRef]||0)+Number(event.value||0),-100,100,0);
  if(type==="story_fact"){const fact=text(event.value||event.payload?.fact,240);if(fact)next.storyMemory.canonicalFacts=strings([...next.storyMemory.canonicalFacts,fact],200,240);}
  if(type==="equip_asset"&&event.targetRef){const slot=text(event.payload?.slot,40)||"accessory";next.equipped[slot]=event.targetRef;if(!next.inventory.includes(event.targetRef))next.inventory=ids([...next.inventory,event.targetRef],64);}
  if(type==="unequip_asset"){const slot=text(event.payload?.slot,40);if(slot)delete next.equipped[slot];}
  if(type==="vehicle_board"&&event.targetRef)next.vehicleAssetId=event.targetRef;
  if(type==="vehicle_exit")next.vehicleAssetId=null;
  if(type==="world_tick"){next.clock.tick=Number(next.clock.tick||0)+1;if(next.clock.tick%24===0)next.clock.day=Number(next.clock.day||1)+1;}
  return next;
}

export function compileLivingWorldGameBrief(manifestInput,stateInput){
  const manifest=createLivingWorldManifest(manifestInput),state=normalizeLivingWorldState(stateInput,manifest);
  const avatarBrief=manifest.avatars.map(compileLivingAvatarGameBrief).join("\n");
  return [`LIVING WORLD RUNTIME V${LIVING_WORLD_RUNTIME_VERSION}: ${manifest.name}.`,`CURRENT WORLD STATE: location=${state.currentLocation||"unset"}; completedQuests=${state.completedQuests.length}; defeatedBosses=${state.defeatedBosses.length}; unlockedGates=${state.unlockedGates.length}; worldDay=${state.clock.day}.`,`STORY CANON: ${[...manifest.story.canonicalFacts,...state.storyMemory.canonicalFacts].slice(-24).join(" | ")||"no canon facts yet"}.`,`CHARACTERS:\n${avatarBrief||"No private Living Avatar profiles selected."}`,`TRAVERSAL: ${manifest.world.traversal.nodes.length} locations, ${manifest.world.traversal.edges.length} semantic routes. Treat hazards, gates and hierarchy as gameplay data; do not claim baked navmesh or verified physics.`,`SCENE REFERENCES: ${manifest.sceneAssetIds.length}; FORGE REFERENCES: ${manifest.forgeBlueprintIds.length}.`,`WORLD CONSISTENCY CONTRACT: Story, quests, NPC relationships, equipment, world events and demo video must read the same manifest/state rather than inventing disconnected copies.`].join("\n\n").slice(0,7600);
}
