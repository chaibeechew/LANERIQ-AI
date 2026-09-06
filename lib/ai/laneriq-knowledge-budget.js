function clean(value,max=500){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function estimateTokens(text){return Math.max(1,Math.ceil(clean(text,20000).length/4));}

export function budgetKnowledgeRules(rules=[], {maxRules=18,maxEstimatedTokens=1200}={}){
  const seen=new Set(),selected=[];let estimatedTokens=0;
  for(const raw of Array.isArray(rules)?rules:[]){
    const rule=clean(raw,500);if(!rule)continue;
    const key=rule.toLowerCase().replace(/\s+/g," ");if(seen.has(key))continue;
    const tokens=estimateTokens(rule);
    if(selected.length>=Math.max(1,Math.min(40,Number(maxRules)||18)))break;
    if(estimatedTokens+tokens>Math.max(128,Math.min(4096,Number(maxEstimatedTokens)||1200)))continue;
    seen.add(key);selected.push(rule);estimatedTokens+=tokens;
  }
  return{contract:"laneriq-knowledge-budget-v1",rules:selected,estimatedTokens,deduplicatedCount:seen.size,truncated:selected.length<(Array.isArray(rules)?rules.length:0),maxRules:Math.max(1,Math.min(40,Number(maxRules)||18)),maxEstimatedTokens:Math.max(128,Math.min(4096,Number(maxEstimatedTokens)||1200))};
}

export function buildBudgetedInstruction(header,rules,options={}){
  const budget=budgetKnowledgeRules(rules,options);
  return{...budget,instruction:[clean(header,120)||"LANERIQ KNOWLEDGE:",...budget.rules.map((rule,index)=>`${index+1}. ${rule}.`)].join("\n")};
}
