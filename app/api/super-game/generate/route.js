import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server.js";
import {POST as generateGame} from "../../game/generate/route.js";
import {buildSuperGameFusionRequest,normalizeAvatarSelections} from "../../../../lib/game/super-game-composer-v1.js";

const MAX_REQUEST_BYTES=40*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function clean(value,max=4000){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

export async function POST(request){
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>MAX_REQUEST_BYTES)return json({success:false,error:"Super Game request is too large."},413);
    const supabase=await createClient();const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)return json({success:false,error:"Authentication required."},401);
    const body=await request.json().catch(()=>null);if(!body||Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_REQUEST_BYTES)return json({success:false,error:"Invalid Super Game request."},400);
    const worldId=clean(body.worldId,80);if(!UUID.test(worldId))return json({success:false,error:"Choose a saved AI Map world first."},400);
    const{data:world,error:worldError}=await supabase.from("game_worlds").select("id,user_id,name,manifest").eq("id",worldId).eq("user_id",user.id).maybeSingle();if(worldError)throw worldError;if(!world)return json({success:false,error:"The selected AI Map is unavailable or not owned by this account."},404);
    const selections=normalizeAvatarSelections(body.avatarSelections);
    if(selections.length){const ids=selections.map(item=>item.assetId);const{data:assets,error:assetError}=await supabase.from("asset_library").select("id,intelligence,file_name,alt_text").eq("user_id",user.id).in("id",ids);if(assetError)throw assetError;const owned=new Set((assets||[]).map(item=>item.id));if(owned.size!==ids.length)return json({success:false,error:"One or more selected Avatar assets are unavailable or not owned by this account."},403);}
    const payload=buildSuperGameFusionRequest({requestId:body.requestId,idea:body.idea,worldManifest:world.manifest,avatarSelections:selections,genre:body.genre,playMode:body.playMode});
    payload.superGameFusion.worldId=world.id;payload.superGameFusion.worldName=world.name;
    const headers=new Headers(request.headers);headers.set("content-type","application/json");headers.delete("content-length");headers.set("x-laneriq-super-game-fusion","v1");
    const forwarded=new Request(request.url,{method:"POST",headers,body:JSON.stringify(payload)});const response=await generateGame(forwarded);response.headers.set("X-LANERIQ-Super-Game-Fusion","v1");response.headers.set("Cache-Control","private, no-store, max-age=0");return response;
  }catch(error){const message=String(error?.message||"");if(message==="SUPER_GAME_REQUEST_ID_REQUIRED")return json({success:false,error:"A stable Super Game request ID is required."},400);if(message==="AI_MAP_WORLD_ZONES_REQUIRED")return json({success:false,error:"The selected AI Map does not contain a valid world manifest."},400);console.error("SUPER_GAME_FUSION_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to start the Super Game fusion right now."},500);}
}
