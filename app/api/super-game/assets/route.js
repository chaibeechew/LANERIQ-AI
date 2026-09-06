import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server.js";

function json(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function looksLikeAvatar(asset){const intelligence=asset?.intelligence&&typeof asset.intelligence==="object"?asset.intelligence:{};return intelligence.mode==="avatar"||intelligence.purpose==="avatar"||/avatar|game character|npc|mascot|presenter/i.test(`${asset?.file_name||""} ${asset?.alt_text||""}`);}

export async function GET(){
  try{
    const supabase=await createClient();const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)return json({success:false,error:"Authentication required."},401);
    const{data,error}=await supabase.from("asset_library").select("id,file_name,storage_path,mime_type,category,alt_text,intelligence,created_at").eq("user_id",user.id).eq("category","image").order("created_at",{ascending:false}).limit(80);if(error)throw error;
    const rows=(data||[]).filter(looksLikeAvatar).slice(0,30);const assets=[];
    for(const item of rows){const{data:signed}=await supabase.storage.from("user-assets").createSignedUrl(item.storage_path,600);if(!signed?.signedUrl)continue;const intelligence=item.intelligence&&typeof item.intelligence==="object"?item.intelligence:{};assets.push({id:item.id,name:item.alt_text||item.file_name||"Avatar",image:signed.signedUrl,style:intelligence.style||null,source:intelligence.source||null,createdAt:item.created_at});}
    return json({success:true,avatars:assets,truth:"Only avatar-like assets owned by the signed-in user are returned. Preview URLs are short-lived."});
  }catch(error){console.error("SUPER_GAME_ASSET_LIST_ERROR",error?.code||error?.name||"unknown");return json({success:false,error:"Unable to load your Avatar assets."},500);}
}
