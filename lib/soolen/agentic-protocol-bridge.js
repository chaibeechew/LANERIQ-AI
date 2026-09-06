import crypto from "node:crypto";

export const LANERIQ_AGENTIC_PROTOCOL_BRIDGE_VERSION="1.0.0";
export const MCP_TARGET_SPEC="2026-07-28";
export const A2A_TARGET_VERSION="1.0.0";

export const A2A_TASK_STATES=Object.freeze([
  "TASK_STATE_UNSPECIFIED","TASK_STATE_SUBMITTED","TASK_STATE_WORKING","TASK_STATE_COMPLETED","TASK_STATE_FAILED","TASK_STATE_CANCELED","TASK_STATE_INPUT_REQUIRED","TASK_STATE_REJECTED","TASK_STATE_AUTH_REQUIRED",
]);

function text(value,max=1000){return String(value??"").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}
function cleanArray(value,max=50){return Array.isArray(value)?value.map(v=>text(v,200)).filter(Boolean).slice(0,max):[];}

export function createMcpStatelessEnvelope(input={}){
  const method=text(input.method,200);
  if(!method)throw new Error("LANERIQ_MCP_METHOD_REQUIRED");
  const name=text(input.name,200);
  const requestDigest=digest(JSON.stringify({method,name,params:input.params??{},taskId:text(input.taskId,200)}));
  return Object.freeze({
    bridgeVersion:LANERIQ_AGENTIC_PROTOCOL_BRIDGE_VERSION,
    protocol:"MCP",
    targetSpec:MCP_TARGET_SPEC,
    transportModel:"stateless-request-response",
    sessionRequired:false,
    headers:Object.freeze({"Mcp-Method":method,...(name?{"Mcp-Name":name}:{})}),
    request:Object.freeze({params:input.params??{},taskId:text(input.taskId,200)||null}),
    requestDigest,
    capabilityDiscoveryOptional:true,
    cacheableCatalogsPreferred:true,
    authorizationRequired:input.authorizationRequired!==false,
    externalConformanceVerified:false,
    mayClaimWireCompatibility:false,
  });
}

export function createA2AAgentCard(input={}){
  const name=text(input.name,120);
  const url=text(input.url,500);
  if(!name||!url)throw new Error("LANERIQ_A2A_AGENT_CARD_NAME_URL_REQUIRED");
  const skills=(Array.isArray(input.skills)?input.skills:[]).slice(0,50).map((skill,index)=>Object.freeze({
    id:text(skill?.id||`skill-${index+1}`,120),
    name:text(skill?.name||skill?.id||`Skill ${index+1}`,120),
    description:text(skill?.description,500),
    tags:Object.freeze(cleanArray(skill?.tags,20)),
  }));
  const card={
    protocolVersion:A2A_TARGET_VERSION,
    name,
    description:text(input.description,1000),
    url,
    preferredTransport:text(input.preferredTransport||"HTTP+JSON",80),
    capabilities:Object.freeze({streaming:input.streaming===true,pushNotifications:input.pushNotifications===true,extendedAgentCard:input.extendedAgentCard===true}),
    skills:Object.freeze(skills),
  };
  const cardDigest=digest(JSON.stringify(card));
  return Object.freeze({
    bridgeVersion:LANERIQ_AGENTIC_PROTOCOL_BRIDGE_VERSION,
    discoveryPath:"/.well-known/agent-card.json",
    card:Object.freeze(card),
    cardDigest,
    signaturePresent:Boolean(input.signature),
    signatureVerified:input.signatureVerified===true,
    externalTckVerified:false,
    mayClaimA2AConformance:false,
  });
}

export function createA2ATask(input={}){
  const state=text(input.state||"TASK_STATE_SUBMITTED",80).toUpperCase();
  if(!A2A_TASK_STATES.includes(state))throw new Error("LANERIQ_A2A_TASK_STATE_INVALID");
  const id=text(input.id,200)||digest(`${Date.now()}|${Math.random()}`).slice(0,32);
  const contextId=text(input.contextId,200)||null;
  return Object.freeze({
    id,
    contextId,
    status:Object.freeze({state,timestamp:new Date().toISOString()}),
    artifacts:Object.freeze(Array.isArray(input.artifacts)?input.artifacts.slice(0,50):[]),
    metadata:Object.freeze({...(input.metadata&&typeof input.metadata==="object"?input.metadata:{})}),
    internalStateHidden:true,
    credentialsIncluded:false,
  });
}

export function transitionA2ATask(task,nextState){
  if(!task?.id)throw new Error("LANERIQ_A2A_TASK_REQUIRED");
  const state=text(nextState,80).toUpperCase();
  if(!A2A_TASK_STATES.includes(state))throw new Error("LANERIQ_A2A_TASK_STATE_INVALID");
  const terminal=new Set(["TASK_STATE_COMPLETED","TASK_STATE_FAILED","TASK_STATE_CANCELED","TASK_STATE_REJECTED"]);
  if(terminal.has(task.status?.state))throw new Error("LANERIQ_A2A_TERMINAL_TASK_IMMUTABLE");
  return Object.freeze({...task,status:Object.freeze({state,timestamp:new Date().toISOString()})});
}

export function getAgenticProtocolStatus(){
  return Object.freeze({bridgeVersion:LANERIQ_AGENTIC_PROTOCOL_BRIDGE_VERSION,mcpTarget:MCP_TARGET_SPEC,a2aTarget:A2A_TARGET_VERSION,mcpStatelessSemanticsReady:true,a2aAgentCardAndTaskSemanticsReady:true,externalMcpConformanceVerified:false,externalA2ATckVerified:false,productionInteroperabilityClaimAllowed:false});
}
