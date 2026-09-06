import assert from 'node:assert/strict';
import {getLaneriqEngineeringKnowledge,createLaneriqEngineeringProfile,engineeringKnowledgeForPrompt,LANERIQ_ENGINEERING_AI_INSTRUCTION} from '../lib/ai/laneriq-engineering-knowledge.js';
import {GENERATION_QUALITY_RULES} from '../lib/buildStandards.js';

const fabric=getLaneriqEngineeringKnowledge();
assert.equal(fabric.contract,'laneriq-engineering-knowledge-fabric-v1');
assert.equal(Object.keys(fabric.domains).length,12);
for(const domain of ['architecture','ai_orchestration','product_generation','frontend_liui','backend_data','cloud_infrastructure','security','media_image_video','mobile_local_compute','cost_governance','avatar_living_character','production_evidence'])assert.ok(fabric.domains[domain]);
assert.equal(fabric.avatar.contract,'laneriq-avatar-engineering-knowledge-v1');

const profile=createLaneriqEngineeringProfile({focus:['architecture','security','cost_governance','production_evidence'],platform:'mobile',mode:'zero'});
assert.equal(profile.domains.length,4);
assert.ok(profile.truthPrinciples.includes('code-ready-is-not-live-ready'));
assert.ok(profile.truthPrinciples.includes('zero-free-no-silent-spend'));
assert.ok(profile.truthPrinciples.includes('mobile-no-cross-user-community-compute'));

const prompt=engineeringKnowledgeForPrompt({focus:['ai_orchestration','backend_data','production_evidence']});
assert.match(prompt,/provider-neutral orchestration/i);
assert.match(prompt,/authenticate before protected reads or writes/i);
assert.match(prompt,/authorize exact owner project and version before privileged persistence/i);
assert.match(prompt,/Exact-SHA|exact Git SHA|exact-version/i);
assert.match(prompt,/Do not represent CODE/i);

assert.match(LANERIQ_ENGINEERING_AI_INSTRUCTION,/mobile cross-user Community Compute remains OFF/i);
assert.match(LANERIQ_ENGINEERING_AI_INSTRUCTION,/ZERO\/FREE cannot silently escalate to metered providers/i);
assert.match(LANERIQ_ENGINEERING_AI_INSTRUCTION,/CODE-ready, Preview-ready, Provider-ready, Physical-device-ready and Production LIVE are separate states/i);
assert.match(GENERATION_QUALITY_RULES,/LANERIQ ENGINEERING KNOWLEDGE FABRIC is mandatory/i);
assert.match(GENERATION_QUALITY_RULES,/provider-opaque/i);
assert.match(GENERATION_QUALITY_RULES,/exact-SHA/i);

console.log('LANERIQ Engineering Knowledge Fabric gate passed: architecture, AI orchestration, product generation, LIUI, data, cloud, security, media, mobile compute, cost governance, Living Character and Production evidence are active knowledge-as-code.');
