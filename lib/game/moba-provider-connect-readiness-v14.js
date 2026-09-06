import {readMobaLiveDeploymentContext} from "./multiplayer-live-activation-v12.js";

const REQUIRED_SETTINGS=Object.freeze([
  "MULTIPLAYER_PROVIDER",
  "MULTIPLAYER_MATCHMAKING_ENDPOINT",
  "MULTIPLAYER_STATUS_ENDPOINT",
  "MULTIPLAYER_CANCEL_ENDPOINT",
]);

function present(value){return String(value??"").trim().length>0;}
function freeze(value){return Object.freeze(value);}

export const MOBA_PROVIDER_CONNECT_READINESS_V14=freeze({
  version:"moba-provider-connect-readiness-v14",
  providerNeutral:true,
  dedicatedLanerIqServerRequired:false,
  creatorServerConfigurationRequired:false,
  secretsExposed:false,
  systems:freeze([
    "secret-presence-only-diagnostics",
    "missing-setting-guidance",
    "exact-build-preview-smoke-eligibility",
    "creator-safe-next-action",
    "production-fail-closed",
  ]),
  truthRule:"V14 reports only the presence/absence of platform multiplayer connection requirements. It never returns provider URLs, credentials or secret values, and eligibility to run a Preview smoke test is not proof that the provider or Production capacity is verified.",
});

export function readMobaProviderConnectionChecklist(env=process.env){
  const settings=freeze({
    provider:present(env?.MULTIPLAYER_PROVIDER),
    matchmaking:present(env?.MULTIPLAYER_MATCHMAKING_ENDPOINT),
    status:present(env?.MULTIPLAYER_STATUS_ENDPOINT),
    cancel:present(env?.MULTIPLAYER_CANCEL_ENDPOINT),
    authToken:present(env?.MULTIPLAYER_PROVIDER_TOKEN),
  });
  const keyToFlag={
    MULTIPLAYER_PROVIDER:"provider",
    MULTIPLAYER_MATCHMAKING_ENDPOINT:"matchmaking",
    MULTIPLAYER_STATUS_ENDPOINT:"status",
    MULTIPLAYER_CANCEL_ENDPOINT:"cancel",
  };
  const missingRequiredSettings=REQUIRED_SETTINGS.filter(key=>settings[keyToFlag[key]]!==true);
  return freeze({
    settings,
    missingRequiredSettings:freeze(missingRequiredSettings),
    requiredSettingsComplete:missingRequiredSettings.length===0,
    optionalAuthTokenConfigured:settings.authToken,
    secretValuesExposed:false,
  });
}

export function evaluateMobaProviderConnectReadiness({providerConfig={},env=process.env,deployment=readMobaLiveDeploymentContext(env)}={}){
  const checklist=readMobaProviderConnectionChecklist(env);
  const checks=freeze({
    requiredSettingsPresent:checklist.requiredSettingsComplete,
    providerConfigured:providerConfig?.configured===true,
    providerNotCostBlocked:providerConfig?.blockedByCostPolicy!==true,
    statusContractPresent:checklist.settings.status===true,
    cancellationContractPresent:checklist.settings.cancel===true,
    hostedRuntime:deployment?.hostedRuntime===true,
    exactBuildBound:deployment?.exactBuildBound===true,
    previewOrProductionEnvironment:["preview","production"].includes(deployment?.environment),
  });
  const configurationReady=checks.requiredSettingsPresent&&checks.providerConfigured&&checks.providerNotCostBlocked;
  const previewSmokeTestEligible=configurationReady&&checks.statusContractPresent&&checks.cancellationContractPresent&&checks.hostedRuntime&&checks.exactBuildBound&&checks.previewOrProductionEnvironment;
  let nextAction="run_real_ten_player_preview";
  if(!checklist.requiredSettingsComplete)nextAction="connect_missing_platform_multiplayer_settings";
  else if(providerConfig?.blockedByCostPolicy===true)nextAction="resolve_multiplayer_cost_policy";
  else if(providerConfig?.configured!==true)nextAction="validate_provider_adapter_contract";
  else if(!checks.hostedRuntime||!checks.exactBuildBound||!checks.previewOrProductionEnvironment)nextAction="deploy_exact_preview_build";
  return freeze({
    version:MOBA_PROVIDER_CONNECT_READINESS_V14.version,
    configurationReady,
    previewSmokeTestEligible,
    liveProviderVerified:false,
    productionReady:false,
    checks,
    missingRequiredSettings:checklist.missingRequiredSettings,
    optionalAuthTokenConfigured:checklist.optionalAuthTokenConfigured,
    nextAction,
    providerIdentityExposed:false,
    providerEndpointExposed:false,
    credentialExposed:false,
    truthRule:MOBA_PROVIDER_CONNECT_READINESS_V14.truthRule,
  });
}

export function buildMobaCreatorProviderConnectStatus(input={}){
  const status=evaluateMobaProviderConnectReadiness(input);
  const headline=status.previewSmokeTestEligible
    ? "Platform multiplayer connection is ready for a real 10-player Preview qualification run."
    : status.missingRequiredSettings.length
      ? `Platform multiplayer connection is incomplete (${status.missingRequiredSettings.length} required setting${status.missingRequiredSettings.length===1?"":"s"} missing).`
      : "Platform multiplayer connection still needs qualification before a real 10-player Preview run.";
  return freeze({
    version:status.version,
    headline,
    configurationReady:status.configurationReady,
    previewSmokeTestEligible:status.previewSmokeTestEligible,
    nextAction:status.nextAction,
    missingRequiredSettings:status.missingRequiredSettings,
    optionalAuthTokenConfigured:status.optionalAuthTokenConfigured,
    secretValuesExposed:false,
    liveProviderVerified:false,
    productionReady:false,
    truthRule:status.truthRule,
  });
}
