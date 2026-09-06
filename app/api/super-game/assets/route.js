import {NextResponse} from "next/server";
import {openSuperGameDataSession} from "../../../../lib/game/super-game-data.js";

function json(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function looksLikeAvatar(asset){const intelligence=asset?.intelligence&&typeof asset.intelligence==="object"?asset.intelligence:{};return intelligence.mode==="avatar"||intelligence.purpose==="avatar"||/avatar|game character|npc|mascot|presenter/i.test(`${asset?.file_name||""} ${asset?.alt_text||""}`);}
function reusableGameAsset(asset){return ["image","video"].includes(String(asset?.category||""))&&!looksLikeAvatar(asset);}
function reusableVoiceAsset(asset){return String(asset?.category||"")==="audio"||String(asset?.mime_type||"").startsWith("audio/");}
async function signedAsset(session,item){const url=await session.assets.signedUrl(item.storage_path,600);if(!url)return null;const intelligence=item.intelligence&&typeof item.intelligence==="object"?item.intelligence:{};return{id:item.id,name:item.alt_text||item.file_name||"Asset",url,category:item.category,mimeType:item.mime_type||null,style:intelligence.style||null,source:intelligence.source||null,createdAt:item.created_at};}

export async function GET(){
  try{
    const session=await openSuperGameDataSession();if(!session.user)return json({success:false,error:"Authentication required."},401);
    const data=await session.assets.rows(160);const avatarRows=data.filter(looksLikeAvatar).slice(0,30),sceneRows=data.filter(reusableGameAsset).slice(0,70),voiceRows=data.filter(reusableVoiceAsset).slice(0,30);const avatars=[],sceneAssets=[],voiceAssets=[];
    for(const item of avatarRows){const signed=await signedAsset(session,item);if(signed)avatars.push({id:signed.id,name:signed.name,image:signed.url,style:signed.style,source:signed.source,createdAt:signed.createdAt});}
    for(const item of sceneRows){const signed=await signedAsset(session,item);if(signed)sceneAssets.push(signed);}
    for(const item of voiceRows){const signed=await signedAsset(session,item);if(signed)voiceAssets.push(signed);}
    return json({success:true,avatars,sceneAssets,voiceAssets,truth:"Only owner-scoped Avatar and reusable Image/Video/Audio assets are returned. Signed previews are short-lived and assets remain private. Voice assets are references only until an approved voice runtime renders output with consent."});
  }catch(error){console.error("SUPER_GAME_ASSET_LIST_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to load your private game assets."},500);}
}
