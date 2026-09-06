import assert from 'node:assert/strict';
import {createKnowledgeRevision,validateLineage,chooseRollbackRevision} from '../lib/ai/laneriq-knowledge-lineage.js';
import {buildKnowledgeDependencyGraph,detectKnowledgeCycles,impactedKnowledge} from '../lib/ai/laneriq-knowledge-dependency-graph.js';
import {auditKnowledgeClaim} from '../lib/ai/laneriq-knowledge-consistency-auditor.js';
import {calibrateKnowledgeConfidence} from '../lib/ai/laneriq-confidence-calibration.js';
import {createDecisionRecord,canReproduceDecision} from '../lib/ai/laneriq-decision-journal.js';
import {evaluateGovernanceRollout} from '../lib/ai/laneriq-governance-rollout.js';
import {evaluateKnowledgeRollback,buildRollbackPlan} from '../lib/ai/laneriq-knowledge-rollback-controller.js';
import {evaluateKnowledgeChange,getKnowledgeControlPlane} from '../lib/ai/laneriq-knowledge-control-plane.js';
import {getLaneriqOperatingIntelligence,LANERIQ_OPERATING_INTELLIGENCE_INSTRUCTION} from '../lib/ai/laneriq-operating-intelligence.js';
import {GENERATION_QUALITY_RULES} from '../lib/buildStandards.js';

const r1=createKnowledgeRevision({ruleId:'zero-free-firewall',version:1,status:'production_rule',exactSha:'abc123',evidenceRefs:['contract:cost','runtime:cost']});
const r2=createKnowledgeRevision({ruleId:'zero-free-firewall',version:2,parentRevisionIds:[r1.revisionId],status:'candidate',changeSummary:'tighten free-capacity admission'});
assert.equal(validateLineage([r1,r2]).valid,true);assert.equal(chooseRollbackRevision([r1,r2],r2.revisionId).revisionId,r1.revisionId);
const badParent=createKnowledgeRevision({ruleId:'x',version:2,parentRevisionIds:['x@1']});assert.equal(validateLineage([badParent]).valid,false);

const graph=buildKnowledgeDependencyGraph({nodes:['cost','planner','release'],edges:[{from:'planner',to:'cost'},{from:'release',to:'planner'}]});assert.equal(detectKnowledgeCycles(graph).hasCycle,false);const impact=impactedKnowledge(graph,['cost']);assert.ok(impact.impacted.includes('planner'));assert.ok(impact.impacted.includes('release'));
const cyclic=buildKnowledgeDependencyGraph({nodes:['a','b'],edges:[{from:'a',to:'b'},{from:'b',to:'a'}]});assert.equal(detectKnowledgeCycles(cyclic).hasCycle,true);

const overclaim=auditKnowledgeClaim({claim:'This capability is Production LIVE and guaranteed',evidenceStage:'preview_verified',evidenceCount:1});assert.equal(overclaim.consistent,false);assert.ok(overclaim.issues.includes('live-claim-exceeds-evidence-stage'));
const verified=auditKnowledgeClaim({claim:'Production live capability',evidenceStage:'production_live',evidenceCount:3});assert.equal(verified.mayUseForProduction,true);

const weak=calibrateKnowledgeConfidence({sourceTrust:.9,evidenceCount:3,independentEvidenceCount:2,stale:true,exactSha:true,runtimeVerified:true});assert.equal(weak.productionEligible,false);
const strong=calibrateKnowledgeConfidence({sourceTrust:1,evidenceCount:4,independentEvidenceCount:3,stale:false,contradictionCount:0,exactSha:true,runtimeVerified:true});assert.equal(strong.band,'high');assert.equal(strong.productionEligible,true);assert.equal(strong.modelConfidenceAuthoritative,false);

const journal=createDecisionRecord({decisionType:'execution_path',selectedPath:'verified_free_remote',reasonCodes:['zero-mode','local-unavailable'],knowledgeDomains:['cost_governance','ai_orchestration'],exactSha:'abc123',authority:'policy'});assert.equal(journal.includesRawPrompt,false);assert.equal(journal.includesUserContent,false);assert.equal(journal.includesSecrets,false);assert.equal(canReproduceDecision(journal).reproducible,true);

const skip=evaluateGovernanceRollout({currentStage:'disabled',targetStage:'active',contractPassed:true,runtimePassed:true,reviewerApproved:true,exactShaVerified:true,canarySampleSize:100});assert.equal(skip.allowed,false);assert.ok(skip.blockers.includes('stage-skip-forbidden'));
const active=evaluateGovernanceRollout({currentStage:'canary',targetStage:'active',contractPassed:true,runtimePassed:true,reviewerApproved:true,exactShaVerified:true,canarySampleSize:25,regressionCount:0});assert.equal(active.allowed,true);assert.equal(active.automaticPromotion,false);
const regression=evaluateGovernanceRollout({currentStage:'shadow',targetStage:'canary',contractPassed:true,runtimePassed:true,regressionCount:1});assert.equal(regression.allowed,false);

const rollback=evaluateKnowledgeRollback({currentRevision:r2,targetRevision:r1,reason:'runtime-regression',productionActive:true,authorityApproved:false});assert.equal(rollback.allowed,false);assert.ok(rollback.blockers.includes('production-rollback-authority-required'));
const rollbackApproved=evaluateKnowledgeRollback({currentRevision:r2,targetRevision:r1,reason:'runtime-regression',productionActive:true,authorityApproved:true});assert.equal(rollbackApproved.allowed,true);const rollbackPlan=buildRollbackPlan({currentRevision:r2,targetRevision:r1,reason:'runtime-regression',productionActive:true,authorityApproved:true});assert.ok(rollbackPlan.steps.includes('quarantine-regressed-revision'));assert.equal(rollbackPlan.requiresPostRollbackVerification,true);

const control=getKnowledgeControlPlane();assert.equal(Object.keys(control.systems).length,7);assert.ok(control.invariants.includes('shadow-canary-before-active'));
const change=evaluateKnowledgeChange({revision:{ruleId:'planner-budget',version:2,parentRevisionIds:['planner-budget@1'],status:'candidate'},revisions:[createKnowledgeRevision({ruleId:'planner-budget',version:1,status:'validated'})],nodes:['planner-budget','release'],edges:[{from:'release',to:'planner-budget'}],claim:{claim:'Bound planner fan-out with deterministic validation',evidenceStage:'contract_tested',evidenceCount:2},confidence:{sourceTrust:.95,evidenceCount:2,independentEvidenceCount:1},rollout:{currentStage:'disabled',targetStage:'shadow',contractPassed:true},decision:{decisionType:'knowledge_change',selectedPath:'shadow',reasonCodes:['new-candidate'],knowledgeDomains:['ai_orchestration']}});assert.equal(change.allowed,true);assert.ok(change.impact.impacted.includes('release'));

const operating=getLaneriqOperatingIntelligence();assert.equal(operating.contract,'laneriq-operating-intelligence-v2');assert.equal(operating.systems.knowledgeControlPlane,'laneriq-knowledge-control-plane-v1');
for(const phrase of ['immutable revision','dependency impact','confidence is bounded','privacy-safe reproducibility journal','disabled -> shadow -> canary -> active','known-good older validated revision'])assert.match(LANERIQ_OPERATING_INTELLIGENCE_INSTRUCTION,new RegExp(phrase,'i'));
assert.match(GENERATION_QUALITY_RULES,/KNOWLEDGE CONTROL PLANE/i);assert.match(GENERATION_QUALITY_RULES,/No automatic Production activation/i);assert.match(GENERATION_QUALITY_RULES,/history is preserved/i);

console.log('LANERIQ Knowledge Control Plane v4.5 gate passed: immutable lineage, dependency impact, consistency auditing, evidence-bounded confidence, privacy-safe decision replay, staged rollout and known-good rollback are executable and fail closed.');
