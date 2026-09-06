import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server.js";

function json(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function looksLikeAvatar(asset){const intelligence=asset?.intelligence&&typeof asset.intelligence==="object"?asset.intelligence:{};return intelligence.mode==="avatar"||intelligence.purpose==="avatar"||/avatar|game character|npc|mascot|presenter/i.test(`${asset?.file_name||""} ${asset?.alt_text||""}`);}
function reusableGameAsset(asset){return ["image","video"].includes(String(asset?.category||""))&&!looksLikeAvatar(asset);}
async function signedAsset(supabase,item){const{data:signed}=await supabase.storage.from("user-assets").createSignedUrl(item.storage_path,600);if(!signed?.signedUrl)return null;const intelligence=item.intelligence&&typeof item.intelligence==="object"?item.intelligence:{};return{id:item.id,name:item.alt_text||item.file_name||"Asset",url:signed.signedUrl,category:item.category,mimeType:item.mime_type||null,style:intelligence.style||null,source:intelligence.source||null,createdAt:item.created_at};}

export async function GET(){
  try{
    const supabase=await createClient();const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)return json({success:false,error:"Authentication required."},401);
    const{data,error}=await supabase.from("asset_library").select("id,file_name,storage_path,mime_type,category,alt_text,intelligence,created_at").eq("user_id",user.id).in("category",["image","video"]).order("created_at",{ascending:false}).limit(120);if(error)throw error;
    const avatarRows=(data||[]).filter(looksLikeAvatar).slice(0,30),sceneRows=(data||[]).filter(reusableGameAsset).slice(0,60);const avatars=[],sceneAssets=[];
    for(const item of avatarRows){const signed=await signedAsset(supabase,item);if(signed)avatars.push({id:signed.id,name:signed.name,image:signed.url,style:signed.style,source:signed.source,createdAt:signed.createdAt});}
    for(const item of sceneRows){const signed=await signedAsset(supabase,item);if(signed)sceneAssets.push(signed);}
    return json({success:true,avatars,sceneAssets,truth:"Only owner-scoped Avatar and reusable Image/Video assets are returned. Signed previews are short-lived and assets remain private."});
  }catch(error){console.error("SUPER_GAME_ASSET_LIST_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to load your private game assets."},500);}
}
