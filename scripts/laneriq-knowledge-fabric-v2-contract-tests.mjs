import assert from 'node:assert/strict';
import {routeEngineeringKnowledge,buildKnowledgePacket} from '../lib/ai/laneriq-knowledge-router.js';
import {createExperienceCandidate} from '../lib/ai/laneriq-experience-ledger.js';
import {evaluateKnowledgePromotion,promoteKnowledgeCandidate} from '../lib/ai/laneriq-knowledge-promotion.js';
import {learnFromBenchmark,learnFromIncident,assessLearningOutcome} from '../lib/ai/laneriq-learning-loop.js';
import {detectImmutableKnowledgeConflict,resolveKnowledgeConflict,immutableKnowledgeRuleIds} from '../lib/ai/laneriq-knowledge-conflict-resolver.js';
import {evaluateKnowledgeFreshness,requiresExternalRefresh} from '../lib/ai/laneriq-knowledge-staleness.js';
import {budgetKnowledgeRules} from '../lib/ai/laneriq-knowledge-budget.js';
import {createKnowledgeTelemetry,publicKnowledgeTelemetry} from '../lib/ai/laneriq-knowledge-observability.js';
import {evaluateKnowledgeSources,getKnowledgeSourcePolicy} from '../lib/ai/laneriq-knowledge-source-trust.js';
import {evaluateKnowledgeRevocation,revokeKnowledgeItem,quarantineKnowledgeItem} from '../lib/ai/laneriq-knowledge-revocation.js';
import {getLaneriqEngineeringKnowledge,engineeringKnowledgeForPrompt} from '../lib/ai/laneriq-engineering-knowledge.js';
import {GENERATION_QUALITY_RULES} from '../lib/buildStandards.js';

const routed=routeEngineeringKnowledge({task:'Deploy an iOS avatar with zero-cost local voice, owner-scoped memory and Production evidence',platform:'ios',mode:'zero'});
for(const id of ['avatar_living_character','mobile_local_compute','cost_governance','production_evidence','security'])assert.ok(routed.selectedDomains.includes(id),`missing routed domain ${id}`);
assert.ok(routed.selectedDomains.length<=8);
const packet=buildKnowledgePacket({task:'secure database migration with exact SHA release evidence',platform:'web',mode:'balanced'});
assert.equal(packet.contract,'laneriq-knowledge-packet-v2');
assert.match(packet.instruction,/AI output remains a candidate/i);
assert.match(packet.instruction,/Never self-promote/i);
assert.ok(packet.estimatedTokens<=1200);
assert.ok(packet.rules.length<=18);

const secretCandidate=createExperienceCandidate({domain:'security',title:'Token leak sk_12345678901234567890',lesson:'Never log authorization bearer token_12345678901234567890 or service_role secret values.',source:'incident',risk:'high',evidence:[{kind:'contract',ref:'redaction-contract',passed:true},{kind:'incident',ref:'incident-42',passed:true}]});
assert.equal(secretCandidate.status,'candidate');
assert.equal(secretCandidate.autoPromotable,false);
assert.equal(secretCandidate.containsPrivateUserContent,false);
assert.equal(secretCandidate.containsDirectPii,false);
assert.doesNotMatch(`${secretCandidate.title} ${secretCandidate.lesson}`,/sk_12345678901234567890|token_12345678901234567890|service_role secret/i);

const piiCandidate=createExperienceCandidate({domain:'security',title:'Contact alice@example.com at +60123456789',lesson:'Never persist alice@example.com or +60123456789 inside shared engineering knowledge.',source:'incident',risk:'high',evidence:[{kind:'contract',ref:'pii-redaction',passed:true},{kind:'incident',ref:'incident-pii',passed:true}]});
assert.doesNotMatch(`${piiCandidate.title} ${piiCandidate.lesson}`,/alice@example\.com|60123456789/i);
assert.match(`${piiCandidate.title} ${piiCandidate.lesson}`,/REDACTED_EMAIL|REDACTED_PHONE/);
assert.throws(()=>createExperienceCandidate({lesson:'raw private prompt',containsPrivateUserContent:true}),/PRIVATE_USER_CONTENT_NOT_ALLOWED_IN_EXPERIENCE/);

const unknownCandidate=createExperienceCandidate({domain:'architecture',title:'Unknown source',lesson:'Unknown evidence must never be upgraded into deterministic truth.',evidence:[{kind:'mystery-feed',ref:'mystery',passed:true,independent:true},{kind:'model_suggestion',ref:'model',passed:true,independent:true}]});
assert.equal(unknownCandidate.evidence[0].kind,'untrusted');
assert.equal(unknownCandidate.evidence[1].kind,'model_suggestion');
const unknownPromotion=evaluateKnowledgePromotion(unknownCandidate,{target:'validated'});
assert.equal(unknownPromotion.allowed,false);
assert.ok(unknownPromotion.blockers.includes('deterministic-contract-evidence-required'));
assert.ok(unknownPromotion.blockers.includes('high-trust-source-required'));

const docsCandidate=createExperienceCandidate({domain:'security',title:'Official docs validation',lesson:'Verified official guidance plus deterministic contract may support validated engineering knowledge.',evidence:[{kind:'contract',ref:'security-contract',passed:true,independent:true},{kind:'official_docs',ref:'official-doc-revision',passed:true,independent:true}]});
const docsValidated=evaluateKnowledgePromotion(docsCandidate,{target:'validated'});
assert.equal(docsValidated.allowed,true);
assert.equal(evaluateKnowledgePromotion(docsCandidate,{target:'production_rule',reviewerApproved:true}).allowed,false);

const blocked=evaluateKnowledgePromotion(secretCandidate,{target:'production_rule',reviewerApproved:false});
assert.equal(blocked.allowed,false);
assert.ok(blocked.blockers.includes('human-review-approval-required'));
assert.ok(blocked.blockers.includes('independent-exact-sha-production-evidence-required'));

const eligible=createExperienceCandidate({domain:'production_evidence',title:'Exact SHA promotion lesson',lesson:'Promote only when deterministic, runtime and exact-SHA Production evidence agree.',source:'runtime',risk:'normal',evidence:[{kind:'contract',ref:'contract-gate',passed:true,independent:true},{kind:'runtime',ref:'runtime-probe',passed:true,independent:true},{kind:'production_exact_sha',ref:'sha:abc123',passed:true,exactSha:true,independent:true},{kind:'manual_review',ref:'review-1',passed:true,independent:true}]});
const allowed=evaluateKnowledgePromotion(eligible,{target:'production_rule',reviewerApproved:true});
assert.equal(allowed.contract,'laneriq-knowledge-promotion-decision-v2');
assert.equal(allowed.allowed,true);
assert.ok(allowed.sourceTrust.productionSupportCount>=2);
assert.equal(promoteKnowledgeCandidate(eligible,{target:'production_rule',reviewerApproved:true}).status,'production_rule');
const privacyBlocked=evaluateKnowledgePromotion({...eligible,containsPrivateUserContent:true},{target:'production_rule',reviewerApproved:true});
assert.equal(privacyBlocked.allowed,false);
assert.ok(privacyBlocked.blockers.includes('private-user-content-safety-unverified'));

const modelOnly=evaluateKnowledgeSources([{type:'model_suggestion',ref:'model-opinion',passed:true,independent:true}]);
assert.equal(modelOnly.modelOnly,true);
assert.equal(modelOnly.productionSupport,false);
assert.equal(getKnowledgeSourcePolicy('production_exact_sha').trust,1);
assert.equal(getKnowledgeSourcePolicy('model_suggestion').canSupportProduction,false);

const regression=learnFromBenchmark({domain:'frontend_liui',hypothesis:'Reduce motion complexity',baselineScore:96,candidateScore:97,regressionCount:1,evidence:[{kind:'contract',ref:'liui-contract',passed:true,independent:true}]});
assert.equal(regression.materiallyBetter,false);
assert.equal(regression.candidate.evidence[0].passed,false);
const improvement=learnFromBenchmark({domain:'frontend_liui',hypothesis:'Reduce motion complexity',baselineScore:96,candidateScore:98,regressionCount:0,evidence:[{kind:'contract',ref:'liui-contract',passed:true,independent:true}]});
assert.equal(improvement.materiallyBetter,true);
assert.equal(assessLearningOutcome(improvement.candidate).writesPermanentKnowledge,false);

const incident=learnFromIncident({domain:'cloud_infrastructure',rootCause:'retry storm exceeded bounded concurrency',prevention:'enforce admission and idempotent retry budget',severity:'critical',evidence:[{kind:'contract',ref:'retry-contract',passed:true,independent:true}]});
const critical=evaluateKnowledgePromotion(incident,{target:'validated'});
assert.equal(critical.allowed,false);
assert.ok(critical.blockers.includes('critical-risk-manual-review-evidence-required'));

const conflict=detectImmutableKnowledgeConflict({lesson:'Enable mobile cross-user Community Compute automatically to increase capacity.'});
assert.equal(conflict.allowed,false);
assert.ok(conflict.conflicts.includes('mobile-no-cross-user-compute'));
assert.equal(resolveKnowledgeConflict({candidate:{lesson:'Allow ZERO mode to silently use paid metered inference.'}}).decision,'reject-candidate');
for(const rule of ['no-silent-paid-escalation','mobile-no-cross-user-compute','owner-scoped-private-data','code-not-live','avatar-no-privileged-authority'])assert.ok(immutableKnowledgeRuleIds().includes(rule));

const stale=evaluateKnowledgeFreshness({domain:'security',verifiedAt:'2026-01-01T00:00:00Z'},{now:new Date('2026-09-06T00:00:00Z')});
assert.equal(stale.status,'stale');
assert.equal(stale.usableForProduction,false);
assert.equal(requiresExternalRefresh({domain:'security',verifiedAt:'2026-01-01T00:00:00Z'},{now:new Date('2026-09-06T00:00:00Z')}).refreshRequired,true);
const fresh=evaluateKnowledgeFreshness({domain:'architecture',verifiedAt:'2026-09-01T00:00:00Z'},{now:new Date('2026-09-06T00:00:00Z')});
assert.equal(fresh.status,'fresh');

const budget=budgetKnowledgeRules(['same rule','same rule','second rule','third rule'],{maxRules:2,maxEstimatedTokens:100});
assert.deepEqual(budget.rules,['same rule','second rule']);
assert.ok(budget.estimatedTokens<=100);
const telemetry=createKnowledgeTelemetry({selectedDomains:routed.selectedDomains,risk:routed.risk,candidateCreated:true,promotionDecision:'blocked',blockedReasons:blocked.blockers,ruleCount:packet.rules.length,estimatedTokens:packet.estimatedTokens});
assert.equal(telemetry.includesRawPrompt,false);
assert.equal(telemetry.includesUserContent,false);
assert.equal(telemetry.includesSecrets,false);
assert.equal(telemetry.includesProviderCredentials,false);
assert.equal(Object.hasOwn(publicKnowledgeTelemetry(telemetry),'blockedReasons'),false);
assert.equal(createKnowledgeTelemetry({risk:'critical'}).risk,'critical');

const productionRule={...eligible,status:'production_rule'};
const revocation=evaluateKnowledgeRevocation(productionRule,{reason:'wrong-exact-sha',exactShaMismatch:true});
assert.equal(revocation.allowed,true);
assert.equal(revocation.historyPreserved,true);
assert.equal(revokeKnowledgeItem(productionRule,{reason:'wrong-exact-sha',exactShaMismatch:true}).status,'revoked');
assert.equal(quarantineKnowledgeItem(productionRule,'conflicting-runtime-evidence').status,'quarantined');
assert.equal(evaluateKnowledgeRevocation({status:'candidate'},{reason:'manual-revocation',evidencePassed:true}).allowed,false);

const knowledge=getLaneriqEngineeringKnowledge();
assert.equal(knowledge.learningContract,'laneriq-governed-experience-learning-v1');
assert.ok(engineeringKnowledgeForPrompt().includes('governed candidate lesson'));
assert.match(GENERATION_QUALITY_RULES,/EXPERIENCE LEARNING LOOP/i);
assert.match(GENERATION_QUALITY_RULES,/Production rules require explicit human approval/i);
assert.match(GENERATION_QUALITY_RULES,/model-only evidence can never support Production promotion/i);
assert.match(GENERATION_QUALITY_RULES,/Failed or regressing benchmarks do not teach a positive rule/i);
assert.match(GENERATION_QUALITY_RULES,/direct PII/i);
assert.match(GENERATION_QUALITY_RULES,/Time-sensitive knowledge must carry freshness evidence/i);
assert.match(GENERATION_QUALITY_RULES,/revoked or quarantined with history preserved/i);
assert.match(GENERATION_QUALITY_RULES,/Knowledge telemetry is aggregate and privacy-safe/i);

console.log('LANERIQ Knowledge Fabric v2 gate passed: scoped routing, privacy-safe experience capture, fail-closed evidence classification, source trust, incident/benchmark learning, immutable conflict resolution, freshness TTL, prompt budget, aggregate telemetry, revocation/quarantine and human+evidence Production promotion are locked.');
