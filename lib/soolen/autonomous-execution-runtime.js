export const AUTONOMOUS_EXECUTION_RUNTIME_VERSION="1.0.0";
const HIGH_RISK=/production|deploy|delete|drop|payment|financial|credential|admin|physical|robot|database-write/i;

function text(value,max=240){return String(value??"").trim().slice(0,max);}
function normalizeStep(step,index){
  const action=text(step?.action,120);if(!action)throw new Error("LANERIQ_AUTONOMOUS_STEP_ACTION_REQUIRED");
  const highRisk=step?.highRisk===true||HIGH_RISK.test(action);
  return Object.freeze({id:text(step?.id||`step-${index+1}`,80),action,description:text(step?.description,500),highRisk,externalSideEffects:step?.externalSideEffects===true||highRisk,requiresHumanApproval:step?.requiresHumanApproval===true||highRisk,requiresConstitutionalToken:step?.requiresConstitutionalToken===true||highRisk,rollbackRequired:step?.rollbackRequired===true||highRisk});
}

export function createAutonomousTaskPlan(input={}){
  const raw=Array.isArray(input.steps)?input.steps:[];if(!raw.length)throw new Error("LANERIQ_AUTONOMOUS_STEPS_REQUIRED");if(raw.length>20)throw new Error("LANERIQ_AUTONOMOUS_STEP_LIMIT");
  const steps=Object.freeze(raw.map(normalizeStep));
  return Object.freeze({version:AUTONOMOUS_EXECUTION_RUNTIME_VERSION,taskId:text(input.taskId||`task-${Date.now()}`,120),goal:text(input.goal,1000),steps,maxSteps:20,bounded:true,unlimitedAutonomyAllowed:false,productionAutoApprovalAllowed:false,authorityExpansionAllowed:false,humanVetoRequired:true});
}

export async function executeAutonomousTask(plan,input={},deps={}){
  if(typeof deps.execute!=="function"||typeof deps.verify!=="function")throw new Error("LANERIQ_AUTONOMOUS_EXECUTORS_REQUIRED");
  const history=[];
  for(const step of plan.steps){
    if(step.requiresHumanApproval&&input.humanApproved!==true)return Object.freeze({accepted:false,status:"HUMAN_APPROVAL_REQUIRED",completedSteps:history.length,history:Object.freeze(history),stoppedAt:step.id});
    if(step.requiresConstitutionalToken&&input.constitutionalTokenVerified!==true)return Object.freeze({accepted:false,status:"CONSTITUTIONAL_TOKEN_REQUIRED",completedSteps:history.length,history:Object.freeze(history),stoppedAt:step.id});
    const execution=await deps.execute({step,taskId:plan.taskId});
    if(execution?.authorityExpanded===true||execution?.safetyBypassed===true)throw new Error("LANERIQ_AUTONOMOUS_EXECUTION_BOUNDARY_VIOLATION");
    const verification=await deps.verify({step,execution,taskId:plan.taskId});
    const passed=verification?.passed===true;
    history.push(Object.freeze({stepId:step.id,action:step.action,executed:execution?.executed===true,verified:passed,evidenceId:text(verification?.evidenceId,120)||null,rollbackAvailable:execution?.rollbackAvailable===true}));
    if(!passed)return Object.freeze({accepted:false,status:"VERIFY_FAILED",completedSteps:history.length,history:Object.freeze(history),stoppedAt:step.id,rollbackRequired:step.rollbackRequired});
  }
  return Object.freeze({accepted:true,status:"COMPLETED",completedSteps:history.length,history:Object.freeze(history),humanVetoPreserved:true,authorityExpanded:false,productionClaimAllowed:false});
}
