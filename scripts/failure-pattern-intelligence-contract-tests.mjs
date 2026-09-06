import assert from "node:assert/strict";
import {
  rankFailureRecoveryStrategies,
  selectFailureRecoveryStrategy,
  summarizeFailureRecoveryPlan,
  buildFailureRecoveryStrategyInstruction,
  FAILURE_PATTERN_INTELLIGENCE_POLICY,
} from "../lib/generator/failure-pattern-intelligence.js";
import { buildGenerationQualityDiagnostics,buildQualityGateRescueInstruction } from "../lib/generator/quality-gate-rescue.js";

const routeDiagnostics={
  failedGateIds:["execution","self_test"],
  failedGates:[
    {id:"execution",issues:["Navigation target /checkout does not resolve to a declared route"]},
    {id:"self_test",issues:["Duplicate page route detected"]},
  ],
  preflight:{riskIds:["route_graph","data_workflow"]},
};
const routeRanked=rankFailureRecoveryStrategies(routeDiagnostics);
assert.equal(routeRanked[0].strategyId,"route_graph_repair");
assert.ok(routeRanked[0].relevanceScore>=routeRanked[1].relevanceScore);
assert.ok(routeRanked[0].signalIds.includes("gate:execution"));
assert.ok(routeRanked[0].signalIds.includes("preflight:route_graph"));

const securityDiagnostics={
  failedGateIds:["execution","self_heal"],
  failedGates:[{id:"execution",issues:["Owner permission and authorization boundary is incomplete"]}],
  preflight:{riskIds:["security_permissions"]},
};
assert.equal(rankFailureRecoveryStrategies(securityDiagnostics)[0].strategyId,"security_boundary_repair");

const externalDiagnostics={
  failedGateIds:["critic_contract"],
  failedGates:[{id:"critic_contract",issues:["External payment provider success was claimed without evidence"]}],
  preflight:{riskIds:["external_integration"]},
};
assert.equal(rankFailureRecoveryStrategies(externalDiagnostics)[0].strategyId,"external_truth_repair");

const gameDiagnostics={
  failedGateIds:["execution"],
  failedGates:[{id:"execution",issues:["Multiplayer combat state and authoritative match recovery are incomplete"]}],
  preflight:{riskIds:["game_runtime","realtime_state"]},
};
assert.equal(rankFailureRecoveryStrategies(gameDiagnostics)[0].strategyId,"game_runtime_repair");

const compositeDiagnostics={
  failedGateIds:["execution","self_heal"],
  failedGates:[
    {id:"execution",issues:["Missing route target and workflow state"]},
    {id:"self_heal",issues:["Accessibility contrast and retry fallback are incomplete"]},
  ],
  preflight:{riskIds:["route_graph","data_workflow","realtime_state"]},
};
const first=selectFailureRecoveryStrategy(compositeDiagnostics,1);
const second=selectFailureRecoveryStrategy(compositeDiagnostics,2);
assert.notEqual(first.strategyId,second.strategyId,"Successive rescue attempts should rotate through ranked strategies when multiple patterns exist.");
assert.equal(first.rank,1);
assert.equal(second.rank,2);

const summary=summarizeFailureRecoveryPlan({
  ...securityDiagnostics,
  failedGates:[{id:"execution",issues:["private owner email owner@example.com and token sk-secret-value"]}],
});
assert.equal(summary.schemaVersion,1);
assert.equal(summary.privacySafe,true);
assert.equal(summary.storesRawPrompt,false);
assert.equal(summary.storesRawFailureText,false);
assert.equal(summary.predictsRecoveryProbability,false);
assert.ok(!JSON.stringify(summary).includes("owner@example.com"));
assert.ok(!JSON.stringify(summary).includes("sk-secret-value"));
assert.ok(summary.ranked.length>=1&&summary.ranked.length<=4);

const strategyInstruction=buildFailureRecoveryStrategyInstruction(routeDiagnostics,1,2);
assert.match(strategyInstruction,/SOOLEN FAILURE-PATTERN RECOVERY STRATEGY 1\/2/);
assert.match(strategyInstruction,/Route graph repair \[route_graph_repair\]/);
assert.match(strategyInstruction,/not a recovery probability/);
assert.match(strategyInstruction,/Do not weaken any deterministic verification/);

const generatedDiagnostics=buildGenerationQualityDiagnostics({
  report:{
    passed:false,
    selfTest:{ok:false,errors:["Duplicate page route detected"]},
    execution:{ok:false,errors:["Navigation target does not resolve to declared route"]},
    selfHeal:{passed:true,issues:[]},
  },
  review:{passed:true,failed:[]},
  stage:"targeted-rescue-exhausted",
  attempts:1,
  maxAttempts:2,
});
assert.equal(generatedDiagnostics.recoveryPlan.schemaVersion,1);
assert.equal(generatedDiagnostics.recoveryPlan.predictsRecoveryProbability,false);
assert.ok(generatedDiagnostics.recoveryPlan.ranked.some(item=>item.strategyId==="route_graph_repair"));

const rescueInstruction=buildQualityGateRescueInstruction({...generatedDiagnostics,preflight:{riskIds:["route_graph"]}},1,2);
assert.match(rescueInstruction,/FAILURE-PATTERN RECOVERY STRATEGY/);
assert.match(rescueInstruction,/route_graph_repair/);
assert.match(rescueInstruction,/FAILING GATES:/);

const fallback=rankFailureRecoveryStrategies({failedGateIds:[],failedGates:[],preflight:{riskIds:[]}});
assert.equal(fallback[0].strategyId,"specification_consistency_repair");
assert.equal(FAILURE_PATTERN_INTELLIGENCE_POLICY.currentRunSignalsOnly,true);
assert.equal(FAILURE_PATTERN_INTELLIGENCE_POLICY.zeroPaidEmbeddingDependency,true);
assert.equal(FAILURE_PATTERN_INTELLIGENCE_POLICY.zeroVectorDatabaseDependency,true);
assert.equal(FAILURE_PATTERN_INTELLIGENCE_POLICY.noDedicatedServerRequired,true);
assert.equal(FAILURE_PATTERN_INTELLIGENCE_POLICY.recoveryProbabilityClaim,false);

console.log("✓ Failure-pattern intelligence ranks repair strategies from current-run gate, issue-pattern and preflight signals");
console.log("✓ Rescue attempts rotate through ranked strategies instead of using one generic repair prompt");
console.log("✓ Recovery summaries keep raw prompt/failure text out and never claim a recovery probability");
console.log("✓ Security, external-integration, route/workflow and game-runtime failures select materially different recovery strategies");
