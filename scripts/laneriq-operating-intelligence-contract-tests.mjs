import assert from 'node:assert/strict';
import {decideLaneriqExecutionPath,decisionCanExecute} from '../lib/ai/laneriq-decision-intelligence.js';
import {evaluateCapabilityTruth,canClaimCapability} from '../lib/ai/laneriq-capability-truth-graph.js';
import {buildGlobalCostPlan,detectCostAnomaly} from '../lib/ai/laneriq-global-cost-intelligence.js';
import {buildAutonomousPlanV2,nextPlannerSteps} from '../lib/ai/laneriq-autonomous-planner-v2.js';
import {buildSelfHealingPlanV2,evaluateRepairAction} from '../lib/ai/laneriq-self-healing-runtime-v2.js';
import {getLaneriqOperatingIntelligence,LANERIQ_OPERATING_INTELLIGENCE_INSTRUCTION} from '../lib/ai/laneriq-operating-intelligence.js';
import {getLaneriqEngineeringKnowledge,LANERIQ_ENGINEERING_AI_INSTRUCTION} from '../lib/ai/laneriq-engineering-knowledge.js';
import {GENERATION_QUALITY_RULES} from '../lib/buildStandards.js';

const zeroBlocked=decideLaneriqExecutionPath({mode:'zero',meteredProviderReady:true,paidAllowed:true});
assert.equal(zeroBlocked.path,'blocked');assert.equal(zeroBlocked.reason,'zero-free-spend-firewall');
const ownDevice=decideLaneriqExecutionPath({mode:'zero',ownDeviceAvailable:true,userDeviceOptIn:true,thermalState:'nominal'});
assert.equal(ownDevice.path,'own_device');assert.equal(ownDevice.mobileCrossUserComputeAllowed,false);
const hotDevice=decideLaneriqExecutionPath({mode:'zero',ownDeviceAvailable:true,userDeviceOptIn:true,thermalState:'serious',verifiedFreeRemote:true});
assert.equal(hotDevice.path,'verified_free_remote');
const unknownThermal=decideLaneriqExecutionPath({mode:'zero',ownDeviceAvailable:true,userDeviceOptIn:true,thermalState:'unknown',verifiedFreeRemote:true});
assert.equal(unknownThermal.path,'verified_free_remote');assert.equal(unknownThermal.unknownThermalAllowsOwnDevice,false);
const highRisk=decideLaneriqExecutionPath({deterministicAvailable:true,highRisk:true});assert.equal(decisionCanExecute(highRisk),false);assert.equal(decisionCanExecute(highRisk,{authorityApproved:true}),true);

const notLive=evaluateCapabilityTruth({evidence:{configured:true,codeReady:true,contractPassed:true,previewVerified:true,exactSha:true,productionProbePassed:true},releaseControllerApproved:false});
assert.equal(notLive.productionLive,false);assert.ok(notLive.blockers.includes('production-exact-sha-controller-evidence-missing'));
const live=evaluateCapabilityTruth({evidence:{configured:true,codeReady:true,contractPassed:true,previewVerified:true,exactSha:true,providerVerified:true,physicalDeviceVerified:true,productionProbePassed:true},requiresProvider:true,requiresPhysicalDevice:true,releaseControllerApproved:true});
assert.equal(live.stage,'production_live');assert.equal(canClaimCapability(live,'production_live'),true);

const zeroCost=buildGlobalCostPlan({mode:'zero',budgetUsd:100,estimatedPaidCostUsd:1,meteredProviderReady:true,paidAllowed:true});
assert.equal(zeroCost.hardStop,true);assert.equal(zeroCost.platformSpendAllowed,false);
const freePlan=buildGlobalCostPlan({mode:'zero',verifiedFreeRemote:true});assert.equal(freePlan.decision.path,'verified_free_remote');
assert.equal(detectCostAnomaly({baselineUsd:10,currentUsd:25,hardLimitUsd:100}).anomalous,true);

const plan=buildAutonomousPlanV2({goal:'Deploy a production app with database migration and publish to stores',platform:'mobile',mode:'zero'});
assert.equal(plan.risk,'high');assert.equal(plan.productionIntent,true);assert.ok(plan.executionOrder.indexOf('authority_gate')<plan.executionOrder.indexOf('implement_candidate'));assert.ok(plan.executionOrder.indexOf('exact_sha_production_evidence')<plan.executionOrder.indexOf('release_candidate'));
assert.deepEqual(nextPlannerSteps(plan,[]),['understand_goal']);

const heal=buildSelfHealingPlanV2({mode:'zero',signals:[{type:'cost_spike',severity:'high'},{type:'migration_mismatch',severity:'critical'},{type:'security_incident',severity:'critical'},{type:'provider_failure',severity:'high',verifiedFreeAvailable:false},{type:'provider_failure',severity:'high',verifiedFreeAvailable:true}]});
assert.equal(heal.destructiveAutoRepairAllowed,false);assert.equal(heal.privilegeEscalationAllowed,false);assert.equal(heal.productionPromotionAllowed,false);
const costRepair=heal.actions.find(x=>x.action==='pause_metered_work');assert.equal(evaluateRepairAction(costRepair).allowed,true);
const securityRepair=heal.actions.find(x=>x.action==='security_repair_proposal');assert.equal(evaluateRepairAction(securityRepair).allowed,false);assert.equal(evaluateRepairAction(securityRepair,{authorityApproved:true,evidenceReady:true}).allowed,true);
const providerRepairs=heal.actions.filter(x=>x.signalType==='provider_failure');assert.equal(providerRepairs[0].action,'degrade_noncritical_work');assert.equal(providerRepairs[1].action,'verified_free_failover');

const operating=getLaneriqOperatingIntelligence();assert.equal(Object.keys(operating.systems).length,5);assert.ok(operating.invariants.includes('decision-before-execution'));
const knowledge=getLaneriqEngineeringKnowledge();assert.equal(knowledge.operatingIntelligence.contract,'laneriq-operating-intelligence-v1');
for(const text of ['DECISION INTELLIGENCE','CAPABILITY TRUTH GRAPH','GLOBAL COST INTELLIGENCE','AUTONOMOUS PLANNER 2.0','SELF-HEALING RUNTIME 2.0'])assert.match(LANERIQ_OPERATING_INTELLIGENCE_INSTRUCTION,new RegExp(text));
assert.match(LANERIQ_ENGINEERING_AI_INSTRUCTION,/OPERATING INTELLIGENCE/i);
assert.match(GENERATION_QUALITY_RULES,/DECISION INTELLIGENCE/i);
assert.match(GENERATION_QUALITY_RULES,/Production LIVE requires exact-SHA Production probe evidence/i);
assert.match(GENERATION_QUALITY_RULES,/ZERO\/FREE is a hard spend firewall/i);
assert.match(GENERATION_QUALITY_RULES,/High-risk tasks insert an explicit authority gate/i);
assert.match(GENERATION_QUALITY_RULES,/Automatic healing is limited to reversible control actions/i);
assert.match(GENERATION_QUALITY_RULES,/Provider failover is automatic only when free-capacity evidence is actually verified/i);

console.log('LANERIQ Operating Intelligence gate passed: Decision Intelligence, Capability Truth Graph, Global Cost Intelligence, Autonomous Planner 2.0 and Self-Healing Runtime 2.0 are executable Knowledge-as-Code with fail-closed authority, cost, thermal, failover and LIVE truth boundaries.');
