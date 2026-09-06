import {createHash,randomUUID} from "node:crypto";

export const LIVING_WORLD_ORIGINALITY_VERSION="1.0.0";
function text(v,max=12000){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}
function hash(value){return createHash("sha256").update(String(value)).digest("hex");}
function tokens(value){return [...new Set(text(value).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>=3).slice(0,1200))];}
function sketch(value){return tokens(value).map(token=>hash(token).slice(0,16)).sort().slice(0,256);}
function overlap(a,b){const A=new Set(a||[]),B=new Set(b||[]);if(!A.size||!B.size)return 0;let common=0;for(const x of A)if(B.has(x))common++;return common/Math.max(A.size,B.size);}

export function createOriginalitySignature({story="",world="",characters="",combat="",variationNonce=""}={}){
  const nonce=text(variationNonce,160)||randomUUID();
  const segments={story:text(story,8000),world:text(world,8000),characters:text(characters,8000),combat:text(combat,8000)};
  const combined=[segments.story,segments.world,segments.characters,segments.combat].join("\n---\n");
  return{version:LIVING_WORLD_ORIGINALITY_VERSION,variationNonce:nonce,signatureHash:hash(`${nonce}\n${combined}`),contentHash:hash(combined),sketch:sketch(combined),segmentHashes:Object.fromEntries(Object.entries(segments).map(([k,v])=>[k,hash(v)])),truth:{ownerCorpusOnly:true,globalUniquenessGuaranteed:false,privateContentStoredInSignature:false}};
}

export function compareOriginalityAgainstOwnerCorpus(signature,prior=[]){
  let maxSimilarity=0,exactOwnerDuplicate=false,matchedKind=null;
  for(const item of Array.isArray(prior)?prior:[]){if(item?.signature_hash===signature.contentHash||item?.signature_hash===signature.signatureHash)exactOwnerDuplicate=true;const score=overlap(signature.sketch,item?.sketch);if(score>maxSimilarity){maxSimilarity=score;matchedKind=item?.content_kind||null;}}
  const risk=exactOwnerDuplicate?"high":maxSimilarity>=.72?"high":maxSimilarity>=.48?"medium":"low";
  return{version:LIVING_WORLD_ORIGINALITY_VERSION,risk,maxSimilarity:Number(maxSimilarity.toFixed(3)),exactOwnerDuplicate,matchedKind,recommendVariation:risk!=="low",truth:{checksOwnedCorpusOnly:true,absoluteNoRepeatPromise:false,crossUserPrivateContentNotCompared:true}};
}

export function originalityGenerationGuidance(result){
  if(result?.risk==="high")return"Regenerate world topology, story event graph, dialogue beats and combat combinations with a new variation nonce before release.";
  if(result?.risk==="medium")return"Increase variation in quest ordering, location graph, character goals and signature abilities before release.";
  return"Originality risk is low against the owner's saved corpus; this is not a guarantee of global uniqueness.";
}
