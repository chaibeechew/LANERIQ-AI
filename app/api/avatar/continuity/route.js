import {NextResponse} from "next/server";
import {loadAvatarContinuity,saveAvatarContinuity} from "../../../../lib/cloud/avatar-characters.js";

const MAX_BYTES=24*1024;
function noStore(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function statusFor(code){if(code==="AUTHENTICATION_REQUIRED")return 401;if(code==="ACCOUNT_VERIFICATION_REQUIRED")return 403;if(code==="CHARACTER_CONTINUITY_ID_INVALID"||code==="CHARACTER_CONTINUITY_SNAPSHOT_INVALID")return 400;if(code==="CHARACTER_SAVE_REQUIRED")return 409;return 500;}

export async function GET(request){
  try{
    const characterId=new URL(request.url).searchParams.get("characterId")||"";const result=await loadAvatarContinuity({characterId});
    if(!result.ok)return noStore({error:result.code==="CHARACTER_ID_INVALID"?"A valid character ID is required.":result.code==="ACCOUNT_VERIFICATION_REQUIRED"?"Account verification is required.":result.code==="AUTHENTICATION_REQUIRED"?"Authentication required.":"Unable to load character continuity.",code:result.code},result.code==="CHARACTER_ID_INVALID"?400:statusFor(result.code));
    return noStore({success:true,characterId,devices:(result.rows||[]).map(row=>({deviceIdHash:row.device_id_hash,deviceClass:row.device_class,snapshot:row.continuity_snapshot,revision:row.revision,lastSeenAt:row.last_seen_at}))});
  }catch{return noStore({error:"Unable to load character continuity."},500);}
}

export async function PUT(request){
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>MAX_BYTES)return noStore({error:"Continuity payload is too large."},413);
    const body=await request.json().catch(()=>null);if(!body)return noStore({error:"Invalid continuity payload."},400);if(Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_BYTES)return noStore({error:"Continuity payload is too large."},413);
    const result=await saveAvatarContinuity({characterId:body.characterId,deviceIdHash:body.deviceIdHash,deviceClass:body.deviceClass,snapshot:body.snapshot});
    if(!result.ok)return noStore({error:result.code==="CHARACTER_SAVE_REQUIRED"?"Save the character before syncing devices.":result.code==="CHARACTER_CONTINUITY_ID_INVALID"?"Valid character and device identifiers are required.":result.code==="CHARACTER_CONTINUITY_SNAPSHOT_INVALID"?"Invalid continuity snapshot.":result.code==="ACCOUNT_VERIFICATION_REQUIRED"?"Account verification is required.":result.code==="AUTHENTICATION_REQUIRED"?"Authentication required.":"Unable to sync character continuity.",code:result.code},statusFor(result.code));
    const row=result.row;return noStore({success:true,characterId:body.characterId,deviceIdHash:row.device_id_hash,deviceClass:row.device_class,snapshot:row.continuity_snapshot,revision:row.revision,lastSeenAt:row.last_seen_at});
  }catch{return noStore({error:"Unable to sync character continuity."},500);}
}
