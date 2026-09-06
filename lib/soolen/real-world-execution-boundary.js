import { getHumanCivilizationLaw } from "./human-civilization-law.js";

export const REAL_WORLD_EXECUTION_BOUNDARY_VERSION="1.0.0";
const LAW=getHumanCivilizationLaw();
export const EXECUTION_SURFACES=Object.freeze(["browser","desktop","own-device","edge","sensor","robotics","scientific-instrument"]);
function text(value,max=300){return String(value??"").trim().slice(0,max);}
function surface(value){const v=text(value,60).toLowerCase();if(!EXECUTION_SURFACES.includes(v))throw new Error(`LANERIQ_REAL_WORLD_SURFACE_UNSUPPORTED:${v||"empty"}`);return v;}

export function createRealWorldExecutionPlan(input={}){
  const executionSurface=surface(input.surface||"own-device");
  const physicalActuation=["robotics","scientific-instrument"].includes(executionSurface)||input.physicalActuation===true;
  const mobile=input.mobile===true;
  const crossUserCommunityCompute=input.crossUserCommunityCompute===true;
  const highRisk=physicalActuation||input.highRisk===true||input.production===true||input.destructive===true;
  const plan=Object.freeze({
    version:REAL_WORLD_EXECUTION_BOUNDARY_VERSION,
    surface:executionSurface,
    physicalActuation,
    mobile,
    crossUserCommunityCompute,
    ownDeviceComputeAllowed:executionSurface==="own-device"||input.ownDevice===true,
    mobileCrossUserCommunityComputeAllowed:false,
    localAuthorityRequired:physicalActuation||executionSurface==="edge"||executionSurface==="desktop",
    constitutionalExecutionTokenRequired:highRisk||input.externalSideEffects===true,
    humanApprovalRequired:physicalActuation||input.production===true||input.destructive===true,
    emergencyStopRequired:physicalActuation,
    rollbackOrSafeStopRequired:highRisk,
    sandboxOrSimulationFirst:highRisk,
    networkPermissionExplicit:input.networkPermissionExplicit===true,
    humanCivilizationLawDigest:LAW.lawDigest,
    maySelfGrantDevicePermissions:false,
    mayDisableHumanVeto:false,
  });
  return plan;
}

export function evaluateRealWorldExecutionAuthorization(input={}){
  const plan=input.plan||createRealWorldExecutionPlan(input);
  const checks={
    mobileCommunityComputeBlocked:!(plan.mobile&&plan.crossUserCommunityCompute),
    constitutionalTokenVerified:!plan.constitutionalExecutionTokenRequired||input.constitutionalTokenVerified===true,
    localAuthorityVerified:!plan.localAuthorityRequired||input.localAuthorityVerified===true,
    humanApprovalVerified:!plan.humanApprovalRequired||input.humanApproved===true,
    emergencyStopVerified:!plan.emergencyStopRequired||input.emergencyStopVerified===true,
    rollbackOrSafeStopVerified:!plan.rollbackOrSafeStopRequired||input.rollbackOrSafeStopVerified===true,
    permissionScopeVerified:input.permissionScopeVerified===true,
    humanVetoAvailable:input.humanVetoAvailable===true,
    lawDigestCurrent:plan.humanCivilizationLawDigest===LAW.lawDigest,
  };
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return Object.freeze({authorized:failed.length===0,checks:Object.freeze(checks),failed:Object.freeze(failed),action:failed.length?"BLOCK_REAL_WORLD_EXECUTION":"ALLOW_WITHIN_VERIFIED_SCOPE",surface:plan.surface,physicalActuation:plan.physicalActuation,authorityExpanded:false,productionActuationClaimAllowed:false,lawDigest:LAW.lawDigest});
}

export function getRealWorldExecutionStatus(){return Object.freeze({version:REAL_WORLD_EXECUTION_BOUNDARY_VERSION,surfaces:EXECUTION_SURFACES,ownDeviceComputeAllowed:true,mobileCrossUserCommunityComputeAllowed:false,physicalActuationRequiresHumanApproval:true,constitutionalTokenForHighRisk:true,productionPhysicalExecutionVerified:false,lawDigest:LAW.lawDigest});}
