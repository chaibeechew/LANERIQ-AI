import {knowledgeForAvatarAgentContext} from "./avatar-engineering-knowledge.js";

const PHASE_EVENT=Object.freeze({
  listening:"USER_SPEECH_START",
  understood:"USER_SPEECH_END",
  thinking:"AI_THINKING",
  responding:"AI_RESPONSE_START",
  response_complete:"AI_RESPONSE_END",
  action_start:"ACTION_START",
  action_success:"ACTION_SUCCESS",
  action_error:"ACTION_ERROR"
});
const SAFE_MEMORY_CATEGORIES=new Set(["preference","project","interaction-style","user-label"]);
const SENSITIVE_HINT=/\b(password|passcode|secret|token|api key|credit card|bank account|medical|diagnosis|religion|political|sexual|criminal|biometric)\b/i;

function clean(value,max=500){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

export function mapAgentPhaseToAvatarEvent(phase){return PHASE_EVENT[String(phase||"").toLowerCase()]||null;}

export function buildCharacterAgentContext({manifest,runtimeState,shortTermContext=[],persistentMemory=[],persistentMemoryOptIn=false,platform="web",deviceTier="mid"}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  const shortTerm=(Array.isArray(shortTermContext)?shortTermContext:[]).slice(-12).map(item=>clean(item,700)).filter(Boolean);
  const persistent=Boolean(persistentMemoryOptIn)?(Array.isArray(persistentMemory)?persistentMemory:[]).slice(-20).map(item=>({category:clean(item?.category,40),text:clean(item?.text,700)})).filter(item=>SAFE_MEMORY_CATEGORIES.has(item.category)&&item.text&&!SENSITIVE_HINT.test(item.text)):[];
  const engineeringKnowledge=knowledgeForAvatarAgentContext({phase:"agent-runtime",platform,deviceTier,readiness:manifest?.readiness||{}});
  return{
    contract:"laneriq-character-agent-context-v2",
    characterId:manifest.characterId,
    persona:manifest?.dna?.persona||"warm",
    language:manifest?.dna?.language||"en",
    state:runtimeState?.state||manifest?.behavior?.initialState||"idle",
    emotion:runtimeState?.emotion||"neutral",
    memory:{ownerScoped:true,persistentOptIn:Boolean(persistentMemoryOptIn),shortTerm,persistent},
    engineeringKnowledge,
    instructions:["preserve-character-identity","use-state-aware-responses","do-not-infer-sensitive-personal-attributes","do-not-expose-provider-identities",...engineeringKnowledge.runtimeRules]
  };
}

export function buildCharacterMemoryWriteIntent({manifest,category,text,persistentMemoryOptIn=false,userConfirmed=false}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  const c=clean(category,40).toLowerCase();
  const value=clean(text,700);
  if(!persistentMemoryOptIn)return{allowed:false,reason:"PERSISTENT_MEMORY_NOT_OPTED_IN"};
  if(!userConfirmed)return{allowed:false,reason:"MEMORY_NOT_USER_CONFIRMED"};
  if(!SAFE_MEMORY_CATEGORIES.has(c))return{allowed:false,reason:"MEMORY_CATEGORY_NOT_ALLOWED"};
  if(!value)return{allowed:false,reason:"MEMORY_TEXT_REQUIRED"};
  if(SENSITIVE_HINT.test(value))return{allowed:false,reason:"SENSITIVE_MEMORY_BLOCKED"};
  return{allowed:true,contract:"character-memory-v1",characterId:manifest.characterId,ownerScoped:true,category:c,text:value,source:"user-confirmed"};
}

export function buildCharacterAgentActionEnvelope({manifest,actionId,name,args={},requiresConfirmation=false}={}){
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  const id=clean(actionId,160),action=clean(name,100);
  if(!id||!action)throw new Error("CHARACTER_AGENT_ACTION_REQUIRED");
  return{
    contract:"laneriq-agent-action-v1",
    characterId:manifest.characterId,
    actionId:id,
    name:action,
    args:args&&typeof args==="object"&&!Array.isArray(args)?args:{},
    stateAware:true,
    requiresConfirmation:Boolean(requiresConfirmation),
    executionAuthority:"laneriq-agent",
    avatarAuthority:"presentation-only"
  };
}

export function buildAvatarEventFromAgentUpdate({phase,emotion}={}){
  const event=mapAgentPhaseToAvatarEvent(phase);
  if(!event)return null;
  const e=clean(emotion,24).toLowerCase();
  return{event,options:e?{emotion:e}:undefined};
}
