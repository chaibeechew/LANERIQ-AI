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
const account=read("app/components/AccountNav.js");
const registry=read("lib/product/canonical-ui-registry.js");
const overlayPolicy=read("lib/ui/global-overlay-policy.js");
const css=read("app/canonical-core-ui.css");
const contextCss=read("app/liui-context-intelligence.css");
const productCss=read("app/liui-canonical-product-surface.css");
const login=read("app/login/page.js");
const create=read("app/create/page.js");
const authCss=read("app/auth/auth.css");

requireMatch(template,/import "\.\/canonical-core-ui\.css";/,"Canonical core stylesheet must be imported from app/template.js");
requireOrder(template,"./liui-runtime-safe-area-fixes.css","./canonical-core-ui.css","Canonical UI stylesheet must load after runtime safe-area fixes");
requireMatch(template,/<Suspense fallback=\{null\}><CanonicalCoreUIOwner \/><\/Suspense>/,"CanonicalCoreUIOwner must be mounted behind a stable suspense boundary");
requireMatch(layout,/import "\.\/liui-canonical-product-surface\.css";/,"Canonical product surface stylesheet must be loaded");
forbid(layout,/liui-complete-18-page-surface\.css/,"Legacy fixed-page product stylesheet must not be loaded");
if(fs.existsSync("app/liui-complete-18-page-surface.css"))throw new Error("Legacy fixed-page product stylesheet must be removed");
if(fs.existsSync("app/auth/auth-living-intelligence.css"))throw new Error("Superseded Auth visual override must stay removed");
if(fs.existsSync("app/auth/auth-lotus-brand-override.css"))throw new Error("Duplicate Auth brand override must stay removed");

requireMatch(owner,/canonical-ui-registry\.js/,"Canonical core owner must use the canonical UI registry");
requireMatch(realSurface,/canonical-ui-registry\.js/,"Real product surface must use the canonical UI registry");
requireMatch(context,/canonical-ui-registry\.js/,"Context intelligence must use the canonical UI registry");
requireMatch(account,/canonical-ui-registry\.js/,"Account chrome must follow canonical UI ownership");
requireMatch(owner,/LaneriqLotusBrand/,"Canonical core owner must use the LANERIQ lotus brand source");
for(const id of ["home","login","auth","create"])if(!registry.includes(`id:\"${id}\"`))throw new Error(`Missing canonical core route id: ${id}`);
for(const route of ["/","/login","/auth","/create"])if(!registry.includes(route))throw new Error(`Missing canonical core route path: ${route}`);

for(const [name,value] of [["core owner",owner],["real product surface",realSurface],["context intelligence",context],["canonical registry",registry],["canonical core stylesheet",css],["canonical product stylesheet",productCss],["login",login],["create",create]]){
  forbid(value,/\bPage\s+\d+\s*(?:of|\/)\s*(?:18|23|25)\b/i,`${name} must not expose fixed page totals`);
  forbid(value,/18-PAGE MASTER LAYOUT/i,`${name} must not restore the old master layout`);
}
for(const [name,value] of [["core owner",owner],["real product surface",realSurface],["context intelligence",context]])forbid(value,/LANERIQ_18_PAGES/,`${name} must not depend on the old fixed-page registry`);

requireMatch(realSurface,/CORE_ROUTE_IDS/,"Workspace shell must explicitly define canonical core isolation");
requireMatch(realSurface,/if\(surface&&!isCore\)document\.body\.dataset\.liuiSurface/,"Workspace surface styling must never attach to core routes");
requireMatch(realSurface,/if\(!context\|\|isCore\)return null/,"Workspace shell must not render on core routes");
requireMatch(account,/canonicalChromeOwnsAccount/,"Global AccountNav must yield to canonical route chrome");
requireMatch(account,/if\s*\(\s*!user\s*\|\|\s*canonicalChromeOwnsAccount\s*\)\s*return null/,"Duplicate account chrome must not render on canonical-owned surfaces");
requireMatch(account,/session\?\.sessionAuthority\s*!==\s*"laneriq"/,"Account session must fail closed unless LANERIQ is authoritative");
requireMatch(account,/body:\s*JSON\.stringify\(\{\s*action:\s*"logout"\s*\}\)/,"Account logout must revoke LANERIQ session authority through the session API");

for(const route of ["/","/login","/auth","/create"])if(!overlayPolicy.includes(`\"${route}\"`))throw new Error(`Global overlay policy must protect canonical core route: ${route}`);
requireMatch(css,/laneriq-future-city-people\.webp/,"Core journey must use the canonical future-city people background");
requireMatch(css,/safe-area-inset-top/,"Canonical UI must account for top safe area");
requireMatch(css,/safe-area-inset-bottom/,"Canonical UI must account for bottom safe area");
requireMatch(css,/overflow-x:hidden/,"Canonical UI must guard horizontal overflow");
forbid(css,/\.liuiContextIntelligence\s+\.liuiContextGroup[\s\S]{0,120}display\s*:\s*none/i,"Core stylesheet must never hide the current workspace context group globally");
forbid(css,/data-canonical-core-ui=\"create\"[^}]*\.createHeader/i,"Deleted Create route-local header must not return as a CSS suppression dependency");
requireMatch(contextCss,/\.liuiContextGroup\{[^}]*color:/,"Workspace context group must have an active presentation rule");
requireMatch(authCss,/@media\(max-width:480px\)/,"Auth must retain the canonical mobile breakpoint contract");
requireMatch(authCss,/font-size:16px/,"Auth inputs must remain mobile-legible");
requireMatch(authCss,/touch-action:manipulation/,"Auth actions must remain touch-optimized");
requireMatch(create,/100svh/,"Create must use dynamic mobile viewport height");
requireMatch(create,/font-size:16px/,"Create inputs must remain mobile-legible");
requireMatch(create,/min-height:44px/,"Create controls must retain minimum touch targets");
requireMatch(create,/prefers-reduced-motion:reduce/,"Create must respect reduced motion");
requireMatch(login,/href=\"\/auth\?next=%2Fcreate\"/,"Login must continue to Enter Email and return to Create");

console.log("Canonical UI Source of Truth checks passed.");
