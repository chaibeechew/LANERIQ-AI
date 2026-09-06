import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server.js";
import { createAdminClient } from "../../../../lib/supabase/admin.js";
import { WALLPAPER_PRESETS,wallpaperDataUri,pickWallpaperForStage } from "../../../../lib/design/wallpaper-presets.js";
import { generateExternalImages, getImageGenerationConfig, ImageGenerationGatewayError } from "../../../../lib/ai/image-generation-gateway.js";
import { getImageMarketRuntimeReadiness,runMarketHardenedImageGeneration } from "../../../../lib/ai/image-market-runtime.js";
import { persistGeneratedImages,replayPersistedImages,DurableImageOutputError } from "../../../../lib/ai/image-output-persistence.js";
import { buildImagePlacementPrompt,getImagePlacementPolicy } from "../../../../lib/ai/image-placement-policy.js";
import { consumeAiCredits,refundAiCredits } from "../../../../lib/app-builder-finance.js";

const HEX=/^#[0-9a-f]{6}$/i;
const REQUEST_ID=/^[a-zA-Z0-9._:-]{1,160}$/;
const STYLES=new Set(["cinematic","luxury","modern","minimal","friendly","bold"]);
const PALETTES=new Set(["auto","luxury","tech","pastel","nature","custom"]);
const IMAGE_GENERATION_CREDIT_COST=Math.max(1,Number(process.env.IMAGE_GENERATION_CREDIT_COST||2));
const MAX_REQUEST_BYTES=32*1024;
const STALE_PENDING_MS=90*1000;
function safeColor(value,fallback){const v=String(value||"").trim();return HEX.test(v)?v:fallback;}
function promptPalette(prompt,preset="auto"){
  if(preset==="luxury")return ["#10251f","#d8bf62","#050d0b","#f4ead0"];
  if(preset==="tech")return ["#102a43","#37b6d8","#06121d","#eaf7ff"];
  if(preset==="pastel")return ["#715b79","#efb6c8","#201725","#fff1f6"];
  if(preset==="nature")return ["#1e513d","#b8d66b","#07130f","#ecf4df"];
  const p=String(prompt||"").toLowerCase();if(/real estate|property|房地产|房产/.test(p))return["#0b3b2e","#d8bf62","#03100d","#f4efe0"];if(/food|restaurant|咖啡|餐厅/.test(p))return["#63331f","#e6a23c","#180b07","#fff4e5"];if(/health|medical|医院|医疗/.test(p))return["#126e82","#78c6a3","#04191d","#f2fbfa"];if(/finance|bank|金融|银行/.test(p))return["#102a43","#3c9d9b","#06121d","#eaf4f4"];return["#173f35","#d8bf62","#06120f","#f5f8f5"];
}
function iconSvg({primary,accent,background,variation=0,title=""}){const mark=variation%3===0?`<path d="M330 520 L512 300 L694 520 L620 520 L620 700 L404 700 L404 520Z" fill="${accent}"/><circle cx="512" cy="455" r="54" fill="${background}"/>`:variation%3===1?`<circle cx="512" cy="512" r="230" fill="${primary}"/><path d="M350 560 C410 360 610 330 690 500 C620 450 550 470 500 590 C455 690 385 660 350 560Z" fill="${accent}"/>`:`<rect x="300" y="300" width="424" height="424" rx="130" fill="${primary}"/><path d="M390 535 Q510 345 635 535 Q510 690 390 535Z" fill="${accent}"/>`;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><radialGradient id="g"><stop stop-color="${accent}" stop-opacity=".3"/><stop offset="1" stop-color="${background}" stop-opacity="0"/></radialGradient></defs><rect width="1024" height="1024" rx="190" fill="${background}"/><circle cx="760" cy="230" r="300" fill="url(#g)"/>${mark}${title?`<text x="512" y="850" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="46" font-weight="700">${title.replace(/[<>&]/g,"").slice(0,24)}</text>`:""}</svg>`;}
function noStore(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function localImages({count,mode,style,paletteName,placement,placementPrompt,primary,accent,background,textColor,includeText,prompt}){const images=[];for(let i=0;i<count;i++){if(mode==="icon"){const svg=iconSvg({primary,accent,background,variation:i,title:includeText?prompt.split(/[.!?。！？]/)[0]:""});images.push({id:`icon-${i+1}`,image:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,mode,style,palette:paletteName,source:"local",placement});continue;}const wallpaperPreset=pickWallpaperForStage(`${mode}-${style}-${i}`,`${placementPrompt}-${paletteName}`);const image=wallpaperDataUri(wallpaperPreset,{primary,accent,background,surface:textColor});images.push({id:`visual-${i+1}`,image,mode,style,palette:paletteName,wallpaperPreset,wallpaperName:WALLPAPER_PRESETS.find(x=>x.id===wallpaperPreset)?.name||wallpaperPreset,source:"local",placement});}return images;}
function requestHash(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
async function readRequest(admin,userId,requestId){const{data,error}=await admin.from("image_generation_requests").select("id,user_id,request_id,request_hash,status,result,error_code,created_at,updated_at").eq("user_id",userId).eq("request_id",requestId).maybeSingle();if(error)throw new Error("IMAGE_REQUEST_LOOKUP_FAILED");return data||null;}
async function claimRequest(admin,{userId,requestId,hash}){
  const now=new Date().toISOString();const{data:inserted,error:insertError}=await admin.from("image_generation_requests").insert({user_id:userId,request_id:requestId,request_hash:hash,status:"pending",updated_at:now}).select("id,user_id,request_id,request_hash,status,result,error_code,created_at,updated_at").single();
  if(!insertError&&inserted)return{state:"claimed",row:inserted};if(String(insertError?.code||"")!=="23505")throw new Error("IMAGE_REQUEST_CLAIM_FAILED");
  let existing=await readRequest(admin,userId,requestId);if(!existing)throw new Error("IMAGE_REQUEST_LOOKUP_FAILED");if(existing.request_hash!==hash)return{state:"conflict",row:existing};if(existing.status==="succeeded"||existing.status==="fallback")return{state:"replay",row:existing};if(existing.status==="failed")return{state:"failed",row:existing};
  const updatedAt=Date.parse(existing.updated_at||"");if(Number.isFinite(updatedAt)&&Date.now()-updatedAt<STALE_PENDING_MS)return{state:"pending",row:existing};
  const{data:taken,error:takeError}=await admin.from("image_generation_requests").update({updated_at:now,error_code:null}).eq("id",existing.id).eq("user_id",userId).eq("status","pending").eq("updated_at",existing.updated_at).select("id,user_id,request_id,request_hash,status,result,error_code,created_at,updated_at").maybeSingle();if(takeError)throw new Error("IMAGE_REQUEST_RECLAIM_FAILED");if(taken)return{state:"claimed",row:taken,reclaimed:true};existing=await readRequest(admin,userId,requestId);if(existing?.status==="succeeded"||existing?.status==="fallback")return{state:"replay",row:existing};return{state:"pending",row:existing};
}
async function completeRequest(admin,{rowId,userId,status,result,errorCode=null}){const{data,error}=await admin.from("image_generation_requests").update({status,result,error_code:errorCode,updated_at:new Date().toISOString()}).eq("id",rowId).eq("user_id",userId).eq("status","pending").select("id").maybeSingle();if(error||!data)throw new Error("IMAGE_REQUEST_COMPLETE_FAILED");}
async function failRequest(admin,{rowId,userId,errorCode}){if(!rowId||!userId)return;try{await admin.from("image_generation_requests").update({status:"failed",result:null,error_code:String(errorCode||"IMAGE_GENERATION_FAILED").slice(0,120),updated_at:new Date().toISOString()}).eq("id",rowId).eq("user_id",userId).eq("status","pending");}catch{}}

export async function POST(request){
  let userId=null,chargeRequestId=null,charged=false,requestRowId=null,admin=null;
  try{
    const contentLength=Number(request.headers.get("content-length")||0);if(contentLength>MAX_REQUEST_BYTES)return noStore({error:"Image request is too large."},413);
    const supabase=await createClient();const {data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)return noStore({error:"Authentication required."},401);userId=user.id;if(!user.confirmed_at&&!user.email_confirmed_at&&!user.phone_confirmed_at)return noStore({error:"Account verification is required."},403);
    const body=await request.json().catch(()=>null);if(!body)return noStore({error:"Invalid image generation request."},400);if(Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_REQUEST_BYTES)return noStore({error:"Image request is too large."},413);
    const prompt=String(body?.prompt||"").trim();if(!prompt)return noStore({error:"Image prompt is required."},400);if(prompt.length>4000)return noStore({error:"Image prompt is too long."},413);chargeRequestId=String(body?.requestId||"").trim();if(!REQUEST_ID.test(chargeRequestId))return noStore({error:"A stable image request ID is required."},400);
    const mode=["image","wallpaper","background","hero","icon","product"].includes(body?.mode)?body.mode:"image";const placement=getImagePlacementPolicy(mode);const placementPrompt=buildImagePlacementPrompt(prompt,mode);const requestedStyle=String(body?.style||"cinematic").trim().toLowerCase();const style=STYLES.has(requestedStyle)?requestedStyle:"cinematic";const requestedPalette=String(body?.palette||"auto").trim().toLowerCase();const paletteName=PALETTES.has(requestedPalette)?requestedPalette:"auto";const count=Math.min(4,Math.max(1,Math.floor(Number(body?.count)||1)));const [basePrimary,baseAccent,baseBackground,textColor]=promptPalette(prompt,paletteName);const primary=safeColor(body?.primaryColor,basePrimary),accent=safeColor(body?.accentColor,baseAccent),background=safeColor(body?.backgroundColor,baseBackground);const includeText=Boolean(body?.includeText);
    admin=createAdminClient();const hash=requestHash({prompt,mode,style,paletteName,count,primary,accent,background,includeText});const claim=await claimRequest(admin,{userId:user.id,requestId:chargeRequestId,hash});
    if(claim.state==="conflict")return noStore({error:"This image request ID was already used for a different request.",code:"IMAGE_REQUEST_ID_CONFLICT"},409);
    if(claim.state==="failed")return noStore({error:"This image request finished unsuccessfully. Start a new image request.",code:"IMAGE_GENERATION_RETRY_NEW_ID"},409);
    if(claim.state==="pending")return noStore({error:"This image request is still processing.",code:"IMAGE_GENERATION_IN_PROGRESS",retryAfterMs:2000},409);
    requestRowId=claim.row.id;
    if(claim.state==="replay"){
      const saved=claim.row.result||{};
      if(saved.source==="model"){
        const images=await replayPersistedImages({admin,userId:user.id,assetIds:saved.assetIds,mode,style,palette:paletteName,placement});
        return noStore({success:true,image:images[0]?.image||null,images,engine:"Soolen Image Runtime",generated:true,replayed:true,durable:true,mode,style,palette:paletteName,source:"model",placement,hardened:Boolean(saved.hardened),truth:saved.truth||null,quality:saved.quality||null,evidenceDigest:saved.evidenceDigest||null,credits:{charged:0,requestId:chargeRequestId,balance:null},note:"Recovered the same provider generation from your private Asset Library without running the provider again."});
      }
      const images=localImages({count,mode,style,paletteName,placement,placementPrompt,primary,accent,background,textColor,includeText,prompt});
      return noStore({success:true,image:images[0]?.image||null,images,engine:"Soolen Visual Engine",generated:true,replayed:true,mode,style,palette:paletteName,source:"local",placement,credits:{charged:0,requestId:chargeRequestId,balance:null},modelFallback:Boolean(saved.modelFailureCode),modelFailureCode:saved.modelFailureCode||null,note:"Recovered the same zero-cost local fallback without running an external provider again."});
    }

    const gateway=getImageGenerationConfig();const market=getImageMarketRuntimeReadiness();let modelFailureCode="";let balance=null;
    if(mode!=="icon"&&gateway.configured){
      if(market.mode==="enforce"&&!market.executionReady){modelFailureCode="IMAGE_MARKET_RUNTIME_NOT_READY";}
      else try{
        const charge=await consumeAiCredits(user.id,{amount:IMAGE_GENERATION_CREDIT_COST,requestId:chargeRequestId,description:"AI image generation",metadata:{operation:"image_generate",mode,count,marketHardening:market.mode}});charged=Boolean(charge?.charged);balance=charge?.balance??null;
        const generated=market.executionReady
          ?await runMarketHardenedImageGeneration({prompt:placementPrompt,style,palette:paletteName,count,requestId:chargeRequestId})
          :await generateExternalImages({prompt:placementPrompt,mode,style,palette:paletteName,count,colors:{primary,accent,background}});
        if(generated.generated){
          const lifecycle=generated.hardened?{task:"image.generate",promptHash:requestHash({prompt:placementPrompt}),truth:[generated.truth],quality:generated.quality,evidenceDigest:generated.evidenceDigest}:{};
          const durableImages=await persistGeneratedImages({admin,userId:user.id,requestId:chargeRequestId,items:generated.images,mode,style,palette:paletteName,placement,lifecycle});
          await completeRequest(admin,{rowId:requestRowId,userId:user.id,status:"succeeded",result:{source:"model",assetIds:durableImages.map(item=>item.assetId),hardened:Boolean(generated.hardened),truth:generated.truth||null,quality:generated.quality||null,evidenceDigest:generated.evidenceDigest||null}});
          return noStore({success:true,image:durableImages[0]?.image||null,images:durableImages,engine:generated.hardened?"LANERIQ Hardened Image Runtime":"Soolen Image Runtime",generated:true,replayed:false,durable:true,mode,style,palette:paletteName,source:"model",placement,hardened:Boolean(generated.hardened),truth:generated.truth||null,quality:generated.quality||null,evidenceDigest:generated.evidenceDigest||null,marketReady:generated.readiness?.marketReady===true,credits:{charged:charged?IMAGE_GENERATION_CREDIT_COST:0,requestId:chargeRequestId,balance},note:generated.hardened?"Provider output passed the LANERIQ real-output quality, safety, provenance and signed-observer gate before private durable capture.":"Provider output was captured server-side into your private Asset Library before being shown, so an expiring provider URL is never the only copy."});
        }
      }catch(error){
        modelFailureCode=error instanceof ImageGenerationGatewayError||error instanceof DurableImageOutputError?error.code:/insufficient credits/i.test(String(error?.message||""))?"IMAGE_CREDITS_UNAVAILABLE":"IMAGE_MODEL_UNAVAILABLE";
        if(charged){try{await refundAiCredits(user.id,{requestId:chargeRequestId,amount:IMAGE_GENERATION_CREDIT_COST,description:"AI image generation failed - automatic refund",metadata:{operation:"image_generate",mode,marketHardening:market.mode}})}catch{}charged=false;}
      }
    }

    const images=localImages({count,mode,style,paletteName,placement,placementPrompt,primary,accent,background,textColor,includeText,prompt});await completeRequest(admin,{rowId:requestRowId,userId:user.id,status:"fallback",result:{source:"local",modelFailureCode:modelFailureCode||null},errorCode:modelFailureCode||null});
    return noStore({success:true,image:images[0]?.image||null,images,engine:"Soolen Visual Engine",generated:true,replayed:false,mode,style,palette:paletteName,source:"local",placement,credits:{charged:0,requestId:chargeRequestId,balance},modelFallback:Boolean(modelFailureCode),modelFailureCode:modelFailureCode||null,marketHardeningMode:market.mode,marketReady:market.marketReady,note:gateway.blockedByCostPolicy?"A connected external image runtime is blocked by the current cost policy, so the original local visual engine was used instead.":modelFailureCode?"The connected image runtime did not pass the required provider, quality, safety, provenance or durable-capture gate, so no model output was claimed and the original local visual engine was used instead.":"Original prompt-driven SVG visual generation with placement-aware responsive composition guidance. This local visual engine is not presented as photorealistic external-model output."});
  }catch(error){
    console.error("SOOLEN_VISUAL_ENGINE_ERROR:",error?.code||error?.name||"unknown");if(charged&&chargeRequestId&&userId){try{await refundAiCredits(userId,{requestId:chargeRequestId,amount:IMAGE_GENERATION_CREDIT_COST,description:"AI image generation failed - automatic refund",metadata:{operation:"image_generate"}})}catch{}}if(admin&&requestRowId&&userId)await failRequest(admin,{rowId:requestRowId,userId,errorCode:error?.code||error?.message||"IMAGE_GENERATION_FAILED"});return noStore({error:"Unable to generate image right now."},500);
  }
}
