import {createLivingWorldManifest,normalizeLivingWorldState} from "./living-world-runtime-v1.js";

export const LIVING_WORLD_DEMO_SYNC_VERSION="1.0.0";
function text(v,max=1800){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}

export function buildLivingWorldDemoPrompt({manifest:manifestInput,state:stateInput,demoType="gameplay_demo",duration=30}={}){
  const manifest=createLivingWorldManifest(manifestInput),state=normalizeLivingWorldState(stateInput,manifest),world=manifest.world.manifest;
  const avatars=manifest.avatars.map(a=>`${a.name} (${a.role}; motion ${a.motion.modes.join(",")}; outfits ${a.appearance.outfitAssetIds.length}; equipment ${a.equipment.bindings.length})`).join("; ")||"no selected private Avatar profiles";
  const canon=[...manifest.story.canonicalFacts,...state.storyMemory.canonicalFacts].slice(-24).join(" | ")||"no established canon yet";
  return [
    `Create an original ${text(demoType,80)||"gameplay_demo"} storyboard for the LANERIQ Living World \"${manifest.name}\". Target duration ${Math.max(8,Math.min(120,Number(duration)||30))} seconds.`,
    `WORLD IDENTITY: ${world.title}; ${world.worldType}; ${world.style}; current location=${state.currentLocation||"unset"}. Use the same zones/routes/story state as the playable world; do not invent a disconnected replacement world.`,
    `CHARACTER IDENTITY: ${avatars}. Preserve authorized private Avatar visual continuity, selected outfit/equipment references and role behavior. Do not infer real-person identity or sensitive traits.`,
    `STORY CANON: ${canon}. Completed quests=${state.completedQuests.join(",")||"none"}; defeated bosses=${state.defeatedBosses.join(",")||"none"}.`,
    `COMBAT CONTINUITY: ${manifest.forgeBlueprintIds.length} owner-scoped Forge references are linked. If showing skills, weapons or ultimates, keep their established gameplay identity and readable telegraphs.`,
    `SCENE REFERENCES: ${manifest.sceneAssetIds.length} owner-scoped private image/video references may guide scene mood, props and continuity; never expose them as public assets.`,
    "SHOT PLAN: establish world → show character traversal → story/quest beat → gameplay/combat beat → clear ending/title beat. Keep camera motion readable on mobile and avoid claiming rendered game footage if only concept media is available.",
    "TRUTH CONTRACT: This request plans demo media from one shared Living World model. It does not prove final 3D rigging, live physics, real-device frame rate or store approval."
  ].join("\n\n").slice(0,7600);
}
