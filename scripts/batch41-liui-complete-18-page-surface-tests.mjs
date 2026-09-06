import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { CANONICAL_PRIMARY_NAV, CANONICAL_CREATION_JOURNEY, CANONICAL_UI_ROUTES } from "../lib/product/canonical-ui-registry.js";

const read=(path)=>fs.readFile(path,"utf8");

const [historicalMaster,registry,component,shellCss,canonicalCss,browserQa,createPage,editorPage,workflowPage,databasePage,publishPage]=await Promise.all([
  read("lib/product/laneriq-18-page-master.js"),
  read("lib/product/canonical-ui-registry.js"),
  read("app/components/LIUIRealProductSurface.js"),
  read("app/liui-real-product-surface.css"),
  read("app/liui-canonical-product-surface.css"),
  read("scripts/production-mobile-browser-qa.mjs"),
  read("app/create/page.js"),
  read("app/editor/[id]/page.js"),
  read("app/workflows/[id]/page.js"),
  read("app/database/[id]/page.js"),
  read("app/publish/[id]/page.js"),
]);

// Historical registry stays complete for compatibility, governance and safety contracts only.
const historicalIds=[...historicalMaster.matchAll(/\bid\s*:\s*(\d+)\s*,\s*slug:/g)].map(match=>Number(match[1]));
assert.deepEqual(historicalIds,Array.from({length:18},(_,i)=>i+1),"Historical product capability registry must remain ordered and complete");
assert.match(historicalMaster,/LANERIQ_REAL_EXECUTION_CHAIN\s*=\s*Object\.freeze\(\[1, 2, 3, 13, 17, 18\]\)/,"Historical real execution chain must remain intact");

// Customer UI authority is canonical, route-aware and not a fixed total-page system.
assert.deepEqual(CANONICAL_PRIMARY_NAV.map(item=>item.label),["Home","Projects","Create","Templates","More"]);
assert.deepEqual(CANONICAL_CREATION_JOURNEY.map(item=>item.label),["Idea","Plan","Build","Preview","Launch","Manage"]);
for(const surface of ["creation","auth","preview","launch","manage","creations","templates","template-detail","assistant","workflow","analytics","more","editor","database","quality","publish"]){
  assert.ok(CANONICAL_UI_ROUTES.some(route=>route.surface===surface),`Canonical UI registry must cover ${surface}`);
}
assert.match(component,/resolveCanonicalUiContext/,'LIUI coordinator must resolve canonical route authority');
assert.match(component,/CANONICAL_PRIMARY_NAV\.map/,'LIUI coordinator must render canonical mobile navigation');
assert.match(component,/CORE_ROUTE_IDS/,'LIUI coordinator must isolate the core journey from workspace chrome');
assert.match(component,/data-liui-nav="canonical"/,'Canonical navigation must be explicitly identified');
assert.doesNotMatch(component,/LANERIQ_18_PAGES|resolvePageId|liuiEighteenStepStrip/,'Customer LIUI coordinator must not depend on historical fixed-page UI');
for(const value of [registry,component,shellCss,canonicalCss,createPage]){
  assert.doesNotMatch(value,/\bPage\s+\d+\s*(?:of|\/)\s*(?:18|23|25)\b/i,'Canonical customer surfaces must not expose fixed page totals');
}
assert.doesNotMatch(shellCss,/liuiEighteenStepStrip|data-liui-page|18-page|18 page/i,'Workspace shell CSS must not restore the retired fixed-page presentation');
assert.doesNotMatch(canonicalCss,/18-page|18 page|Page \d+/i,'Canonical product surface CSS must not encode fixed page presentation');

// Existing execution engines and consequential-action boundaries stay real.
assert.ok(createPage.includes("/api/orchestrate"),"Create must retain the real orchestrate path");
assert.ok(createPage.includes("/api/generate"),"Create must retain the real generate path");
assert.ok(createPage.includes("stableCreateRequestId"),"Create must retain idempotent recovery identity");
assert.ok(editorPage.includes("/api/modify"),"AI Editor must retain the real modify path");
assert.ok(workflowPage.includes("dryRun"),"Workflow editor must retain Safe Test / dry-run behavior");
assert.match(databasePage,/rollback/i,"Database surface must retain rollback/recoverability");
assert.ok(publishPage.includes("customer_approved_at"),"Publish must retain customer approval boundary");
assert.ok(publishPage.includes("Nothing has been submitted to the store yet"),"Publish must preserve truthful external-store boundary");

// Canonical LIUI quality requirements.
assert.ok(shellCss.includes("liuiRealBottomNav"),"Workspace shell CSS must style canonical mobile navigation");
assert.match(shellCss,/min-height:56px/,'Canonical workspace mobile nav must exceed the 44px touch target minimum');
assert.match(shellCss,/safe-area-inset-bottom/,'Workspace shell must respect the mobile bottom safe area');
assert.match(shellCss,/safe-area-inset-top/,'Workspace shell must respect the mobile top safe area');
assert.match(shellCss,/overflow-x:hidden/,'Workspace shell must guard horizontal overflow');
assert.match(shellCss,/prefers-reduced-motion:reduce/,'Workspace shell must honor reduced-motion accessibility');
assert.match(canonicalCss,/#fffdf7|#f2ecdf/,'Long intent/assistant inputs must retain warm light high-legibility treatment');
for(const surface of ["assistant","database","templates"])assert.ok(canonicalCss.includes(`data-liui-surface=\"${surface}\"`),`Canonical product CSS must cover ${surface}`);

// Browser QA validates only visible canonical targets and preserves evidence truth.
assert.ok(browserQa.includes(".liuiRealBottomNav a"),"Production browser QA must include canonical LIUI nav targets");
assert.ok(browserQa.includes(".filter(isVisible)"),"Production browser QA must ignore hidden legacy targets");
assert.ok(browserQa.includes("liuiNavVisibleTargetCount"),"Production browser QA must record canonical LIUI target count");
assert.match(browserQa,/assert\.equal\(metrics\.liuiNavVisibleTargetCount, 5/,'Production browser QA must require exactly five visible LIUI nav targets');
assert.match(browserQa,/physicalDeviceVerified:\s*false/,'Browser emulation must never be mislabeled as physical-device evidence');
assert.match(browserQa,/liveProviderVerified:\s*false/,'Browser emulation must never be mislabeled as provider-LIVE evidence');
assert.match(browserQa,/officialStoreVerified:\s*false/,'Browser emulation must never be mislabeled as official-store evidence');

console.log("✓ Historical capability registry remains intact without owning customer presentation");
console.log("✓ Canonical customer UI covers core and workspace routes without fixed total-page chrome");
console.log("✓ Real execution engines, approvals, rollback and store-evidence boundaries remain intact");
console.log("✓ Safe areas, touch targets, input legibility, reduced motion and visible-nav browser QA remain enforced");
