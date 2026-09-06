import {createLaneriqEngineeringProfile} from "./laneriq-engineering-knowledge.js";
import {budgetKnowledgeRules} from "./laneriq-knowledge-budget.js";

const DOMAIN_SIGNALS=Object.freeze({
  architecture:["architecture","adapter","provider","migration","service","boundary","portable","架构","迁移"],
  ai_orchestration:["agent","model","prompt","provider router","orchestration","inference","ai","智能体","模型"],
  product_generation:["generate","builder","app","website","workflow","product","生成","应用","网站"],
  frontend_liui:["ui","ux","liui","layout","responsive","accessibility","frontend","界面","设计"],
  backend_data:["database","data","schema","record","persist","supabase","backend","数据库","数据"],
  cloud_infrastructure:["cloud","vercel","deploy","capacity","server","slo","infrastructure","云","部署","服务器"],
  security:["security","auth","permission","secret","malware","abuse","ssrf","csrf","privacy","安全","权限","隐私"],
  media_image_video:["image","video","media","render","asset","avatar image","图片","视频","媒体"],
  mobile_local_compute:["mobile","ios","android","battery","thermal","gpu","npu","device","手机","电池","发热"],
  cost_governance:["cost","free","zero","metered","quota","billing","credits","成本","免费","付费"],
  avatar_living_character:["avatar","character","voice","lip sync","viseme","emotion","face rig","角色","头像","嘴型"],
  production_evidence:["production","release","live","sha","ci","preview","evidence","rollback","生产","发布","证据"]
});

const HIGH_RISK_SIGNALS=["delete","payment","billing","admin","secret","auth","permission","production","publish","deploy","database","migration","删除","付款","管理员","密钥","生产","发布","数据库","迁移"];
function clean(value,max=1200){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function normalize(value){return clean(value).toLowerCase();}
function includesAny(text,signals){return signals.some(signal=>text.includes(signal));}

export function routeEngineeringKnowledge({task="",platform="web",mode="balanced",maxDomains=6}={}){
  const text=normalize(task);
  const scored=Object.entries(DOMAIN_SIGNALS).map(([id,signals])=>({id,score:signals.reduce((n,signal)=>n+(text.includes(signal)?1:0),0)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const selected=[];
  const add=id=>{if(!selected.includes(id))selected.push(id);};
  for(const item of scored)add(item.id);
  const p=normalize(platform),m=normalize(mode);
  if(p.includes("ios")||p.includes("android")||p.includes("mobile"))add("mobile_local_compute");
  if(m==="zero"||m==="free")add("cost_governance");
  if(includesAny(text,HIGH_RISK_SIGNALS))add("security");
  if(text.includes("production")||text.includes("live")||text.includes("publish")||text.includes("deploy")||text.includes("生产")||text.includes("发布"))add("production_evidence");
  if(!selected.length){add("product_generation");add("architecture");}
  const bounded=selected.slice(0,Math.max(1,Math.min(8,Number(maxDomains)||6)));
  const profile=createLaneriqEngineeringProfile({focus:bounded,platform,mode});
  return{contract:"laneriq-knowledge-router-v1",selectedDomains:bounded,risk:includesAny(text,HIGH_RISK_SIGNALS)?"high":"normal",profile};
}

export function buildKnowledgePacket(options={}){
  const routed=routeEngineeringKnowledge(options);
  const allRules=routed.profile.domains.flatMap(domain=>domain.rules.slice(0,3));
  const budget=budgetKnowledgeRules(allRules,{maxRules:18,maxEstimatedTokens:1200});
  return{
    contract:"laneriq-knowledge-packet-v2",
    selectedDomains:routed.selectedDomains,
    risk:routed.risk,
    truthPrinciples:routed.profile.truthPrinciples,
    rules:budget.rules,
    estimatedTokens:budget.estimatedTokens,
    truncated:budget.truncated,
    instruction:["LANERIQ TASK-SCOPED ENGINEERING KNOWLEDGE:",...budget.rules.map((rule,index)=>`${index+1}. ${rule}.`),"AI output remains a candidate until deterministic validation and authority/evidence gates accept it.","Never self-promote a candidate lesson into a Production rule."].join("\n")
  };
}
