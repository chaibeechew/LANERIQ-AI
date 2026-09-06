import { EVIDENCE_CLASSES } from "./cognitive-os.js";

export const LANERIQ_INTELLIGENCE_BENCHMARK_VERSION = "1.0.0";

export const INTELLIGENCE_DOMAINS = Object.freeze([
  "reasoning",
  "coding",
  "planning",
  "research",
  "agent-execution",
  "long-horizon-completion",
  "memory",
  "self-healing",
  "hallucination-resistance",
  "security",
  "tool-use",
  "multimodal",
  "app-building",
  "business-reasoning",
  "cost-optimization",
]);

const WEIGHTS = Object.freeze({
  reasoning: 1.2, coding: 1.1, planning: 1.2, research: 1.0,
  "agent-execution": 1.2, "long-horizon-completion": 1.2, memory: 0.9,
  "self-healing": 1.1, "hallucination-resistance": 1.3, security: 1.3,
  "tool-use": 1.0, multimodal: 0.8, "app-building": 1.1,
  "business-reasoning": 0.9, "cost-optimization": 0.9,
});

function text(value, max = 160) { return String(value ?? "").trim().slice(0, max); }
function score(value) { const n=Number(value); return Number.isFinite(n)?Math.min(100,Math.max(0,n)):0; }
function percentile(values,p){ if(!values.length)return 0; const s=[...values].sort((a,b)=>a-b); return s[Math.min(s.length-1,Math.max(0,Math.ceil((p/100)*s.length)-1))]; }

export function evaluateIntelligenceBenchmark(cases = [], input = {}) {
  if (!Array.isArray(cases)) throw new Error("LANERIQ_BENCHMARK_CASES_ARRAY_REQUIRED");
  const normalized = cases.map((item,index)=>{
    const domain=text(item?.domain,80);
    if(!INTELLIGENCE_DOMAINS.includes(domain)) throw new Error(`LANERIQ_BENCHMARK_UNKNOWN_DOMAIN:${domain||index}`);
    return {id:text(item?.id||`${domain}-${index+1}`,120),domain,score:score(item?.score),passed:item?.passed===true,evidenceClass:text(item?.evidenceClass||EVIDENCE_CLASSES.INTERNAL,40).toUpperCase(),externallyVerified:item?.externallyVerified===true};
  });
  const domainResults=INTELLIGENCE_DOMAINS.map(domain=>{const rows=normalized.filter(r=>r.domain===domain);const scores=rows.map(r=>r.score);return{domain,cases:rows.length,average:rows.length?scores.reduce((a,b)=>a+b,0)/rows.length:0,p10:percentile(scores,10),passRate:rows.length?rows.filter(r=>r.passed).length/rows.length:0,weight:WEIGHTS[domain]||1};});
  const populated=domainResults.filter(r=>r.cases>0);const totalWeight=populated.reduce((s,r)=>s+r.weight,0);const overall=totalWeight?populated.reduce((s,r)=>s+r.average*r.weight,0)/totalWeight:0;const passRate=normalized.length?normalized.filter(r=>r.passed).length/normalized.length:0;
  const productionEvidence=normalized.filter(r=>r.evidenceClass===EVIDENCE_CLASSES.PRODUCTION);const productionExternallyVerified=productionEvidence.length>0&&productionEvidence.every(r=>r.externallyVerified);
  const minimumCases=Number.isFinite(Number(input.minimumCases))?Math.max(1,Number(input.minimumCases)):30;const minimumOverall=Number.isFinite(Number(input.minimumOverall))?Number(input.minimumOverall):85;const minimumPassRate=Number.isFinite(Number(input.minimumPassRate))?Number(input.minimumPassRate):0.9;
  const releaseQualified=normalized.length>=minimumCases&&overall>=minimumOverall&&passRate>=minimumPassRate;
  return Object.freeze({benchmarkVersion:LANERIQ_INTELLIGENCE_BENCHMARK_VERSION,caseCount:normalized.length,domainResults,overall,passRate,thresholds:{minimumCases,minimumOverall,minimumPassRate},releaseQualified,productionEvidenceCount:productionEvidence.length,mayClaimProductionBenchmarkVerified:releaseQualified&&productionExternallyVerified,truthBoundary:"INTERNAL/SIMULATED/STATIC_PREFLIGHT results may improve engineering confidence but cannot be promoted into externally verified Production evidence."});
}
