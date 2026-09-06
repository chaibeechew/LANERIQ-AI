import assert from "node:assert/strict";
import fs from "node:fs";
import { CANONICAL_UI_ROUTES, CANONICAL_CREATION_JOURNEY, CANONICAL_PRIMARY_NAV } from "../lib/product/canonical-ui-registry.js";
import { LIUI_CONTEXT_LANGUAGE_CODES, LIUI_CONTEXT_TRANSLATIONS, liuiContextText } from "../lib/i18n/liui-context-translations.js";

const read=(path)=>fs.readFileSync(path,"utf8");
const component=read("app/components/LIUIContextIntelligence.js");
const css=read("app/liui-context-intelligence.css");
const layout=read("app/layout.js");
const registry=read("lib/product/canonical-ui-registry.js");
const workflow=read(".github/workflows/liui-context-intelligence-gate.yml");

assert.ok(CANONICAL_UI_ROUTES.length>=20,"Canonical UI registry must cover core and workspace destinations");
for(const route of CANONICAL_UI_ROUTES){
  assert.ok(route.id, "Every canonical UI route must define an id");
  assert.ok(route.surface, `Route ${route.id} must define a surface`);
  assert.ok(route.name, `Route ${route.id} must define a customer-facing name`);
  assert.ok(route.stage, `Route ${route.id} must define a stage`);
  assert.ok(route.risk, `Route ${route.id} must define risk truth`);
  assert.equal(typeof route.approval,"boolean",`Route ${route.id} must define approval truth`);
  assert.ok(route.evidence,`Route ${route.id} must define evidence truth`);
  assert.ok(route.primaryAction,`Route ${route.id} must define a primary action`);
}
assert.deepEqual(CANONICAL_PRIMARY_NAV.map(item=>item.label),["Home","Projects","Create","Templates","More"]);
assert.deepEqual(CANONICAL_CREATION_JOURNEY.map(item=>item.label),["Idea","Plan","Build","Preview","Launch","Manage"]);

for(const marker of [
  'resolveCanonicalUiContext',
  'canonicalCreationIndex',
  'CANONICAL_CREATION_JOURNEY',
  'if (!context) return null',
  'data-liui-context-intelligence="true"',
  'data-route-id={context.id}',
  'context.risk || "low"',
  'context.evidence || "code"',
  'laneriq-language-change',
  'MutationObserver',
  'aria-busy',
  'Human approval required before consequential actions.',
  'AI may assist within current permissions.',
]) assert.ok(component.includes(marker),`Missing canonical Context Intelligence marker: ${marker}`);

assert.doesNotMatch(component,/LANERIQ_18_PAGES|PAGE_GROUPS|18-PAGE MASTER|Eighteen purpose-built screens|Pages 1–18/i,"Context Intelligence must not restore fixed-page customer UI authority");
assert.doesNotMatch(component,/\bPage\s+\d+\s*(?:of|\/)\s*(?:18|23|25)\b/i,"Context Intelligence must not expose a fixed total-page counter");
assert.doesNotMatch(component,/\bfetch\s*\(/,"Context Intelligence must not make network calls");
assert.doesNotMatch(component,/\/api\//,"Context Intelligence must not invoke business APIs");
assert.doesNotMatch(component,/services\/malware-defense|app\/api\/malware/,"Context Intelligence must not touch Malware Defense core");

for(const id of ["home","login","auth","create","preview","release","dashboard","projects","templates","assistant","workflow","analytics","studio","editor","database","operations","publish"]){
  assert.ok(registry.includes(`id:\"${id}\"`),`Canonical registry missing route ${id}`);
}

assert.deepEqual(LIUI_CONTEXT_LANGUAGE_CODES,["en","zh-CN","zh-TW","ms","id","ja","ko","th","vi","es"]);
for(const [key,translations] of Object.entries(LIUI_CONTEXT_TRANSLATIONS))for(const code of LIUI_CONTEXT_LANGUAGE_CODES)assert.ok(String(translations[code]||"").trim(),`${key} must be translated for ${code}`);
assert.equal(liuiContextText("Risk","zh-CN"),"风险");
assert.equal(liuiContextText("Approval required","ms"),"Kelulusan diperlukan");

for(const marker of ["safe-area-inset-bottom","prefers-reduced-motion","z-index:9800",".liuiContextBento",".liuiContextJourney"]) assert.ok(css.includes(marker),`Missing Context Intelligence CSS contract: ${marker}`);
assert.ok(css.includes("bottom:calc(88px + env(safe-area-inset-bottom))"),"Mobile decision dock must stay above canonical navigation");
assert.match(css,/max-width:600px/,'Context Intelligence must include narrow mobile adaptation');
assert.match(css,/overflow:auto/,'Context Intelligence panel must remain scrollable on constrained viewports');

assert.ok(layout.includes('import "./liui-context-intelligence.css";'),"Root layout must load Context Intelligence CSS");
assert.ok(layout.includes('import LIUIContextIntelligence from "./components/LIUIContextIntelligence";'),"Root layout must mount Context Intelligence");
assert.ok(layout.includes('<Suspense fallback={null}><LIUIContextIntelligence /></Suspense>'),"Context Intelligence must be wrapped in Suspense for search params");
assert.ok(workflow.includes("lib/product/canonical-ui-registry.js"),"Dedicated gate must watch the canonical UI registry");
assert.ok(workflow.includes("node scripts/batch95-liui-context-intelligence-tests.mjs"),"Dedicated gate must run Context Intelligence contract");
assert.doesNotMatch(workflow,/npm (?:ci|install)/,"Dedicated Context Intelligence gate must stay dependency-free");
assert.ok(workflow.includes("UI contract only"),"Gate must preserve evidence-boundary truth");

console.log("✓ LIUI Context Intelligence resolves customer context from the canonical route registry");
console.log("✓ Creation Journey remains Idea / Plan / Build / Preview / Launch / Manage without a fixed total-page UI");
console.log("✓ Context Intelligence performs no business API calls and preserves system boundaries");
console.log("✓ Mobile safe-area, scrolling and multilingual decision context remain regression-gated");
