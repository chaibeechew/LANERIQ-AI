import crypto from "node:crypto";

export const APP_PRODUCT_LIFECYCLE_VERSION="1.0.0";

export const APP_PRODUCT_PHASES=Object.freeze([
  Object.freeze({id:"opportunity",goal:"Prove a real user problem and desired outcome",artifacts:["problem-statement","target-users","jobs-to-be-done","success-metrics","risk-register"],gate:"problem-evidence-reviewed"}),
  Object.freeze({id:"product-strategy",goal:"Turn the opportunity into a focused product thesis",artifacts:["prd","value-proposition","mvp-scope","business-model","non-goals"],gate:"prd-and-scope-approved"}),
  Object.freeze({id:"experience-architecture",goal:"Design information architecture and end-to-end user journeys",artifacts:["sitemap","user-flows","navigation-model","empty-error-loading-states","content-model"],gate:"critical-flows-complete"}),
  Object.freeze({id:"design-system",goal:"Create platform-aware visual and interaction foundations",artifacts:["design-tokens","type-scale","spacing-system","component-contracts","accessibility-contract"],gate:"design-system-valid"}),
  Object.freeze({id:"prototype",goal:"Validate the experience before expensive implementation",artifacts:["wireframes","high-fidelity-prototype","interaction-spec","usability-findings"],gate:"prototype-validated"}),
  Object.freeze({id:"technical-architecture",goal:"Choose the simplest secure architecture that can scale",artifacts:["runtime-plan","data-model","api-contracts","auth-model","provider-routing","threat-model","cost-envelope"],gate:"architecture-security-reviewed"}),
  Object.freeze({id:"implementation",goal:"Build vertical slices that remain continuously runnable",artifacts:["frontend","backend","database","integrations","analytics-events","feature-flags"],gate:"critical-slices-runnable"}),
  Object.freeze({id:"quality-engineering",goal:"Prove correctness, usability, performance, accessibility and security",artifacts:["unit-tests","integration-tests","e2e-tests","a11y-tests","performance-evidence","security-evidence"],gate:"quality-thresholds-met"}),
  Object.freeze({id:"beta-validation",goal:"Validate on real browsers/devices and representative users",artifacts:["device-matrix","browser-matrix","beta-feedback","crash-free-evidence","release-candidate"],gate:"beta-evidence-accepted"}),
  Object.freeze({id:"release-readiness",goal:"Prepare stores, web launch, compliance and rollback",artifacts:["store-metadata","screenshots","privacy-disclosures","support-path","rollout-plan","rollback-plan"],gate:"release-ready"}),
  Object.freeze({id:"launch-observability",goal:"Launch progressively with measurable health",artifacts:["dashboards","alerts","funnel-events","retention-events","incident-playbook"],gate:"launch-health-observable"}),
  Object.freeze({id:"growth-and-evolution",goal:"Improve from evidence instead of feature accumulation",artifacts:["feedback-loop","experiment-backlog","retention-analysis","conversion-analysis","deprecation-plan"],gate:"iteration-evidence-loop-active"}),
]);

function sha(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

export function createAppProductLifecycle({target="app+website",mvp=true,risk="medium",criticalFlows=[]}={}){
  const flows=[...new Set((criticalFlows||[]).map(String).filter(Boolean))].slice(0,20);
  const phases=APP_PRODUCT_PHASES.map((phase,index)=>Object.freeze({...phase,index,required:true,mayParallelize:index>=3&&index<=6}));
  const plan={version:APP_PRODUCT_LIFECYCLE_VERSION,target,mvp:Boolean(mvp),risk:String(risk),criticalFlows:Object.freeze(flows),phases:Object.freeze(phases),principles:Object.freeze({outcomeBeforeFeatures:true,prototypeBeforeScale:true,securityAndAccessibilityByDesign:true,progressiveRelease:true,evidenceDrivenIteration:true})};
  return Object.freeze({...plan,planDigest:sha(plan)});
}
