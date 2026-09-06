import crypto from "node:crypto";

export const AGENTIC_TRACE_RUNTIME_VERSION="1.0.0";
const MAX_SPANS=500;
const ALLOWED_SPAN_TYPES=new Set(["task","agent","turn","generation","tool","guardrail","handoff","verification","judge","self-heal","protocol"]);

function text(value,max=300){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}

export function createAgenticTrace(input={}){
  const workflowName=text(input.workflowName||"LANERIQ Cognitive Workflow",160);
  const traceId=`trace_${digest(`${workflowName}|${Date.now()}|${Math.random()}`).slice(0,32)}`;
  return {version:AGENTIC_TRACE_RUNTIME_VERSION,traceId,workflowName,groupDigest:input.groupId?digest(input.groupId):null,startedAt:new Date().toISOString(),endedAt:null,spans:[],containsRawPrompt:false,containsCustomerRawData:false,containsSecrets:false,durable:false};
}

export function startTraceSpan(trace,input={}){
  if(!trace?.traceId||!Array.isArray(trace.spans))throw new Error("LANERIQ_TRACE_REQUIRED");
  if(trace.spans.length>=MAX_SPANS)throw new Error("LANERIQ_TRACE_SPAN_LIMIT_REACHED");
  const type=text(input.type||"task",40).toLowerCase();
  if(!ALLOWED_SPAN_TYPES.has(type))throw new Error("LANERIQ_TRACE_SPAN_TYPE_INVALID");
  const parentId=text(input.parentId,80)||null;
  if(parentId&&!trace.spans.some(span=>span.spanId===parentId))throw new Error("LANERIQ_TRACE_PARENT_NOT_FOUND");
  const spanId=`span_${digest(`${trace.traceId}|${trace.spans.length}|${type}|${Date.now()}|${Math.random()}`).slice(0,24)}`;
  const span={spanId,parentId,type,name:text(input.name||type,160),startedAt:new Date().toISOString(),endedAt:null,status:"running",inputDigest:input.input!==undefined?digest(JSON.stringify(input.input)):null,outputDigest:null,metadata:Object.freeze({...((input.metadata&&typeof input.metadata==="object")?input.metadata:{})}),containsRawPrompt:false,containsCustomerRawData:false,containsSecrets:false};
  trace.spans.push(span);
  return spanId;
}

export function endTraceSpan(trace,spanId,input={}){
  const span=trace?.spans?.find(item=>item.spanId===spanId);
  if(!span)throw new Error("LANERIQ_TRACE_SPAN_NOT_FOUND");
  if(span.endedAt)throw new Error("LANERIQ_TRACE_SPAN_ALREADY_ENDED");
  span.endedAt=new Date().toISOString();
  span.status=input.status==="error"?"error":"completed";
  span.outputDigest=input.output!==undefined?digest(JSON.stringify(input.output)):null;
  return Object.freeze({...span});
}

export function finalizeAgenticTrace(trace){
  if(!trace?.traceId)throw new Error("LANERIQ_TRACE_REQUIRED");
  if(trace.spans.some(span=>!span.endedAt))throw new Error("LANERIQ_TRACE_OPEN_SPANS_REMAIN");
  trace.endedAt=new Date().toISOString();
  const canonical=trace.spans.map(span=>({spanId:span.spanId,parentId:span.parentId,type:span.type,name:span.name,status:span.status,inputDigest:span.inputDigest,outputDigest:span.outputDigest}));
  return Object.freeze({...trace,spans:Object.freeze(trace.spans.map(span=>Object.freeze({...span}))),traceDigest:digest(JSON.stringify(canonical)),durable:false,mayContainSensitivePayload:false});
}
