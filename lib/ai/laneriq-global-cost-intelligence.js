import {decideLaneriqExecutionPath} from "./laneriq-decision-intelligence.js";

export const LANERIQ_GLOBAL_COST_INTELLIGENCE_CONTRACT="laneriq-global-cost-intelligence-v1";
function number(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}

export function buildGlobalCostPlan({
  mode="balanced",budgetUsd=0,estimatedPaidCostUsd=0,exactReuse=false,deterministicAvailable=false,
  localAvailable=false,ownDeviceAvailable=false,userDeviceOptIn=false,thermalState="unknown",
  verifiedFreeRemote=false,meteredProviderReady=false,paidAllowed=false,customerByo=false,customerConsent=false
}={}){
  const budget=Math.max(0,number(budgetUsd)),estimated=Math.max(0,number(estimatedPaidCostUsd));
  const zeroMode=["zero","free"].includes(String(mode||"").toLowerCase());
  const platformSpendAllowed=!zeroMode&&paidAllowed===true&&estimated<=budget;
  const byoAllowed=customerByo===true&&customerConsent===true;
  const decision=decideLaneriqExecutionPath({mode,exactReuse,deterministicAvailable,localAvailable,ownDeviceAvailable,userDeviceOptIn,thermalState,verifiedFreeRemote,meteredProviderReady,paidAllowed:platformSpendAllowed||byoAllowed});
  const hardStop=decision.path==="blocked"||(estimated>budget&&decision.path==="metered_remote"&&!byoAllowed);
  return{
    contract:LANERIQ_GLOBAL_COST_INTELLIGENCE_CONTRACT,
    decision,
    budgetUsd:budget,
    estimatedPaidCostUsd:estimated,
    platformSpendAllowed:platformSpendAllowed&&!hardStop,
    customerByoAllowed:byoAllowed,
    hardStop,
    noSilentSpend:true,
    optimizationOrder:["exact_reuse","deterministic","local","own_device","verified_free_remote","metered_remote"],
  };
}

export function detectCostAnomaly({baselineUsd=0,currentUsd=0,hardLimitUsd=Infinity}={}){
  const baseline=Math.max(0,number(baselineUsd)),current=Math.max(0,number(currentUsd));
  const limit=Number.isFinite(Number(hardLimitUsd))?Math.max(0,Number(hardLimitUsd)):Infinity;
  const ratio=baseline>0?current/baseline:(current>0?Infinity:1);
  const anomalous=current>limit||ratio>=2;
  return{contract:"laneriq-cost-anomaly-v1",baselineUsd:baseline,currentUsd:current,ratio:Number.isFinite(ratio)?ratio:null,hardLimitExceeded:current>limit,anomalous,action:anomalous?"pause-or-degrade-metered-work":"continue"};
}

export const LANERIQ_GLOBAL_COST_INTELLIGENCE_INSTRUCTION=`
LANERIQ GLOBAL COST INTELLIGENCE:
- Cost admission happens before provider execution, not after the bill arrives.
- Reuse/deterministic/local/own-device/verified-free capacity precede paid remote execution.
- ZERO/FREE is a hard spend firewall; no caller flag may silently override it.
- Paid execution requires an explicit budget/policy or explicit customer BYO consent.
- Cost spikes trigger pause/degrade/replan proposals; never hide cost anomalies with user-facing credit complexity.
`;
