export const VISUAL_REGION_RESOLVER_VERSION="1.0.0";

const REGION_RULES=[
  ["left",/(left|left side|左边|左侧|左面)/i],
  ["right",/(right|right side|右边|右侧|右面)/i],
  ["top",/(top|above|header|上面|顶部|上方)/i],
  ["bottom",/(bottom|below|footer|下面|底部|下方|底层)/i],
  ["center",/(center|middle|中央|中间)/i],
  ["here",/(here|this area|this section|这里|这边|这一块|这个位置)/i],
];
const CRITICAL=/(auth|login|permission|admin|billing|payment|delete|security|publish|deploy|登录|权限|管理员|付款|支付|删除|安全|发布|部署)/i;

function inferFromSelection(selection){
  if(!selection)return null;
  const cx=(selection.x??0)+(selection.width??0)/2,cy=(selection.y??0)+(selection.height??0)/2;
  if(selection.componentId)return {region:"component",confidence:.99,componentId:selection.componentId,componentRole:selection.componentRole||null};
  if(cx<.34)return {region:"left",confidence:.96};
  if(cx>.66)return {region:"right",confidence:.96};
  if(cy<.3)return {region:"top",confidence:.94};
  if(cy>.7)return {region:"bottom",confidence:.94};
  return {region:"center",confidence:.9};
}

export function resolveVisualEditRegion(instruction="",context={},pageModel={}){
  const text=String(instruction||"");
  const selected=inferFromSelection(context?.selection);
  if(selected)return Object.freeze({...selected,pageRoute:context.pageRoute||"/",source:"explicit-selection",criticalTarget:CRITICAL.test(`${selected.componentRole||""} ${selected.componentId||""}`)});
  for(const [region,re] of REGION_RULES){
    if(re.test(text))return Object.freeze({region,confidence:region==="here"?.58:.82,pageRoute:context.pageRoute||"/",source:"language-position",componentId:null,componentRole:null,criticalTarget:false});
  }
  const components=Array.isArray(pageModel?.components)?pageModel.components:[];
  const named=components.find(c=>{
    const hay=`${c?.id||""} ${c?.type||""} ${c?.role||""}`.toLowerCase();
    return hay&&text.toLowerCase().includes(String(c?.role||c?.type||"").toLowerCase());
  });
  if(named)return Object.freeze({region:"component",confidence:.86,pageRoute:context.pageRoute||"/",source:"semantic-component",componentId:named.id||null,componentRole:named.role||named.type||null,criticalTarget:CRITICAL.test(`${named.role||""} ${named.type||""}`)});
  return Object.freeze({region:"page",confidence:.45,pageRoute:context.pageRoute||"/",source:"page-fallback",componentId:null,componentRole:null,criticalTarget:false});
}
