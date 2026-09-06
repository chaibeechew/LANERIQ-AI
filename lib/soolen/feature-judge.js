import { EVIDENCE_CLASSES, evaluateCognitiveResult } from "./cognitive-os.js";

export const FEATURE_JUDGE_VERSION="1.0.0";

export const FEATURE_JUDGE_PROFILES=Object.freeze({
  "app-builder":Object.freeze(["testsPassed","securityPassed","ownershipRlsPassed","outputVerified","previewVerified"]),
  "malware-defense":Object.freeze(["testsPassed","securityPassed","deterministicDecisionPreserved","ransomwareProtectionVerified","remediationVerified","falsePositiveGuardPassed"]),
  "ai-image":Object.freeze(["testsPassed","securityPassed","providerOutputValidated","safetyPassed","qualityJudgePassed","durableCaptureVerified"]),
  "ai-video":Object.freeze(["testsPassed","securityPassed","rendererOutputValidated","safetyPassed","qualityJudgePassed","durableCaptureVerified"]),
  "production-release":Object.freeze(["testsPassed","securityPassed","supabaseVerified","apiVerified","browserVerified","malwareVerified","appBuilderVerified","uiVerified","cognitiveDurabilityVerified","realProviderBenchmarkVerified","exactShaVerified"]),
});

function key(domain){const value=String(domain||"").trim().toLowerCase();if(!FEATURE_JUDGE_PROFILES[value])throw new Error(`LANERIQ_FEATURE_JUDGE_DOMAIN_UNSUPPORTED:${value||"empty"}`);return value;}
function normalizeEvidence(value){const raw=String(value||EVIDENCE_CLASSES.INTERNAL).trim().toUpperCase();return Object.values(EVIDENCE_CLASSES).includes(raw)?raw:EVIDENCE_CLASSES.INTERNAL;}

export function evaluateFeatureJudge(domain,input={}){
  const feature=key(domain);const required=FEATURE_JUDGE_PROFILES[feature];
  const checks={};for(const name of required)checks[name]=input[name]===true;
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  const observedEvidenceClass=normalizeEvidence(input.observedEvidenceClass);
  const requiredEvidenceClass=normalizeEvidence(input.requiredEvidenceClass|| (feature==="production-release"?EVIDENCE_CLASSES.PRODUCTION:EVIDENCE_CLASSES.INTERNAL));
  const cognitive=evaluateCognitiveResult({
    completed:input.completed!==false,
    testsPassed:input.testsPassed===true,
    securityPassed:input.securityPassed===true,
    privacyPassed:input.privacyPassed!==false,
    outputVerified:input.outputVerified===true||feature==="malware-defense"||feature==="production-release",
    requiredEvidenceClass,observedEvidenceClass,
    minimumConfidence:input.minimumConfidence??(feature==="production-release"?.9:.72),
    critical:feature==="production-release"||input.critical===true,
    risk:feature==="production-release"?"critical":input.risk,
    uncertainty:input.uncertainty||{evidenceCoverage:input.evidenceCoverage??.8,sourceAgreement:input.sourceAgreement??.8,testCoverage:input.testCoverage??.8,evidenceClass:observedEvidenceClass,contradictionCount:input.contradictionCount??0,unknownCount:input.unknownCount??0,externalVerificationRequired:input.externalVerificationRequired===true},
  });
  const accepted=failed.length===0&&cognitive.accepted;
  return Object.freeze({version:FEATURE_JUDGE_VERSION,domain:feature,accepted,action:accepted?"accept":feature==="production-release"?"block-release":"repair-or-escalate",checks:Object.freeze(checks),failed:Object.freeze([...new Set([...failed,...cognitive.failed])]),cognitive,observedEvidenceClass,requiredEvidenceClass,mayLowerSafetyGates:false,mayOverrideDeterministicEnforcement:false,mayClaimProductionVerified:accepted&&feature==="production-release"&&cognitive.mayClaimProductionVerified});
}

export function summarizeFeatureJudges(results={}){
  const domains=Object.keys(FEATURE_JUDGE_PROFILES);const rows=domains.map(domain=>({domain,accepted:results?.[domain]?.accepted===true,failed:[...(results?.[domain]?.failed||[])]}));
  return Object.freeze({version:FEATURE_JUDGE_VERSION,allVerified:rows.every(r=>r.accepted),rows:Object.freeze(rows),productionReleaseVerified:results?.["production-release"]?.mayClaimProductionVerified===true});
}
