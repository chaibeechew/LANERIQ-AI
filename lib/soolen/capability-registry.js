// Soolen AI capability catalog and fail-closed entitlement resolver.
// This describes Soolen-owned orchestration. It does not copy third-party models,
// subscriptions, private tools, or provider credentials.

import { filterProvidersByCost, freeTierProviders, getSoolenCostMode, zeroCostPolicy, zeroCostProviders } from "./cost-policy.js";

const LEVEL = Object.freeze({ free: 0, pro: 1, business: 2 });

export const SOOLEN_CAPABILITY_VERSION = "1.1.0";

export const SOOLEN_CAPABILITIES = Object.freeze([
  { id:"multilingual-chat", category:"Think & Create", name:"Multilingual AI conversation", description:"Discuss, plan, write, translate and refine work in the user's language.", minimumTier:"free", readiness:"text" },
  { id:"advanced-reasoning", category:"Think & Create", name:"Advanced multi-model reasoning", description:"Use stronger authorized models, deeper analysis and provider fallback for complex tasks.", minimumTier:"pro", readiness:"premiumText" },
  { id:"app-website-builder", category:"Build", name:"App + Customer Website builder", description:"Plan, generate, test, preview, modify and package an app and its customer website together.", minimumTier:"free", readiness:"text" },
  { id:"coding-agent", category:"Build", name:"Coding and repair agent", description:"Create code, run structured checks, repair failures and keep version history.", minimumTier:"free", readiness:"text" },
  { id:"world-builder", category:"Games", name:"AI Map / World Builder", description:"Create owner-scoped semantic game worlds with zones, routes, spawn points, mission anchors and gameplay hooks without falsely claiming live geospatial data.", minimumTier:"free", readiness:"local" },
  { id:"game-intelligence-forge", category:"Games", name:"Game Intelligence Forge", description:"Forge structured original weapons, items, treasure, skills, magic, kungfu, ultimates, defense, healing, buffs, debuffs, summons, transformations, character builds and balance profiles.", minimumTier:"free", readiness:"local" },
  { id:"super-game-fusion", category:"Games", name:"Super Game World Fusion", description:"Merge an owner-scoped World Manifest, Avatar character assets and Combat Forge blueprints into the existing Professional Game Creator request pipeline.", minimumTier:"free", readiness:"local" },
  { id:"visual-understanding", category:"Images", name:"Photo, screenshot and sketch understanding", description:"Extract layout, aspect, light/dark balance and palette without identifying private people.", minimumTier:"free", readiness:"local" },
  { id:"local-image-creation", category:"Images", name:"Original local visual creation", description:"Create original icons, hero artwork and backgrounds using Soolen's programmatic engine.", minimumTier:"free", readiness:"local" },
  { id:"premium-image-studio", category:"Images", name:"Premium image generation and editing", description:"Use an authorized multimodal provider for higher-fidelity generation and edits.", minimumTier:"pro", readiness:"premiumImage", planned:true },
  { id:"browser-voice", category:"Voice", name:"Multilingual browser voice", description:"Speak an idea and hear it read back using voices available on the user's device.", minimumTier:"free", readiness:"browser" },
  { id:"cloud-transcription", category:"Voice", name:"High-accuracy cloud transcription", description:"Transcribe longer recordings with an authorized speech provider.", minimumTier:"pro", readiness:"transcription" },
  { id:"premium-neural-voice", category:"Voice", name:"Soolen multilingual neural voice", description:"Generate consistent multilingual speech through an approved, configured voice service.", minimumTier:"pro", readiness:"premiumVoice" },
  { id:"video-storyboard", category:"Video", name:"Demo storyboard and browser video", description:"Plan a product demo and create browser-local preview media.", minimumTier:"free", readiness:"local" },
  { id:"premium-video-studio", category:"Video", name:"Full video generation and editing", description:"Generate or transform video through an authorized render provider or Soolen worker.", minimumTier:"pro", readiness:"premiumVideo" },
  { id:"project-memory", category:"Workspace", name:"Projects, versions and rollback", description:"Keep each app project, its generated versions and controlled rollback history.", minimumTier:"free", readiness:"local" },
  { id:"live-web-research", category:"Knowledge", name:"Live web research with sources", description:"Retrieve current public information through a separately authorized search provider.", minimumTier:"pro", readiness:"web", planned:true },
  { id:"document-workspace", category:"Files", name:"Documents, PDF, sheets and slides", description:"Read, create and revise common work files inside a permission-scoped project.", minimumTier:"pro", readiness:"documents", planned:true },
  { id:"scheduled-work", category:"Actions", name:"Scheduled and conditional tasks", description:"Run user-approved checks and reminders with clear scope and controls.", minimumTier:"business", readiness:"automations", planned:true },
  { id:"connected-actions", category:"Actions", name:"Authorized app connectors", description:"Work with connected services only after the user grants each required permission.", minimumTier:"business", readiness:"connectors", planned:true },
]);

function enabled(name, env) { return Boolean(env[name]); }
function providerState(env = process.env) {
  const costMode = getSoolenCostMode(env);
  const configuredTextProviders = [
    ["gateway", enabled("AI_GATEWAY_API_KEY", env) && enabled("AI_GATEWAY_MODEL", env)],
    ["gemini", enabled("GEMINI_API_KEY", env)],["groq", enabled("GROQ_API_KEY", env)],["cerebras", enabled("CEREBRAS_API_KEY", env)],["deepseek", enabled("DEEPSEEK_API_KEY", env)],["mistral", enabled("MISTRAL_API_KEY", env)],["together", enabled("TOGETHER_API_KEY", env)],["openrouter", enabled("OPENROUTER_API_KEY", env)],["cloudflare", enabled("CLOUDFLARE_AI_ACCOUNT_ID", env) && enabled("CLOUDFLARE_AI_API_TOKEN", env)],["huggingface", enabled("HF_TOKEN", env) && enabled("HF_MODEL", env)],["xai", enabled("XAI_API_KEY", env)],["openai", enabled("OPENAI_API_KEY", env)],["ollama", enabled("OLLAMA_BASE_URL", env)],["soolen-local", true],
  ].filter(([, ready]) => ready).map(([provider]) => provider);
  const safeDefault = costMode === "zero" ? zeroCostProviders(env) : costMode === "free" ? freeTierProviders(env) : null;
  const freeDefault = safeDefault || ["gemini","groq","cerebras","ollama","soolen-local"];
  const paidDefault = safeDefault || ["gateway","openai","xai","deepseek","mistral","together","openrouter","gemini","groq","cerebras","cloudflare","huggingface","ollama","soolen-local"];
  const split = (value, fallback) => String(value || fallback.join(",")).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const selectedFree = filterProvidersByCost(split(env.SOOLEN_FREE_PROVIDERS, freeDefault), env).filter((provider) => configuredTextProviders.includes(provider));
  const selectedPaid = filterProvidersByCost(split(env.SOOLEN_PAID_PROVIDERS, paidDefault), env).filter((provider) => configuredTextProviders.includes(provider));
  const openVoiceReady = Boolean(env.SOOLENAI_TTS_URL && env.SOOLENAI_VOICE_SAMPLE_URL);
  return {costMode,configuredTextProviders,freeTextProviders:selectedFree,paidTextProviders:selectedPaid,premiumText:selectedPaid.some((provider) => provider !== "soolen-local"),premiumImage:["zero","free"].includes(costMode) ? false : Boolean(env.SOOLEN_IMAGE_PROVIDER_URL || (env.AI_GATEWAY_API_KEY && env.SOOLEN_IMAGE_MODEL)),transcription:["zero","free"].includes(costMode) ? Boolean(env.SOOLEN_STT_URL) : Boolean(env.OPENAI_API_KEY || env.SOOLEN_STT_URL),premiumVoice:["zero","free"].includes(costMode) ? openVoiceReady : Boolean(openVoiceReady || (env.ELEVENLABS_API_KEY && env.SOOLENAI_VOICE_ID)),premiumVideo:["zero","free"].includes(costMode) ? false : Boolean(env.SOOLEN_VIDEO_RUNTIME_URL || env.SOOLEN_VIDEO_EXECUTOR_URL || env.SOOLEN_VIDEO_PROVIDER_URL),web:["zero","free"].includes(costMode) ? false : Boolean(env.SOOLEN_WEB_SEARCH_URL || env.TAVILY_API_KEY || env.PERPLEXITY_API_KEY),documents:Boolean(env.SOOLEN_DOCUMENT_WORKER_URL),automations:["zero","free"].includes(costMode) ? false : Boolean(env.SOOLEN_AUTOMATION_WORKER_URL),connectors:Boolean(env.SOOLEN_CONNECTOR_BROKER_URL)};
}
export function planTier(planCode, accessStatus) {if (!["active","trialing"].includes(String(accessStatus || "").toLowerCase())) return "free";const code = String(planCode || "").toLowerCase();if (/business|team|enterprise/.test(code)) return "business";return "pro";}
export function resolveSoolenCapabilities({ tier = "free", env = process.env } = {}) {
  const normalizedTier = LEVEL[tier] === undefined ? "free" : tier,providers = providerState(env),selectedTextProviders = normalizedTier === "free" ? providers.freeTextProviders : providers.paidTextProviders;
  const readiness={local:true,browser:true,text:selectedTextProviders.length>0,premiumText:providers.premiumText,premiumImage:providers.premiumImage,transcription:providers.transcription,premiumVoice:providers.premiumVoice,premiumVideo:providers.premiumVideo,web:providers.web,documents:providers.documents,automations:providers.automations,connectors:providers.connectors};
  const capabilities=SOOLEN_CAPABILITIES.map((capability)=>{const entitled=LEVEL[normalizedTier]>=LEVEL[capability.minimumTier],configured=Boolean(readiness[capability.readiness]);const status=!entitled?"professional_access_required":capability.planned?(configured?"integration_ready":"planned"):configured?"ready":"setup_required";return{...capability,entitled,configured,status};});
  return {version:SOOLEN_CAPABILITY_VERSION,tier:normalizedTier,capabilities,providers:{text:selectedTextProviders,count:providers.configuredTextProviders.length,premiumRouting:normalizedTier!=="free"&&providers.premiumText,costMode:providers.costMode},policy:{thirdPartyModelsCopied:false,requiresAuthorizedProvider:true,professionalFeaturesRequireActive365DayAccess:true,standardQualityFloorMatchesProfessional:true,failClosed:true,...zeroCostPolicy(env)}};
}
