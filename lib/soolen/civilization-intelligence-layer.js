import { createFutureIntelligenceRun } from "./future-intelligence-layer.js";
import { getCivilizationHorizonEnvelope } from "./civilization-horizon-envelope.js";
import { createCenturyGoalContract, createTemporalAuthorityGrant, evaluateTemporalAuthority } from "./temporal-governance-runtime.js";
import { createVersionedProtocolEnvelope, planCryptoAgility } from "./protocol-crypto-evolution-runtime.js";
import { createEpistemicTimeCapsule } from "./civilization-memory-runtime.js";
import { planDelayTolerantTask } from "./delay-tolerant-cognition.js";

export const LANERIQ_CIVILIZATION_INTELLIGENCE_VERSION="1.0.0";

export function createCivilizationRecoveryPlan(input={}){
  return Object.freeze({
    trigger:String(input.trigger||"catastrophic-system-loss").slice(0,200),
    phases:Object.freeze(["verify-surviving-authority","restore-minimal-safety-policy","restore-provenance-ledger","validate-time-capsules","rebuild-provider-and-compute-registry","sandbox-reconstruction","independent-judge","human-successor-approval","limited-service","progressive-recovery"]),
    neverBootstrapWithUnlimitedAuthority:true,
    defaultDenyUntilAuthorityRecovered:true,
    oldCredentialsNotTrustedByAge:true,
    productionAutonomyDuringRecovery:false,
  });
}

export function createCivilizationIntelligenceRun(domain,input={}){
  const future=createFutureIntelligenceRun(domain,input);
  const envelope=getCivilizationHorizonEnvelope();
  const temporalGoal=createCenturyGoalContract({goal:input.goal,startYear:input.startYear,reviewIntervalYears:input.reviewIntervalYears});
  const authorityGrant=createTemporalAuthorityGrant({principal:input.principal||"verified-human-or-organization",scope:input.authorityScope||domain,issuedAtYear:input.issuedAtYear,expiresAtYear:input.expiresAtYear});
  const authority=evaluateTemporalAuthority(authorityGrant,{currentYear:input.currentYear,verifiedPrincipal:input.verifiedPrincipal===true,revoked:input.revoked===true});
  const protocol=createVersionedProtocolEnvelope({protocol:input.protocol||"laneriq-canonical",schemaVersion:input.schemaVersion||"1",canonicalIntent:input.goal,payload:input.protocolPayload||{domain}});
  const cryptoAgility=planCryptoAgility({currentSuite:input.currentCryptoSuite,candidateSuite:input.nextCryptoSuite});
  const timeCapsule=createEpistemicTimeCapsule({statement:input.goal,evidenceRefs:input.evidenceRefs||[],priorDigest:input.priorCapsuleDigest});
  const delayTolerance=planDelayTolerantTask({taskId:input.taskId||`${domain}-civilization-task`,oneWayLatencySeconds:input.oneWayLatencySeconds,risk:input.risk,localAuthorityVerified:input.localAuthorityVerified===true,disconnected:input.disconnected===true});
  return Object.freeze({
    version:LANERIQ_CIVILIZATION_INTELLIGENCE_VERSION,
    domain,
    future,
    envelope,
    temporalGoal,
    authorityGrant,
    authority,
    protocol,
    cryptoAgility,
    timeCapsule,
    delayTolerance,
    recovery:createCivilizationRecoveryPlan({trigger:input.recoveryTrigger}),
    architecture:Object.freeze({centuryScaleGoalReview:true,authorityDecayAndReauthorization:true,cryptoAgility:true,selfDescribingProtocolEvolution:true,epistemicTimeCapsules:true,delayTolerantCognition:true,catastropheRecovery:true,substrateAndModelIndependence:true}),
    truthBoundary:Object.freeze({actual2526AIClaim:false,interstellarDeploymentClaim:false,futureCryptoSecurityClaim:false,productionSelfEvolutionAllowed:false,humanSovereigntyRequired:true})
  });
}

export function getCivilizationIntelligenceStatus(){return Object.freeze({version:LANERIQ_CIVILIZATION_INTELLIGENCE_VERSION,state:"CODE_AND_CI_FUTURE_PROXY",horizonYear:2526,productionClaimAllowed:false});}
