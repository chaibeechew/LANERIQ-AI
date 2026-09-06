import assert from 'node:assert/strict';
import {getAvatarEngineeringKnowledge,createAvatarEngineeringKnowledgeProfile,knowledgeForAvatarPrompt,knowledgeForAvatarAgentContext} from '../lib/ai/avatar-engineering-knowledge.js';
import {buildLivingCharacterManifest} from '../lib/ai/avatar-character-core.js';
import {buildCharacterAgentContext} from '../lib/ai/avatar-agent-bridge.js';

const knowledge=getAvatarEngineeringKnowledge();
assert.equal(knowledge.contract,'laneriq-avatar-engineering-knowledge-v1');
assert.equal(Object.keys(knowledge.domains).length,10);
for(const required of ['identity_continuity','state_behavior','face_animation','voice_lipsync','body_motion','renderer_mobile','memory_agent','security_consent','cross_device','production_evidence'])assert.ok(knowledge.domains[required]);
assert.ok(knowledge.domains.renderer_mobile.invariants.some(rule=>/cross-user community compute/i.test(rule)));
assert.ok(knowledge.domains.production_evidence.invariants.some(rule=>/exact Git head SHA/i.test(rule)));
assert.ok(knowledge.domains.voice_lipsync.invariants.some(rule=>/ZERO and FREE/i.test(rule)));

const manifest=buildLivingCharacterManifest({characterId:'lc_knowledge_contract',type:'presenter',persona:'clear',voiceStyle:'clear',motionProfile:'natural',language:'en',continuityKey:'knowledge-contract'});
const profile=createAvatarEngineeringKnowledgeProfile({phase:'runtime',platform:'ios',deviceTier:'high',readiness:manifest.readiness});
assert.equal(profile.platform,'ios');
assert.equal(profile.deviceTier,'high');
assert.equal(profile.liveTruth.highFidelity3D,false);
assert.equal(profile.liveTruth.externalNeuralVoice,false);
assert.equal(profile.liveTruth.physicalDeviceBenchmark,false);
assert.ok(profile.platformGuidance.some(rule=>/unrestricted cross-app overlay/i.test(rule)));

const promptKnowledge=knowledgeForAvatarPrompt({platform:'android',deviceTier:'mid',readiness:manifest.readiness});
assert.match(promptKnowledge,/LANERIQ LIVING CHARACTER ENGINEERING KNOWLEDGE/);
assert.match(promptKnowledge,/persistent Character DNA/);
assert.match(promptKnowledge,/Do not claim high-fidelity native 3D/);

const agentKnowledge=knowledgeForAvatarAgentContext({platform:'web',deviceTier:'mid',readiness:manifest.readiness});
assert.ok(agentKnowledge.runtimeRules.includes('avatar-is-presentation-only-agent-owns-execution'));
assert.ok(agentKnowledge.runtimeRules.includes('zero-free-never-silently-escalates-to-metered-provider'));
assert.ok(agentKnowledge.runtimeRules.includes('code-ready-never-implies-live-ready'));

const agentContext=buildCharacterAgentContext({manifest,runtimeState:{state:'thinking',emotion:'focused'},platform:'ios',deviceTier:'high'});
assert.equal(agentContext.contract,'laneriq-character-agent-context-v2');
assert.equal(agentContext.engineeringKnowledge.contract,'laneriq-avatar-engineering-knowledge-v1');
assert.equal(agentContext.engineeringKnowledge.liveTruth.highFidelity3D,false);
assert.ok(agentContext.instructions.includes('code-ready-never-implies-live-ready'));
assert.equal(agentContext.memory.ownerScoped,true);

console.log('LANERIQ Avatar Engineering Knowledge gate passed: identity, behavior, face, voice, motion, renderer/mobile, memory/agent, security/consent, cross-device and exact-SHA production truth are taught as executable knowledge-as-code.');
