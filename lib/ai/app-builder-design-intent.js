import crypto from "node:crypto";

export const APP_BUILDER_DESIGN_INTENT_VERSION="1.0.0";

const INDUSTRY_RULES=[
  ["Real Estate",/(real[ -]?estate|property|properties|listing|realtor|房地产|房产|楼盘|地产)/i],
  ["E-commerce",/(e-?commerce|online store|shop|shopping|product catalog|网店|电商|商城)/i],
  ["Restaurant",/(restaurant|cafe|menu|food|dining|餐厅|餐饮|咖啡)/i],
  ["SaaS",/(saas|software platform|subscription software|软件平台)/i],
  ["Education",/(education|school|course|learning|academy|教育|课程|学校)/i],
  ["Hotel & Hospitality",/(hotel|hospitality|resort|room booking|酒店|度假村)/i],
  ["Healthcare",/(health|clinic|medical|doctor|patient|医疗|诊所|健康)/i],
  ["AI Services",/(ai |artificial intelligence|agent|copilot|人工智能|智能助手)/i],
  ["Cybersecurity",/(cyber|security operations|soc|threat|malware|网络安全|防毒)/i],
  ["Creator Economy",/(creator|influencer|content creator|创作者|网红)/i],
];
const ARCHETYPE_RULES=[
  ["booking",/(booking|reservation|appointment|schedule|预约|预订)/i],
  ["crm",/(crm|lead|customer management|pipeline|客户管理|销售线索)/i],
  ["marketplace",/(marketplace|two-sided|seller|vendor|市场平台|卖家)/i],
  ["store",/(store|shop|cart|checkout|catalog|商城|购物车|结账)/i],
  ["directory",/(directory|listing|map search|目录|列表|地图搜索|房源)/i],
  ["operations",/(operations|jobs|dispatch|team dashboard|运营|工单|调度)/i],
  ["membership",/(membership|member portal|会员|会员中心)/i],
  ["learning",/(course|lesson|learning|quiz|课程|学习|测验)/i],
  ["inventory",/(inventory|stock|supplier|warehouse|库存|仓库|供应商)/i],
  ["community",/(community|social|feed|group|社区|社交|动态)/i],
  ["analytics",/(analytics|dashboard|metrics|reporting|分析|指标|报表)/i],
  ["service",/(service business|quote|services|consulting|服务|报价)/i],
];
const STYLE_RULES=[
  ["glass",/(glass|cinematic|futuristic|未来|玻璃|科技感)/i],
  ["luxury",/(luxury|premium|editorial|高端|奢华|精品)/i],
  ["dark-tech",/(dark|cyber|tech|黑色|暗色|科技)/i],
  ["natural",/(natural|warm|organic|human|自然|温暖|亲和)/i],
  ["minimal",/(minimal|clean|simple|现代简约|简洁|极简)/i],
];

function digest(value){return crypto.createHash("sha256").update(String(value??"")).digest("hex");}
function matchRule(text,rules,fallback){for(const [value,re] of rules)if(re.test(text))return value;return fallback;}
function inferTarget(text){if(/\bwebsite\b|landing page|官网|网站|网页/i.test(text)&&!/\bapp\b|mobile app|应用/i.test(text))return"website";if(/\bapp\b|mobile app|应用|小程序/i.test(text)&&!/\bwebsite\b|网站|网页/i.test(text))return"app";return"app+website";}
function inferGoal(text,archetype){if(/sell|revenue|checkout|purchase|销售|购买|成交/i.test(text))return"conversion";if(/lead|inquiry|quote|contact|线索|询盘|咨询/i.test(text))return"lead-generation";if(/book|reservation|appointment|预约|预订/i.test(text))return"booking";if(/manage|operation|dashboard|管理|运营/i.test(text))return"operations";return archetype==="analytics"?"insight":"engagement";}

export function compileAppBuilderDesignIntent(prompt="",options={}){
  const raw=String(prompt||"").slice(0,20000);
  const industry=String(options.industry||matchRule(raw,INDUSTRY_RULES,"SaaS"));
  const archetypeId=String(options.archetypeId||matchRule(raw,ARCHETYPE_RULES,industry==="Real Estate"?"directory":"service"));
  const styleId=String(options.styleId||matchRule(raw,STYLE_RULES,"minimal"));
  const target=String(options.target||inferTarget(raw));
  const primaryGoal=String(options.primaryGoal||inferGoal(raw,archetypeId));
  const intent={
    version:APP_BUILDER_DESIGN_INTENT_VERSION,
    promptDigest:digest(raw),industry,archetypeId,styleId,target,primaryGoal,
    audience:String(options.audience||"general-users").slice(0,120),
    locale:String(options.locale||"auto").slice(0,40),
    responsive:Object.freeze({mobileFirst:true,breakpoints:Object.freeze(["mobile","tablet","desktop"])}),
    accessibility:Object.freeze({keyboardRequired:true,focusVisibleRequired:true,contrastRequired:true,reducedMotionSupported:true}),
    designSystem:"LANERIQ AI Living Intelligence UI / Adaptive Generative Interface System 2026",
    rawPromptPersisted:false,
  };
  return Object.freeze(intent);
}
