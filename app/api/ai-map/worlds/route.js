import {NextResponse} from "next/server";
import {integrationStatus} from "../../../../lib/integrations/server.js";
import {createAiMapWorldManifest} from "../../../../lib/game/super-game-composer-v1.js";
import {openSuperGameDataSession,accountVerified} from "../../../../lib/game/super-game-data.js";

const MAX_REQUEST_BYTES=24*1024;
const REQUEST_ID=/^[A-Za-z0-9._:-]{1,160}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function clean(value,max=4000){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}

export async function GET(){
  try{const session=await openSuperGameDataSession();if(!session.user)return json({success:false,error:"Authentication required."},401);const worlds=await session.worlds.list(50);return json({success:true,worlds,provider:{managedMapsReady:integrationStatus().maps.ready,liveGeospatialDataUsed:false},truth:"Saved AI Maps are owner-scoped semantic world plans. Live geospatial data is not claimed by this endpoint."});}
  catch(error){console.error("AI_MAP_LIST_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to load your AI Maps."},500);}
}

export async function POST(request){
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>MAX_REQUEST_BYTES)return json({success:false,error:"AI Map request is too large."},413);
    const session=await openSuperGameDataSession();if(!session.user)return json({success:false,error:"Authentication required."},401);if(!accountVerified(session))return json({success:false,error:"Account verification is required."},403);
    const body=await request.json().catch(()=>null);if(!body||Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_REQUEST_BYTES)return json({success:false,error:"Invalid AI Map request."},400);
    const requestId=clean(body.requestId,160);if(!REQUEST_ID.test(requestId))return json({success:false,error:"A stable AI Map request ID is required."},400);
    const prompt=clean(body.prompt,4000);if(!prompt)return json({success:false,error:"Describe the map or world you want to create."},400);
    const manifest=createAiMapWorldManifest({prompt,name:body.name,mode:body.mode,worldType:body.worldType,style:body.style,scale:body.scale});
    const existing=await session.worlds.byRequestId(requestId);
    if(existing){const same=existing.prompt===manifest.prompt&&existing.mode===manifest.mode&&existing.world_type===manifest.worldType&&existing.style===manifest.style&&existing.scale===manifest.scale;if(!same)return json({success:false,error:"This AI Map request ID was already used for different inputs.",code:"AI_MAP_REQUEST_ID_CONFLICT"},409);return json({success:true,replayed:true,world:existing,provider:{managedMapsReady:integrationStatus().maps.ready,liveGeospatialDataUsed:false}});}
    const world=await session.worlds.insert({request_id:requestId,name:manifest.title,mode:manifest.mode,prompt:manifest.prompt,world_type:manifest.worldType,style:manifest.style,scale:manifest.scale,manifest});
    return json({success:true,replayed:false,world,provider:{managedMapsReady:integrationStatus().maps.ready,liveGeospatialDataUsed:false},truth:"World created from LANERIQ semantic planning. No live map tiles or real-time traffic were used."},201);
  }catch(error){console.error("AI_MAP_CREATE_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to create this AI Map right now."},500);}
}

export async function DELETE(request){
  try{const session=await openSuperGameDataSession();if(!session.user)return json({success:false,error:"Authentication required."},401);const body=await request.json().catch(()=>null);const id=clean(body?.id,80);if(!UUID.test(id))return json({success:false,error:"A valid AI Map ID is required."},400);const data=await session.worlds.remove(id);if(!data)return json({success:false,error:"AI Map not found."},404);return json({success:true,deletedId:id});}
  catch(error){console.error("AI_MAP_DELETE_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to delete this AI Map right now."},500);}
}
