export const VISUAL_EDIT_INTENT_VERSION="1.0.0";

const ACTIONS=[
  ["remove",/(remove|delete|hide|删掉|删除|拿掉|隐藏)/i],
  ["move",/(move|shift|relocate|移到|移动|挪到)/i],
  ["replace",/(replace|swap|change .* to|换成|替换|改成)/i],
  ["add",/(add|insert|put|place|加|加入|放|新增)/i],
  ["style",/(color|font|style|bigger|smaller|premium|luxury|颜色|字体|风格|大一点|小一点|高级|高端)/i],
  ["content",/(text|copy|title|description|文案|文字|标题|说明)/i],
];
const OBJECTS=[
  ["image",/(image|photo|picture|banner|illustration|图|图片|照片|插画)/i],
  ["faq",/(faq|frequently asked|常见问题|问答)/i],
  ["pricing",/(pricing|price plan|套餐|价格|收费)/i],
  ["testimonial",/(testimonial|review|客户评价|评价|见证)/i],
  ["button",/(button|cta|按钮)/i],
  ["video",/(video|影片|视频)/i],
  ["form",/(form|contact form|表单|联系表)/i],
  ["section",/(section|block|区域|区块|版块)/i],
];
const AUTHORITY=/(admin|role|permission|auth|login|database policy|rls|billing permission|管理员|角色|权限|授权|登录|数据库权限)/i;
const HIGH_RISK=/(payment|refund|delete account|deploy production|publish production|transfer money|付款|退款|删除账号|生产部署|正式发布|转账)/i;

function match(text,rules,fallback){for(const [value,re] of rules)if(re.test(text))return value;return fallback;}

export function classifyVisualEditIntent(instruction=""){
  const text=String(instruction||"").trim().slice(0,4000);
  if(!text)throw new Error("LANERIQ_VISUAL_EDIT_INSTRUCTION_REQUIRED");
  const authorityChange=AUTHORITY.test(text),highRisk=HIGH_RISK.test(text);
  const action=match(text,ACTIONS,"modify"),object=match(text,OBJECTS,"layout-or-component");
  const destructive=action==="remove"||highRisk;
  return Object.freeze({
    version:VISUAL_EDIT_INTENT_VERSION,action,object,destructive,authorityChange,highRisk,
    category:authorityChange?"authority-sensitive":highRisk?"high-risk":object==="layout-or-component"?"layout":"visual-product-edit",
    mayAutoApply:!authorityChange&&!highRisk,
    requiresExplicitConfirmation:highRisk||authorityChange,
    originalInstruction:text,
  });
}
