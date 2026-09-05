import {getAvatarEngineeringKnowledge} from "./avatar-engineering-knowledge.js";
import {LANERIQ_LEARNING_LOOP_INSTRUCTION} from "./laneriq-learning-loop.js";
import {getLaneriqOperatingIntelligence,LANERIQ_OPERATING_INTELLIGENCE_INSTRUCTION} from "./laneriq-operating-intelligence.js";

const VERSION="laneriq-engineering-knowledge-fabric-v1";
const CORE=Object.freeze({
  architecture:{objective:"Build replaceable, observable systems with explicit contracts, bounded failure domains and gradual migration paths.",rules:["separate product logic from provider adapters","prefer deterministic contracts at service boundaries","design idempotency and recovery before retries","use exact versions and optimistic concurrency for durable mutations","avoid premature dedicated infrastructure when portable managed components are safer and cheaper"]},
  ai_orchestration:{objective:"Use AI as a governed capability rather than an unbounded provider call.",rules:["route through provider-neutral orchestration","classify workload and cost before execution","prefer deterministic reuse local or own-device capacity before remote capacity","bound fan-out context output and retries","separate model suggestion from authoritative validation and side effects","never infer provider readiness from configuration alone"]},
  product_generation:{objective:"Generate complete usable products rather than attractive mockups.",rules:["plan intent users workflows data permissions and failure states before generation","make core user journeys executable","include loading empty error offline and recovery behavior","preserve user-approved project memory and exact-version history","verify generated output before persistence or publish"]},
  frontend_liui:{objective:"Create adaptive accessible mobile-first interfaces that reveal the right controls at the right moment.",rules:["intent-first composition before feature density","responsive layout and touch-safe interaction","semantic motion with reduced-motion support","clear trust permission loading empty and error states","progressive disclosure instead of exposing infrastructure complexity","performance and accessibility are product requirements not polish"]},
  backend_data:{objective:"Keep durable state owner-scoped, conflict-safe and schema-bounded.",rules:["authenticate before protected reads or writes","authorize exact owner project and version before privileged persistence","use database constraints in addition to application validation","keep service-role operations isolated behind server or cloud adapters","make writes idempotent and optimistic-concurrency aware","minimize stored sensitive data and define deletion/export behavior"]},
  cloud_infrastructure:{objective:"Remain portable and resilient while fixed cost follows proven demand.",rules:["keep core domains provider-opaque","use replaceable adapters and deployment receipts","measure SLO error budget capacity and true workload cost","prefer graceful survival and recovery modes over cascading failure","introduce dedicated infrastructure only when TCO redundancy backup security and observability justify it","migrate workloads gradually rather than replacing managed services all at once"]},
  security:{objective:"Fail closed at identity, data, network, file and execution boundaries.",rules:["least privilege and server-authoritative access control","server-only secrets and strict input bounds","CSRF replay SSRF rate-limit and abuse defenses for mutations and external fetches","private-by-default assets with owner scoping","malware or safety claims require evidence rather than optimistic labels","high-risk actions require explicit authority and confirmation where appropriate"]},
  media_image_video:{objective:"Treat generated media as durable private artifacts with truthful provenance and bounded provider execution.",rules:["capture approved provider output durably before display when persistence is promised","validate media type size host and ownership","separate storyboard or plan from renderer evidence","refund or recover idempotently when paid generation fails","do not claim provider or renderer output when a local fallback was used","preserve consent and rights boundaries for real-person likeness and third-party IP"]},
  mobile_local_compute:{objective:"Use device capability without hidden resource extraction or thermal harm.",rules:["own-device compute requires explicit user choice where appropriate","cross-customer Community Compute stays off on mobile","battery thermal background and low-power state constrain work","unknown mobile thermal telemetry is not equivalent to cool","prefer short adaptive bursts and safe recovery","offload or degrade before sustained thermal pressure"]},
  cost_governance:{objective:"Make zero/free modes impossible to silently convert into spend.",rules:["admission control runs before provider execution","ZERO or FREE blocks metered providers unless policy explicitly changes","verified free remote capacity requires a hard spending stop","cache semantic reuse local and own-device work precede paid remote execution","customer-billed or BYO provider paths require explicit consent","internal cost telemetry must not require user-facing credit complexity"]},
  avatar_living_character:{objective:"Use the dedicated Living Character engineering knowledge for persistent identity, behavior, embodiment and LIVE truth.",rules:["preserve Character DNA across surfaces","Avatar presentation never owns privileged Agent execution","audio playback is the lip-sync clock","adaptive renderer degrades before thermal failure","persistent memory is opt-in and sensitive memory is blocked","native neural physical-device capability requires independent LIVE evidence"]},
  production_evidence:{objective:"Promote only reproducible exact-version behavior, not confidence or synthetic demos.",rules:["bind release evidence to exact Git SHA","CI build preview runtime and production are distinct evidence stages","wrong or stale SHA invalidates promotion","contract tests prove code behavior but not external provider or physical-device reality","Production completion requires the designated integration controller and all mandatory gates","rollback and recovery evidence are part of release readiness"]}
});

function clean(value,max=80){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function list(value){return Array.isArray(value)?value.map(item=>clean(item,40)).filter(Boolean):[];}
export function getLaneriqEngineeringKnowledge(){return{contract:VERSION,domains:CORE,avatar:getAvatarEngineeringKnowledge(),learningContract:"laneriq-governed-experience-learning-v1",operatingIntelligence:getLaneriqOperatingIntelligence()};}

export function createLaneriqEngineeringProfile({focus=[],platform="web",mode="balanced"}={}){
  const requested=list(focus),ids=requested.length?requested.filter(id=>CORE[id]):Object.keys(CORE),selected=ids.length?ids:Object.keys(CORE);
  return{contract:VERSION,platform:clean(platform,24)||"web",mode:clean(mode,24)||"balanced",domains:selected.map(id=>({id,objective:CORE[id].objective,rules:[...CORE[id].rules]})),truthPrinciples:["code-ready-is-not-live-ready","exact-sha-evidence","provider-neutral-core","owner-scoped-private-data","zero-free-no-silent-spend","mobile-no-cross-user-community-compute","candidate-lessons-never-self-promote","decision-before-execution","capability-claims-evidence-bounded","self-heal-reversible-by-default"]};
}

export function engineeringKnowledgeForPrompt(options={}){
  const profile=createLaneriqEngineeringProfile(options),rules=profile.domains.flatMap(domain=>domain.rules.slice(0,2));
  return["LANERIQ ENGINEERING KNOWLEDGE FABRIC:",...rules.map((rule,index)=>`${index+1}. ${rule}.`),"Treat AI output as a candidate until deterministic validation, authorization and evidence gates accept it.","Do not represent CODE, configured providers, previews, emulators or synthetic probes as LIVE Production evidence.","Do not turn an incident, benchmark or model suggestion directly into permanent knowledge; create a governed candidate lesson and pass promotion gates.","Before execution, use Decision Intelligence, Capability Truth, Cost Intelligence, dependency planning and bounded Self-Healing controls."].join("\n");
}

export const LANERIQ_ENGINEERING_AI_INSTRUCTION=`
LANERIQ ENGINEERING KNOWLEDGE FABRIC is mandatory for planning, generation, modification and autonomous repair.
- Architecture: keep product domains provider-opaque, contract-driven, idempotent, recoverable and portable.
- AI orchestration: classify and bound work before execution; prefer deterministic reuse/local/own-device capacity and validate AI output before side effects.
- Product generation: build real user journeys with data, permissions, loading, empty, error, offline and recovery states; do not ship mockup-only flows.
- Data: authenticate and authorize exact owner/project/version; enforce schema/database constraints; isolate privileged persistence.
- Security/privacy: least privilege, server-only secrets, bounded inputs, abuse/SSRF/replay defenses, private-by-default assets and evidence-based safety claims.
- Mobile: adapt to battery/thermal/background/accessibility; unknown thermal state is not cool; mobile cross-user Community Compute remains OFF.
- Cost: ZERO/FREE cannot silently escalate to metered providers; verified free remote capacity needs a hard spending stop.
- Media and Living Characters: preserve consent, ownership, durable private artifacts, identity continuity and truthful local/provider provenance.
- Release truth: CODE-ready, Preview-ready, Provider-ready, Physical-device-ready and Production LIVE are separate states. Exact-SHA and probe-specific evidence are required before promotion.
Use the smallest sufficient architecture, but never simplify away security, ownership, recovery, accessibility, cost boundaries or evidence gates.

${LANERIQ_LEARNING_LOOP_INSTRUCTION}

${LANERIQ_OPERATING_INTELLIGENCE_INSTRUCTION}
`;
