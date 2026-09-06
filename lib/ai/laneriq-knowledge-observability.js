function clean(value,max=80){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function boundedInt(value,max=100000){const n=Math.floor(Number(value)||0);return Math.max(0,Math.min(max,n));}

export function createKnowledgeTelemetry({selectedDomains=[],risk="normal",candidateCreated=false,promotionDecision="none",blockedReasons=[],ruleCount=0,estimatedTokens=0}={}){
  const domains=[...new Set((Array.isArray(selectedDomains)?selectedDomains:[]).map(item=>clean(item,48)).filter(Boolean))].slice(0,12);
  const reasons=[...new Set((Array.isArray(blockedReasons)?blockedReasons:[]).map(item=>clean(item,64)).filter(Boolean))].slice(0,12);
  const normalizedRisk=clean(risk,16).toLowerCase();
  return{
    contract:"laneriq-knowledge-telemetry-v1",
    selectedDomains:domains,
    selectedDomainCount:domains.length,
    risk:["normal","high","critical"].includes(normalizedRisk)?normalizedRisk:"normal",
    candidateCreated:candidateCreated===true,
    promotionDecision:["none","blocked","promotable"].includes(clean(promotionDecision,24))?clean(promotionDecision,24):"none",
    blockedReasons:reasons,
    ruleCount:boundedInt(ruleCount,100),
    estimatedTokens:boundedInt(estimatedTokens,20000),
    includesRawPrompt:false,
    includesUserContent:false,
    includesSecrets:false,
    includesProviderCredentials:false
  };
}

export function publicKnowledgeTelemetry(telemetry={}){
  return{contract:"laneriq-public-knowledge-telemetry-v1",selectedDomainCount:boundedInt(telemetry?.selectedDomainCount,12),risk:clean(telemetry?.risk,16)||"normal",candidateCreated:telemetry?.candidateCreated===true,promotionDecision:clean(telemetry?.promotionDecision,24)||"none",blockedReasonCount:Array.isArray(telemetry?.blockedReasons)?telemetry.blockedReasons.length:0,ruleCount:boundedInt(telemetry?.ruleCount,100),estimatedTokens:boundedInt(telemetry?.estimatedTokens,20000)};
}
