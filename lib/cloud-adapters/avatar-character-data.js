import {createClient as createProviderClient} from "../supabase/server.js";
import {createAdminClient as createProviderAdminClient} from "../supabase/admin.js";

function fail(code,detail=null,extra={}){return Object.freeze({ok:false,code,detail,...extra});}
function success(payload={}){return Object.freeze({ok:true,...payload});}
function normalizePrincipal(user){return Object.freeze({principalId:user.id,verified:Boolean(user.confirmed_at||user.email_confirmed_at||user.phone_confirmed_at)});}

async function resolvePrincipal(createClient,{requireVerified=true}={}){
  try{
    const client=await createClient();const{data,error}=await client.auth.getUser();
    if(error||!data?.user?.id)return fail("AUTHENTICATION_REQUIRED");
    const principal=normalizePrincipal(data.user);if(requireVerified&&!principal.verified)return fail("ACCOUNT_VERIFICATION_REQUIRED");
    return success({principal});
  }catch{return fail("AUTHENTICATION_REQUIRED");}
}

export function createAvatarCharacterDataAdapter({createClient=createProviderClient,createAdminClient=createProviderAdminClient}={}){
  return Object.freeze({
    id:"compatibility-avatar-character-data-v1",

    async loadCharacter({characterId}){
      const auth=await resolvePrincipal(createClient);if(!auth.ok)return auth;const userId=auth.principal.principalId,admin=createAdminClient();
      const{data,error}=await admin.from("living_characters").select("character_id,manifest,revision,persistent_memory_opt_in,memory_binding_id,updated_at").eq("user_id",userId).eq("character_id",characterId).maybeSingle();
      if(error)return fail("CHARACTER_LOAD_FAILED");if(!data)return fail("CHARACTER_NOT_FOUND");return success({principal:auth.principal,row:data});
    },

    async saveCharacter({characterId,manifest,expectedRevision=null,persistentMemoryOptIn=false,memoryBindingId=null}){
      const auth=await resolvePrincipal(createClient);if(!auth.ok)return auth;const userId=auth.principal.principalId,admin=createAdminClient();
      const{data:existing,error:lookupError}=await admin.from("living_characters").select("id,revision").eq("user_id",userId).eq("character_id",characterId).maybeSingle();
      if(lookupError)return fail("CHARACTER_SAVE_FAILED");
      const hasExpected=Number.isInteger(expectedRevision)&&expectedRevision>=0;
      if(existing){
        if(hasExpected&&expectedRevision!==Number(existing.revision))return fail("CHARACTER_REVISION_CONFLICT",null,{revision:Number(existing.revision)});
        const nextRevision=Number(existing.revision)+1;const{data,error}=await admin.from("living_characters").update({manifest,revision:nextRevision,persistent_memory_opt_in:Boolean(persistentMemoryOptIn),memory_binding_id:memoryBindingId||null,updated_at:new Date().toISOString()}).eq("id",existing.id).eq("user_id",userId).eq("revision",existing.revision).select("character_id,manifest,revision,persistent_memory_opt_in,memory_binding_id,updated_at").maybeSingle();
        if(error||!data)return fail("CHARACTER_REVISION_CONFLICT",null,{revision:Number(existing.revision)});return success({principal:auth.principal,row:data,created:false});
      }
      if(hasExpected&&expectedRevision!==0)return fail("CHARACTER_REVISION_CONFLICT",null,{revision:0});
      const{data,error}=await admin.from("living_characters").insert({user_id:userId,character_id:characterId,manifest,revision:1,persistent_memory_opt_in:Boolean(persistentMemoryOptIn),memory_binding_id:memoryBindingId||null}).select("character_id,manifest,revision,persistent_memory_opt_in,memory_binding_id,updated_at").single();
      if(error)return fail("CHARACTER_SAVE_FAILED");return success({principal:auth.principal,row:data,created:true});
    },

    async listContinuity({characterId}){
      const auth=await resolvePrincipal(createClient);if(!auth.ok)return auth;const userId=auth.principal.principalId,admin=createAdminClient();
      const{data,error}=await admin.from("living_character_devices").select("device_id_hash,device_class,continuity_snapshot,revision,last_seen_at").eq("user_id",userId).eq("character_id",characterId).order("revision",{ascending:false}).order("last_seen_at",{ascending:false}).limit(12);
      if(error)return fail("CHARACTER_CONTINUITY_LOAD_FAILED");return success({principal:auth.principal,rows:data||[]});
    },

    async saveContinuity({characterId,deviceIdHash,deviceClass,snapshot,revision}){
      const auth=await resolvePrincipal(createClient);if(!auth.ok)return auth;const userId=auth.principal.principalId,admin=createAdminClient();
      const{data:character,error:characterError}=await admin.from("living_characters").select("id").eq("user_id",userId).eq("character_id",characterId).maybeSingle();
      if(characterError)return fail("CHARACTER_LOOKUP_FAILED");if(!character)return fail("CHARACTER_SAVE_REQUIRED");
      const{data,error}=await admin.from("living_character_devices").upsert({user_id:userId,character_id:characterId,device_id_hash:deviceIdHash,device_class:deviceClass,continuity_snapshot:snapshot,revision,last_seen_at:new Date().toISOString()},{onConflict:"user_id,character_id,device_id_hash"}).select("device_id_hash,device_class,continuity_snapshot,revision,last_seen_at").single();
      if(error)return fail("CHARACTER_CONTINUITY_SAVE_FAILED");return success({principal:auth.principal,row:data});
    }
  });
}
