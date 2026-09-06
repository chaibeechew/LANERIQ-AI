import { generateWithZeroCostAdmission } from "./zero-cost-admitted-generation.js";
import { createCognitiveEnvelope,cognitivePromptContract,recordCognitiveTelemetry } from "../soolen/cognitive-integration.js";
import { createAppBuilderCreationPlan } from "./app-builder-creation-pipeline.js";

const SAFE_STAGE=/^[a-z0-9_-]{1,80}$/i;

async function resolveRequestUserId(){
  try{
    const { createClient }=await import("../supabase/server.js");
    const supabase=await createClient();
    const { data:{ user } }=await supabase.auth.getUser();
    return user?.id?String(user.id):null;
  }catch{
    return null;
  }
}

function cleanStage(stage){
  const value=String(stage||"generation").trim().toLowerCase();
  return SAFE_STAGE.test(value)?value:"generation";
}

function extractCreationIdea(prompt){
  const source=String(prompt||"");
  const match=source.match(/USER IDEA:\s*\n?["“]?([\s\S]*?)["”]?\s*\n\nVOICE INPUT:/i);
  return String(match?.[1]||"").replace(/^["“]|["”]$/g,"").trim().slice(0,8000);
}

export function buildAppCreationPromptContext(prompt){
  const idea=extractCreationIdea(prompt);
  if(!idea)return Object.freeze({injected:false,context:"",summary:null});
  try{
    const plan=createAppBuilderCreationPlan(idea);
    const selected=plan.templateIntelligence?.selected;
    const pageLayouts=new Map((plan.layoutPlan?.pages||[]).map(page=>[page.pageId,page.family]));
    const compact=Object.freeze({
      version:plan.version,
      promptDigest:plan.intent.promptDigest,
      industry:plan.intent.industry,
      archetypeId:plan.intent.archetypeId,
      styleId:plan.intent.styleId,
      target:plan.intent.target,
      primaryGoal:plan.intent.primaryGoal,
      template:selected?{templateId:selected.templateId,mode:selected.applicationMode,industry:selected.industry,archetypeId:selected.archetypeId,styleId:selected.styleId}:null,
      pages:(plan.pageBlueprint?.informationArchitecture?.pages||[]).map(page=>({name:page.name,route:page.route,role:page.role,sections:page.sections,layoutFamily:pageLayouts.get(page.id)||"semantic-stack",requiredStates:page.requiredStates})),
      designJudge:{passed:plan.designJudge.passed,score:plan.designJudge.score,target:plan.designJudge.target,evidenceClass:plan.designJudge.evidenceClass},
      rules:{templateIsInspirationOnly:true,directCloneAllowed:false,mobileFirst:true,reflow320:true,touchTargetMinimum:44,serverAuthoritativeMutations:true,productionClaimAllowed:false},
    });
    return Object.freeze({
      injected:true,
      context:`LANERIQ REQUEST-SPECIFIC APP CREATION PLAN\n${JSON.stringify(compact)}\nUse this deterministic plan as a planning scaffold. Preserve the customer's explicit requirements when they are more specific. Recompose rather than clone. Do not promote this CODE plan to runtime or Production evidence.`,
      summary:Object.freeze({version:plan.version,promptDigest:plan.intent.promptDigest,industry:plan.intent.industry,archetypeId:plan.intent.archetypeId,styleId:plan.intent.styleId,target:plan.intent.target,designScore:plan.designJudge.score}),
    });
  }catch{
    return Object.freeze({injected:false,context:"",summary:null});
  }
}

export async function generateAppBuilderWithAdmission(prompt,{
  userId=null,
  projectId=null,
  stage="generation",
  baseVersionId=null,
  attachmentCount=0,
  requestedAgents=1,
  reuseAllowed=true,
}={}){
  const resolvedUserId=userId?String(userId):await resolveRequestUserId();
  const scope=resolvedUserId
    ? projectId
      ? `user:${resolvedUserId}:project:${String(projectId)}`
      : `user:${resolvedUserId}:app-builder`
    : null;
  const cleanPurposeStage=cleanStage(stage);
  const purpose=`app-builder-${cleanPurposeStage}`;
  const variant=baseVersionId?String(baseVersionId):"new-project";
  const keyMaterial=`${variant}\n${String(prompt||"")}`;
  const cognitive=createCognitiveEnvelope("app-builder",{
    goal:`Build or modify an application safely at stage: ${cleanPurposeStage}`,
    complexity:Math.min(1,.65+Math.min(10,Math.max(0,Number(attachmentCount)||0))*.02),
    uncertainty:{evidenceCoverage:.55,sourceAgreement:.65,testCoverage:.35,evidenceClass:"INTERNAL",externalVerificationRequired:false},
  });
  const cognitiveContract=cognitivePromptContract(cognitive);
  const creation=buildAppCreationPromptContext(prompt);
  const cognitivePrompt=[cognitiveContract,creation.context,String(prompt||"")].filter(Boolean).join("\n\n");
  const operationId=`${scope||"anonymous"}:${purpose}:${variant}`;
  recordCognitiveTelemetry({domain:"app-builder",phase:"admission",envelope:cognitive,operationId,outcome:"planned"});

  const result=await generateWithZeroCostAdmission(cognitivePrompt,{
    scope,
    purpose,
    reuseKeyMaterial:keyMaterial,
    reuseVariant:variant,
    reuseClass:"private_result",
    reuseAllowed:Boolean(scope&&reuseAllowed),
    allowApproximateReuse:false,
    interactive:true,
    queueAllowed:false,
    attachmentCount:Math.max(0,Number(attachmentCount||0)),
    requestedAgents:Math.max(1,Number(requestedAgents||1)),
    paidFallbackAllowed:false,
  });
  recordCognitiveTelemetry({domain:"app-builder",phase:"generation",envelope:cognitive,operationId,outcome:"completed",provider:result?.provider||""});
  return {...result,cognitive,appCreation:creation.summary};
}

export const APP_BUILDER_ADMISSION_POLICY=Object.freeze({
  localBeforeRemote:true,
  paidFallbackAllowed:false,
  privateReuseScopeRequired:true,
  crossUserPrivateReuseAllowed:false,
  approximatePrivateReuseAllowed:false,
  baseVersionBoundModifyReuse:true,
  unauthenticatedReuseAllowed:false,
  cognitiveContractInjected:true,
  cognitiveTelemetryRawPromptStored:false,
  requestSpecificCreationPlanInjected:true,
  creationPlanRawPromptStored:false,
  creationPlanProductionClaimAllowed:false,
});