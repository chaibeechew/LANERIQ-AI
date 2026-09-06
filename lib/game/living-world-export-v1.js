import {createLivingWorldManifest,normalizeLivingWorldState} from "./living-world-runtime-v1.js";

export const LIVING_WORLD_EXPORT_VERSION="1.0.0";
export const LIVING_WORLD_EXPORT_TARGETS=Object.freeze({json:{supported:true,mime:"application/json"},gdd_markdown:{supported:true,mime:"text/markdown"},unity:{supported:false},unreal:{supported:false},godot:{supported:false},roblox:{supported:false}});
function text(v,max=4000){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

export function livingWorldExportCapabilities(){return{version:LIVING_WORLD_EXPORT_VERSION,targets:LIVING_WORLD_EXPORT_TARGETS,truth:"JSON and Game Design Document export are implemented. Unity/Unreal/Godot/Roblox packages remain roadmap until real exporters and validators exist."};}

export function buildLivingWorldJsonExport(manifestInput,stateInput,playtest=null){
  const manifest=createLivingWorldManifest(manifestInput),state=normalizeLivingWorldState(stateInput,manifest);
  return{schema:"laneriq.living-world.export.v1",exportVersion:LIVING_WORLD_EXPORT_VERSION,manifest,state,playtest:playtest||null,capabilities:livingWorldExportCapabilities(),truth:{portableStructuredData:true,enginePackage:false,storeApproval:false,realDeviceEvidence:false}};
}

export function buildLivingWorldGdd(manifestInput,stateInput,playtest=null){
  const manifest=createLivingWorldManifest(manifestInput),state=normalizeLivingWorldState(stateInput,manifest),world=manifest.world.manifest;
  const lines=[`# ${manifest.name}`,"",`LANERIQ Living World Export ${LIVING_WORLD_EXPORT_VERSION}`,"",`## World`,`- Type: ${world.worldType}` ,`- Style: ${world.style}`,`- Scale: ${world.scale}`,`- Locations: ${manifest.world.traversal.nodes.length}`,`- Routes: ${manifest.world.traversal.edges.length}`,"",`## Characters`,...(manifest.avatars.length?manifest.avatars.map(a=>`- ${a.name} — ${a.role}; motion: ${a.motion.modes.join(", ")}`):["- No Living Avatar profiles selected."]),"",`## Story`,`- Premise: ${text(manifest.story.premise,2400)||"Not defined"}`,`- Canon facts: ${[...manifest.story.canonicalFacts,...state.storyMemory.canonicalFacts].join(" | ")||"None yet"}`,`- Quests: ${manifest.story.questSeeds.length}`,"",`## Gameplay State`,`- Current location: ${state.currentLocation||"unset"}`,`- Completed quests: ${state.completedQuests.length}`,`- Defeated bosses: ${state.defeatedBosses.length}`,`- World day: ${state.clock.day}`,"",`## Combat & Assets`,`- Forge references: ${manifest.forgeBlueprintIds.length}`,`- Scene assets: ${manifest.sceneAssetIds.length}`,"",`## Quality`,playtest?`- Playtest verdict: ${playtest.verdict} (${playtest.score}/100)`:"- Playtest not run for this export.","",`## Export truth`,`This document is structured design output. It is not proof of a Unity, Unreal, Godot or Roblox package, store approval, real-device performance or live multiplayer.`];
  return lines.join("\n");
}
