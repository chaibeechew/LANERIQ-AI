import { createDomainCognitiveRun } from "./cognitive-service.js";
import { planAdaptiveInference } from "./adaptive-inference-control.js";
import { buildContextPack, buildContextInstruction } from "./context-engineering-runtime.js";
import { createMcpStatelessEnvelope, createA2AAgentCard, getAgenticProtocolStatus } from "./agentic-protocol-bridge.js";
import { createAgenticTrace } from "./agentic-trace-runtime.js";
import { planToolGuardrail } from "./tool-guardrail-runtime.js";

export const LANERIQ_AGENTIC_INTELLIGENCE_LAYER_VERSION="1.0.0";

export function createAgenticIntelligenceRun(domain,input={}){
  const cognitive=createDomainCognitiveRun(domain,input);
  const contextPack=buildContextPack(Array.isArray(input.contextSources)?input.contextSources:[],{maxChars:input.maxContextChars});
  const adaptiveInference=planAdaptiveInference({
    complexity:input.complexity??({"app-builder":.75,"malware-defense":.9,"ai-image":.65,"ai-video":.8,"production-release":1}[domain]??.5),
    uncertainty:cognitive.uncertainty.uncertainty,
    impact:input.impact??.7,
    risk:input.risk||({"malware-defense":"high","production-release":"critical"}[domain]||"medium"),
    zeroCost:input.zeroCost===true,
    availableProviderCount:input.availableProviderCount,
    requiresTools:cognitive.modelStrategy.requiredCapabilities.includes("tool_calling"),
    production:domain==="production-release"||input.production===true,
    destructive:input.destructive===true,
  });
  const toolGuardrail=input.toolName?planToolGuardrail({toolName:input.toolName,highRisk:input.highRiskTool===true,destructive:input.destructive===true,production:domain==="production-release"||input.production===true,financial:input.financial===true,critical:input.risk==="critical",network:input.network===true,executable:input.executable!==false}):null;
  const protocolTarget=String(input.protocolTarget||"internal").toLowerCase();
  const protocol=protocolTarget==="mcp"?createMcpStatelessEnvelope({method:input.protocolMethod||"tools/call",name:input.protocolName,params:input.protocolParams||{},taskId:input.taskId,authorizationRequired:true}):null;
  const agentCard=protocolTarget==="a2a"?createA2AAgentCard({name:input.agentName||"LANERIQ AI Agent",url:input.agentUrl||"https://laneriq-ai.vercel.app",description:input.agentDescription||"LANERIQ cognitive agent",skills:input.agentSkills||[],streaming:input.streaming===true,pushNotifications:input.pushNotifications===true,signature:input.agentCardSignature,signatureVerified:input.agentCardSignatureVerified===true}):null;
  const trace=createAgenticTrace({workflowName:`LANERIQ ${domain} Agentic Intelligence`,groupId:input.groupId});
  return Object.freeze({
    version:LANERIQ_AGENTIC_INTELLIGENCE_LAYER_VERSION,
    domain,
    cognitive,
    adaptiveInference,
    contextPack,
    contextInstruction:buildContextInstruction(contextPack),
    toolGuardrail,
    protocol,
    agentCard,
    protocolStatus:getAgenticProtocolStatus(),
    trace,
    architecture:Object.freeze({
      testTimeComputeScaling:true,
      verifierGuidedSelection:true,
      contextEngineering:true,
      promptInjectionQuarantine:true,
      perToolGuardrails:true,
      hierarchicalTracing:true,
      mcp20260728SemanticTarget:true,
      a2a100SemanticTarget:true,
      sandboxByDefaultForExecutableWork:adaptiveInference.sandboxRequired,
      providerIndependent:true,
    }),
    truthBoundary:Object.freeze({
      externalMcpConformanceVerified:false,
      externalA2ATckVerified:false,
      protocolProductionInteroperabilityClaimAllowed:false,
      inferenceQualityImprovementClaimRequiresBenchmarkEvidence:true,
      rawChainOfThoughtPersisted:false,
    }),
  });
}

export function getAgenticIntelligenceLayerStatus(){
  return Object.freeze({version:LANERIQ_AGENTIC_INTELLIGENCE_LAYER_VERSION,state:"CODE_AND_CI_TARGET",adaptiveTestTimeInference:true,contextEngineering:true,toolGuardrails:true,hierarchicalTrace:true,mcpTarget:"2026-07-28",a2aTarget:"1.0.0",mcpExternalConformance:"REQUIRED",a2aExternalTck:"REQUIRED",productionClaimAllowed:false});
}
