export const LANERIQ_DECISION_INTELLIGENCE_CONTRACT="laneriq-decision-intelligence-v1";
export const LANERIQ_EXECUTION_PATHS=Object.freeze(["exact_reuse","deterministic","local","own_device","verified_free_remote","metered_remote","blocked"]);

function clean(value,max=64){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function thermalSafe(value){const state=clean(value,24).toLowerCase();return !["serious","critical","hot"].includes(state);}

export function decideLaneriqExecutionPath({
  mode="balanced",exactReuse=false,deterministicAvailable=false,localAvailable=false,
  ownDeviceAvailable=false,userDeviceOptIn=false,thermalState="unknown",background=false,
  verifiedFreeRemote=false,meteredProviderReady=false,paidAllowed=false,highRisk=false
}={}){
  const normalizedMode=clean(mode,24).toLowerCase()||"balanced";
  const zeroMode=normalizedMode==="zero"||normalizedMode==="free";
  let path="blocked",reason="no-safe-capacity";
  if(exactReuse){path="exact_reuse";reason="exact-owner-scoped-reuse";}
  else if(deterministicAvailable){path="deterministic";reason="deterministic-solution-available";}
  else if(localAvailable){path="local";reason="local-capability-available";}
  else if(ownDeviceAvailable&&userDeviceOptIn&&thermalSafe(thermalState)&&background!==true){path="own_device";reason="explicit-own-device-capacity-safe";}
  else if(verifiedFreeRemote){path="verified_free_remote";reason="verified-free-remote-capacity";}
  else if(!zeroMode&&meteredProviderReady&&paidAllowed){path="metered_remote";reason="explicit-metered-policy-allows-spend";}
  else if(zeroMode&&meteredProviderReady){path="blocked";reason="zero-free-spend-firewall";}

  return{
    contract:LANERIQ_DECISION_INTELLIGENCE_CONTRACT,path,reason,mode:normalizedMode,
    requiresAuthority:highRisk===true,
    requiresDeterministicValidation:true,
    paidEscalationSilent:false,
    mobileCrossUserComputeAllowed:false,
    decisionOrder:["exact_reuse","deterministic","local","own_device","verified_free_remote","metered_remote"],
  };
}

export function decisionCanExecute(decision={}, {authorityApproved=false}={}){
  if(decision?.path==="blocked")return false;
  if(decision?.requiresAuthority===true&&authorityApproved!==true)return false;
  return true;
}

export const LANERIQ_DECISION_INTELLIGENCE_INSTRUCTION=`
LANERIQ DECISION INTELLIGENCE:
- Decide whether AI/remote compute is needed before executing anything.
- Prefer exact owner-scoped reuse, deterministic logic, local capability, explicitly opted-in own-device capability, then verified-free remote capacity.
- Metered remote execution is last-resort and requires explicit policy; ZERO/FREE never silently escalates to spend.
- Mobile cross-user Community Compute remains OFF.
- High-risk actions require authority before execution, and every AI-produced result remains subject to deterministic validation.
`;
