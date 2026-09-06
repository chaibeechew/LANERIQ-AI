import { NextResponse } from "next/server";
import { runAutonomousEngine } from "../../../engine/autonomous-engine.js";
import { runSoolenAdultMode } from "../../../lib/soolen/adult-engine.js";
import { runCriticChecks } from "../../../lib/soolen/critic-engine.js";
import { normalizeAppSpec } from "../../../lib/generator/runtime-guard.js";
import { buildAppExplanation } from "../../../lib/generator/app-explanation.js";
import { selfTestGeneratedApp } from "../../../lib/generator/self-test.js";
import { verifyGeneratedAppExecution,buildRepairInstruction } from "../../../lib/generator/execution-verifier.js";
import { buildGenerationQualityDiagnostics,buildQualityGateRescueInstruction } from "../../../lib/generator/quality-gate-rescue.js";
import { inspectProjectSpecification,buildSelfHealInstruction } from "../../../lib/ai/project-self-heal-policy.js";
import { inferIndustryCapabilities } from "../../../lib/ai/industry-capability-planner.js";
import { isMobileGameIdea } from "../../../lib/ai/mobile-game-knowledge.js";
import { resolveWallpaperId } from "../../../lib/design/wallpaper-presets.js";
import { mergeProjectMemory } from "../../../lib/project-memory.js";
import { bootstrapAppBuilderRealityEnvelope,serializeAppBuilderRealityEnvelope,summarizeAppBuilderRealityEnvelope,hashAppBuilderArtifact } from "../../../lib/intelligence/app-builder-world-bridge.js";
import { consumeAppBuilderEntitlement,bindAppBuilderProjectAccess,restoreFailedAppBuilderCreate,consumeAiCredits,refundAiCredits } from "../../../lib/app-builder-finance.js";
import { getBuilderPrincipal,loadBuilderGenerationReplay,loadBuilderGenerationInputs,persistBuilderGeneratedProject,saveBuilderGeneratedProjectContext } from "../../../lib/cloud/builder-projects.js";

const GENERATE_CREDIT_COST=Math.max(1,Number(process.env.APP_GENERATE_CREDIT_COST||10));
const HEX_COLOR=/^#[0-9a-f]{6}$/i;
const REQUEST_ID=/^[A-Za-z0-9._:-]{1,160}$/;
const MAX_REQUEST_BYTES=64*1024;
const STALE_PARTIAL_MS=90*1000;
const QUALITY_GATE_RESCUE_ATTEMPTS=Math.max(0,Math.min(3,Number(process.env.APP_GENERATE_QUALITY_RESCUE_ATTEMPTS??2)||0));

function json(payload,status=200){
 return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});
}
function verifyGeneration(result){const normalized=normalizeAppSpec(result?.specification);const selfTest=selfTestGeneratedApp(normalized);const execution=verifyGeneratedAppExecution(selfTest.normalizedSpec);const selfHeal=inspectProjectSpecification(execution.normalizedSpec);const errors=[...(selfTest.errors||[]),...(execution.errors||[]),...selfHeal.issues.filter(issue=>issue.severity==="error").map(issue=>issue.message)];return{passed:selfTest.ok&&execution.ok&&selfHeal.passed,selfTest,execution,selfHeal,errors,normalized:execution.normalizedSpec};}
function sourceEngineeringEvidence(adult){const status=String(adult?.engineeringStatus||"not-required");return{status,sandboxVerified:status==="verified",requiredForGeneration:false,requiredBeforeSourceRelease:true};}
function generationQualityGateFailure(message){const text=String(message||"");return text.includes("Soolen Super Brain could not verify the generated specification after autonomous repair attempts")||text.startsWith("Generated app failed final verification:");}
function qualityGateError(message,diagnostics){const error=new Error(message);error.code="GENERATION_QUALITY_GATE_NOT_MET";error.qualityDiagnostics=diagnostics;return error;}
function lastCriticSnapshot(adult,requirements){const history=Array.isArray(adult?.criticHistory)?adult.criticHistory:[],last=history[history.length-1]||null,result=adult?.result||{};return{review:last?.review||runCriticChecks(result,requirements),report:last?.verification?.report||verifyGeneration(result)};}
function buildBrandBrief(kit){if(!kit)return"";const rows=[kit.company_name&&`Brand/company: ${kit.company_name}`,kit.primary_color&&`Primary color: ${kit.primary_color}`,kit.secondary_color&&`Secondary color: ${kit.secondary_color}`,kit.accent_color&&`Accent color: ${kit.accent_color}`,kit.font_style&&`Typography direction: ${kit.font_style}`,kit.brand_voice&&`Brand voice: ${kit.brand_voice}`,kit.logo_url&&`Logo reference: ${kit.logo_url}`].filter(Boolean);return rows.length?`SAVED BRAND KIT\n${rows.join("\n")}\nUse this identity as a design system for the new App + Website. Keep the result original, readable, comfortable, natural and accessible. Do not imitate third-party branding/assets.`:"";}
function pageText(page){return`${page?.name||""} ${page?.purpose||page?.description||""}`.toLowerCase();}
function choosePlacement(asset,pages=[]){const name=String(asset?.file_name||"").toLowerCase(),category=String(asset?.category||"").toLowerCase(),candidates=pages.map((page,index)=>({page,index,text:pageText(page)})),match=words=>candidates.find(item=>words.some(word=>item.text.includes(word)));let target=null,role="content",reason="Placed on the most relevant generated page.";if(/logo|brand|icon/.test(name)){target=match(["home","landing","about","profile"]);role="brand";reason="Detected as likely brand/logo media."}else if(/property|house|home|unit|listing|room/.test(name)){target=match(["property","listing","home","gallery"]);role="gallery";reason="Filename suggests property/listing media."}else if(/product|item|menu|food/.test(name)){target=match(["product","shop","store","menu","catalog"]);role="gallery";reason="Filename suggests product or catalog media."}else if(category==="video"){target=match(["home","about","story","gallery","media"]);role="video";reason="Video placed where motion/story content is most useful."}else target=match(["home","gallery","about","portfolio","product","listing"]);target=target||candidates[0]||null;return{asset_id:asset.id,suggested_page:target?.page?.name||"Main",suggested_role:role,placement_reason:reason};}
function safeColor(value){const v=String(value||"").trim();return HEX_COLOR.test(v)?v:"";}
function cookieValue(request,key){const raw=String(request?.headers?.get?.("cookie")||"");for(const part of raw.split(";")){const[name,...rest]=part.trim().split("=");if(name===key){try{return decodeURIComponent(rest.join("="))}catch{return rest.join("=")}}}return"";}

async function loadGenerationReplay(requestId){
 const state=await loadBuilderGenerationReplay({requestId});
 if(!state.ok)throw new Error(state.detail||`Generation replay lookup failed: ${state.code}`);
 const app=state.app;
 if(!app)return null;
 if(!app.current_version_id){
  const updatedMs=Date.parse(app.updated_at||app.created_at||"");
  const stale=Number.isFinite(updatedMs)&&Date.now()-updatedMs>=STALE_PARTIAL_MS;
  return stale?{stalePartial:true,app}:{inProgress:true,app};
 }
 const version=state.version;
 if(!version?.specification)return{inProgress:true,app};
 const verified=verifyGeneration({specification:version.specification});
 if(!verified.passed)throw new Error("Persisted generation replay failed integrity verification.");
 const specification=verified.normalized;
 const unifiedWorld=summarizeAppBuilderRealityEnvelope(state.memory?.memory_json?.realityEnvelope);
 if(unifiedWorld.valid&&unifiedWorld.artifactHash!==hashAppBuilderArtifact(specification))throw new Error("Persisted App Builder world evidence does not match the saved specification.");
 return{
  success:true,
  replayed:true,
  specification,
  explanation:buildAppExplanation(specification),
  selfTest:verified.selfTest,
  executionVerification:verified.execution,
  selfHeal:verified.selfHeal,
  unifiedWorld,
  idempotency:{requestId,replayed:true,persisted:true},
  credits:{charged:0,requestId},
  app:{id:app.id,name:app.name,versionId:version.id,versionNo:version.version_no,visibility:app.visibility,publishStatus:app.publish_status}
 };
}

export async function POST(request){
 let userId=null,charged=false,chargeRequestId=null,entitlementSource=null,entitlementReserved=false,createdAppId=null,accessBound=false;
 try{
  const contentLength=Number(request.headers.get("content-length")||0);
  if(contentLength>MAX_REQUEST_BYTES)return json({success:false,error:"App generation request is too large."},413);

  const principal=await getBuilderPrincipal({requireVerified:true});
  if(!principal.ok){
   if(principal.code==="ACCOUNT_VERIFICATION_REQUIRED")return json({success:false,error:"Please verify your email or phone before creating an app."},403);
   return json({success:false,error:"Authentication required."},401);
  }
  userId=principal.principal.principalId;

  const body=await request.json().catch(()=>null);
  if(!body)return json({success:false,error:"Invalid app generation request."},400);
  if(Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_REQUEST_BYTES)return json({success:false,error:"App generation request is too large."},413);

  const idea=String(body?.idea||body?.prompt||"").trim(),voiceTranscript=String(body?.voiceTranscript||body?.transcript||"").trim(),requestedName=String(body?.requestedName||"").trim().slice(0,200),assetIds=Array.isArray(body?.assetIds)?[...new Set(body.assetIds.filter(v=>typeof v==="string"&&v.trim()).map(v=>v.trim()))].slice(0,20):[],referenceImages=Array.isArray(body?.referenceImages||body?.imageRefs)?(body.referenceImages||body.imageRefs).filter(v=>typeof v==="string"&&v.trim()).slice(0,10):[];
  const language=String(body?.language||"en").trim(),industry=String(body?.industry||"technology").trim(),terminology=Array.isArray(body?.terminology)?body.terminology:[],createDemoVideo=Boolean(body?.createDemoVideo),themeMode=["auto","preset","custom"].includes(body?.themeMode)?body.themeMode:"auto",themePreset=String(body?.themePreset||"auto").trim().slice(0,60),primaryColor=safeColor(body?.primaryColor),accentColor=safeColor(body?.accentColor),backgroundColor=safeColor(body?.backgroundColor),styleRequest=String(body?.styleRequest||"").trim().slice(0,500),wallpaperCookie=cookieValue(request,"ai_build_wallpaper"),requestedWallpaper=String(body?.wallpaperPreset||wallpaperCookie||""),wallpaperMode=body?.wallpaperMode==="selected"||(!body?.wallpaperMode&&requestedWallpaper&&requestedWallpaper!=="random")?"selected":"random",wallpaperPreset=wallpaperMode==="selected"?resolveWallpaperId(requestedWallpaper,"moon-city"):"";

  chargeRequestId=String(body?.requestId||"").trim();
  if(!REQUEST_ID.test(chargeRequestId))return json({success:false,error:"A stable generation request ID is required."},400);
  if(!idea&&!voiceTranscript)return json({success:false,error:"Please describe the app you want to build."},400);
  const combinedInput=[requestedName?`CUSTOMER-CHOSEN APP NAME: ${requestedName}`:"",idea,voiceTranscript].filter(Boolean).join("\n\n");
  if(combinedInput.length>8000)return json({success:false,error:"App description is too long."},413);

  const replay=await loadGenerationReplay(chargeRequestId);
  if(replay?.success)return json(replay);
  if(replay?.inProgress)return json({success:false,code:"GENERATION_REQUEST_IN_PROGRESS",error:"This exact build request is already being saved. Retry the same request ID to recover the saved project without creating a duplicate."},409);

  const inputs=await loadBuilderGenerationInputs({assetIds});
  if(!inputs.ok)throw new Error(`Builder generation inputs unavailable: ${inputs.code}`);
  const brandKit=inputs.brandKit||null,ownedAssets=inputs.ownedAssets||[];
  if(isMobileGameIdea(combinedInput)){const access=inputs.builderAccess,trustedGameGateway=request.headers.get("x-soolen-game-gateway")==="professional-fair-use";if(!access?.professional?.active||!trustedGameGateway)return json({success:false,code:"PRO_GAME_CREATOR_REQUIRED",error:"Mobile Game Creator is a Professional feature. Start game creation from the Pro Game Creator so Fair Use protections apply.",upgradePath:"/game-builder"},403);}
  const industryPlan=inferIndustryCapabilities({idea:combinedInput,industry});
  const brandBrief=buildBrandBrief(brandKit),buildInput=[combinedInput,industryPlan.brief,brandBrief].filter(Boolean).join("\n\n");

  const entitlement=await consumeAppBuilderEntitlement(userId,{operation:"create",appId:null,requestId:chargeRequestId});
  let creditCharge=null;
  if(!entitlement?.allowed){
    creditCharge=await consumeAiCredits(userId,{amount:GENERATE_CREDIT_COST,requestId:chargeRequestId,description:"AI app generation",metadata:{operation:"generate"}});
    charged=creditCharge?.charged===true;
  }else{
    entitlementSource=entitlement.source;
    entitlementReserved=true;
  }

  const postReservationReplay=await loadGenerationReplay(chargeRequestId);
  if(postReservationReplay?.success){
    if(entitlementReserved&&!entitlement?.replayed){try{await restoreFailedAppBuilderCreate(userId,{requestId:chargeRequestId})}catch{}}
    return json(postReservationReplay);
  }
  if(postReservationReplay?.inProgress||((entitlement?.replayed||creditCharge?.replayed)&&!postReservationReplay?.stalePartial)){
    return json({success:false,code:"GENERATION_REQUEST_IN_PROGRESS",error:"This exact build request is already running. Retry the same request ID to recover the saved project without creating a duplicate."},409);
  }

  const generationOptions={voiceTranscript,referenceImages,language,industry,terminology,createDemoVideo,brandKit:brandKit||null,themeMode,themePreset,primaryColor,accentColor,backgroundColor,styleRequest,wallpaperMode,wallpaperPreset};
  const adultRequirements={...(body?.requirements||{}),brandKit:brandKit||undefined,requestedName:requestedName||undefined,industryPlan:industryPlan.matched?{profileId:industryPlan.profileId,pages:industryPlan.pages,data:industryPlan.data,workflows:industryPlan.workflows,roles:industryPlan.roles,explicit:industryPlan.explicit}:undefined,themeMode,themePreset,primaryColor,accentColor,backgroundColor,styleRequest,wallpaperMode,wallpaperPreset};
  const adult=await runSoolenAdultMode({taskType:"app-build",goal:buildInput,privateData:referenceImages.length>0||assetIds.length>0,requirements:adultRequirements,maxRepairs:3,executors:[{id:"soolen-autonomous-engine",available:true,local:false,requiresNetwork:true,baseScore:50,historicalSuccess:0.5}],permissions:{network:true,privateUpload:referenceImages.length>0||assetIds.length>0}},{execute:async()=>runAutonomousEngine(buildInput,generationOptions),verify:async result=>{const report=verifyGeneration(result);return{passed:report.passed,report}},repair:async({result,review,verification})=>{const report=verification?.report||verifyGeneration(result),criticFailures=(review?.failed||[]).map(x=>x.id),instruction=buildRepairInstruction(report.execution||{}),selfHealInstruction=buildSelfHealInstruction({specification:report.normalized});return runAutonomousEngine(`${buildInput}\n\nSOOLEN AUTONOMOUS REPAIR + SELF-HEAL MODE\n${instruction}\n\n${selfHealInstruction}\nCritic failures: ${criticFailures.join(", ")||"none"}\nSelf-test failures: ${(report.selfTest?.errors||[]).join(", ")||"none"}\nDo not remove working features. Preserve the saved Brand Kit and customer-selected color/theme/wallpaper direction unless it conflicts with accessibility or safety. Preserve the customer's chosen app name. Never invent external-provider success. Return the full corrected specification only.`,generationOptions)}});

  let generationResult=adult.result,rescueAttempts=0,rescueRecovered=false,rescueDiagnostics=null;
  if(adult.generationStatus!=="verified"){
    let {review,report}=lastCriticSnapshot(adult,adultRequirements);
    for(let attempt=1;attempt<=QUALITY_GATE_RESCUE_ATTEMPTS;attempt+=1){
      const diagnostics=buildGenerationQualityDiagnostics({report,review,stage:"adult-repair-exhausted",attempts:attempt-1,maxAttempts:QUALITY_GATE_RESCUE_ATTEMPTS});
      const rescueInstruction=buildQualityGateRescueInstruction(diagnostics,attempt,QUALITY_GATE_RESCUE_ATTEMPTS),executionInstruction=buildRepairInstruction(report.execution||{}),selfHealInstruction=buildSelfHealInstruction({specification:report.normalized});
      generationResult=await runAutonomousEngine(`${buildInput}\n\n${rescueInstruction}\n\n${executionInstruction}\n\n${selfHealInstruction}`,generationOptions);
      rescueAttempts=attempt;
      review=runCriticChecks(generationResult,adultRequirements);
      report=verifyGeneration(generationResult);
      if(review.passed&&report.passed){
        rescueRecovered=true;
        rescueDiagnostics=buildGenerationQualityDiagnostics({report,review,stage:"targeted-rescue-recovered",attempts:rescueAttempts,maxAttempts:QUALITY_GATE_RESCUE_ATTEMPTS});
        break;
      }
    }
    if(!rescueRecovered){
      rescueDiagnostics=buildGenerationQualityDiagnostics({report,review,stage:"targeted-rescue-exhausted",attempts:rescueAttempts,maxAttempts:QUALITY_GATE_RESCUE_ATTEMPTS});
      throw qualityGateError("Soolen Super Brain could not verify the generated specification after autonomous repair attempts.",rescueDiagnostics);
    }
  }

  const verified=verifyGeneration(generationResult),finalReview=runCriticChecks(generationResult,adultRequirements);
  if(!verified.passed||!finalReview.passed){
    const diagnostics=buildGenerationQualityDiagnostics({report:verified,review:finalReview,stage:"final-verification",attempts:rescueAttempts,maxAttempts:QUALITY_GATE_RESCUE_ATTEMPTS});
    throw qualityGateError(`Generated app failed final verification: ${verified.errors.join("; ")}`,diagnostics);
  }
  const effectiveGenerationStatus=rescueRecovered?"verified":adult.generationStatus;
  const specification={...verified.normalized,name:requestedName||verified.normalized.name};
  const engineeringEvidence=sourceEngineeringEvidence(adult);
  const changeSummary=brandBrief?"Initial verified + self-healed build with saved Brand Kit":"Initial Soolen Super Brain generated, repaired, self-healed and verified application";
  const pages=Array.isArray(specification.pages)?specification.pages:[];
  const mediaAssignments=ownedAssets.map(asset=>choosePlacement(asset,pages));
  const finalDesign=specification?.designSystem||{},memoryScope=body?.innovationLearningConsent?"anonymized_patterns":"project_only";
  const realityEnvelope=bootstrapAppBuilderRealityEnvelope({identitySeed:chargeRequestId,specification,appVersionNo:1,verification:{selfTestPassed:verified.selfTest.ok,selfHealPassed:verified.selfHeal.passed,executionPassed:verified.execution.ok,executionRequired:true,qualityAccepted:true,qualityScore:verified.selfHeal.score}});
  const memoryPayload=mergeProjectMemory(null,{requestedName:requestedName||specification.name,brandPreferences:brandKit?{companyName:brandKit.company_name||"",logoReference:brandKit.logo_url||"",primaryColor:brandKit.primary_color||"",secondaryColor:brandKit.secondary_color||"",accentColor:brandKit.accent_color||"",fontStyle:brandKit.font_style||"",brandVoice:brandKit.brand_voice||""}:{},industryPlan:industryPlan.matched?{profileId:industryPlan.profileId,label:industryPlan.label,pages:industryPlan.pages,data:industryPlan.data,workflows:industryPlan.workflows,roles:industryPlan.roles,explicit:industryPlan.explicit}:{},visualPreferences:{themeMode:finalDesign.themeMode||themeMode,themePreset,primaryColor:finalDesign.primaryColor||primaryColor,accentColor:finalDesign.accentColor||accentColor,backgroundColor:finalDesign.backgroundColor||backgroundColor,styleRequest,wallpaperMode:finalDesign.wallpaperMode||wallpaperMode,wallpaperPreset:finalDesign.wallpaperPreset||wallpaperPreset},mediaPreferences:mediaAssignments.map(item=>({assetId:item.asset_id,page:item.suggested_page,role:item.suggested_role})),selfHeal:{score:verified.selfHeal.score,issues:verified.selfHeal.issues.length,passed:verified.selfHeal.passed},lastBuildAt:new Date().toISOString(),realityEnvelope:serializeAppBuilderRealityEnvelope(realityEnvelope)});

  const persistence=await persistBuilderGeneratedProject({requestId:chargeRequestId,name:String(specification.name||"Untitled App").trim(),description:String(specification.description||"").trim(),sourcePrompt:combinedInput,specification,changeSummary,memoryJson:memoryPayload,learningScope:memoryScope});
  if(!persistence.ok)throw new Error(`Atomic App + Website save failed: ${persistence.detail||persistence.code||"unknown persistence failure"}`);
  const persisted=persistence.persisted;
  createdAppId=persisted.app_id;
  if(persisted.memory_saved!==true)throw new Error("Atomic App + Unified World persistence did not confirm project memory.");
  const app={id:persisted.app_id,name:persisted.app_name||String(specification.name||"Untitled App").trim(),visibility:persisted.visibility||"private",publish_status:persisted.publish_status||"draft"};
  const version={id:persisted.version_id,version_no:Number(persisted.version_no||1)};

  if(persisted.replayed&&!persisted.recovered_partial){
    if(entitlementReserved&&!entitlement?.replayed){try{await restoreFailedAppBuilderCreate(userId,{requestId:chargeRequestId})}catch{}}
    if(charged&&!creditCharge?.replayed){try{await refundAiCredits(userId,{requestId:chargeRequestId,amount:GENERATE_CREDIT_COST,description:"Duplicate generation replay - automatic refund",metadata:{operation:"generate",reason:"atomic_replay"}})}catch{}}
    const atomicReplay=await loadGenerationReplay(chargeRequestId);
    if(atomicReplay?.success)return json(atomicReplay);
  }

  if(entitlementReserved){
    try{
      let binding=await bindAppBuilderProjectAccess(userId,{appId:app.id,requestId:chargeRequestId});
      if(!binding?.bound&&!binding?.replayed)binding=await bindAppBuilderProjectAccess(userId,{appId:app.id,requestId:chargeRequestId});
      accessBound=Boolean(binding?.bound||binding?.replayed);
    }catch(error){console.warn("PROJECT_ACCESS_BIND_ERROR:",error?.message||"unknown");}
  }
  const contextSave=await saveBuilderGeneratedProjectContext({projectId:app.id,assignments:mediaAssignments,memoryJson:memoryPayload,learningScope:memoryScope});
  if(!contextSave.ok)console.warn("PROJECT_CONTEXT_SAVE_ERROR:",contextSave.code);
  const unifiedWorld=summarizeAppBuilderRealityEnvelope(memoryPayload.realityEnvelope);

  const payload={success:true,...generationResult,specification,explanation:buildAppExplanation(specification),selfTest:verified.selfTest,executionVerification:verified.execution,selfHeal:verified.selfHeal,industryPlan:{matched:industryPlan.matched,profileId:industryPlan.profileId,label:industryPlan.label,pages:industryPlan.pages,data:industryPlan.data,workflows:industryPlan.workflows,roles:industryPlan.roles,explicit:industryPlan.explicit},brandKit:{applied:Boolean(brandBrief),companyName:brandKit?.company_name||null},theme:memoryPayload.visualPreferences,media:{attached:mediaAssignments.length,assignments:mediaAssignments.map(item=>({assetId:item.asset_id,page:item.suggested_page,role:item.suggested_role,reason:item.placement_reason}))},projectLearning:{scope:memoryScope,saved:Boolean(persisted.memory_saved||contextSave.ok&&contextSave.memorySaved)},unifiedWorld,superBrain:{mode:adult.mode,status:effectiveGenerationStatus,generationStatus:effectiveGenerationStatus,overallStatus:adult.status,sourceEngineering:engineeringEvidence,specialists:adult.specialists,decision:adult.decision?.reason,repairs:Math.max(0,(adult.criticHistory?.length||1)-1)+rescueAttempts,qualityGateRescue:{attempted:rescueAttempts>0,recovered:rescueRecovered,attempts:rescueAttempts,maxAttempts:QUALITY_GATE_RESCUE_ATTEMPTS},privacy:adult.privacy,checks:{selfTest:verified.selfTest.ok,selfHeal:verified.selfHeal.passed,buildableStructure:verified.execution.checks.buildableStructure,runtimeRoutesValid:verified.execution.checks.runtimeRoutesValid,securityPassed:verified.execution.checks.securityPassed,privacyPassed:verified.execution.checks.privacyPassed}},idempotency:{requestId:chargeRequestId,replayed:Boolean(persisted.replayed),recoveredPartial:Boolean(persisted.recovered_partial),persisted:true,atomic:true},entitlement:{source:entitlementSource,charged,projectAccessBound:accessBound},credits:{charged:charged?GENERATE_CREDIT_COST:0,requestId:chargeRequestId},app:{id:app.id,name:app.name,versionId:version.id,versionNo:version.version_no,visibility:app.visibility,publishStatus:app.publish_status}};
  return json(payload);
 }catch(error){
  if(createdAppId)return json({success:false,code:"GENERATION_REQUEST_IN_PROGRESS",error:"The core App + Website were saved, but the final response was interrupted. Retry the same request ID to recover the saved project without creating or charging again."},409);
  if(entitlementReserved&&chargeRequestId&&userId){try{await restoreFailedAppBuilderCreate(userId,{requestId:chargeRequestId})}catch{}}
  if(charged&&chargeRequestId&&userId){try{await refundAiCredits(userId,{requestId:chargeRequestId,amount:GENERATE_CREDIT_COST,description:"AI generation failed - automatic refund",metadata:{operation:"generate"}})}catch{}}
  const message=String(error?.message||""),diagnostics=error?.qualityDiagnostics||null;
  if(error?.code==="GENERATION_QUALITY_GATE_NOT_MET"||generationQualityGateFailure(message)){
   console.warn("AI BUILD APP & WEB quality gate:",JSON.stringify({code:"GENERATION_QUALITY_GATE_NOT_MET",requestId:chargeRequestId||null,primaryGate:diagnostics?.primaryGate||null,failedGateIds:diagnostics?.failedGateIds||[],issueCount:Number(diagnostics?.issueCount||0),rescueAttempts:Number(diagnostics?.rescueAttempts||0)}));
   return json({success:false,code:"GENERATION_QUALITY_GATE_NOT_MET",error:diagnostics?.userMessage||"LANERIQ could not produce a build that passed all verification gates. No project was finalized, and any reserved entitlement or charged credits were restored or refunded.",diagnostics:diagnostics||undefined,retryable:true},422);
  }
  if(message.includes("Another creation request is already in progress"))return json({success:false,error:"Another build is already in progress. Wait for it to finish before starting another."},409);
  if(message.includes("Insufficient credits"))return json({success:false,error:"Insufficient credits.",requiredCredits:GENERATE_CREDIT_COST},402);
  if(message.includes("Server financial runtime is not configured"))return json({success:false,error:"Secure billing runtime is not configured yet."},503);
  console.error("AI BUILD APP & WEB error:",error);
  return json({success:false,error:message||"Unable to generate the app. Any charged credits were automatically refunded."},500);
 }
}