import crypto from "node:crypto";

export const VISUAL_EDIT_CONTEXT_VERSION="1.0.0";
const SHA256=/^[a-f0-9]{64}$/i;
const SAFE_REF=/^[a-zA-Z0-9._:/-]{1,240}$/;

function clamp(n,min,max){const v=Number(n);return Number.isFinite(v)?Math.min(max,Math.max(min,v)):null;}
function digest(value){return crypto.createHash("sha256").update(value).digest("hex");}

export function createVisualEditContext(input={}){
  const rawScreenshot=input.screenshotBytes||input.rawScreenshot||input.imageData||null;
  const computedDigest=rawScreenshot?digest(Buffer.isBuffer(rawScreenshot)?rawScreenshot:Buffer.from(String(rawScreenshot))):null;
  const suppliedDigest=String(input.screenshotDigest||"").trim().toLowerCase();
  const screenshotDigest=computedDigest||(SHA256.test(suppliedDigest)?suppliedDigest:null);
  const screenshotRef=String(input.screenshotRef||"").trim();
  if(!screenshotDigest)throw new Error("LANERIQ_VISUAL_EDIT_SCREENSHOT_DIGEST_REQUIRED");
  if(screenshotRef&&!SAFE_REF.test(screenshotRef))throw new Error("LANERIQ_VISUAL_EDIT_SCREENSHOT_REF_INVALID");
  const s=input.selection&&typeof input.selection==="object"?input.selection:null;
  const selection=s?Object.freeze({
    x:clamp(s.x,0,1),y:clamp(s.y,0,1),width:clamp(s.width,0,1),height:clamp(s.height,0,1),
    componentId:String(s.componentId||"").slice(0,160)||null,
    componentRole:String(s.componentRole||"").slice(0,120)||null,
  }):null;
  const viewport=Object.freeze({
    width:clamp(input.viewport?.width,240,10000),
    height:clamp(input.viewport?.height,240,10000),
    device:String(input.viewport?.device||"unknown").slice(0,40),
  });
  return Object.freeze({
    version:VISUAL_EDIT_CONTEXT_VERSION,
    screenshotDigest,
    screenshotRef:screenshotRef||null,
    pageRoute:String(input.pageRoute||"/").slice(0,240),
    pageId:String(input.pageId||"").slice(0,160)||null,
    viewport,
    selection,
    capturedAt:String(input.capturedAt||"").slice(0,64)||null,
    privacy:Object.freeze({rawScreenshotPersisted:false,rawImageDataPersisted:false,ocrTextPersisted:false,secretsAllowed:false}),
    evidenceClass:"SCREENSHOT_REFERENCE_ONLY",
  });
}
