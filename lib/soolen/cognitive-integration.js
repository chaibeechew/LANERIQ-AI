import crypto from "node:crypto";
import { createDomainCognitiveRun } from "./cognitive-service.js";

export const LANERIQ_COGNITIVE_INTEGRATION_VERSION="1.0.0";
const MAX_EVENTS=200;
const runtime=globalThis.__LANERIQ_COGNITIVE_TELEMETRY||{events:[]};
if(!Array.isArray(runtime.events))runtime.events=[];
globalThis.__LANERIQ_COGNITIVE_TELEMETRY=runtime;

function text(value,max=200){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function digest(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}
function safeOperationId(value){const raw=text(value,200);return raw?digest(raw):null;}

export function createCognitiveEnvelope(domain,input={}){
  const run=createDomainCognitiveRun(domain,input);
  const envelope=Object.freeze({
    integrationVersion:LANERIQ_COGNITIVE_INTEGRATION_VERSION,
    cognitiveOSVersion:run.cognitiveOSVersion,
    domain:String(domain),
    taskType:run.taskType,
    reasoningMode:run.reasoningMode,
    confidence:run.uncertainty.confidence,
    uncertainty:run.uncertainty.uncertainty,
    evidenceClass:run.uncertainty.evidenceClass,
    councilRequired:Boolean(run.council),
    simulationRequired:Boolean(run.simulation),
    humanApprovalRequired:Boolean(run.executionPolicy.humanApprovalRequired),
    automaticExecutionAllowed:Boolean(run.executionPolicy.automaticExecutionAllowed),
    rollbackPlanRequired:Boolean(run.executionPolicy.rollbackPlanRequired),
    providerIndependent:Boolean(run.modelStrategy.providerIndependent),
    requiredCapabilities:[...run.modelStrategy.requiredCapabilities],
    crossProviderVerificationPreferred:Boolean(run.modelStrategy.crossProviderVerificationPreferred),
    mayClaimProductionVerified:false,
  });
  return envelope;
}

export function cognitivePromptContract(envelope){
  if(!envelope)return"";
  return [
    "LANERIQ COGNITIVE EXECUTION CONTRACT:",
    `reasoningMode=${envelope.reasoningMode}`,
    `evidenceClass=${envelope.evidenceClass}`,
    `councilRequired=${envelope.councilRequired}`,
    `simulationRequired=${envelope.simulationRequired}`,
    `humanApprovalRequired=${envelope.humanApprovalRequired}`,
    "Do not promote internal or simulated claims to Production evidence.",
    "Prefer reversible, testable, least-privilege implementation choices.",
    "Surface assumptions, unknowns, security/privacy constraints and verification needs inside the requested output structure where relevant.",
  ].join("\n");
}

export function recordCognitiveTelemetry({domain,phase,envelope,operationId=null,outcome="planned",provider="",latencyMs=0}={}){
  const event=Object.freeze({
    schemaVersion:1,
    observedAt:new Date().toISOString(),
    domain:text(domain,80),
    phase:text(phase,80),
    operationDigest:safeOperationId(operationId),
    reasoningMode:text(envelope?.reasoningMode,40),
    evidenceClass:text(envelope?.evidenceClass,40),
    councilRequired:envelope?.councilRequired===true,
    humanApprovalRequired:envelope?.humanApprovalRequired===true,
    outcome:text(outcome,80),
    providerClass:text(provider,80),
    latencyMs:Math.max(0,Math.min(3_600_000,Number(latencyMs)||0)),
    containsRawPrompt:false,
    containsCustomerRawData:false,
    containsSecrets:false,
  });
  runtime.events.push(event);
  if(runtime.events.length>MAX_EVENTS)runtime.events.splice(0,runtime.events.length-MAX_EVENTS);
  return event;
}

export function getCognitiveTelemetrySnapshot(){
  const events=runtime.events.slice(-MAX_EVENTS);
  const byDomain={};
  for(const event of events){
    const key=event.domain||"unknown";
    const current=byDomain[key]||{events:0,councilRequired:0,humanApprovalRequired:0};
    current.events+=1;
    if(event.councilRequired)current.councilRequired+=1;
    if(event.humanApprovalRequired)current.humanApprovalRequired+=1;
    byDomain[key]=current;
  }
  return Object.freeze({integrationVersion:LANERIQ_COGNITIVE_INTEGRATION_VERSION,eventCount:events.length,byDomain:Object.freeze(byDomain),events:Object.freeze(events),durable:false,privacySafeMethodMetadataOnly:true});
}
