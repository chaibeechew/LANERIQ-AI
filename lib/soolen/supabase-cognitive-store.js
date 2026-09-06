import crypto from "node:crypto";

export const SUPABASE_COGNITIVE_STORE_VERSION = "1.0.0";

function text(value,max=800){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function sha(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}
function requireClient(client){if(!client||typeof client.from!=="function")throw new Error("LANERIQ_SUPABASE_CLIENT_REQUIRED");return client;}
function identity(input={}){
  const ownerId=text(input.ownerId,80);if(!ownerId)throw new Error("LANERIQ_COGNITIVE_OWNER_REQUIRED");
  return Object.freeze({ownerId,appId:text(input.appId,80)||null,migrationVerified:input.migrationVerified===true});
}

function failurePayload(id,scope,record){
  const safe={
    owner_id:id.ownerId,
    app_id:id.appId,
    scope_key:text(scope,200),
    record_id:text(record?.recordId,24),
    category:text(record?.category||"general",100),
    failure_code:text(record?.failureCode||"UNKNOWN",120),
    strategy:text(record?.strategy,800),
    repair_pattern:text(record?.repairPattern,800),
    success_after_repair:record?.successAfterRepair===true,
    provider_class:text(record?.providerClass,80),
    runtime_class:text(record?.runtimeClass,80),
    contains_customer_raw_data:false,
    contains_secrets:false,
  };
  safe.method_digest=sha(JSON.stringify(safe));
  if(!safe.scope_key||!/^[a-f0-9]{24}$/.test(safe.record_id))throw new Error("LANERIQ_FAILURE_MEMORY_RECORD_INVALID");
  return safe;
}

export function createSupabaseFailureMemoryAdapter(client,input={}){
  const db=requireClient(client);const id=identity(input);
  return Object.freeze({
    storageClass:"supabase:cognitive_failure_memory",
    productionVerified:id.migrationVerified,
    async load(scope){
      const key=text(scope,200);if(!key)throw new Error("LANERIQ_FAILURE_MEMORY_SCOPE_REQUIRED");
      const {data,error}=await db.from("cognitive_failure_memory").select("record_id,category,failure_code,strategy,repair_pattern,success_after_repair,provider_class,runtime_class,created_at").eq("owner_id",id.ownerId).eq("scope_key",key).order("created_at",{ascending:true}).limit(50);
      if(error)throw new Error(`LANERIQ_FAILURE_MEMORY_LOAD_FAILED:${text(error.code||error.message,120)}`);
      return {intelligenceFailureMemory:(data||[]).map(row=>({recordId:text(row.record_id,24),category:text(row.category,100),failureCode:text(row.failure_code,120),strategy:text(row.strategy,800),repairPattern:text(row.repair_pattern,800),successAfterRepair:row.success_after_repair===true,providerClass:text(row.provider_class,80),runtimeClass:text(row.runtime_class,80),containsCustomerRawData:false,containsSecrets:false,createdAt:row.created_at}))};
    },
    async save(scope,next){
      const records=Array.isArray(next?.intelligenceFailureMemory)?next.intelligenceFailureMemory:[];
      const record=records.at(-1);if(!record)return {ok:true,inserted:false};
      const payload=failurePayload(id,scope,record);
      const {error}=await db.from("cognitive_failure_memory").insert(payload);
      if(error&&String(error.code)!=="23505")return {ok:false,error:`LANERIQ_FAILURE_MEMORY_SAVE_FAILED:${text(error.code||error.message,120)}`};
      return {ok:true,inserted:!error,duplicate:String(error?.code||"")==="23505",recordId:payload.record_id,methodDigest:payload.method_digest};
    },
  });
}

export function createSupabaseCognitiveLedgerAdapter(client,input={}){
  const db=requireClient(client);const id=identity(input);
  return Object.freeze({
    storageClass:"supabase:cognitive_event_ledger",
    productionVerified:id.migrationVerified,
    async append(event={}){
      if(event.containsRawPrompt===true||event.containsCustomerRawData===true||event.containsSecrets===true)throw new Error("LANERIQ_COGNITIVE_LEDGER_PRIVATE_DATA_REJECTED");
      const safe={
        owner_id:id.ownerId,
        app_id:id.appId,
        operation_digest:/^[a-f0-9]{64}$/.test(text(event.operationDigest,64))?text(event.operationDigest,64):null,
        domain:text(event.domain,80),phase:text(event.phase,80),reasoning_mode:text(event.reasoningMode,40),evidence_class:text(event.evidenceClass,40).toUpperCase(),
        council_required:event.councilRequired===true,human_approval_required:event.humanApprovalRequired===true,outcome:text(event.outcome||"planned",80),provider_class:text(event.providerClass,80),latency_ms:Math.max(0,Math.min(3600000,Number(event.latencyMs)||0)),
        contains_raw_prompt:false,contains_customer_raw_data:false,contains_secrets:false,observed_at:event.observedAt||new Date().toISOString(),
      };
      safe.event_digest=sha(JSON.stringify(safe));
      const {error}=await db.from("cognitive_event_ledger").insert(safe);
      if(error&&String(error.code)!=="23505")throw new Error(`LANERIQ_COGNITIVE_LEDGER_APPEND_FAILED:${text(error.code||error.message,120)}`);
      return Object.freeze({ok:true,duplicate:String(error?.code||"")==="23505",eventDigest:safe.event_digest,storageClass:this.storageClass,productionVerified:this.productionVerified});
    },
  });
}

export function createSupabaseBenchmarkEvidenceAdapter(client,input={}){
  const db=requireClient(client);const id=identity(input);
  return Object.freeze({
    storageClass:"supabase:cognitive_benchmark_evidence",
    productionVerified:id.migrationVerified,
    async append(receipt={}){
      const evidenceClass=text(receipt.evidenceClass,40).toUpperCase();
      if(evidenceClass==="PRODUCTION"&&receipt.externallyVerified!==true)throw new Error("LANERIQ_PRODUCTION_BENCHMARK_EXTERNAL_VERIFICATION_REQUIRED");
      const safe={
        owner_id:id.ownerId,app_id:id.appId,campaign_id:text(receipt.campaignId,120),case_id:text(receipt.caseId||receipt.id,240),domain:text(receipt.domain,80),provider_class:text(receipt.providerClass||receipt.provider,80),model_class:text(receipt.modelClass,120),evidence_class:evidenceClass,
        score:Math.max(0,Math.min(100,Number(receipt.score)||0)),passed:receipt.passed===true,externally_verified:receipt.externallyVerified===true,duration_ms:Math.max(0,Math.min(3600000,Number(receipt.durationMs)||0)),prompt_digest:text(receipt.promptDigest,64),result_digest:text(receipt.resultDigest,64),
      };
      if(!safe.campaign_id||!safe.case_id||!safe.domain||!safe.provider_class||!/^[a-f0-9]{64}$/.test(safe.prompt_digest)||!/^[a-f0-9]{64}$/.test(safe.result_digest))throw new Error("LANERIQ_BENCHMARK_EVIDENCE_INVALID");
      const {error}=await db.from("cognitive_benchmark_evidence").insert(safe);
      if(error&&String(error.code)!=="23505")throw new Error(`LANERIQ_BENCHMARK_EVIDENCE_SAVE_FAILED:${text(error.code||error.message,120)}`);
      return Object.freeze({ok:true,duplicate:String(error?.code||"")==="23505",storageClass:this.storageClass,productionVerified:this.productionVerified});
    },
  });
}
