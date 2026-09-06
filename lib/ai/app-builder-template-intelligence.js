import { getTemplateCatalog } from "../templateCatalog.js";

export const APP_BUILDER_TEMPLATE_INTELLIGENCE_VERSION="1.0.0";

function scoreTemplate(template,intent){
  let score=0;
  if(template.industry===intent.industry)score+=45;
  if(template.archetypeId===intent.archetypeId)score+=30;
  if(template.styleId===intent.styleId)score+=15;
  if(intent.target==="app+website"&&(template.targets||[]).includes("app")&&(template.targets||[]).includes("website"))score+=8;
  else if((template.targets||[]).includes(intent.target))score+=8;
  if(template.responsive?.mobileFirst===true)score+=4;
  if(template.application?.mode==="inspiration-only")score+=2;
  return Math.round((score+(Number(template.score)||0)/1000)*100)/100;
}

export function rankAppBuilderTemplates(intent,{limit=6}={}){
  if(!intent?.industry||!intent?.archetypeId)throw new Error("LANERIQ_APP_BUILDER_DESIGN_INTENT_REQUIRED");
  const safeLimit=Math.max(1,Math.min(12,Number(limit)||6));
  const matches=getTemplateCatalog()
    .map(template=>({template,fitScore:scoreTemplate(template,intent)}))
    .sort((a,b)=>b.fitScore-a.fitScore||a.template.id.localeCompare(b.template.id))
    .slice(0,safeLimit)
    .map(({template,fitScore})=>Object.freeze({
      templateId:template.id,
      title:template.title,
      industry:template.industry,
      archetypeId:template.archetypeId,
      styleId:template.styleId,
      pages:Object.freeze([...template.pages]),
      features:Object.freeze([...template.features]),
      fitScore,
      source:template.source,
      applicationMode:template.application?.mode||"inspiration-only",
      directCopyAllowed:false,
      preserveThirdPartyBranding:false,
      mobileFirst:template.responsive?.mobileFirst===true,
    }));
  return Object.freeze({
    version:APP_BUILDER_TEMPLATE_INTELLIGENCE_VERSION,
    strategy:"rank-canonical-inspiration-then-recompose",
    templateCountEvaluated:getTemplateCatalog().length,
    matches:Object.freeze(matches),
    selected:matches[0]||null,
    directTemplateCloningAllowed:false,
    thirdPartyBrandPreservationAllowed:false,
  });
}
