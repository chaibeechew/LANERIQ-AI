export const APP_BUILDER_LIVE_VERIFICATION_VERSION="1.0.0";
export const APP_BUILDER_LIVE_STATES=Object.freeze(["CODE_ONLY","CI_VERIFIED","PREVIEW_VERIFIED","LIVE_NOT_VERIFIED","LIVE_VERIFIED"]);
const SHA=/^[a-f0-9]{40}$/i;

function yes(value){return value===true;}
function exactSha(evidence){const values=[evidence?.gitSha,evidence?.deploymentSha,evidence?.runtimeSha];return values.every(value=>SHA.test(String(value||"")))&&new Set(values.map(value=>String(value).toLowerCase())).size===1;}
function browserJourneyPassed(browser={}){return ["home","plan","generate","preview","modify","save","publish"].every(step=>yes(browser?.[step]));}
function providerPassed(provider={}){return provider.required!==true||(provider.realRequest===true&&provider.success===true&&provider.mock!==true&&provider.providerId&&provider.receiptDigest);}
function databasePassed(database={}){return database.required!==true||(database.production===true&&database.migrationsApplied===true&&database.rlsVerified===true&&database.writeReadVerified===true);}
function accessibilityPassed(a11y={}){return yes(a11y.keyboard)&&yes(a11y.visibleFocus)&&yes(a11y.reflow320)&&yes(a11y.touchTargets)&&yes(a11y.reducedMotion);}
function runtimeHealthPassed(runtime={}){return Number(runtime.criticalConsoleErrors||0)===0&&Number(runtime.criticalNetworkFailures||0)===0&&yes(runtime.publicUrlFetch)&&/^https:\/\//i.test(String(runtime.publicUrl||""));}
function securityPassed(security={}){return yes(security.appBuilderGate)&&yes(security.authzBoundary)&&yes(security.noSecretExposure)&&(security.uploadsPresent!==true||yes(security.malwareGate));}

export function evaluateAppBuilderLiveVerification(evidence={}){
  const checks=Object.freeze({
    exactShaConvergence:exactSha(evidence),
    productionDeployment:evidence.deploymentTarget==="production",
    ciExactHead:yes(evidence.ci?.exactHead)&&yes(evidence.ci?.success),
    browserJourney:browserJourneyPassed(evidence.browser),
    provider:providerPassed(evidence.provider),
    database:databasePassed(evidence.database),
    accessibility:accessibilityPassed(evidence.accessibility),
    runtimeHealth:runtimeHealthPassed(evidence.runtime),
    security:securityPassed(evidence.security),
    releaseControl:yes(evidence.releaseControl?.passed)&&yes(evidence.releaseControl?.humanApproved),
  });
  const allProduction=Object.values(checks).every(Boolean);
  const previewVerified=checks.exactShaConvergence&&evidence.deploymentTarget==="preview"&&checks.ciExactHead&&checks.accessibility&&checks.runtimeHealth;
  let state="CODE_ONLY";
  if(evidence.deploymentTarget==="production"&&!allProduction)state="LIVE_NOT_VERIFIED";
  else if(previewVerified)state="PREVIEW_VERIFIED";
  else if(checks.ciExactHead)state="CI_VERIFIED";
  if(allProduction)state="LIVE_VERIFIED";
  const missing=Object.entries(checks).filter(([,passed])=>!passed).map(([id])=>id);
  return Object.freeze({
    version:APP_BUILDER_LIVE_VERIFICATION_VERSION,
    state,
    checks,
    missing:Object.freeze(missing),
    live:state==="LIVE_VERIFIED",
    verified:state==="LIVE_VERIFIED",
    productionClaimAllowed:state==="LIVE_VERIFIED",
    mockProviderCountsAsLiveEvidence:false,
    staticCiCountsAsRuntimeEvidence:false,
    highQualitySpecCountsAsProductionEvidence:false,
    evidenceBoundary:"LIVE_VERIFIED requires exact release SHA convergence plus real Production browser/provider/database/runtime/security/release-control evidence. CODE or CI alone never qualifies.",
  });
}
