import crypto from "node:crypto";

export const LANERIQ_COLLECTIVE_INTELLIGENCE_VERSION="0.1.0";

function text(value,max=800){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}

export const INSTITUTION_ROLES=Object.freeze([
  "proposer","critic","evidence","security","economics","operations","minority-report","judge","human-steward"
]);

export function createAgentInstitution(input={}){
  const goal=text(input.goal,1200);if(!goal)throw new Error("LANERIQ_AGENT_INSTITUTION_GOAL_REQUIRED");
  const maxAgents=Math.max(3,Math.min(1000,Math.round(Number(input.maxAgents)||12)));
  const institution={
    schemaVersion:"1",
    goal,
    maxAgents,
    roles:INSTITUTION_ROLES,
    decisionRule:text(input.decisionRule||"evidence-weighted-supermajority-with-minority-report",120),
    quorum:Math.min(maxAgents,Math.max(2,Math.round(Number(input.quorum)||Math.ceil(maxAgents*.6)))),
    blindIndependentFirstPass:true,
    providerDiversityPreferred:true,
    correlatedFailureBudget:Math.min(1,Math.max(0,Number(input.correlatedFailureBudget)||.2)),
    dissentMustBePreserved:true,
    securityVetoEnabled:true,
    humanVetoForCritical:true,
    agentMaySelfGrantAuthority:false,
    agentMayHideMinorityReport:false,
  };
  return freeze({...institution,institutionDigest:digest(institution)});
}

export function evaluateCollectiveDecision(input={}){
  const ballots=Array.isArray(input.ballots)?input.ballots.slice(0,1000):[];
  const eligible=ballots.filter(b=>b&&typeof b.decision==="string"&&Number.isFinite(Number(b.confidence)));
  const groups=new Map();
  for(const ballot of eligible){
    const key=text(ballot.decision,200);const weight=Math.max(0,Math.min(1,Number(ballot.confidence)))*(ballot.independentEvidence===true?1:.65);
    const current=groups.get(key)||{decision:key,weight:0,count:0,evidenceIndependent:0};current.weight+=weight;current.count+=1;if(ballot.independentEvidence===true)current.evidenceIndependent+=1;groups.set(key,current);
  }
  const ranked=[...groups.values()].sort((a,b)=>b.weight-a.weight);
  const winner=ranked[0]||null;const runnerUp=ranked[1]||null;
  const securityVeto=eligible.some(b=>b.role==="security"&&b.veto===true);
  const unresolvedDissent=eligible.some(b=>b.role==="minority-report"&&b.materialRisk===true&&b.resolved!==true);
  const diversityCount=new Set(eligible.map(b=>text(b.providerClass||b.agentClass,80)).filter(Boolean)).size;
  const accepted=Boolean(winner)&&!securityVeto&&!unresolvedDissent&&eligible.length>=Math.max(2,Number(input.minimumBallots)||3)&&diversityCount>=Math.max(1,Number(input.minimumDiversity)||1);
  return freeze({
    version:LANERIQ_COLLECTIVE_INTELLIGENCE_VERSION,
    accepted,
    winner,
    runnerUp,
    securityVeto,
    unresolvedDissent,
    ballotCount:eligible.length,
    diversityCount,
    minorityReports:Object.freeze(eligible.filter(b=>b.role==="minority-report").map(b=>({decision:text(b.decision,200),materialRisk:b.materialRisk===true,resolved:b.resolved===true}))),
    action:accepted?"eligible-for-next-gate":"debate-or-escalate",
    mayBypassHumanCriticalApproval:false,
  });
}
