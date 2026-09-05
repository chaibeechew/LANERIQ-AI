import {createKnowledgeRevision,validateLineage,chooseRollbackRevision,LANERIQ_KNOWLEDGE_LINEAGE_CONTRACT} from "./laneriq-knowledge-lineage.js";
import {buildKnowledgeDependencyGraph,detectKnowledgeCycles,impactedKnowledge,LANERIQ_KNOWLEDGE_DEPENDENCY_CONTRACT} from "./laneriq-knowledge-dependency-graph.js";
import {auditKnowledgeClaim,LANERIQ_KNOWLEDGE_CONSISTENCY_CONTRACT,LANERIQ_KNOWLEDGE_CONSISTENCY_INSTRUCTION} from "./laneriq-knowledge-consistency-auditor.js";
import {calibrateKnowledgeConfidence,LANERIQ_CONFIDENCE_CALIBRATION_CONTRACT,LANERIQ_CONFIDENCE_CALIBRATION_INSTRUCTION} from "./laneriq-confidence-calibration.js";
import {createDecisionRecord,canReproduceDecision,LANERIQ_DECISION_JOURNAL_CONTRACT} from "./laneriq-decision-journal.js";
import {evaluateGovernanceRollout,LANERIQ_GOVERNANCE_ROLLOUT_CONTRACT,LANERIQ_GOVERNANCE_ROLLOUT_INSTRUCTION} from "./laneriq-governance-rollout.js";
import {evaluateKnowledgeRollback,buildRollbackPlan,LANERIQ_KNOWLEDGE_ROLLBACK_CONTRACT,LANERIQ_KNOWLEDGE_ROLLBACK_INSTRUCTION} from "./laneriq-knowledge-rollback-controller.js";

export const LANERIQ_KNOWLEDGE_CONTROL_PLANE_CONTRACT="laneriq-knowledge-control-plane-v1";
export function getKnowledgeControlPlane(){return{contract:LANERIQ_KNOWLEDGE_CONTROL_PLANE_CONTRACT,systems:{lineage:LANERIQ_KNOWLEDGE_LINEAGE_CONTRACT,dependencyGraph:LANERIQ_KNOWLEDGE_DEPENDENCY_CONTRACT,consistency:LANERIQ_KNOWLEDGE_CONSISTENCY_CONTRACT,confidence:LANERIQ_CONFIDENCE_CALIBRATION_CONTRACT,decisionJournal:LANERIQ_DECISION_JOURNAL_CONTRACT,governanceRollout:LANERIQ_GOVERNANCE_ROLLOUT_CONTRACT,rollback:LANERIQ_KNOWLEDGE_ROLLBACK_CONTRACT},invariants:["immutable-version-history","dependency-impact-before-rule-change","claim-does-not-exceed-evidence","confidence-evidence-bounded","privacy-safe-decision-journal","shadow-canary-before-active","known-good-rollback-with-history"]};}
export function evaluateKnowledgeChange({revision={},revisions=[],nodes=[],edges=[],claim={},confidence={},rollout={},decision={}}={}){
  const next=createKnowledgeRevision(revision),lineage=validateLineage([...revisions,next]),graph=buildKnowledgeDependencyGraph({nodes,edges}),cycles=detectKnowledgeCycles(graph),impact=impactedKnowledge(graph,[next.ruleId]),consistency=auditKnowledgeClaim(claim),calibration=calibrateKnowledgeConfidence(confidence),rolloutDecision=evaluateGovernanceRollout(rollout),journal=createDecisionRecord(decision);
  const allowed=lineage.valid&&!cycles.hasCycle&&consistency.consistent&&rolloutDecision.allowed;
  return{contract:"laneriq-knowledge-change-evaluation-v1",allowed,lineage,cycles,impact,consistency,calibration,rollout:rolloutDecision,journal,reproducibility:canReproduceDecision(journal),rollbackCandidate:chooseRollbackRevision([...revisions,next],next.revisionId)};
}
export function evaluateKnowledgeRecovery(input={}){const decision=evaluateKnowledgeRollback(input);return{decision,plan:buildRollbackPlan(input)};}
export const LANERIQ_KNOWLEDGE_CONTROL_PLANE_INSTRUCTION=`
LANERIQ KNOWLEDGE CONTROL PLANE:
- Every durable rule change creates a new immutable revision with lineage; never mutate history in place.
- Analyze dependency impact and reject cycles before activating rule changes.
- ${LANERIQ_KNOWLEDGE_CONSISTENCY_INSTRUCTION}
- ${LANERIQ_CONFIDENCE_CALIBRATION_INSTRUCTION}
- Decisions keep a privacy-safe reproducibility journal without raw prompt/user content/secrets.
- ${LANERIQ_GOVERNANCE_ROLLOUT_INSTRUCTION}
- ${LANERIQ_KNOWLEDGE_ROLLBACK_INSTRUCTION}
`;
