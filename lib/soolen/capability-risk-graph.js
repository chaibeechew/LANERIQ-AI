import crypto from "node:crypto";

export const CAPABILITY_RISK_GRAPH_VERSION="1.0.0";
const LEVELS=Object.freeze({LOW:20,MEDIUM:45,HIGH:70,CRITICAL:90});
function text(value,max=120){return String(value??"").trim().slice(0,max);}
function clamp(value,min=0,max=100){return Math.min(max,Math.max(min,Number(value)||0));}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function level(score){if(score>=LEVELS.CRITICAL)return "CRITICAL";if(score>=LEVELS.HIGH)return "HIGH";if(score>=LEVELS.MEDIUM)return "MEDIUM";return "LOW";}

export function createCapabilityRiskGraph(input={}){
  const rawNodes=Array.isArray(input.nodes)?input.nodes:[];
  const rawEdges=Array.isArray(input.edges)?input.edges:[];
  if(rawNodes.length>250||rawEdges.length>1000)throw new Error("LANERIQ_RISK_GRAPH_BOUNDS_EXCEEDED");
  const nodes=new Map();
  for(const row of rawNodes){
    const id=text(row.id,100);if(!id)throw new Error("LANERIQ_RISK_GRAPH_NODE_ID_REQUIRED");if(nodes.has(id))throw new Error("LANERIQ_RISK_GRAPH_DUPLICATE_NODE");
    nodes.set(id,Object.freeze({id,domain:text(row.domain,80)||"general",baseRisk:clamp(row.baseRisk),criticality:clamp(row.criticality),externalSideEffects:row.externalSideEffects===true,humanApprovalRequired:row.humanApprovalRequired===true,authorityExpanding:false}));
  }
  const edges=[];
  for(const row of rawEdges){const from=text(row.from,100),to=text(row.to,100);if(!nodes.has(from)||!nodes.has(to))throw new Error("LANERIQ_RISK_GRAPH_EDGE_NODE_MISSING");edges.push(Object.freeze({from,to,weight:Math.min(1,Math.max(0,Number(row.weight)||0.5)),kind:text(row.kind,50)||"dependency"}));}
  const body=Object.freeze({version:CAPABILITY_RISK_GRAPH_VERSION,nodes:Object.freeze([...nodes.values()]),edges:Object.freeze(edges)});
  return Object.freeze({...body,graphDigest:digest(body)});
}

export function evaluateCapabilityRisk(graph={},input={}){
  const target=text(input.targetId,100);const nodes=new Map((graph.nodes||[]).map(row=>[row.id,row]));
  if(!nodes.has(target))throw new Error("LANERIQ_RISK_GRAPH_TARGET_MISSING");
  const maxDepth=Math.min(8,Math.max(1,Number(input.maxDepth)||4));
  const incidentBoost=clamp(input.incidentSeverity,0,40);const queue=[{id:target,depth:0,signal:incidentBoost}];const visited=new Map();
  while(queue.length){const item=queue.shift();const previous=visited.get(item.id);if(previous!=null&&previous>=item.signal)continue;visited.set(item.id,item.signal);if(item.depth>=maxDepth)continue;
    for(const edge of graph.edges||[]){if(edge.from!==item.id)continue;queue.push({id:edge.to,depth:item.depth+1,signal:item.signal*edge.weight});}
  }
  const impacts=[];
  for(const [id,propagated] of visited){const node=nodes.get(id);const score=clamp(node.baseRisk*0.5+node.criticality*0.35+propagated+(node.externalSideEffects?10:0));impacts.push(Object.freeze({id,score,level:level(score),humanApprovalRequired:node.humanApprovalRequired||score>=LEVELS.CRITICAL}));}
  impacts.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const highest=impacts[0]||{score:0,level:"LOW"};
  return Object.freeze({targetId:target,highestRisk:highest.score,highestLevel:highest.level,impacts:Object.freeze(impacts),criticalImpacts:Object.freeze(impacts.filter(row=>row.level==="CRITICAL")),automaticProductionMutationAllowed:false,authorityExpansionAllowed:false,evaluationDigest:digest(impacts)});
}

export function compareRiskPosture(before={},after={}){
  const beforeScore=clamp(before.highestRisk),afterScore=clamp(after.highestRisk);const delta=afterScore-beforeScore;
  return Object.freeze({before:beforeScore,after:afterScore,delta,improved:delta<0,degraded:delta>0,requiresHumanReview:afterScore>=LEVELS.CRITICAL||delta>=15,automaticApprovalAllowed:false});
}
