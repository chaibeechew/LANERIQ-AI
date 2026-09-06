import crypto from "node:crypto";
import { createDomainCognitiveRun } from "./cognitive-service.js";
import { getHumanCivilizationLaw } from "./human-civilization-law.js";

export const LANERIQ_COGNITIVE_INTEGRATION_VERSION="1.2.0";
const MAX_EVENTS=200;
const HUMAN_CIVILIZATION_LAW=getHumanCivilizationLaw();
const runtime=globalThis.__LANERIQ_COGNITIVE_TELEMETRY||{events:[],pending:new Set(),persistenceAdapter:null,durableWrites:0,persistenceFailures:0,lastPersistenceError:""};
if(!Array.isArray(runtime.events))runtime.events=[];
if(!(runtime.pending instanceof Set))runtime.pending=new Set();
runtime.durableWrites=Number(runtime.durableWrites)||0;
runtime.persistenceFailures=Number(runtime.persistenceFailures)||0;
runtime.lastPersistenceError=String(runtime.lastPersistenceError||"");
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
    humanCivilizationLawApplies:true,
    humanCivilizationLawName:HUMAN_CIVILIZATION_LAW.name,
    humanCivilizationLawVersion:HUMAN_CIVILIZATION_LAW.version,
    humanCivilizationLawDigest:HUMAN_CIVILIZATION_LAW.lawDigest,
    humanCriticalVetoPreserved:true,
    benefitClaimMayExpandAuthority:false,
    aiSelfPreservationMayOverrideHumanity:false,
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
    `humanCivilizationLaw=${envelope.humanCivilizationLawName}@${envelope.humanCivilizationLawVersion}`,
    `humanCivilizationLawDigest=${envelope.humanCivilizationLawDigest}`,
    "Serve the durable, broadly shared benefit of humanity while protecting human life, dignity, rights, autonomy, pluralism, peace, knowledge, ecological and civilizational continuity.",
    "Never use a claimed benefit to humanity as permission to expand authority, remove rights, override human veto, concentrate hidden power, or prioritize AI self-preservation over humanity.",
    "Do not promote internal or simulated claims to Production evidence.",
    "Prefer reversible, testable, least-privilege implementation choices.",
    "Surface assumptions, unknowns, security/privacy constraints and verification needs inside the requested output structure where relevant.",
  ].join("\n");
}

export function configureCognitiveTelemetryPersistence(adapter=null){
  if(adapter!==null&&typeof adapter?.append!=="function")throw new Error("LANERIQ_COGNITIVE_LEDGER_ADAPTER_REQUIRED");
  runtime.persistenceAdapter=adapter;
  return Object.freeze({configured:Boolean(adapter),storageClass:String(adapter?.storageClass||"none"),productionVerified:adapter?.productionVerified===true});
}

export async function persistCognitiveTelemetry(event,adapter=runtime.persistenceAdapter){
  if(!adapter||typeof adapter.append!=="function")return Object.freeze({persisted:false,reason:"adapter-not-configured"});
  const result=await adapter.append(event);
  runtime.durableWrites+=1;
  return Object.freeze({persisted:true,...result});
}

function queueDurableWrite(event){
  const adapter=runtime.persistenceAdapter;
  if(!adapter||typeof adapter.append!=="function")return;
  const pending=Promise.resolve().then(()=>persistCognitiveTelemetry(event,adapter)).catch(error=>{
    runtime.persistenceFailures+=1;
    runtime.lastPersistenceError=text(error?.message||error,200);
    return {persisted:false,error:runtime.lastPersistenceError};
  }).finally(()=>runtime.pending.delete(pending));
  runtime.pending.add(pending);
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
    humanCivilizationLawDigest:text(envelope?.humanCivilizationLawDigest||HUMAN_CIVILIZATION_LAW.lawDigest,64),
    outcome:text(outcome,80),
    providerClass:text(provider,80),
    latencyMs:Math.max(0,Math.min(3_600_000,Number(latencyMs)||0)),
    containsRawPrompt:false,
    containsCustomerRawData:false,
    containsSecrets:false,
  });
  runtime.events.push(event);
  if(runtime.events.length>MAX_EVENTS)runtime.events.splice(0,runtime.events.length-MAX_EVENTS);
  queueDurableWrite(event);
  return event;
}

export async function flushCognitiveTelemetryPersistence(){
  const pending=[...runtime.pending];
  if(pending.length)await Promise.allSettled(pending);
  return Object.freeze({pending:runtime.pending.size,durableWrites:runtime.durableWrites,persistenceFailures:runtime.persistenceFailures,lastPersistenceError:runtime.lastPersistenceError});
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
  const adapter=runtime.persistenceAdapter;
  return Object.freeze({integrationVersion:LANERIQ_COGNITIVE_INTEGRATION_VERSION,eventCount:events.length,byDomain:Object.freeze(byDomain),events:Object.freeze(events),durable:Boolean(adapter)&&adapter.productionVerified===true&&runtime.persistenceFailures===0,durablePersistenceConfigured:Boolean(adapter),durableStorageClass:String(adapter?.storageClass||"none"),durableWrites:runtime.durableWrites,persistenceFailures:runtime.persistenceFailures,pendingWrites:runtime.pending.size,lastPersistenceError:runtime.lastPersistenceError,privacySafeMethodMetadataOnly:true,humanCivilizationLawDigest:HUMAN_CIVILIZATION_LAW.lawDigest});
}
