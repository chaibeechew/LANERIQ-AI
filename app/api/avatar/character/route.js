import {NextResponse} from "next/server";
import {loadAvatarCharacter,saveAvatarCharacter} from "../../../../lib/cloud/avatar-characters.js";

const MAX_BYTES=48*1024;
function noStore(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function statusFor(code){if(code==="AUTHENTICATION_REQUIRED")return 401;if(code==="ACCOUNT_VERIFICATION_REQUIRED")return 403;if(code==="CHARACTER_ID_INVALID"||code==="CHARACTER_MANIFEST_INVALID")return 400;if(code==="CHARACTER_NOT_FOUND")return 404;if(code==="CHARACTER_REVISION_CONFLICT")return 409;return 500;}
function rowPayload(row){return{characterId:row.character_id,manifest:row.manifest,revision:row.revision,persistentMemoryOptIn:row.persistent_memory_opt_in,memoryBindingId:row.memory_binding_id||null,updatedAt:row.updated_at};}

export async function GET(request){
  try{
    const characterId=new URL(request.url).searchParams.get("characterId")||"";const result=await loadAvatarCharacter({characterId});
    if(!result.ok)return noStore({error:result.code==="CHARACTER_NOT_FOUND"?"Character not found.":result.code==="CHARACTER_ID_INVALID"?"A valid character ID is required.":result.code==="ACCOUNT_VERIFICATION_REQUIRED"?"Account verification is required.":result.code==="AUTHENTICATION_REQUIRED"?"Authentication required.":"Unable to load character.",code:result.code},statusFor(result.code));
    return noStore({success:true,...rowPayload(result.row)});
  }catch{return noStore({error:"Unable to load character."},500);}
}

export async function PUT(request){
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>MAX_BYTES)return noStore({error:"Character payload is too large."},413);
    const body=await request.json().catch(()=>null);if(!body)return noStore({error:"Invalid character payload."},400);if(Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_BYTES)return noStore({error:"Character payload is too large."},413);
    const rawExpected=Number(body.expectedRevision),expectedRevision=Number.isInteger(rawExpected)&&rawExpected>=0?rawExpected:null;
    const result=await saveAvatarCharacter({characterId:body.characterId,manifest:body.manifest,expectedRevision,persistentMemoryOptIn:Boolean(body.persistentMemoryOptIn),memoryBindingId:body.memoryBindingId});
    if(!result.ok){const status=statusFor(result.code);return noStore({error:result.code==="CHARACTER_REVISION_CONFLICT"?"Character changed on another device.":result.code==="CHARACTER_MANIFEST_INVALID"?"Invalid Living Character manifest.":result.code==="CHARACTER_ID_INVALID"?"A valid character ID is required.":result.code==="ACCOUNT_VERIFICATION_REQUIRED"?"Account verification is required.":result.code==="AUTHENTICATION_REQUIRED"?"Authentication required.":"Unable to save character.",code:result.code,revision:result.revision??undefined},status);}
    return noStore({success:true,...rowPayload(result.row)},result.created?201:200);
  }catch{return noStore({error:"Unable to save character."},500);}
}
