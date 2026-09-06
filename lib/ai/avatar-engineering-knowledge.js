// LANERIQ Living Character Engineering Knowledge Core.
// Knowledge-as-code guides generation and agent decisions. It does not claim that CODE-ready capabilities are LIVE.

const KNOWLEDGE_VERSION="laneriq-avatar-engineering-knowledge-v1";
const DOMAINS=Object.freeze({
  identity_continuity:Object.freeze({
    objective:"Keep one recognizable character identity across image, video, chat, web, mobile and desktop while allowing bounded cosmetic evolution.",
    invariants:["lock identity anchors such as face structure, signature traits, voice anchor and behavioral DNA","treat outfit, accessories and scene as mutable unless explicitly locked","measure identity drift before accepting evolution","reuse private owner-scoped continuity anchors rather than reconstructing identity from memory"],
    antiPatterns:["silent face drift","voice identity changing between sessions","using sensitive inferred traits as identity anchors","cross-customer identity reuse"],
    metrics:["identity-drift-score","continuity-revision","voice-anchor-match"]
  }),
  state_behavior:Object.freeze({
    objective:"Make behavior explicit, legal and recoverable through a deterministic state machine.",
    invariants:["use legal transitions between idle listening thinking speaking acting success and concerned","presentation state never grants execution authority","proactive or recovered speech enters through a legal thinking-to-speaking path","barge-in must interrupt speaking and return to a valid state"],
    antiPatterns:["audio playing while state remains idle","UI animation executing tools directly","hidden impossible transitions","state inferred only from visual animation"],
    metrics:["rejected-transition-rate","barge-in-latency-ms","state-recovery-rate"]
  }),
  face_animation:Object.freeze({
    objective:"Drive a natural renderer-neutral face from attention, emotion and audio timing without tying intelligence to one mesh.",
    invariants:["audio or verified phoneme timing is the mouth-animation clock","blend gaze blink head motion and micro-expression independently","smooth co-articulation instead of snapping visemes","honor reduced-motion and renderer channel budgets","52-channel output is optional high-detail output, not an intelligence requirement"],
    antiPatterns:["frame-rate-dependent lip sync","random gaze during listening","constant exaggerated expression","forcing 52 channels on thermally constrained devices"],
    metrics:["lip-sync-error-ms","blink-naturalness","gaze-target-stability","face-frame-budget-ms"]
  }),
  voice_lipsync:Object.freeze({
    objective:"Keep speech, phonemes, visemes, interruption and facial animation synchronized to real playback.",
    invariants:["actual playback time is the master clock","correct jitter and bounded drift before hard resync","support user barge-in","estimated text-to-viseme timing must never be labeled exact phoneme timing","ZERO and FREE modes cannot silently escalate to metered neural TTS"],
    antiPatterns:["using generation completion time as playback time","claiming exact timing from estimated visemes","continuing speech after user interruption","provider identity exposed to the client"],
    metrics:["voice-start-latency-ms","lip-sync-error-ms","audio-clock-drift-ms","barge-in-latency-ms"]
  }),
  body_motion:Object.freeze({
    objective:"Generate readable, physically plausible body language that supports meaning rather than distracting from it.",
    invariants:["sequence meaningful gestures as anticipation action settle","look toward a target before or while pointing","use IK for reachable targets and foot lock for grounded motion","bound secondary motion by frame time and reduced-motion preference","semantic action intent stays separate from renderer-specific joint commands"],
    antiPatterns:["hands teleporting to targets","foot sliding","perpetual idle movement","gesture intensity unrelated to speech or emotion"],
    metrics:["ik-reach-error","foot-slip-rate","gesture-settle-time-ms","motion-frame-budget-ms"]
  }),
  renderer_mobile:Object.freeze({
    objective:"Preserve character responsiveness on real phones through adaptive quality instead of overheating or dropping interaction quality.",
    invariants:["degrade 3d to lightweight-3d to 2.5d before thermal failure","treat battery thermal background and reduced-motion as runtime signals","missing sparse telemetry preserves the last-known safe plan instead of inventing a new device state","continuous character rendering is primarily in-app","use local browser or own-device compute before remote work when appropriate","cross-user Community Compute remains OFF on mobile; only the user's own devices may contribute local compute"],
    antiPatterns:["assuming an unknown browser thermal state is cool","resetting Performance to Balanced because one telemetry frame is missing","continuous background rendering","cross-user community compute on mobile"],
    metrics:["fps","frame-time-p95-ms","dropped-frame-rate","thermal-state","battery-rate-per-hour","memory-mb"]
  }),
  memory_agent:Object.freeze({
    objective:"Let the character remember useful user-approved context while keeping the LANERIQ Agent as the only execution authority.",
    invariants:["Avatar is presentation-only and Agent owns actions","persistent memory is opt-in and user-confirmed","sensitive memory categories are blocked","bound short-term and persistent context","state and emotion may affect presentation but cannot bypass action confirmation"],
    antiPatterns:["Avatar directly performing privileged actions","storing raw secrets as character memory","unbounded conversation history","inferring sensitive personal attributes"],
    metrics:["memory-write-rejection-reason","context-size","confirmed-memory-count","action-confirmation-rate"]
  }),
  security_consent:Object.freeze({
    objective:"Keep identity, likeness, voice, memory and assets private, consented and owner-scoped.",
    invariants:["real-person likeness or voice cloning requires appropriate permission","private assets remain owner-scoped","handoff payloads exclude raw key material and raw persistent-memory contents","provider identities and credentials stay server-side","use authenticated encryption and context binding for private cross-device payloads"],
    antiPatterns:["silent face or voice cloning","raw private key export","plaintext cross-device memory sync","provider secrets in browser payloads"],
    metrics:["consent-present","owner-scope-check","encryption-envelope-valid","sensitive-field-block-count"]
  }),
  cross_device:Object.freeze({
    objective:"Continue the same character across devices without weakening identity, privacy or revision consistency.",
    invariants:["use encrypted owner-character-device-bound handoff envelopes","use optimistic revisions and explicit conflict recovery","prefer non-extractable native key handles when available","support device revocation","do not promote E2E handoff LIVE until real secure-key custody and round-trip evidence exist"],
    antiPatterns:["last-write-wins character corruption","raw asset transfer inside continuity metadata","server-side storage of exportable user private keys","synthetic key tests labeled physical-device evidence"],
    metrics:["handoff-round-trip-success","revision-conflict-rate","device-revoke-success","key-attestation-status"]
  }),
  production_evidence:Object.freeze({
    objective:"Promote capabilities only from exact-version reproducible evidence and fail closed when evidence is incomplete.",
    invariants:["bind LIVE evidence to exact Git head SHA","native renderer neural voice secure handoff and physical benchmark require independent probes","stale or wrong-SHA evidence cannot promote LIVE","synthetic contract tests prove code behavior but never mutate LIVE flags","Production Release Control owns final promotion"],
    antiPatterns:["CODE-ready equals LIVE-ready","one green preview promoting unrelated capabilities","benchmarking emulator data as a physical-device result","changing truth flags from tests without evidence"],
    metrics:["exact-sha-match","probe-pass-count","physical-device-evidence-count","live-promotion-block-reason"]
  })
});

const PLATFORM_NOTES=Object.freeze({
  ios:["prefer in-app character rendering and approved system surfaces","do not depend on unrestricted cross-app overlay behavior","native renderer evidence should bind Metal/runtime/device telemetry"],
  android:["overlay behavior is optional and permission-gated, never a core dependency","prefer in-app rendering and normal Android surfaces","native renderer evidence should bind Vulkan or supported OpenGL ES runtime/device telemetry"],
  web:["WebGL2 and SpeechSynthesis are capability-detected fallbacks","browser thermal telemetry stays unknown unless a trusted native wrapper supplies it"],
  desktop:["desktop may use richer native rendering while preserving the same Character DNA and agent authority boundaries"]
});

function clean(value,max=80){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function platform(value){const p=clean(value,20).toLowerCase();return PLATFORM_NOTES[p]?p:"web";}
function liveFlag(readiness,key){return Boolean(readiness&&readiness[key]===true);}
export function getAvatarEngineeringKnowledge(){return{contract:KNOWLEDGE_VERSION,domains:DOMAINS,platformNotes:PLATFORM_NOTES};}

export function createAvatarEngineeringKnowledgeProfile({phase="runtime",platform:platformName="web",deviceTier="mid",readiness={}}={}){
  const p=platform(platformName),tier=["low","mid","high"].includes(clean(deviceTier,20).toLowerCase())?clean(deviceTier,20).toLowerCase():"mid";
  return{
    contract:KNOWLEDGE_VERSION,
    phase:clean(phase,32)||"runtime",
    platform:p,
    deviceTier:tier,
    principles:["identity-continuity-first","audio-clocked-expression","agent-authority-separated-from-avatar","local-and-own-device-first","adaptive-mobile-quality","consent-and-owner-scope","fail-closed-live-truth"],
    platformGuidance:[...PLATFORM_NOTES[p]],
    liveTruth:{
      highFidelity3D:liveFlag(readiness,"realtime3DRenderer"),
      externalNeuralVoice:liveFlag(readiness,"liveVoiceProvider"),
      encryptedCrossDeviceHandoff:liveFlag(readiness,"crossDeviceEncryptedHandoffLive"),
      physicalDeviceBenchmark:liveFlag(readiness,"physicalDeviceBenchmark"),
      generativeMotion:liveFlag(readiness,"motionGenerator"),
      persistenceMigrationApplied:liveFlag(readiness,"persistenceMigrationApplied")
    },
    domains:Object.entries(DOMAINS).map(([id,value])=>({id,objective:value.objective,invariants:[...value.invariants],antiPatterns:[...value.antiPatterns],metrics:[...value.metrics]}))
  };
}

export function knowledgeForAvatarPrompt(options={}){
  const profile=createAvatarEngineeringKnowledgeProfile(options);
  const rules=profile.domains.flatMap(domain=>domain.invariants.slice(0,2)).slice(0,14);
  return[
    "LANERIQ LIVING CHARACTER ENGINEERING KNOWLEDGE:",
    ...rules.map((rule,index)=>`${index+1}. ${rule}.`),
    `Platform: ${profile.platform}; device tier: ${profile.deviceTier}.`,
    "Visual generation is only one representation of a persistent Character DNA. Preserve identity anchors and mobile-safe readability.",
    "Do not claim high-fidelity native 3D, external neural voice, generative motion, encrypted cross-device LIVE or physical-device readiness unless their exact LIVE evidence flag is true."
  ].join("\n");
}

export function knowledgeForAvatarAgentContext(options={}){
  const profile=createAvatarEngineeringKnowledgeProfile(options);
  return{
    contract:KNOWLEDGE_VERSION,
    principles:profile.principles,
    liveTruth:profile.liveTruth,
    runtimeRules:[
      "preserve-character-identity",
      "use-only-legal-behavior-state-transitions",
      "audio-playback-is-lipsync-master-clock",
      "avatar-is-presentation-only-agent-owns-execution",
      "persistent-memory-requires-opt-in-and-confirmed-write",
      "adapt-render-quality-before-thermal-failure",
      "zero-free-never-silently-escalates-to-metered-provider",
      "code-ready-never-implies-live-ready"
    ],
    platformGuidance:profile.platformGuidance
  };
}
