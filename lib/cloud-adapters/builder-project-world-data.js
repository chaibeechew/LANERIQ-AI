import { createBuilderProjectDataAdapter as createBaseAdapter } from './builder-project-data.js';
import { createClient as createProviderClient } from '../supabase/server.js';
import { createAdminClient as createProviderAdminClient } from '../supabase/admin.js';

function fail(code,detail=null){return Object.freeze({ok:false,code,detail});}
function success(payload={}){return Object.freeze({ok:true,...payload});}

export function createBuilderProjectDataAdapter({
  createClient=createProviderClient,
  createAdminClient=createProviderAdminClient,
}={}){
  const base=createBaseAdapter({createClient,createAdminClient});
  return Object.freeze({
    ...base,
    id:'compatibility-builder-project-world-data-v1',

    async loadGenerationReplay({requestId}){
      const result=await base.loadGenerationReplay({requestId});
      if(!result?.ok||!result.app)return result;
      const client=await createClient();
      const {data:memory,error}=await client.from('project_memory').select('memory_json,learning_scope').eq('app_id',result.app.id).eq('owner_id',result.principal.principalId).maybeSingle();
      if(error)return fail('GENERATION_REPLAY_MEMORY_LOOKUP_FAILED',error.message);
      return success({...result,memory:memory||null});
    },

    async loadGameCapacityContext({appId}){
      const inputs=await base.loadGenerationInputs({assetIds:[]});
      if(!inputs?.ok)return inputs;
      const userId=inputs.principal.principalId;
      const client=await createClient();
      const {data:project,error:projectError}=await client.from('apps').select('id,current_version_id').eq('id',appId).eq('owner_id',userId).maybeSingle();
      if(projectError||!project)return fail('PROJECT_NOT_FOUND',projectError?.message||null);
      if(!project.current_version_id)return fail('PROJECT_VERSION_NOT_FOUND');
      const {data:version,error:versionError}=await client.from('app_versions').select('id,specification').eq('id',project.current_version_id).eq('app_id',project.id).maybeSingle();
      if(versionError||!version)return fail('PROJECT_VERSION_NOT_FOUND',versionError?.message||null);
      const specification=version.specification||{};
      if(specification?.productType!=="mobile_game"&&specification?.game?.enabled!==true)return fail('PROJECT_NOT_GAME');
      return success({principal:inputs.principal,builderAccess:inputs.builderAccess,project,version});
    },

    async persistGeneratedProject({requestId,name,description,sourcePrompt,specification,changeSummary,memoryJson,learningScope='project_only'}){
      const principal=await base.currentPrincipal({requireVerified:true});
      if(!principal?.ok)return principal;
      const admin=createAdminClient();
      const {data,error}=await admin.rpc('server_persist_generated_project_world',{
        p_user_id:principal.principal.principalId,
        p_request_id:requestId,
        p_name:name,
        p_description:description,
        p_source_prompt:sourcePrompt,
        p_specification:specification,
        p_change_summary:changeSummary,
        p_memory_json:memoryJson||{},
        p_learning_scope:String(learningScope||'project_only'),
      });
      if(error||!data?.success)return fail('GENERATED_PROJECT_PERSIST_FAILED',error?.message||'unknown persistence failure');
      return success({principal:principal.principal,persisted:data});
    },

    async loadModificationContext({appId,requestId}){
      const result=await base.loadModificationContext({appId,requestId});
      if(!result?.ok||!result.project?.current_version_id)return result;
      const client=await createClient();
      const {data,error}=await client.from('app_versions').select('id,version_no,specification,created_at').eq('id',result.project.current_version_id).eq('app_id',appId).maybeSingle();
      if(error||!data)return fail('CURRENT_VERSION_LOAD_FAILED',error?.message||null);
      return success({...result,currentVersion:data});
    },

    async saveModification({appId,expectedVersionId,requestId,specification,changeSummary,memoryJson,learningScope='project_only'}){
      const principal=await base.currentPrincipal({requireVerified:true});
      if(!principal?.ok)return principal;
      const userId=principal.principal.principalId;
      const client=await createClient();
      const {data:project,error:projectError}=await client.from('apps').select('id,current_version_id').eq('id',appId).eq('owner_id',userId).maybeSingle();
      if(projectError||!project)return fail('PROJECT_NOT_FOUND',projectError?.message||null);
      if(project.current_version_id!==expectedVersionId)return fail('PROJECT_CHANGED_DURING_MODIFICATION');
      const admin=createAdminClient();
      const {data:version,error}=await admin.rpc('server_save_app_modification_world',{
        p_user_id:userId,
        p_app_id:appId,
        p_expected_version_id:expectedVersionId,
        p_request_id:requestId,
        p_specification:specification,
        p_change_summary:changeSummary,
        p_memory_json:memoryJson||{},
        p_learning_scope:String(learningScope||'project_only'),
      });
      if(error)return fail('MODIFICATION_SAVE_FAILED',error.message);
      let savedVersion=version;
      if(version?.replayed){
        const {data:persisted,error:persistedError}=await client.from('app_versions').select('id,version_no,created_at,specification').eq('id',version.id).eq('app_id',appId).maybeSingle();
        if(persistedError||!persisted?.specification)return fail('MODIFICATION_REPLAY_LOAD_FAILED',persistedError?.message||null);
        savedVersion=persisted;
      }
      return success({principal:principal.principal,version:savedVersion,replayed:Boolean(version?.replayed),memorySaved:true,worldMemoryAtomic:true});
    },
  });
}
