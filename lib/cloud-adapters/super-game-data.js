import {createClient} from "../supabase/server.js";

const WORLD_SELECT="id,request_id,name,mode,prompt,world_type,style,scale,manifest,created_at,updated_at";
const FORGE_SELECT="id,request_id,name,category,prompt,blueprint,created_at,updated_at";
const ASSET_SELECT="id,file_name,storage_path,mime_type,category,alt_text,intelligence,created_at";
const PROJECT_SELECT="id,request_id,name,world_id,manifest,state,revision,originality,created_at,updated_at";
const EVENT_SELECT="id,project_id,event_key,event_type,payload,created_at";
const AVATAR_PROFILE_SELECT="id,request_id,name,avatar_asset_id,profile,consent,created_at,updated_at";

function publicUser(user){return user?{id:user.id,confirmed_at:user.confirmed_at||null,email_confirmed_at:user.email_confirmed_at||null,phone_confirmed_at:user.phone_confirmed_at||null}:null;}
function verified(user){return Boolean(user&&(user.confirmed_at||user.email_confirmed_at||user.phone_confirmed_at));}
function failure(error){if(error)throw error;}

export async function openSuperGameDataAdapterSession(){
  const supabase=await createClient();
  const{data:{user},error}=await supabase.auth.getUser();
  const authUser=error?null:user;
  const userView=publicUser(authUser);
  const userId=authUser?.id||null;
  function ensure(){if(!userId)throw new Error("AUTH_REQUIRED");}

  return {
    user:userView,
    verified:verified(authUser),
    worlds:{
      async list(limit=50){ensure();const{data,error}=await supabase.from("game_worlds").select(WORLD_SELECT).eq("user_id",userId).order("created_at",{ascending:false}).limit(limit);failure(error);return data||[];},
      async byId(id){ensure();const{data,error}=await supabase.from("game_worlds").select(WORLD_SELECT).eq("id",id).eq("user_id",userId).maybeSingle();failure(error);return data||null;},
      async byRequestId(requestId){ensure();const{data,error}=await supabase.from("game_worlds").select(WORLD_SELECT).eq("user_id",userId).eq("request_id",requestId).maybeSingle();failure(error);return data||null;},
      async insert(row){ensure();const{data,error}=await supabase.from("game_worlds").insert({...row,user_id:userId}).select(WORLD_SELECT).single();failure(error);return data;},
      async remove(id){ensure();const{data,error}=await supabase.from("game_worlds").delete().eq("id",id).eq("user_id",userId).select("id").maybeSingle();failure(error);return data||null;}
    },
    forge:{
      async list(limit=100){ensure();const{data,error}=await supabase.from("game_forge_blueprints").select(FORGE_SELECT).eq("user_id",userId).order("created_at",{ascending:false}).limit(limit);failure(error);return data||[];},
      async byRequestId(requestId){ensure();const{data,error}=await supabase.from("game_forge_blueprints").select(FORGE_SELECT).eq("user_id",userId).eq("request_id",requestId).maybeSingle();failure(error);return data||null;},
      async byIds(ids){ensure();if(!ids.length)return[];const{data,error}=await supabase.from("game_forge_blueprints").select("id,blueprint").eq("user_id",userId).in("id",ids);failure(error);return data||[];},
      async insert(row){ensure();const{data,error}=await supabase.from("game_forge_blueprints").insert({...row,user_id:userId}).select(FORGE_SELECT).single();failure(error);return data;},
      async remove(id){ensure();const{data,error}=await supabase.from("game_forge_blueprints").delete().eq("id",id).eq("user_id",userId).select("id").maybeSingle();failure(error);return data||null;}
    },
    assets:{
      async rows(limit=160){ensure();const{data,error}=await supabase.from("asset_library").select(ASSET_SELECT).eq("user_id",userId).in("category",["image","video","audio"]).order("created_at",{ascending:false}).limit(limit);failure(error);return data||[];},
      async byIds(ids){ensure();if(!ids.length)return[];const{data,error}=await supabase.from("asset_library").select("id,file_name,storage_path,mime_type,category,alt_text,intelligence,created_at").eq("user_id",userId).in("id",ids);failure(error);return data||[];},
      async signedUrl(storagePath,expiresIn=600){ensure();const{data,error}=await supabase.storage.from("user-assets").createSignedUrl(storagePath,expiresIn);failure(error);return data?.signedUrl||null;}
    },
    livingWorld:{
      async listProjects(limit=50){ensure();const{data,error}=await supabase.from("living_world_projects").select(PROJECT_SELECT).eq("user_id",userId).order("created_at",{ascending:false}).limit(limit);failure(error);return data||[];},
      async projectById(id){ensure();const{data,error}=await supabase.from("living_world_projects").select(PROJECT_SELECT).eq("id",id).eq("user_id",userId).maybeSingle();failure(error);return data||null;},
      async projectByRequestId(requestId){ensure();const{data,error}=await supabase.from("living_world_projects").select(PROJECT_SELECT).eq("user_id",userId).eq("request_id",requestId).maybeSingle();failure(error);return data||null;},
      async insertProject(row){ensure();const{data,error}=await supabase.from("living_world_projects").insert({...row,user_id:userId}).select(PROJECT_SELECT).single();failure(error);return data;},
      async updateProjectState(id,expectedRevision,state,manifest=null,originality=null){ensure();const patch={state,revision:expectedRevision+1,updated_at:new Date().toISOString()};if(manifest)patch.manifest=manifest;if(originality)patch.originality=originality;const{data,error}=await supabase.from("living_world_projects").update(patch).eq("id",id).eq("user_id",userId).eq("revision",expectedRevision).select(PROJECT_SELECT).maybeSingle();failure(error);return data||null;},
      async eventByKey(projectId,eventKey){ensure();const{data,error}=await supabase.from("living_world_events").select(EVENT_SELECT).eq("project_id",projectId).eq("user_id",userId).eq("event_key",eventKey).maybeSingle();failure(error);return data||null;},
      async insertEvent(row){ensure();const{data,error}=await supabase.from("living_world_events").insert({...row,user_id:userId}).select(EVENT_SELECT).single();failure(error);return data;},
      async originalitySignatures(limit=120){ensure();const{data,error}=await supabase.from("living_world_originality_signatures").select("content_kind,signature_hash,sketch,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(limit);failure(error);return data||[];},
      async insertOriginalitySignature(row){ensure();const{data,error}=await supabase.from("living_world_originality_signatures").insert({...row,user_id:userId}).select("id,content_kind,signature_hash,sketch,created_at").single();if(error&&String(error.code||"")!=="23505")throw error;return data||null;}
    },
    avatarProfiles:{
      async list(limit=50){ensure();const{data,error}=await supabase.from("living_avatar_profiles").select(AVATAR_PROFILE_SELECT).eq("user_id",userId).order("created_at",{ascending:false}).limit(limit);failure(error);return data||[];},
      async byRequestId(requestId){ensure();const{data,error}=await supabase.from("living_avatar_profiles").select(AVATAR_PROFILE_SELECT).eq("user_id",userId).eq("request_id",requestId).maybeSingle();failure(error);return data||null;},
      async insert(row){ensure();const{data,error}=await supabase.from("living_avatar_profiles").insert({...row,user_id:userId}).select(AVATAR_PROFILE_SELECT).single();failure(error);return data;}
    }
  };
}
