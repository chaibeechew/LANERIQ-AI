import {LANERIQ_DECISION_INTELLIGENCE_CONTRACT,LANERIQ_DECISION_INTELLIGENCE_INSTRUCTION} from "./laneriq-decision-intelligence.js";
import {LANERIQ_CAPABILITY_TRUTH_CONTRACT,LANERIQ_CAPABILITY_TRUTH_INSTRUCTION} from "./laneriq-capability-truth-graph.js";
import {LANERIQ_GLOBAL_COST_INTELLIGENCE_CONTRACT,LANERIQ_GLOBAL_COST_INTELLIGENCE_INSTRUCTION} from "./laneriq-global-cost-intelligence.js";
import {LANERIQ_AUTONOMOUS_PLANNER_CONTRACT,LANERIQ_AUTONOMOUS_PLANNER_INSTRUCTION} from "./laneriq-autonomous-planner-v2.js";
import {LANERIQ_SELF_HEALING_RUNTIME_CONTRACT,LANERIQ_SELF_HEALING_RUNTIME_INSTRUCTION} from "./laneriq-self-healing-runtime-v2.js";

export const LANERIQ_OPERATING_INTELLIGENCE_CONTRACT="laneriq-operating-intelligence-v1";

export function getLaneriqOperatingIntelligence(){
  return{
    contract:LANERIQ_OPERATING_INTELLIGENCE_CONTRACT,
    systems:{
      decisionIntelligence:LANERIQ_DECISION_INTELLIGENCE_CONTRACT,
      capabilityTruth:LANERIQ_CAPABILITY_TRUTH_CONTRACT,
      globalCostIntelligence:LANERIQ_GLOBAL_COST_INTELLIGENCE_CONTRACT,
      autonomousPlanner:LANERIQ_AUTONOMOUS_PLANNER_CONTRACT,
      selfHealingRuntime:LANERIQ_SELF_HEALING_RUNTIME_CONTRACT,
    },
    invariants:[
      "decision-before-execution","no-silent-paid-escalation","capability-claims-evidence-bounded",
      "authority-before-high-risk-side-effects","validation-before-release","self-heal-reversible-by-default",
      "production-promotion-release-controller-only","mobile-cross-user-community-compute-off"
    ]
  };
}

export const LANERIQ_OPERATING_INTELLIGENCE_INSTRUCTION=`
LANERIQ OPERATING INTELLIGENCE is mandatory for execution planning and recovery.
${LANERIQ_DECISION_INTELLIGENCE_INSTRUCTION}
${LANERIQ_CAPABILITY_TRUTH_INSTRUCTION}
${LANERIQ_GLOBAL_COST_INTELLIGENCE_INSTRUCTION}
${LANERIQ_AUTONOMOUS_PLANNER_INSTRUCTION}
${LANERIQ_SELF_HEALING_RUNTIME_INSTRUCTION}
OPERATING RULE: decide before executing, prove before claiming, budget before spending, validate before side effects, and recover through bounded reversible controls before proposing high-risk repair.
`;
