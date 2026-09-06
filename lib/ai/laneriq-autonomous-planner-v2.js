export const LANERIQ_AUTONOMOUS_PLANNER_CONTRACT="laneriq-autonomous-planner-v2";

function clean(value,max=1600){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function has(text,pattern){return pattern.test(text.toLowerCase());}

const BASE_STEPS=Object.freeze([
  {id:"understand_goal",dependsOn:[],authority:"none"},
  {id:"classify_risk",dependsOn:["understand_goal"],authority:"none"},
  {id:"choose_execution_path",dependsOn:["classify_risk"],authority:"none"},
  {id:"design_architecture",dependsOn:["choose_execution_path"],authority:"none"},
  {id:"define_data_ownership",dependsOn:["design_architecture"],authority:"none"},
  {id:"design_experience",dependsOn:["design_architecture","define_data_ownership"],authority:"none"},
  {id:"implement_candidate",dependsOn:["design_experience"],authority:"none"},
  {id:"deterministic_validation",dependsOn:["implement_candidate"],authority:"none"},
  {id:"runtime_evidence",dependsOn:["deterministic_validation"],authority:"none"},
  {id:"release_candidate",dependsOn:["runtime_evidence"],authority:"release_controller"},
]);

function topo(steps){
  const byId=new Map(steps.map(step=>[step.id,step])),done=new Set(),order=[];
  while(order.length<steps.length){
    let progressed=false;
    for(const step of steps){if(done.has(step.id))continue;if(step.dependsOn.every(id=>done.has(id))){done.add(step.id);order.push(step.id);progressed=true;}}
    if(!progressed)throw new Error("PLANNER_DEPENDENCY_CYCLE");
  }
  return order;
}

export function buildAutonomousPlanV2({goal="",platform="web",mode="balanced"}={}){
  const text=clean(goal).toLowerCase();
  if(!text)throw new Error("PLANNER_GOAL_REQUIRED");
  const highRisk=has(text,/(delete|payment|billing|admin|permission|auth|secret|database migration|production|publish|deploy|删除|付款|管理员|权限|生产|发布|迁移)/);
  const productionIntent=has(text,/(production|publish|deploy|store|app store|google play|生产|发布|上架)/);
  const steps=BASE_STEPS.map(step=>({...step,dependsOn:[...step.dependsOn]}));
  if(highRisk){
    const index=steps.findIndex(step=>step.id==="implement_candidate");
    steps.splice(index,0,{id:"authority_gate",dependsOn:["design_experience"],authority:"explicit_owner_or_operator"});
    const implementation=steps.find(step=>step.id==="implement_candidate");implementation.dependsOn=["authority_gate"];
  }
  if(productionIntent){
    const release=steps.find(step=>step.id==="release_candidate");
    const index=steps.indexOf(release);
    steps.splice(index,0,{id:"exact_sha_production_evidence",dependsOn:["runtime_evidence"],authority:"release_controller"});
    release.dependsOn=["exact_sha_production_evidence"];
  }
  return{contract:LANERIQ_AUTONOMOUS_PLANNER_CONTRACT,goal:clean(goal,400),platform:clean(platform,32)||"web",mode:clean(mode,24)||"balanced",risk:highRisk?"high":"normal",productionIntent,steps,executionOrder:topo(steps),maxParallelism:highRisk?2:4,sideEffectsBeforeValidation:false};
}

export function nextPlannerSteps(plan={},completed=[]){
  const done=new Set(Array.isArray(completed)?completed:[]);
  return (Array.isArray(plan?.steps)?plan.steps:[]).filter(step=>!done.has(step.id)&&step.dependsOn.every(id=>done.has(id))).map(step=>step.id);
}

export const LANERIQ_AUTONOMOUS_PLANNER_INSTRUCTION=`
LANERIQ AUTONOMOUS PLANNER 2.0:
- Convert goals into a dependency graph: understand -> risk -> execution path -> architecture -> ownership/data -> experience -> implementation -> deterministic validation -> runtime evidence -> release candidate.
- High-risk tasks insert an explicit authority gate before side effects.
- Production intent inserts exact-SHA Production evidence before release promotion.
- Do not perform side effects before required validation/authority dependencies are satisfied.
- Keep concurrency bounded and use the smallest plan that still preserves security, recovery, cost and evidence requirements.
`;
