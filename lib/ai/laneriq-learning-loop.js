import {createExperienceCandidate} from "./laneriq-experience-ledger.js";
import {evaluateKnowledgePromotion} from "./laneriq-knowledge-promotion.js";

function clean(value,max=900){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}

export function learnFromIncident({domain="security",title="Incident lesson",rootCause="",prevention="",severity="high",evidence=[]}={}){
  const lesson=`Root cause: ${clean(rootCause,360)}. Prevention: ${clean(prevention,520)}.`;
  return createExperienceCandidate({domain,title,lesson,source:"incident",risk:severity,evidence:[{kind:"incident",ref:"bounded-incident-record",passed:true,independent:false},...evidence]});
}

export function learnFromBenchmark({domain="product_generation",title="Benchmark lesson",hypothesis="",baselineScore=0,candidateScore=0,regressionCount=0,evidence=[]}={}){
  const baseline=number(baselineScore),candidate=number(candidateScore),delta=candidate-baseline,regressions=Math.max(0,Math.floor(number(regressionCount)));
  const materiallyBetter=delta>=1&&regressions===0;
  const lesson=`Hypothesis: ${clean(hypothesis,560)}. Benchmark delta: ${delta.toFixed(2)}; regressions: ${regressions}. ${materiallyBetter?"Candidate improved the measured target without recorded regression.":"Candidate is not eligible for positive learning from this benchmark."}`;
  const candidateLesson=createExperienceCandidate({domain,title,lesson,source:"benchmark",risk:"normal",evidence:[{kind:"benchmark",ref:"bounded-benchmark-result",passed:materiallyBetter,independent:true},...evidence]});
  return{candidate:candidateLesson,materiallyBetter,delta,regressionCount:regressions};
}

export function assessLearningOutcome(candidate,options={}){
  return{contract:"laneriq-learning-outcome-v1",candidateId:candidate?.id||"",promotion:evaluateKnowledgePromotion(candidate,options),writesPermanentKnowledge:false,requiresExplicitPromotion:true};
}

export const LANERIQ_LEARNING_LOOP_INSTRUCTION=`
LANERIQ EXPERIENCE LEARNING LOOP:
- Route each task to the smallest relevant engineering knowledge set; do not flood prompts with unrelated domains.
- Bound and deduplicate knowledge packets so prompt growth cannot silently become a latency/cost problem.
- Incidents, benchmarks, contract failures and runtime observations may create bounded candidate lessons, never permanent rules directly.
- Candidate lessons must exclude raw secrets, credentials, unrestricted private prompts, direct PII and cross-customer private data.
- Grade evidence by source trust; model suggestions, community reports and user feedback may inspire investigation but cannot independently establish Production truth.
- Production knowledge needs multiple high-trust sources; model-only evidence can never support Production promotion.
- New candidate lessons must not override immutable security, owner-scope, no-silent-spend, mobile no-cross-user-compute, Agent-authority or CODE-vs-LIVE boundaries.
- Time-sensitive knowledge must carry freshness evidence; stale security, cloud, cost or Production knowledge requires refresh before Production use.
- A deterministic contract plus evidence diversity is required before a lesson can become validated knowledge.
- Production rules require explicit human approval, independent exact-SHA Production evidence, and independent runtime/benchmark/physical-device evidence.
- Critical-risk lessons additionally require manual-review evidence.
- Failed or regressing benchmarks do not teach a positive rule.
- Contradicted validated/Production knowledge is revoked or quarantined with history preserved; never silently rewrite evidence history.
- Knowledge telemetry is aggregate and privacy-safe: no raw prompt, user content, secrets or provider credentials.
- Learning must preserve existing security, ownership, cost, mobile thermal and CODE-vs-LIVE truth boundaries.
`;
