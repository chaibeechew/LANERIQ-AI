const DEFAULT_TTL_DAYS=Object.freeze({architecture:180,ai_orchestration:90,product_generation:120,frontend_liui:120,backend_data:120,cloud_infrastructure:60,security:45,media_image_video:60,mobile_local_compute:60,cost_governance:30,avatar_living_character:90,production_evidence:14});
function clean(value,max=80){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function parseTime(value){const t=Date.parse(String(value||""));return Number.isFinite(t)?t:null;}

export function evaluateKnowledgeFreshness(item={}, {now=new Date()}={}){
  const domain=clean(item?.domain,48)||"architecture",createdAt=parseTime(item?.createdAt),verifiedAt=parseTime(item?.verifiedAt),reference=verifiedAt??createdAt;
  const ttlDays=Math.max(1,Math.min(365,Number(item?.ttlDays)||DEFAULT_TTL_DAYS[domain]||90));
  const nowMs=now instanceof Date?now.getTime():parseTime(now);
  if(!Number.isFinite(nowMs))throw new Error("KNOWLEDGE_NOW_INVALID");
  if(reference===null)return{contract:"laneriq-knowledge-freshness-v1",domain,status:"unknown",usableForProduction:false,reason:"missing-verification-time",ttlDays,ageDays:null};
  const ageDays=Math.max(0,(nowMs-reference)/86400000),fresh=ageDays<=ttlDays;
  return{contract:"laneriq-knowledge-freshness-v1",domain,status:fresh?"fresh":"stale",usableForProduction:fresh,reason:fresh?"within-ttl":"verification-expired",ttlDays,ageDays:Number(ageDays.toFixed(2))};
}

export function requiresExternalRefresh(item={},options={}){
  const freshness=evaluateKnowledgeFreshness(item,options);
  const volatile=Boolean(item?.volatile===true)||["security","cloud_infrastructure","cost_governance","production_evidence"].includes(freshness.domain);
  return{...freshness,volatile,refreshRequired:volatile&&freshness.status!=="fresh"};
}

export function defaultKnowledgeTtlDays(domain){return DEFAULT_TTL_DAYS[clean(domain,48)]||90;}
