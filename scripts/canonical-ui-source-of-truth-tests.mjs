import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8")}
function requireMatch(value,pattern,message){if(!pattern.test(value))throw new Error(message)}
function forbid(value,pattern,message){if(pattern.test(value))throw new Error(message)}
function requireOrder(value,first,second,message){const a=value.indexOf(first),b=value.indexOf(second);if(a<0||b<0||b<=a)throw new Error(message)}

const layout=read("app/layout.js");
const template=read("app/template.js");
const owner=read("app/components/CanonicalCoreUIOwner.js");
const realSurface=read("app/components/LIUIRealProductSurface.js");
const context=read("app/components/LIUIContextIntelligence.js");
const registry=read("lib/product/canonical-ui-registry.js");
const css=read("app/canonical-core-ui.css");
const productCss=read("app/liui-canonical-product-surface.css");
const login=read("app/login/page.js");
const create=read("app/create/page.js");

requireMatch(template,/import "\.\/canonical-core-ui\.css";/,"Canonical core stylesheet must be imported from app/template.js");
requireOrder(template,"./liui-runtime-safe-area-fixes.css","./canonical-core-ui.css","Canonical UI stylesheet must load after runtime safe-area fixes");
requireMatch(template,/<Suspense fallback=\{null\}><CanonicalCoreUIOwner \/><\/Suspense>/,"CanonicalCoreUIOwner must be mounted behind a stable suspense boundary");
requireMatch(layout,/import "\.\/liui-canonical-product-surface\.css";/,"Canonical product surface stylesheet must be loaded");
forbid(layout,/liui-complete-18-page-surface\.css/,"Legacy fixed-page product stylesheet must not be loaded");
if(fs.existsSync("app/liui-complete-18-page-surface.css"))throw new Error("Legacy fixed-page product stylesheet must be removed");

requireMatch(owner,/canonical-ui-registry\.js/,"Canonical core owner must use the canonical UI registry");
requireMatch(realSurface,/canonical-ui-registry\.js/,"Real product surface must use the canonical UI registry");
requireMatch(context,/canonical-ui-registry\.js/,"Context intelligence must use the canonical UI registry");
requireMatch(owner,/LaneriqLotusBrand/,"Canonical core owner must use the LANERIQ lotus brand source");
for(const route of ["/","/login","/auth","/create"])if(!registry.includes(`pattern:/^\\${route==="/"?"/$":route.replaceAll("/","\\/")+"\\/?$/"}`)&&!registry.includes(`route: \"${route}\"`)&&!registry.includes(`href: \"${route}\"`))throw new Error(`Missing canonical core route: ${route}`);

for(const [name,value] of [["real product surface",realSurface],["context intelligence",context],["canonical registry",registry]]){
  forbid(value,/\bPage\s+\d+\s*(?:of|\/)\s*(?:18|23|25)\b/i,`${name} must not expose fixed page totals`);
  forbid(value,/18-PAGE MASTER LAYOUT/i,`${name} must not restore the old master layout`);
  forbid(value,/LANERIQ_18_PAGES/,`${name} must not depend on the old fixed-page registry`);
}

requireMatch(css,/data-canonical-core-ui=\"create\"[\s\S]*\.createHeader[\s\S]*display:none!important/,"Legacy Create route-local header must remain suppressed by the canonical shell until source extraction completes");
forbid(productCss,/18-page|18 page|Page \d+/i,"Canonical product surface stylesheet must not encode fixed page presentation");
requireMatch(css,/laneriq-future-city-people\.webp/,"Core journey must use the canonical future-city people background");
requireMatch(css,/safe-area-inset-top/,"Canonical UI must account for top safe area");
requireMatch(css,/safe-area-inset-bottom/,"Canonical UI must account for bottom safe area");
requireMatch(css,/overflow-x:hidden/,"Canonical UI must guard horizontal overflow");
requireMatch(login,/href=\"\/auth\?next=%2Fcreate\"/,"Login must continue to Enter Email and return to Create");
forbid(login,/\b(?:18|23|25)[ -]?pages?\b/i,"Login must not expose legacy fixed page counts");

// Create still contains a historical route-local header for compatibility, but it is never visible.
// Keep this assertion until that local header is fully extracted in a later cleanup commit.
if(/Page\s+[23]\s+of\s+18/i.test(create)&&!/body\[data-canonical-core-ui=\"create\"\][\s\S]*\.createHeader[\s\S]*display:none!important/.test(css)){
  throw new Error("Historical Create page-count chrome is not safely suppressed");
}

console.log("Canonical UI Source of Truth checks passed.");
