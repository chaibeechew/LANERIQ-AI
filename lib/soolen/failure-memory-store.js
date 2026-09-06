import crypto from "node:crypto";
import { createFailureMemoryRecord } from "./cognitive-os.js";

export const FAILURE_MEMORY_STORE_VERSION="1.0.0";
export const MAX_FAILURE_MEMORY_RECORDS=50;

function text(value,max=300){return String(value??"").trim().slice(0,max);}
function hash(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}

export function sanitizeFailureMemoryRecord(input={}){
  const record=createFailureMemoryRecord(input);
  return Object.freeze({...record,recordId:hash(`${record.createdAt}|${record.category}|${record.failureCode}|${record.strategy}|${record.repairPattern}`).slice(0,24)});
}

export function appendFailureMemory(projectMemory={},input={}){
  const existing=Array.isArray(projectMemory?.intelligenceFailureMemory)?projectMemory.intelligenceFailureMemory:[];
  const record=sanitizeFailureMemoryRecord(input);
  const next=[...existing.filter(item=>item&&item.recordId!==record.recordId),record].slice(-MAX_FAILURE_MEMORY_RECORDS);
  return Object.freeze({...projectMemory,intelligenceFailureMemory:next});
}

export function summarizeFailureMemory(projectMemory={},options={}){
  const limit=Math.max(1,Math.min(20,Number(options.limit)||8));
  const rows=(Array.isArray(projectMemory?.intelligenceFailureMemory)?projectMemory.intelligenceFailureMemory:[]).slice(-limit).map(item=>({recordId:text(item.recordId,40),category:text(item.category,100),failureCode:text(item.failureCode,120),strategy:text(item.strategy,500),repairPattern:text(item.repairPattern,500),successAfterRepair:item.successAfterRepair===true,providerClass:text(item.providerClass,80),runtimeClass:text(item.runtimeClass,80)}));
  return Object.freeze({version:FAILURE_MEMORY_STORE_VERSION,count:rows.length,records:rows,containsCustomerRawData:false,containsSecrets:false});
}
