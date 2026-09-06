import {NextResponse} from "next/server";
import {openSuperGameDataSession,accountVerified} from "../../../../lib/game/super-game-data.js";
import {applyLivingWorldEvent,LIVING_WORLD_EVENT_TYPES} from "../../../../lib/game/living-world-runtime-v1.js";

const MAX=28*1024,REQUEST=/^[A-Za-z0-9._:-]{1,160}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,EVENT_SET=new Set(LIVING_WORLD_EVENT_TYPES);
function json(data,status=200){return NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}})}
function clean(v,max=800){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}

export async function POST(request){
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>MAX)return json({success:false,error:"Living World event is too large."},413);
    const session=await openSuperGameDataSession();if(!session.user)return json({success:false,error:"Authentication required."},401);if(!accountVerified(session))return json({success:false,error:"Account verification is required."},403);
    const body=await request.json().catch(()=>null);if(!body||Buffer.byteLength(JSON.stringify(body),"utf8")>MAX)return json({success:false,error:"Invalid Living World event."},400);
    const projectId=clean(body.projectId,80),eventKey=clean(body.eventKey,160),type=clean(body?.event?.type,60).toLowerCase();if(!UUID.test(projectId))return json({success:false,error:"A valid Living World project is required."},400);if(!REQUEST.test(eventKey))return json({success:false,error:"A stable Living World event key is required."},400);if(!EVENT_SET.has(type))return json({success:false,error:"Unsupported Living World event type."},400);
    const project=await session.livingWorld.projectById(projectId);if(!project)return json({success:false,error:"Living World project not found."},404);
    const nextState=applyLivingWorldEvent(project.manifest,project.state,{...body.event,type,key:eventKey});
    const payload={...body.event,type,key:eventKey};
    const result=await session.livingWorld.applyEventAtomic({projectId,expectedRevision:Number(project.revision||0),eventKey,eventType:type,payload,nextState});
    return json({success:true,replayed:Boolean(result?.replayed),project:result?.project||null,event:result?.event||null,truth:"Event and persistent world-state revision are committed atomically and remain owner scoped."});
  }catch(error){const message=String(error?.message||error?.details||"");if(/REVISION_CONFLICT/.test(message))return json({success:false,error:"Living World state changed before this event could be applied. Reload the latest state and retry with the same event key.",code:"LIVING_WORLD_REVISION_CONFLICT"},409);if(/PROJECT_NOT_FOUND/.test(message))return json({success:false,error:"Living World project not found."},404);console.error("LIVING_WORLD_EVENT_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to apply this Living World event right now."},500)}
}
