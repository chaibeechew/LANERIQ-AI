import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8")}
function requireMatch(value,pattern,message){if(!pattern.test(value))throw new Error(message)}
function requireOrder(value,first,second,message){const a=value.indexOf(first),b=value.indexOf(second);if(a<0||b<0||b<=a)throw new Error(message)}

const template=read("app/template.js");
const owner=read("app/components/CanonicalCoreUIOwner.js");
const css=read("app/canonical-core-ui.css");
const login=read("app/login/page.js");

requireMatch(template,/import "\.\/canonical-core-ui\.css";/,"Canonical core stylesheet must be imported from app/template.js");
requireOrder(template,"./liui-runtime-safe-area-fixes.css","./canonical-core-ui.css","Canonical UI stylesheet must load after runtime safe-area fixes");
requireMatch(template,/<CanonicalCoreUIOwner\s*\/>/,"CanonicalCoreUIOwner must be mounted by app/template.js");
requireMatch(owner,/LaneriqLotusBrand/,"Canonical core owner must use the LANERIQ lotus brand source");
for(const route of ["/","/login","/auth","/create"])if(!owner.includes(`[\"${route}\"`))throw new Error(`Missing canonical core route: ${route}`);
requireMatch(css,/\.liuiContextIntelligence \.liuiMasterLayout[\s\S]*display:none!important/,"Legacy master-layout customer panel must be suppressed");
requireMatch(css,/\.liuiContextIntelligence \.liuiContextCounter[\s\S]*display:none!important/,"Legacy fixed page counter must be suppressed");
requireMatch(css,/data-canonical-core-ui=\"create\"[\s\S]*\.createHeader[\s\S]*display:none!important/,"Create legacy page-count header must be removed from the canonical runtime");
requireMatch(css,/laneriq-future-city-people\.webp/,"Core journey must use the canonical future-city people background");
requireMatch(css,/safe-area-inset-top/,"Canonical UI must account for top safe area");
requireMatch(css,/safe-area-inset-bottom/,"Canonical UI must account for bottom safe area");
requireMatch(login,/href=\"\/auth\?next=%2Fcreate\"/,"Login must continue to Enter Email and return to Create");
if(/\b(?:18|23|25)[ -]?pages?\b/i.test(login))throw new Error("Login must not expose legacy fixed page counts");

console.log("Canonical UI Source of Truth checks passed.");
