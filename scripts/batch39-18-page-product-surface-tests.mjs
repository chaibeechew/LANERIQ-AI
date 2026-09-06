import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LANERIQ_18_PAGES,
  LANERIQ_18_PAGE_AI_RULES,
  LANERIQ_18_PAGE_DESIGN_RULES,
  LANERIQ_CORE_CREATION_CHAIN,
  LANERIQ_POWER_WORKSPACE_CHAIN,
  LANERIQ_REAL_EXECUTION_CHAIN,
  LANERIQ_GLOBAL_NAV,
  LANERIQ_APPROVED_CREATION_JOURNEY,
  LANERIQ_APPROVED_HOME_STACK,
  resolveMasterProductPage,
} from '../lib/product/laneriq-18-page-master.js';
import { CANONICAL_PRIMARY_NAV, CANONICAL_CREATION_JOURNEY, CANONICAL_UI_ROUTES } from '../lib/product/canonical-ui-registry.js';

// Historical product registry remains an internal capability / safety contract.
assert.equal(LANERIQ_18_PAGES.length,18,'Historical product contract must retain 18 ordered capability records');
assert.deepEqual(LANERIQ_18_PAGES.map(page=>page.id),Array.from({length:18},(_,i)=>i+1));
assert.equal(new Set(LANERIQ_18_PAGES.map(page=>page.id)).size,18);
assert.equal(new Set(LANERIQ_18_PAGES.map(page=>page.slug)).size,18);
assert.ok(LANERIQ_18_PAGES.every(page=>page.name&&page.route&&page.routeFile&&page.purpose&&page.primaryAction));
assert.ok(LANERIQ_18_PAGES.every(page=>Array.isArray(page.userActions)&&page.userActions.length>0));
assert.ok(LANERIQ_18_PAGES.every(page=>Array.isArray(page.aiActions)&&page.aiActions.length>0));
assert.ok(LANERIQ_18_PAGES.every(page=>Array.isArray(page.data)&&page.data.length>0));
assert.ok(LANERIQ_18_PAGES.every(page=>Array.isArray(page.states)&&page.states.includes('error')&&page.states.includes('retry')&&page.states.includes('success')));
for(const page of LANERIQ_18_PAGES)assert.ok(fs.existsSync(page.routeFile),`Physical route file missing for historical capability ${page.id}: ${page.routeFile}`);

assert.deepEqual(LANERIQ_CORE_CREATION_CHAIN,[1,2,3,4,5,6]);
assert.deepEqual(LANERIQ_POWER_WORKSPACE_CHAIN,[13,17,18]);
assert.deepEqual(LANERIQ_REAL_EXECUTION_CHAIN,[1,2,3,13,17,18]);
assert.deepEqual(LANERIQ_GLOBAL_NAV.map(item=>item.label),['Home','Projects','Create','Templates','More']);
assert.deepEqual(LANERIQ_APPROVED_CREATION_JOURNEY,['Idea','Plan','Build','Preview','Launch','Manage']);
assert.deepEqual(LANERIQ_APPROVED_HOME_STACK,['Hero','Intent Composer','Create Image / Design UI','Style','Templates','Build CTA']);
assert.equal(resolveMasterProductPage(1)?.slug,'home');
assert.equal(resolveMasterProductPage('17')?.slug,'ai-testing-self-heal');
assert.equal(resolveMasterProductPage('publish-deployment-center')?.id,18);
assert.equal(resolveMasterProductPage('missing'),null);

const root=fs.readFileSync('app/page.js','utf8');
for(const marker of ['/api/orchestrate','/api/generate'])assert.ok(root.includes(marker),`Home creation engine must retain ${marker}`);
assert.match(root,/stableCreateRequestId/);assert.match(root,/CREATE_REQUEST_KEY/);assert.match(root,/GENERATION_REQUEST_IN_PROGRESS|generation_request_in_progress/i);assert.match(root,/without creating a duplicate/i);

const page13=resolveMasterProductPage(13);assert.equal(page13.route,'/editor/[id]');assert.equal(page13.humanApproval,true);assert.match(page13.aiActions.join(' '),/version/i);assert.match(page13.aiActions.join(' '),/undo/i);
const page16=resolveMasterProductPage(16);assert.equal(page16.risk,'critical');assert.equal(page16.humanApproval,true);assert.match(page16.aiActions.join(' '),/RLS/i);assert.match(page16.aiActions.join(' '),/destructive/i);
const page17=resolveMasterProductPage(17);assert.equal(page17.risk,'critical');assert.match(page17.aiActions.join(' '),/self-heal/i);assert.match(page17.aiActions.join(' '),/never downgrade gates/i);
const page18=resolveMasterProductPage(18);assert.equal(page18.risk,'critical');assert.equal(page18.humanApproval,true);assert.match(page18.aiActions.join(' '),/rollback/i);assert.match(page18.evidence,/production-exact-sha/i);

for(const key of ['humanInControl','neverFakeCompletion','neverFakeLiveProvider','neverFakeStoreApproval','neverInventAnalytics','preserveOwnershipAndRls','selfHealMayNotLowerQualityGates','secretsStayServerSide','smsOnHold'])assert.equal(LANERIQ_18_PAGE_AI_RULES[key],true,`Safety rule ${key} must remain true`);
assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.intentFirst,true);assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.contextAdaptive,true);assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.liquidIntelligenceGlass,true);assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.homeFirstPaint,'Future City + People');assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.noCreditsLaunch,true);assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.mobileCommunityCompute,false);

// Customer-facing UI authority is now canonical and must not inherit fixed totals.
assert.deepEqual(CANONICAL_PRIMARY_NAV.map(item=>item.label),['Home','Projects','Create','Templates','More']);
assert.deepEqual(CANONICAL_CREATION_JOURNEY.map(item=>item.label),['Idea','Plan','Build','Preview','Launch','Manage']);
assert.ok(CANONICAL_UI_ROUTES.length>=20,'Canonical customer registry must cover core and workspace routes');
const shell=fs.readFileSync('app/components/LIUIRealProductSurface.js','utf8');
const shellCss=fs.readFileSync('app/liui-real-product-surface.css','utf8');
const canonicalCss=fs.readFileSync('app/liui-canonical-product-surface.css','utf8');
for(const marker of ['liuiReferenceHeader','liuiReferenceRail','liuiCreationStage','liuiWorkspaceStage','liuiRealBottomNav'])assert.ok(shell.includes(marker),`Canonical shell missing ${marker}`);
assert.match(shell,/2026\.4-canonical/);
assert.match(shell,/CORE_ROUTE_IDS/);
assert.doesNotMatch(shell,/liuiEighteenStepStrip|resolvePageId|LANERIQ_18_PAGES/);
assert.doesNotMatch(shellCss,/liuiEighteenStepStrip|data-liui-page|18-page|18 page/i);
assert.doesNotMatch(canonicalCss,/18-page|18 page|Page \d+/i);

const page16Source=fs.readFileSync('app/database/[id]/page.js','utf8');
for(const marker of ['Database Builder','Relationships & Schema','AI Assistant (Database)','Data Safety Snapshot'])assert.ok(page16Source.includes(marker),`Database surface missing ${marker}`);
const page17Source=fs.readFileSync('app/operations/[id]/page.js','utf8');
for(const marker of ['AI Testing &','AI Testing Process','Issues Found','LIUI Quality Gate','Quick Actions'])assert.ok(page17Source.includes(marker),`Testing surface missing ${marker}`);
const page18Source=fs.readFileSync('app/publish/[id]/page.js','utf8');
for(const marker of ['Publish &','Deployment Targets','Domain & Hosting','App Store Preparation','Official store review remains external'])assert.ok(page18Source.includes(marker),`Publish surface missing ${marker}`);

const statusRoute=fs.readFileSync('app/api/product-surface/status/route.js','utf8');
assert.doesNotMatch(statusRoute,/process\.env/);for(const forbidden of ['rawPrompt','raw prompt','userId','user_id','specification'])assert.doesNotMatch(statusRoute,new RegExp(forbidden,'i'));
assert.match(statusRoute,/productionRuntimeVerified:false/);assert.match(statusRoute,/externalProviderLiveVerified:false/);assert.match(statusRoute,/physicalDeviceVerified:false/);assert.match(statusRoute,/storeVerified:false/);

console.log('✓ Historical capability registry remains intact as an internal functional and safety contract');
console.log('✓ Canonical customer UI authority is independent of fixed 18/23/25 page presentation');
console.log('✓ Real creation, editor, database, self-heal and publish boundaries remain intact');
console.log('✓ No-credits, SMS hold and mobile Community Compute boundaries remain enforced');
