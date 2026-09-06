export const LANERIQ_CAPABILITY_TRUTH_CONTRACT="laneriq-capability-truth-graph-v1";
export const LANERIQ_CAPABILITY_STAGES=Object.freeze(["declared","configured","code_ready","contract_tested","preview_verified","provider_verified","physical_device_verified","production_live"]);

function bool(v){return v===true;}
function stageIndex(stage){const i=LANERIQ_CAPABILITY_STAGES.indexOf(stage);return i<0?0:i;}

export function evaluateCapabilityTruth({
  evidence={},requiresProvider=false,requiresPhysicalDevice=false,releaseControllerApproved=false
}={}){
  let stage="declared";
  const blockers=[];
  if(bool(evidence.configured))stage="configured";else blockers.push("configuration-evidence-missing");
  if(stageIndex(stage)>=1&&bool(evidence.codeReady))stage="code_ready";else if(stageIndex(stage)>=1)blockers.push("code-readiness-missing");
  if(stageIndex(stage)>=2&&bool(evidence.contractPassed))stage="contract_tested";else if(stageIndex(stage)>=2)blockers.push("contract-evidence-missing");
  if(stageIndex(stage)>=3&&bool(evidence.previewVerified)&&bool(evidence.exactSha))stage="preview_verified";else if(stageIndex(stage)>=3)blockers.push("exact-sha-preview-evidence-missing");

  if(stageIndex(stage)>=4){
    if(requiresProvider){if(bool(evidence.providerVerified))stage="provider_verified";else blockers.push("provider-live-evidence-missing");}
    else stage="provider_verified";
  }
  if(stageIndex(stage)>=5){
    if(requiresPhysicalDevice){if(bool(evidence.physicalDeviceVerified))stage="physical_device_verified";else blockers.push("physical-device-evidence-missing");}
    else stage="physical_device_verified";
  }
  if(stageIndex(stage)>=6){
    if(bool(evidence.productionProbePassed)&&bool(evidence.exactSha)&&releaseControllerApproved===true)stage="production_live";
    else blockers.push("production-exact-sha-controller-evidence-missing");
  }
  return{contract:LANERIQ_CAPABILITY_TRUTH_CONTRACT,stage,stageIndex:stageIndex(stage),productionLive:stage==="production_live",blockers:[...new Set(blockers)],exactShaBound:bool(evidence.exactSha),releaseControllerApproved:releaseControllerApproved===true};
}

export function canClaimCapability(truth={},requestedStage="code_ready"){
  return stageIndex(truth?.stage)>=stageIndex(requestedStage);
}

export const LANERIQ_CAPABILITY_TRUTH_INSTRUCTION=`
LANERIQ CAPABILITY TRUTH GRAPH:
- Track every capability through declared -> configured -> code_ready -> contract_tested -> preview_verified -> provider_verified -> physical_device_verified -> production_live.
- Never skip evidence stages because configuration exists or a model says the feature should work.
- Preview verification requires exact-SHA evidence.
- Provider and physical-device stages are required when the capability depends on them.
- Production LIVE requires exact-SHA Production probe evidence plus designated Release Controller approval.
- UI, marketing and Agents may claim only the highest verified stage, never a future stage.
`;
