import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANONICAL_PRIMARY_NAV, CANONICAL_UI_ROUTES } from '../lib/product/canonical-ui-registry.js';

const layout=fs.readFileSync('app/layout.js','utf8');
const coordinator=fs.readFileSync('app/components/LIUIRealProductSurface.js','utf8');
const css=fs.readFileSync('app/liui-real-product-surface.css','utf8');
const canonicalCss=fs.readFileSync('app/liui-canonical-product-surface.css','utf8');
const registry=fs.readFileSync('lib/product/canonical-ui-registry.js','utf8');
const home=fs.readFileSync('app/page.js','utf8');
const editor=fs.readFileSync('app/editor/[id]/page.js','utf8');
const operations=fs.readFileSync('app/operations/[id]/page.js','utf8');
const publish=fs.readFileSync('app/publish/[id]/page.js','utf8');

assert.match(layout,/liui-real-product-surface\.css/,'LIUI workspace shell stylesheet must load');
assert.match(layout,/liui-canonical-product-surface\.css/,'Canonical product surface stylesheet must load');
assert.match(layout,/LIUIRealProductSurface/,'LIUI runtime coordinator must be mounted');
assert.match(coordinator,/usePathname/,'Surface coordinator must follow actual route changes');
assert.match(coordinator,/resolveCanonicalUiContext/,'Surface coordinator must resolve the canonical route registry');
assert.match(coordinator,/CORE_ROUTE_IDS/,'Workspace shell must explicitly isolate canonical core routes');
assert.match(coordinator,/if\(!context\|\|isCore\)return null/,'Workspace shell must not render over the canonical core journey');
assert.match(coordinator,/if\(surface&&!isCore\)document\.body\.dataset\.liuiSurface/,'Core routes must not receive workspace surface styling');
assert.doesNotMatch(coordinator,/LANERIQ_18_PAGES|resolvePageId|liuiEighteenStepStrip/,'Workspace shell must not depend on the historical fixed-page UI registry');
assert.doesNotMatch(coordinator,/\bPage\s+\d+\s*(?:of|\/)\s*(?:18|23|25)\b/i,'Workspace shell must not expose fixed page totals');

assert.deepEqual(CANONICAL_PRIMARY_NAV.map(item=>item.label),['Home','Projects','Create','Templates','More']);
for(const surface of ['preview','launch','manage','editor','quality','publish']) assert.ok(CANONICAL_UI_ROUTES.some(route=>route.surface===surface),`Missing ${surface} surface in canonical registry`);
for(const label of ['Home','Projects','Create','Templates','More']) assert.ok(registry.includes(`label: "${label}"`),`Canonical registry missing ${label}`);

for(const marker of [
  '.liuiReferenceHeader',
  '.liuiReferenceRail',
  '.liuiCreationStage',
  '.liuiWorkspaceStage',
  '.liuiRealBottomNav',
  'safe-area-inset-top',
  'safe-area-inset-bottom',
  'prefers-reduced-motion:reduce',
  'overflow-x:hidden',
]) assert.ok(css.includes(marker),`Missing canonical workspace shell CSS marker: ${marker}`);
assert.doesNotMatch(css,/liuiEighteenStepStrip|data-liui-page=|18-page|18 page/i,'Workspace CSS must not restore the historical fixed-page presentation');
assert.match(canonicalCss,/backdrop-filter:blur\(22px\)/,'Priority product surfaces must use semi-transparent intelligence glass');
assert.match(canonicalCss,/font-size:max\(16px,1em\)!important/,'Canonical editable surfaces must preserve mobile input legibility');
assert.match(canonicalCss,/prefers-reduced-motion:reduce/,'Canonical product surface must honor reduced-motion accessibility');

for(const marker of ['/api/orchestrate','/api/generate','stableCreateRequestId','CREATE_REQUEST_KEY']) assert.ok(home.includes(marker),`Real generation/recovery marker missing after UI work: ${marker}`);
assert.match(editor,/\/api\/modify/,'AI Editor must retain the real AI modify API');
assert.match(editor,/Create a new version|new version/i,'AI Editor must preserve version-before-change behavior');
assert.match(operations,/assessBuildQuality/,'Testing & Self-Heal must retain real quality assessment');
assert.match(operations,/owner_id/,'Testing & Self-Heal must remain owner-scoped');
assert.match(publish,/\/api\/publish\/request/,'Publish must retain the real publish-request API');
assert.match(publish,/Nothing has been submitted to the store yet/i,'Publish must retain truthful store evidence wording');
assert.match(publish,/customer_approved_at/,'Publish must retain customer approval gating');

assert.doesNotMatch(css,/display:\s*none[^}]*\.error/i,'LIUI must not hide error states');
assert.doesNotMatch(coordinator,/fetch\(/,'Navigation coordinator must not add network calls or spend');

console.log('✓ Canonical workspace shell is mounted on real product routes and isolated from the core journey');
console.log('✓ Primary navigation authority is Home / Projects / Create / Templates / More');
console.log('✓ Fixed total-page presentation cannot re-enter the workspace shell');
console.log('✓ Editor, Testing and Publish keep real APIs, ownership and evidence boundaries');
console.log('✓ Safe areas, mobile input legibility, glass UI and reduced-motion accessibility remain enforced');
