const SOURCE_POLICY=Object.freeze({
  production_exact_sha:{trust:1,independentRequired:true,canSupportProduction:true,refreshDays:14},
  deterministic_contract:{trust:0.95,independentRequired:false,canSupportProduction:true,refreshDays:90},
  official_docs:{trust:0.9,independentRequired:true,canSupportProduction:true,refreshDays:30},
  runtime_probe:{trust:0.9,independentRequired:true,canSupportProduction:true,refreshDays:30},
  physical_device:{trust:0.95,independentRequired:true,canSupportProduction:true,refreshDays:30},
  benchmark:{trust:0.85,independentRequired:true,canSupportProduction:true,refreshDays:30},
  incident:{trust:0.8,independentRequired:false,canSupportProduction:false,refreshDays:90},
  user_feedback:{trust:0.5,independentRequired:false,canSupportProduction:false,refreshDays:30},
  community_report:{trust:0.35,independentRequired:true,canSupportProduction:false,refreshDays:14},
  model_suggestion:{trust:0.2,independentRequired:true,canSupportProduction:false,refreshDays:1}
});
function clean(value,max=64){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

export function getKnowledgeSourcePolicy(type){const key=clean(type,40);return SOURCE_POLICY[key]?{type:key,...SOURCE_POLICY[key]}:{type:"unknown",trust:0,independentRequired:true,canSupportProduction:false,refreshDays:1};}

export function evaluateKnowledgeSources(sources=[]){
  const normalized=(Array.isArray(sources)?sources:[]).slice(0,16).map(source=>{const policy=getKnowledgeSourcePolicy(source?.type);return{...policy,passed:source?.passed===true,independent:source?.independent===true,ref:clean(source?.ref,120)};});
  const passed=normalized.filter(item=>item.passed);
  const highTrust=passed.filter(item=>item.trust>=0.85&&(item.independentRequired===false||item.independent===true));
  const productionSupport=highTrust.filter(item=>item.canSupportProduction);
  const modelOnly=passed.length>0&&passed.every(item=>item.type==="model_suggestion");
  return{contract:"laneriq-knowledge-source-trust-v1",sources:normalized,highTrustCount:highTrust.length,productionSupportCount:productionSupport.length,modelOnly,validatedSupport:highTrust.length>=1,productionSupport:productionSupport.length>=2&&!modelOnly};
}

export function knowledgeSourceTypes(){return Object.keys(SOURCE_POLICY);}
