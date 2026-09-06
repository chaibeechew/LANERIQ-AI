const MAX_PREF_KEYS=24;
const MAX_PREF_STRING=2000;
const MAX_MEDIA=30;
const MAX_MEDIA_KEYS=12;
const MAX_MEDIA_STRING=1000;
const MAX_LEARNED_FROM=12;
const MAX_FAILURE_MEMORY=50;
const MAX_REALITY_ENVELOPE=240000;
const SECRET_KEY=/(password|passwd|secret|token|api[_-]?key|credential|private[_-]?key|auth[_-]?key)/i;
const PRIVATE_REALITY_KEY=/(raw[_-]?prompt|source[_-]?prompt|private[_-]?content|file[_-]?content|media[_-]?bytes|chat[_-]?content|password|passwd|secret|token|api[_-]?key|credential|private[_-]?key|auth[_-]?key)/i;

function plainObject(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
function cleanString(value,max){return String(value??"").trim().slice(0,max);}
function cleanScalar(value,max=MAX_PREF_STRING){
  if(typeof value==="boolean")return value;
  if(typeof value==="number"&&Number.isFinite(value))return value;
  if(typeof value==="string")return cleanString(value,max);
  return undefined;
}
function cleanFlatObject(value,{maxKeys=MAX_PREF_KEYS,maxString=MAX_PREF_STRING}={}){
  const input=plainObject(value),out={};
  for(const [rawKey,rawValue] of Object.entries(input).slice(0,maxKeys)){
    const key=cleanString(rawKey,80).replace(/[^a-zA-Z0-9_ -]/g,"");
    if(!key||SECRET_KEY.test(key))continue;
    const clean=cleanScalar(rawValue,maxString);
    if(clean!==undefined)out[key]=clean;
  }
  return out;
}
function cleanMediaPreferences(value){
  if(!Array.isArray(value))return[];
  return value.slice(0,MAX_MEDIA).map(item=>{
    if(typeof item==="string")return {label:cleanString(item,MAX_MEDIA_STRING)};
    const input=plainObject(item),out={};
    for(const [rawKey,rawValue] of Object.entries(input).slice(0,MAX_MEDIA_KEYS)){
      const key=cleanString(rawKey,80).replace(/[^a-zA-Z0-9_ -]/g,"");
      if(!key||SECRET_KEY.test(key))continue;
      const clean=cleanScalar(rawValue,MAX_MEDIA_STRING);
      if(clean!==undefined)out[key]=clean;
    }
    return out;
  }).filter(item=>Object.keys(item).length>0);
}
function cleanStringArray(value,{maxItems=30,maxString=300}={}){
  return Array.isArray(value)?value.slice(0,maxItems).map(item=>cleanString(item,maxString)).filter(Boolean):[];
}
function cleanIndustryPlan(value){
  const input=plainObject(value);
  if(!Object.keys(input).length)return{};
  return {
    profileId:cleanString(input.profileId||input.profile_id,120),
    label:cleanString(input.label,200),
    pages:cleanStringArray(input.pages,{maxItems:30,maxString:200}),
    data:cleanStringArray(input.data,{maxItems:30,maxString:200}),
    workflows:cleanStringArray(input.workflows,{maxItems:30,maxString:300}),
    roles:cleanStringArray(input.roles,{maxItems:20,maxString:160}),
    explicit:input.explicit===true,
  };
}
function cleanPublishingDeclarations(value){
  const input=plainObject(value),permissionInput=plainObject(input.permissionPurposes),permissionPurposes={};
  for(const key of ["camera","microphone","location","photos","notifications"]){const value=cleanString(permissionInput[key],500);if(value)permissionPurposes[key]=value;}
  const termsChoice=["platform_default","custom"].includes(input.termsChoice)?input.termsChoice:"";
  const termsUrl=termsChoice==="custom"?cleanString(input.termsUrl,500):"";
  return {
    termsChoice,
    termsUrl,
    ageRatingAcknowledged:input.ageRatingAcknowledged===true,
    permissionPurposes,
    updatedAt:cleanString(input.updatedAt,80),
  };
}
function cleanPreciseTarget(value){
  const input=plainObject(value);if(!Object.keys(input).length)return null;
  return {
    pageName:cleanString(input.pageName,160),pageIndex:Number.isInteger(input.pageIndex)?input.pageIndex:null,
    sectionName:cleanString(input.sectionName,160),sectionIndex:Number.isInteger(input.sectionIndex)?input.sectionIndex:null,
    lineNumber:Number.isInteger(input.lineNumber)&&input.lineNumber>0?input.lineNumber:null,
    elementType:cleanString(input.elementType,40),position:cleanString(input.position,160),
  };
}
function cleanSelfHeal(value){
  const input=plainObject(value);if(!Object.keys(input).length)return{};
  return {score:Number.isFinite(Number(input.score))?Math.max(0,Math.min(100,Number(input.score))):0,issues:Number.isInteger(Number(input.issues))?Math.max(0,Math.min(1000,Number(input.issues))):0,passed:input.passed===true};
}
function cleanFailureMemory(value){
  if(!Array.isArray(value))return[];
  return value.slice(-MAX_FAILURE_MEMORY).map(item=>{
    const input=plainObject(item);
    const keys=Object.keys(input);
    if(keys.some(key=>SECRET_KEY.test(key)||PRIVATE_REALITY_KEY.test(key)))return null;
    return {
      schemaVersion:"1",
      recordId:cleanString(input.recordId,40),
      createdAt:cleanString(input.createdAt,80),
      category:cleanString(input.category,100),
      failureCode:cleanString(input.failureCode,120),
      strategy:cleanString(input.strategy,800),
      repairPattern:cleanString(input.repairPattern,800),
      preventedBy:cleanString(input.preventedBy,300),
      successAfterRepair:input.successAfterRepair===true,
      providerClass:cleanString(input.providerClass,80),
      runtimeClass:cleanString(input.runtimeClass,80),
      containsCustomerRawData:false,
      containsSecrets:false,
      reusableAcrossCustomers:input.reusableAcrossCustomers!==false,
    };
  }).filter(item=>item&&item.failureCode);
}
function cleanRealityEnvelope(value){
  if(typeof value!=="string")return"";
  const raw=value.trim();if(!raw||raw.length>MAX_REALITY_ENVELOPE)return"";
  let parsed;try{parsed=JSON.parse(raw)}catch{return"";}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||parsed.schemaVersion!==1||parsed.bridgeVersion!=="laneriq-app-builder-world-v1")return"";
  let nodes=0;
  function safe(value,depth=0){
    if(depth>12||++nodes>10000)return false;
    if(value===null||["string","number","boolean"].includes(typeof value))return true;
    if(Array.isArray(value))return value.length<=512&&value.every(item=>safe(item,depth+1));
    if(value&&typeof value==="object"){
      const entries=Object.entries(value);if(entries.length>512)return false;
      return entries.every(([key,item])=>!PRIVATE_REALITY_KEY.test(key)&&safe(item,depth+1));
    }
    return false;
  }
  if(!safe(parsed))return"";
  const normalized=JSON.stringify(parsed);return normalized.length<=MAX_REALITY_ENVELOPE?normalized:"";
}

export function sanitizeMemoryJson(memory){
  const input=plainObject(memory);
  return {
    requestedName:cleanString(input.requestedName||input.requested_name,200),
    brandPreferences:cleanFlatObject(input.brandPreferences||input.brand_preferences),
    visualPreferences:cleanFlatObject(input.visualPreferences||input.visual_preferences),
    userPreferences:cleanFlatObject(input.userPreferences||input.user_preferences),
    workflowPreferences:cleanFlatObject(input.workflowPreferences||input.workflow_preferences),
    contentGuidance:cleanString(input.contentGuidance||input.content_guidance,6000),
    mediaPreferences:cleanMediaPreferences(input.mediaPreferences||input.media_preferences),
    industryPlan:cleanIndustryPlan(input.industryPlan||input.industry_plan),
    lastBuildAt:cleanString(input.lastBuildAt||input.last_build_at,80)||null,
    lastModificationAt:cleanString(input.lastModificationAt||input.last_modification_at,80)||null,
    lastModificationInstruction:cleanString(input.lastModificationInstruction||input.last_modification_instruction,1000),
    lastPreciseTarget:cleanPreciseTarget(input.lastPreciseTarget||input.last_precise_target),
    lastSelfHealApplied:input.lastSelfHealApplied===true||input.last_self_heal_applied===true,
    selfHeal:cleanSelfHeal(input.selfHeal||input.self_heal),
    intelligenceFailureMemory:cleanFailureMemory(input.intelligenceFailureMemory||input.intelligence_failure_memory),
    learnedFrom:cleanStringArray(input.learnedFrom||input.learned_from,{maxItems:MAX_LEARNED_FROM,maxString:200}).length?cleanStringArray(input.learnedFrom||input.learned_from,{maxItems:MAX_LEARNED_FROM,maxString:200}):["customer instructions","approved project changes","customer-owned references"],
    storePublishingDeclarations:cleanPublishingDeclarations(input.storePublishingDeclarations||input.store_publishing_declarations),
    realityEnvelope:cleanRealityEnvelope(input.realityEnvelope||input.reality_envelope),
    rawPrivateAssetsReusableAcrossCustomers:false,
  };
}

export function mergeProjectMemory(current,patch={}){
  const base=sanitizeMemoryJson(current),incoming=plainObject(patch);
  return sanitizeMemoryJson({...base,...incoming,
    brandPreferences:{...base.brandPreferences,...cleanFlatObject(incoming.brandPreferences||incoming.brand_preferences)},
    visualPreferences:{...base.visualPreferences,...cleanFlatObject(incoming.visualPreferences||incoming.visual_preferences)},
    userPreferences:{...base.userPreferences,...cleanFlatObject(incoming.userPreferences||incoming.user_preferences)},
    workflowPreferences:{...base.workflowPreferences,...cleanFlatObject(incoming.workflowPreferences||incoming.workflow_preferences)},
    mediaPreferences:Array.isArray(incoming.mediaPreferences||incoming.media_preferences)?cleanMediaPreferences(incoming.mediaPreferences||incoming.media_preferences):base.mediaPreferences,
    industryPlan:Object.keys(plainObject(incoming.industryPlan||incoming.industry_plan)).length?cleanIndustryPlan(incoming.industryPlan||incoming.industry_plan):base.industryPlan,
    storePublishingDeclarations:Object.keys(plainObject(incoming.storePublishingDeclarations||incoming.store_publishing_declarations)).length?cleanPublishingDeclarations(incoming.storePublishingDeclarations||incoming.store_publishing_declarations):base.storePublishingDeclarations,
    intelligenceFailureMemory:Array.isArray(incoming.intelligenceFailureMemory||incoming.intelligence_failure_memory)?cleanFailureMemory(incoming.intelligenceFailureMemory||incoming.intelligence_failure_memory):base.intelligenceFailureMemory,
  });
}

export function buildProjectMemoryBrief(memoryRow){
  if(!memoryRow)return"";
  const memory=sanitizeMemoryJson(memoryRow.memory_json||memoryRow),rows=[];
  if(memory.requestedName)rows.push(`Preferred project name: ${memory.requestedName}`);
  if(Object.keys(memory.brandPreferences).length)rows.push(`Brand preferences: ${JSON.stringify(memory.brandPreferences)}`);
  if(Object.keys(memory.visualPreferences).length)rows.push(`Visual preferences: ${JSON.stringify(memory.visualPreferences)}`);
  if(Object.keys(memory.userPreferences).length)rows.push(`User preferences: ${JSON.stringify(memory.userPreferences)}`);
  if(Object.keys(memory.workflowPreferences).length)rows.push(`Workflow preferences: ${JSON.stringify(memory.workflowPreferences)}`);
  if(Object.keys(memory.industryPlan).length)rows.push(`Remembered industry structure: ${JSON.stringify(memory.industryPlan)}`);
  if(memory.contentGuidance)rows.push(`Content guidance: ${memory.contentGuidance}`);
  if(memory.lastModificationInstruction)rows.push(`Most recent approved modification: ${memory.lastModificationInstruction}`);
  if(memory.mediaPreferences.length)rows.push(`Existing customer-owned media/reference placement preferences: ${JSON.stringify(memory.mediaPreferences.slice(0,12))}`);
  if(memory.intelligenceFailureMemory.length)rows.push(`Safe prior failure patterns: ${JSON.stringify(memory.intelligenceFailureMemory.slice(-8).map(item=>({failureCode:item.failureCode,strategy:item.strategy,repairPattern:item.repairPattern,successAfterRepair:item.successAfterRepair,runtimeClass:item.runtimeClass})))}`);
  if(!rows.length)return"";
  return `PROJECT MEMORY\n${rows.join("\n")}\nTreat these as project-specific preferences and privacy-safe method-level failure signals. They are not permission to reuse private assets or raw customer content across customers. Preserve them unless the customer's current instruction clearly overrides them.`;
}
