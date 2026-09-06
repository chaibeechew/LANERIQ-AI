import {NextResponse} from "next/server";
import {getBuilderPrincipal,loadBuilderModificationContext} from "../../../../lib/cloud/builder-projects.js";
import {createPreviewConversationalEditPlan} from "../../../../lib/ai/preview-conversational-edit-pipeline.js";

export const maxDuration=30;

function pageModelFromSpecification(specification,route="/"){
  const pages=Array.isArray(specification?.pages)?specification.pages:[];
  const page=pages.find(p=>String(p?.route||"")===String(route||"/"))||pages[0]||{};
  const sections=Array.isArray(page?.sections)?page.sections:[];
  const components=sections.map((section,index)=>({
    id:String(section?.id||`${page?.id||"page"}-section-${index+1}`),
    type:String(section?.type||section?.component||"section"),
    role:String(section?.role||section?.name||section?.type||"section"),
  }));
  return {components};
}
function complexityFromSpecification(specification,route="/"){
  const pages=Array.isArray(specification?.pages)?specification.pages:[];
  const page=pages.find(p=>String(p?.route||"")===String(route||"/"))||pages[0]||{};
  const actions=Array.isArray(page?.actions)?page.actions:Array.isArray(specification?.actions)?specification.actions:[];
  const sections=Array.isArray(page?.sections)?page.sections:[];
  const nav=Array.isArray(specification?.navigation)?specification.navigation:[];
  return {primaryActions:Math.max(1,actions.filter(a=>a?.primary===true||a?.priority==="primary").length),topLevelActions:actions.length,primaryNavigationItems:nav.length,visiblePriorityBlocks:sections.length,modalDepth:0,criticalDecisionsPerView:0};
}

export async function POST(request){
  try{
    const principal=await getBuilderPrincipal({requireVerified:true});
    if(!principal.ok)return NextResponse.json({error:principal.code==="ACCOUNT_VERIFICATION_REQUIRED"?"Account verification required.":"Authentication required."},{status:principal.code==="ACCOUNT_VERIFICATION_REQUIRED"?403:401});
    const body=await request.json();
    const appId=String(body?.appId||"").trim(),expectedVersionId=String(body?.expectedVersionId||"").trim();
    const instruction=String(body?.instruction||"").trim();
    if(!appId||!expectedVersionId)return NextResponse.json({error:"Saved project and expected version are required."},{status:400});
    if(!instruction)return NextResponse.json({error:"Visual edit instruction is required."},{status:400});
    if(instruction.length>4000)return NextResponse.json({error:"Visual edit instruction is too long."},{status:413});
    const context=await loadBuilderModificationContext({appId,requestId:`visual-plan:${expectedVersionId}`});
    if(!context.ok)return NextResponse.json({error:context.code==="PROJECT_NOT_FOUND"?"App not found or access denied.":"Visual edit context unavailable."},{status:context.code==="PROJECT_NOT_FOUND"?404:409});
    if(context.project?.current_version_id!==expectedVersionId)return NextResponse.json({error:"Project changed after the preview loaded. Refresh before visual editing."},{status:409});
    const specification=context.currentVersion?.specification;
    if(!specification)return NextResponse.json({error:"Current project version unavailable."},{status:409});
    const visual={...(body?.visual||{}),pageRoute:String(body?.visual?.pageRoute||"/").slice(0,240)};
    const plan=createPreviewConversationalEditPlan({instruction,visual,target:body?.target||"app+website",pageModel:pageModelFromSpecification(specification,visual.pageRoute),proposedComplexity:complexityFromSpecification(specification,visual.pageRoute)});
    return NextResponse.json({success:true,state:plan.state,executionAllowed:plan.executionAllowed,region:plan.region,intent:{action:plan.intent.action,object:plan.intent.object,category:plan.intent.category,requiresExplicitConfirmation:plan.intent.requiresExplicitConfirmation},responsive:plan.responsive,simplicity:plan.simplicity,verdict:plan.verdict,modifyEnvelope:plan.modifyEnvelope?{instruction:plan.modifyEnvelope.instruction,preciseTarget:plan.modifyEnvelope.preciseTarget,visualEvidence:plan.modifyEnvelope.visualEvidence,expectedVersionRequired:true,stableRequestIdRequired:true}:null,truthBoundary:plan.truthBoundary});
  }catch(error){
    console.error("Visual edit plan API error:",error);
    return NextResponse.json({error:"Visual edit planning failed safely."},{status:400});
  }
}
