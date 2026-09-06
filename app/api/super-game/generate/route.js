import {NextResponse} from "next/server";
import {POST as generateGame} from "../../game/generate/route.js";
import {buildSuperGameFusionRequestV2,normalizeSuperGameAvatarSelections} from "../../../../lib/game/super-game-fusion-v2.js";
import {openSuperGameDataSession,accountVerified} from "../../../../lib/game/super-game-data.js";

const MAX_REQUEST_BYTES=56*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function clean(value,max=4000){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function uniqueIds(value,max){return [...new Set((Array.isArray(value)?value:[]).map(v=>clean(v,80)).filter(v=>UUID.test(v)))].slice(0,max);}

export async function POST(request){
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>MAX_REQUEST_BYTES)return json({success:false,error:"Super Game request is too large."},413);
    const session=await openSuperGameDataSession();if(!session.user)return json({success:false,error:"Authentication required."},401);if(!accountVerified(session))return json({success:false,error:"Account verification is required."},403);
    const body=await request.json().catch(()=>null);if(!body||Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_REQUEST_BYTES)return json({success:false,error:"Invalid Super Game request."},400);
    const worldId=clean(body.worldId,80);if(!UUID.test(worldId))return json({success:false,error:"Choose a saved AI Map world first."},400);
    const world=await session.worlds.byId(worldId);if(!world)return json({success:false,error:"The selected AI Map is unavailable or not owned by this account."},404);

    const selections=normalizeSuperGameAvatarSelections(body.avatarSelections);
    if(selections.length){const ids=selections.map(item=>item.assetId);const assets=await session.assets.byIds(ids);if(new Set(assets.map(item=>item.id)).size!==ids.length)return json({success:false,error:"One or more selected Avatar assets are unavailable or not owned by this account."},403);}

    const referenceAssetIds=uniqueIds(body.referenceAssetIds,20);
    if(referenceAssetIds.length){const rows=await session.assets.byIds(referenceAssetIds);const allowed=rows.filter(item=>["image","video"].includes(String(item.category||"")));if(new Set(allowed.map(item=>item.id)).size!==referenceAssetIds.length)return json({success:false,error:"One or more selected scene assets are unavailable, unsupported or not owned by this account."},403);}

    const forgeIds=uniqueIds(body.forgeBlueprintIds,20);let forgeBlueprints=[];
    if(forgeIds.length){const rows=await session.forge.byIds(forgeIds);const byId=new Map(rows.map(item=>[item.id,item.blueprint]));if(byId.size!==forgeIds.length)return json({success:false,error:"One or more selected Forge assets are unavailable or not owned by this account."},403);forgeBlueprints=forgeIds.map(id=>byId.get(id));}

    const payload=buildSuperGameFusionRequestV2({requestId:body.requestId,idea:body.idea,worldManifest:world.manifest,avatarSelections:selections,referenceAssetIds,genre:body.genre,playMode:body.playMode,forgeBlueprints,settings:body.settings});
    payload.superGameFusion.worldId=world.id;payload.superGameFusion.worldName=world.name;payload.superGameFusion.forge.blueprintIds=forgeIds;
    const headers=new Headers(request.headers);headers.set("content-type","application/json");headers.delete("content-length");headers.set("x-laneriq-super-game-fusion","v2");
    const forwarded=new Request(request.url,{method:"POST",headers,body:JSON.stringify(payload)});const response=await generateGame(forwarded);response.headers.set("X-LANERIQ-Super-Game-Fusion","v2");response.headers.set("Cache-Control","private, no-store, max-age=0");return response;
  }catch(error){const message=String(error?.message||"");if(message==="SUPER_GAME_REQUEST_ID_REQUIRED")return json({success:false,error:"A stable Super Game request ID is required."},400);if(message==="AI_MAP_WORLD_ZONES_REQUIRED")return json({success:false,error:"The selected AI Map does not contain a valid world manifest."},400);console.error("SUPER_GAME_FUSION_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to start the Super Game fusion right now."},500);}
}
