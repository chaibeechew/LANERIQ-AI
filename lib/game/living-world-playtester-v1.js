import {createLivingWorldManifest,normalizeLivingWorldState} from "./living-world-runtime-v1.js";
import {normalizeForgeBlueprint} from "./game-intelligence-forge-v1.js";

export const LIVING_WORLD_PLAYTEST_VERSION="1.0.0";
function reachable(graph,start){const seen=new Set(start?[start]:[]),queue=start?[start]:[];const next=new Map();for(const edge of graph.edges||[]){if(!next.has(edge.from))next.set(edge.from,[]);next.get(edge.from).push(edge.to);if(edge.bidirectional!==false){if(!next.has(edge.to))next.set(edge.to,[]);next.get(edge.to).push(edge.from);}}while(queue.length){const current=queue.shift();for(const target of next.get(current)||[])if(!seen.has(target)){seen.add(target);queue.push(target);}}return seen;}
function issue(id,severity,message,detail=null){return{id,severity,message,detail};}

export function playtestLivingWorld({manifest:manifestInput,state:stateInput,forgeBlueprints=[]}={}){
  const manifest=createLivingWorldManifest(manifestInput),state=normalizeLivingWorldState(stateInput,manifest),graph=manifest.world.traversal,issues=[];
  const nodeIds=new Set(graph.nodes.map(n=>n.id));
  if(!state.currentLocation||!nodeIds.has(state.currentLocation))issues.push(issue("spawn-location","blocking","Current/spawn location is missing from the traversal graph."));
  const seen=reachable(graph,state.currentLocation);
  const unreachable=graph.nodes.filter(n=>!seen.has(n.id)).map(n=>n.id);if(unreachable.length)issues.push(issue("unreachable-locations","blocking",`${unreachable.length} locations are unreachable from the current spawn.`,unreachable));
  const unreachableObjectives=(graph.objectiveAnchors||[]).filter(id=>!seen.has(id));if(unreachableObjectives.length)issues.push(issue("unreachable-objectives","blocking","One or more objectives cannot be reached.",unreachableObjectives));
  const isolated=graph.nodes.filter(node=>!(graph.edges||[]).some(edge=>edge.from===node.id||edge.to===node.id));if(isolated.length>1)issues.push(issue("isolated-zones","warning","Multiple locations have no route connections.",isolated.map(n=>n.id)));
  const hazardous=graph.nodes.filter(n=>(n.hazards||[]).length);if(hazardous.length&&!manifest.avatars.some(a=>a.motion.modes.some(mode=>["climb","swim","fly","ride","drive"].includes(mode))))issues.push(issue("hazard-traversal","warning","Hazard locations exist but selected Avatars have only basic locomotion.",hazardous.map(n=>({id:n.id,hazards:n.hazards}))));
  const quests=manifest.story.questSeeds||[];for(const quest of quests){if(quest.locationId&&!nodeIds.has(quest.locationId))issues.push(issue(`quest-location:${quest.id}`,"blocking",`Quest ${quest.title} references an unknown location.`,quest.locationId));for(const dependency of quest.prerequisites||[])if(!quests.some(q=>q.id===dependency))issues.push(issue(`quest-prereq:${quest.id}`,"warning",`Quest ${quest.title} has an unknown prerequisite.`,dependency));}
  const forge=(Array.isArray(forgeBlueprints)?forgeBlueprints:[]).map(normalizeForgeBlueprint);for(const item of forge){if(item.pvp.powerMultiplier>1.1)issues.push(issue(`pvp-power:${item.name}`,"warning",`${item.name} has unusually high PvP power tuning.`,item.pvp));if(item.category==="ultimate"&&item.cooldownSeconds<15)issues.push(issue(`ultimate-cooldown:${item.name}`,"warning",`${item.name} ultimate cooldown may be too short for counterplay.`,item.cooldownSeconds));}
  const blockers=issues.filter(x=>x.severity==="blocking").length,warnings=issues.filter(x=>x.severity==="warning").length;
  const score=Math.max(0,100-blockers*22-warnings*6);
  return{version:LIVING_WORLD_PLAYTEST_VERSION,score,verdict:blockers?"blocked":score>=85?"ready_for_runtime_preview":"needs_tuning",summary:{blocking:blockers,warnings,locations:graph.nodes.length,routes:graph.edges.length,reachable:seen.size,quests:quests.length,forgeAssets:forge.length},issues,checks:{worldReachability:blockers===0,objectiveReachability:unreachableObjectives.length===0,questReferences:!issues.some(i=>i.id.startsWith("quest-location:")),combatCounterplay:!issues.some(i=>i.id.startsWith("pvp-power:")||i.id.startsWith("ultimate-cooldown:"))},truth:{simulationType:"deterministic_static_contract",realGameplaySession:false,realDevicePerformance:false,liveMultiplayer:false,physicsEngineRun:false}};
}
