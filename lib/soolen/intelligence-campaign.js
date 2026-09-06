import crypto from "node:crypto";
import { INTELLIGENCE_DOMAINS, evaluateIntelligenceBenchmark } from "./intelligence-benchmark.js";
import { EVIDENCE_CLASSES } from "./cognitive-os.js";

export const INTELLIGENCE_CAMPAIGN_VERSION="1.0.0";

function text(value,max=1000){return String(value??"").trim().slice(0,max);}
function sha(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}

export function createBenchmarkCampaign(input={}){
  const campaignId=text(input.campaignId||`lib-${Date.now()}`,120);
  const evidenceClass=text(input.evidenceClass||EVIDENCE_CLASSES.INTERNAL,40).toUpperCase();
  const casesPerDomain=Math.max(1,Math.min(100,Number(input.casesPerDomain)||2));
  const cases=[];
  for(const domain of INTELLIGENCE_DOMAINS){
    for(let i=1;i<=casesPerDomain;i++) cases.push({id:`${campaignId}:${domain}:${i}`,domain,promptClass:`${domain}-case-${i}`,evidenceClass,status:"pending"});
  }
  return Object.freeze({version:INTELLIGENCE_CAMPAIGN_VERSION,campaignId,evidenceClass,casesPerDomain,caseCount:cases.length,cases,externalVerificationRequired:evidenceClass===EVIDENCE_CLASSES.PRODUCTION,maySelfPromoteEvidence:false});
}

export function recordCampaignResult(campaign,result={}){
  if(!campaign?.campaignId||!Array.isArray(campaign?.cases))throw new Error("LANERIQ_CAMPAIGN_REQUIRED");
  const id=text(result.id,240);const target=campaign.cases.find(item=>item.id===id);if(!target)throw new Error("LANERIQ_CAMPAIGN_CASE_NOT_FOUND");
  const score=Math.max(0,Math.min(100,Number(result.score)||0));
  const observedEvidenceClass=text(result.evidenceClass||target.evidenceClass,40).toUpperCase();
  if(observedEvidenceClass!==target.evidenceClass)throw new Error("LANERIQ_CAMPAIGN_EVIDENCE_CLASS_DRIFT");
  const receipt={id:target.id,domain:target.domain,score,passed:result.passed===true,evidenceClass:observedEvidenceClass,externallyVerified:result.externallyVerified===true,durationMs:Math.max(0,Number(result.durationMs)||0),resultDigest:sha(JSON.stringify({id:target.id,score,passed:result.passed===true,observedEvidenceClass,externallyVerified:result.externallyVerified===true,notes:text(result.notes,1000)}))};
  const results=[...(Array.isArray(campaign.results)?campaign.results.filter(x=>x.id!==target.id):[]),receipt];
  return Object.freeze({...campaign,results,completedCount:results.length});
}

export function finalizeBenchmarkCampaign(campaign,input={}){
  const results=Array.isArray(campaign?.results)?campaign.results:[];
  const benchmark=evaluateIntelligenceBenchmark(results,{minimumCases:input.minimumCases||campaign?.caseCount||30,minimumOverall:input.minimumOverall??85,minimumPassRate:input.minimumPassRate??0.9});
  const complete=results.length===campaign.caseCount;
  return Object.freeze({version:INTELLIGENCE_CAMPAIGN_VERSION,campaignId:campaign.campaignId,complete,benchmark,campaignDigest:sha(JSON.stringify({campaignId:campaign.campaignId,evidenceClass:campaign.evidenceClass,results:results.map(r=>r.resultDigest)})),mayClaimProductionVerified:complete&&benchmark.mayClaimProductionBenchmarkVerified});
}
