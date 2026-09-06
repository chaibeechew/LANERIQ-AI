function clean(v,max=96){return String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}
export const LANERIQ_KNOWLEDGE_DEPENDENCY_CONTRACT="laneriq-knowledge-dependency-graph-v1";
export function buildKnowledgeDependencyGraph({nodes=[],edges=[]}={}){
  const ids=[...new Set((Array.isArray(nodes)?nodes:[]).map(x=>clean(typeof x==="string"?x:x?.id)).filter(Boolean))];
  const allowed=new Set(ids),normalized=(Array.isArray(edges)?edges:[]).map(e=>({from:clean(e?.from),to:clean(e?.to),kind:clean(e?.kind,32)||"depends_on"})).filter(e=>allowed.has(e.from)&&allowed.has(e.to)&&e.from!==e.to);
  return{contract:LANERIQ_KNOWLEDGE_DEPENDENCY_CONTRACT,nodes:ids,edges:normalized};
}
export function detectKnowledgeCycles(graph={}){
  const adj=new Map((graph.nodes||[]).map(id=>[id,[]])); for(const e of graph.edges||[])adj.get(e.from)?.push(e.to);
  const visiting=new Set(),done=new Set(),cycles=[];
  function dfs(id,path){if(visiting.has(id)){const i=path.indexOf(id);cycles.push(path.slice(i).concat(id));return} if(done.has(id))return; visiting.add(id); for(const n of adj.get(id)||[])dfs(n,path.concat(n)); visiting.delete(id);done.add(id)}
  for(const id of graph.nodes||[])dfs(id,[id]); return{contract:"laneriq-knowledge-cycle-check-v1",hasCycle:cycles.length>0,cycles:cycles.slice(0,10)};
}
export function impactedKnowledge(graph={},changedIds=[]){
  const changed=new Set((Array.isArray(changedIds)?changedIds:[]).map(clean).filter(Boolean)),reverse=new Map((graph.nodes||[]).map(id=>[id,[]])); for(const e of graph.edges||[])reverse.get(e.to)?.push(e.from);
  const impacted=new Set(changed),queue=[...changed]; while(queue.length){const id=queue.shift();for(const d of reverse.get(id)||[])if(!impacted.has(d)){impacted.add(d);queue.push(d)}}
  return{contract:"laneriq-knowledge-impact-v1",changed:[...changed],impacted:[...impacted]};
}
