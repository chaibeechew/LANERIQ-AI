import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANONICAL_PRIMARY_NAV, CANONICAL_CREATION_JOURNEY } from '../lib/product/canonical-ui-registry.js';
import { LANERIQ_18_PAGE_DESIGN_RULES } from '../lib/product/laneriq-18-page-master.js';

const home=fs.readFileSync('app/page.js','utf8');
const finalCss=fs.readFileSync('app/home-liui-v5.css','utf8');
const canonicalCss=fs.readFileSync('app/canonical-core-ui.css','utf8');
const wallpaper=fs.readFileSync('app/components/AdaptiveWallpaperEngine.js','utf8');
const generatedStandard=fs.readFileSync('lib/design/generated-experience-standard.js','utf8');
const owner=fs.readFileSync('app/components/CanonicalCoreUIOwner.js','utf8');
const registry=fs.readFileSync('lib/product/canonical-ui-registry.js','utf8');
const layout=fs.readFileSync('app/layout.js','utf8');

// Real Page 1 engine remains untouched by the canonical presentation layer.
for(const marker of ['/api/orchestrate','/api/generate','stableCreateRequestId','CREATE_REQUEST_KEY']) assert.ok(home.includes(marker),`Page 1 real generation/recovery marker missing: ${marker}`);
for(const marker of ['LANERIQ AI','LIVING INTELLIGENCE','Tell LANERIQ AI what you want to create.','Create Image','Design UI']) assert.ok(home.includes(marker),`Native Page 1 product marker missing: ${marker}`);
assert.ok(home.indexOf('className="promptCard"')<home.indexOf('className="featureCards"'),'Intent Composer must precede creator tools in the real DOM');
assert.doesNotMatch(home,/moon-city/i,'Retired wallpaper preset must not remain in Page 1 runtime');

// Approved first paint, intent-first geometry and core safe-area behavior.
assert.match(finalCss,/url\('\/laneriq-future-city-people\.webp'\)!important/,'Homepage must retain Future City + People first paint');
assert.match(layout,/preload[^>]+laneriq-future-city-people\.webp/,'Future City + People artwork must remain preloaded');
assert.match(finalCss,/\.frame\{max-width:900px!important/,'Page 1 must retain the focused mobile-first content width');
assert.match(finalCss,/\.promptCard\{[\s\S]*border-radius:30px!important/,'Page 1 must use the large glass intent composer');
assert.match(finalCss,/\.featureCards\{display:grid!important;grid-template-columns:1fr 1fr!important/,'Create Image / Design UI must retain two-card geometry');
assert.match(finalCss,/\.buildCta\{[\s\S]*min-height:82px!important/,'Primary build action must remain visually dominant');
assert.match(canonicalCss,/safe-area-inset-top/,'Canonical core UI must protect the top safe area');
assert.match(canonicalCss,/safe-area-inset-bottom/,'Canonical core UI must protect the bottom safe area');
assert.match(canonicalCss,/overflow-x:hidden/,'Canonical core UI must prevent horizontal overflow');

// Intent-first order remains locked.
assert.match(finalCss,/\.promptCard\{order:2\}/,'Intent Composer must come immediately after Hero');
assert.match(finalCss,/\.featureCards\{order:3\}/,'Create Image / Design UI must follow Intent Composer');
assert.match(finalCss,/\.choiceCard:not\(\.templateCard\)\{order:4\}/,'Style must follow creator tools');
assert.match(finalCss,/\.templateCard\{order:5\}/,'Templates must follow Style');
assert.match(finalCss,/:where\(\.buildCta,\.buildProgress\)\{order:6\}/,'Build CTA/progress must remain the final primary action');

// Wallpaper runtime cannot replace Page 1 first paint.
assert.match(wallpaper,/if\(hidden\|\|homeSurface\(\)\)return/,'Wallpaper runtime must never replace Page 1 first paint');
assert.doesNotMatch(wallpaper,/big-moon-valley|moon-city/i,'Legacy Page 1 design identifiers must not remain in the wallpaper runtime');
assert.doesNotMatch(generatedStandard,/moon-city/i,'Retired wallpaper fallback must not remain in generated-experience standard');

// Customer UI authority is the canonical registry, not a fixed total-page registry.
assert.deepEqual(CANONICAL_PRIMARY_NAV.map(item=>item.label),['Home','Projects','Create','Templates','More']);
assert.deepEqual(CANONICAL_CREATION_JOURNEY.map(item=>item.label),['Idea','Plan','Build','Preview','Launch','Manage']);
assert.match(owner,/canonical-ui-registry\.js/,'Canonical core owner must read shared UI authority');
assert.match(owner,/CANONICAL_PRIMARY_NAV\.map/,'Canonical owner must render shared primary navigation');
assert.match(registry,/id:\"home\"/,'Canonical registry must own Home');
assert.match(registry,/id:\"create\"/,'Canonical registry must own Create');
for(const label of ['Home','Projects','Create','Templates','More']) assert.ok(registry.includes(`label: "${label}"`),`Canonical registry missing ${label}`);
for(const value of [owner,registry,canonicalCss]) assert.doesNotMatch(value,/\bPage\s+\d+\s*(?:of|\/)\s*(?:18|23|25)\b/i,'Canonical Page 1 authority must not expose fixed page totals');
assert.doesNotMatch(owner,/LANERIQ_18_PAGES/,'Canonical core owner must not depend on the historical fixed-page registry');

// Product policy boundaries remain intact even though the old registry is no longer UI authority.
assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.noCreditsLaunch,true);
assert.equal(LANERIQ_18_PAGE_DESIGN_RULES.mobileCommunityCompute,false);

console.log('✓ Page 1 preserves real generate/orchestrate/recovery behavior');
console.log('✓ Canonical Page 1 geometry, future-city first paint and safe areas are locked');
console.log('✓ Intent Composer → creator tools → Style → Templates → Build CTA order is locked');
console.log('✓ Customer navigation authority is Home / Projects / Create / Templates / More from the canonical registry');
console.log('✓ Fixed 18/23/25 customer page totals cannot re-enter the canonical Page 1 shell');
