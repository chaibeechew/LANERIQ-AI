function clean(value,max=160){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function clamp(value,min=0,max=1){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function stableHash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,"0");}
function normalizedTraits(list){return [...new Set((Array.isArray(list)?list:[]).map(v=>clean(v,48).toLowerCase()).filter(Boolean))].sort().slice(0,24);}

export function buildAvatarIdentityDNA(manifest,{signatureTraits=[],outfitFamily="default",voiceAnchor="",relationshipStyle="assistant",version=1}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  const core={characterId:manifest.characterId,archetype:clean(manifest?.dna?.archetype,32),visualStyle:clean(manifest?.dna?.visualStyle,40),persona:clean(manifest?.dna?.persona,40),language:clean(manifest?.dna?.language,24),voiceStyle:clean(manifest?.dna?.voice?.style,40),motionProfile:clean(manifest?.dna?.motion?.profile,40),signatureTraits:normalizedTraits(signatureTraits),outfitFamily:clean(outfitFamily,48)||"default",voiceAnchor:clean(voiceAnchor,96),relationshipStyle:clean(relationshipStyle,48)||"assistant",continuityKey:clean(manifest?.dna?.continuity?.key,96)};
  const canonical=JSON.stringify(core);
  return{contract:"laneriq-character-identity-v2",version:Math.max(1,Math.floor(Number(version)||1)),...core,identityFingerprint:`lcid_${stableHash(canonical)}`,behavioralDNA:{warmth:manifest?.dna?.persona==="warm" ? .8 : .55,expressiveness:manifest?.dna?.motion?.profile==="expressive" ? .85 : .55,directness:manifest?.dna?.persona==="professional" ? .78 : .58,playfulness:manifest?.dna?.persona==="playful" ? .9 : .35},lockedFields:["characterId","continuityKey","signatureTraits","voiceAnchor"]};
}

export function evaluateAvatarIdentityDrift(reference,candidate){
  if(reference?.contract!=="laneriq-character-identity-v2"||candidate?.contract!=="laneriq-character-identity-v2")return{valid:false,score:0,reasons:["IDENTITY_CONTRACT_INVALID"]};
  const reasons=[];let score=1;
  if(reference.characterId!==candidate.characterId){score-=1;reasons.push("CHARACTER_ID_CHANGED");}
  if(reference.continuityKey!==candidate.continuityKey){score-=.35;reasons.push("CONTINUITY_KEY_CHANGED");}
  if(reference.voiceAnchor&&reference.voiceAnchor!==candidate.voiceAnchor){score-=.2;reasons.push("VOICE_ANCHOR_CHANGED");}
  const a=new Set(reference.signatureTraits||[]),b=new Set(candidate.signatureTraits||[]),union=new Set([...a,...b]);let overlap=0;for(const item of union)if(a.has(item)&&b.has(item))overlap+=1;const traitScore=union.size?overlap/union.size:1;score-=Math.max(0,1-traitScore)*.25;if(traitScore<.6)reasons.push("SIGNATURE_TRAIT_DRIFT");
  for(const key of ["persona","visualStyle","voiceStyle","motionProfile"]){if(reference[key]!==candidate[key]){score-=.05;reasons.push(`${key.toUpperCase()}_CHANGED`);}}
  const final=clamp(score);return{valid:final>=.72,score:Number(final.toFixed(3)),traitSimilarity:Number(traitScore.toFixed(3)),reasons};
}

export function mergeAvatarIdentityEvolution(reference,changes={}, {allowVisualEvolution=true,allowBehaviorEvolution=true}={}){
  if(reference?.contract!=="laneriq-character-identity-v2")throw new Error("AVATAR_IDENTITY_REQUIRED");
  const next={...reference,version:(reference.version||1)+1};
  if(allowVisualEvolution&&changes.outfitFamily)next.outfitFamily=clean(changes.outfitFamily,48)||reference.outfitFamily;
  if(allowBehaviorEvolution&&changes.relationshipStyle)next.relationshipStyle=clean(changes.relationshipStyle,48)||reference.relationshipStyle;
  if(allowBehaviorEvolution&&changes.behavioralDNA&&typeof changes.behavioralDNA==="object")next.behavioralDNA={...reference.behavioralDNA,...Object.fromEntries(Object.entries(changes.behavioralDNA).map(([k,v])=>[k,clamp(v)]))};
  next.characterId=reference.characterId;next.continuityKey=reference.continuityKey;next.signatureTraits=[...(reference.signatureTraits||[])];next.voiceAnchor=reference.voiceAnchor;next.identityFingerprint=reference.identityFingerprint;
  return next;
}
