// LANERIQ AI Living Avatar Profile V1.
// Converts owner-validated private assets into a game-ready character contract without
// claiming that a 3D rig, voice clone, cloth simulation or vehicle animation has already rendered.

export const LIVING_AVATAR_PROFILE_VERSION="1.0.0";
export const LIVING_AVATAR_ROLES=Object.freeze(["playable","npc","enemy","boss","companion","merchant","guide","quest_giver","summon"]);
export const LIVING_AVATAR_MOTION_MODES=Object.freeze(["walk","run","jump","climb","swim","fly","ride","drive"]);
export const LIVING_AVATAR_EQUIPMENT_SLOTS=Object.freeze(["head","face","neck","torso","outerwear","hands","waist","legs","feet","main_hand","off_hand","back","accessory","vehicle","mount"]);
export const LIVING_AVATAR_LIKENESS_MODES=Object.freeze(["fictional","self","consented_person"]);

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_SET=new Set(LIVING_AVATAR_ROLES),MOTION_SET=new Set(LIVING_AVATAR_MOTION_MODES),SLOT_SET=new Set(LIVING_AVATAR_EQUIPMENT_SLOTS),LIKENESS_SET=new Set(LIVING_AVATAR_LIKENESS_MODES);
function text(v,max=500){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}
function id(v){const value=text(v,80);return UUID.test(value)?value:null;}
function ids(value,max=24){return [...new Set((Array.isArray(value)?value:[]).map(id).filter(Boolean))].slice(0,max);}
function values(value,set,max=12){return [...new Set((Array.isArray(value)?value:[]).map(v=>text(v,60).toLowerCase()).filter(v=>set.has(v)))].slice(0,max);}

export function normalizeLivingAvatarProfile(input={}){
  const likenessMode=LIKENESS_SET.has(text(input.likenessMode,40).toLowerCase())?text(input.likenessMode,40).toLowerCase():"fictional";
  const consentConfirmed=Boolean(input.consentConfirmed);
  const voiceAssetId=id(input.voiceAssetId),voiceConsentConfirmed=Boolean(input.voiceConsentConfirmed);
  const role=ROLE_SET.has(text(input.role,40).toLowerCase())?text(input.role,40).toLowerCase():"playable";
  const avatarAssetId=id(input.avatarAssetId);
  const motionModes=values(input.motionModes,MOTION_SET,8);
  const safeMotion=motionModes.length?motionModes:["walk","run","jump"];
  const equipmentBindings=(Array.isArray(input.equipmentBindings)?input.equipmentBindings:[]).slice(0,24).map(item=>({assetId:id(item?.assetId),slot:SLOT_SET.has(text(item?.slot,40).toLowerCase())?text(item.slot,40).toLowerCase():"accessory",label:text(item?.label,120)})).filter(item=>item.assetId);
  const outfitAssetIds=ids(input.outfitAssetIds,12),vehicleAssetIds=ids(input.vehicleAssetIds,8);
  return {
    version:LIVING_AVATAR_PROFILE_VERSION,
    name:text(input.name,120)||"Living Avatar",
    avatarAssetId,
    role,
    likeness:{mode:likenessMode,consentConfirmed:likenessMode==="fictional"?true:consentConfirmed},
    voice:{assetId:voiceAssetId,consentConfirmed:voiceAssetId?voiceConsentConfirmed:false,style:text(input.voiceStyle,120),language:text(input.voiceLanguage,40)},
    appearance:{outfitAssetIds,appearanceNotes:text(input.appearanceNotes,600),preserveAuthorizedIdentity:likenessMode!=="fictional"},
    motion:{modes:safeMotion,locomotionProfile:text(input.locomotionProfile,120)||"mobile_game_default",semanticOnly:true},
    equipment:{bindings:equipmentBindings,slots:LIVING_AVATAR_EQUIPMENT_SLOTS},
    vehicles:{assetIds:vehicleAssetIds,allowedModes:safeMotion.filter(mode=>["ride","drive","fly"].includes(mode))},
    story:{persona:text(input.persona,800),faction:text(input.faction,120),relationshipTags:[...new Set((Array.isArray(input.relationshipTags)?input.relationshipTags:[]).map(v=>text(v,80)).filter(Boolean))].slice(0,12)},
    truth:{gameplayProfileReady:true,renderedRig:false,voiceCloneRendered:false,clothSimulationRendered:false,vehicleAnimationRendered:false,ownerValidationRequired:true}
  };
}

export function validateLivingAvatarConsent(profile){
  const p=normalizeLivingAvatarProfile(profile);
  if(p.likeness.mode!=="fictional"&&!p.likeness.consentConfirmed)return{ok:false,reason:"LIKENESS_CONSENT_REQUIRED"};
  if(p.voice.assetId&&!p.voice.consentConfirmed)return{ok:false,reason:"VOICE_CONSENT_REQUIRED"};
  return{ok:true,reason:null};
}

export function compileLivingAvatarGameBrief(profile){
  const p=normalizeLivingAvatarProfile(profile);
  return [
    `LIVING AVATAR: ${p.name}; role=${p.role}.`,
    `MOTION: ${p.motion.modes.join(", ")}.`,
    `OUTFITS: ${p.appearance.outfitAssetIds.length} owner-validated outfit references.`,
    `EQUIPMENT: ${p.equipment.bindings.map(x=>`${x.slot}:${x.label||"private asset"}`).join(", ")||"none selected"}.`,
    `VEHICLES: ${p.vehicles.assetIds.length} private references; allowed modes ${p.vehicles.allowedModes.join(", ")||"none"}.`,
    `VOICE: ${p.voice.assetId?"owner-validated reference with explicit consent required":"no voice reference"}.`,
    "Treat all motion, clothing and vehicle bindings as structured game intent until a compatible rig/animation runtime renders verified output."
  ].join(" ").slice(0,1800);
}
