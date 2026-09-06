import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspectProjectSpecification, buildSelfHealInstruction } from '../lib/ai/project-self-heal-policy.js';
import { applySoolenMaxSecurity } from '../lib/ai/soolenai-max-security.js';
import { selfTestGeneratedApp } from '../lib/generator/self-test.js';
import { verifyGeneratedAppExecution } from '../lib/generator/execution-verifier.js';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const generate=read('app/api/generate/route.js');
const modify=read('app/api/modify/route.js');
const builderDomain=read('lib/cloud/builder-projects.js');
const builderAdapter=read('lib/cloud-adapters/builder-project-data.js');
const policy=read('lib/ai/project-self-heal-policy.js');

const qualityPlan={
  stability:['Loading, error and empty states with retry','Input validation and recoverable actions','Status confirmation and offline-safe fallback'],
  security:['Server validation for sensitive actions','Least privilege role and permission checks','No client secrets or tokens'],
  privacy:['Private by default customer data','Delete and export controls','Purpose-limited personal data'],
  comfort:['Mobile responsive layout prevents overflow','Accessible readable tap targets and contrast','Simple navigation with safe-area spacing'],
  beauty:['Premium original visual hierarchy','Coordinated responsive palette and imagery','Polished card, hero and wallpaper system'],
  naturalness:['Human friendly copy','Context-aware real-world workflow','Natural spacing and interaction rhythm'],
};
const designSystem={themeMode:'auto',colorPreference:'coordinated',paletteRationale:'accessible branded palette',primaryColor:'#12664f',secondaryColor:'#234e42',accentColor:'#d9ad45',backgroundColor:'#eef5f1',surfaceColor:'#ffffff',textColor:'#102c23',backgroundDirection:'layered premium background',heroDirection:'responsive visual hero',layoutSignature:'mobile-first responsive cards',fontDirection:'humanist sans',iconStyle:'line icons',cardStyle:'soft elevated cards',imageStyle:'original editorial imagery',wallpaperPreset:'moon-city'};
const base={name:'Safe Project',description:'Customer workflow',designSystem,qualityPlan,pages:[{id:'home',name:'Home',route:'/',description:'Useful home page',components:[{type:'card'}]},{id:'records',name:'Records',route:'/records',description:'Records page',components:[{type:'list'}]}],features:[{name:'Records',description:'Manage customer records'}],data:{Record:{fields:['name','status']}},dataModels:[{name:'Record',fields:['name: text','status: text']}],actions:[{name:'Open records',route:'/records'}],navigation:[{label:'Home',route:'/'},{label:'Records',route:'/records'}],visualAssets:[{type:'hero',description:'Original accessible hero image'}]};

const required=['broken_actions','empty_pages','mobile_overflow','data_contracts','ownership_permissions','missing_routes','api_failures','media_integrity','accessibility_basics','release_readiness'];
const good=inspectProjectSpecification(base);
for(const id of required)assert.ok(good.checkResults[id],`Missing deterministic check: ${id}`);
assert.equal(good.passed,true,'Known-good structural specification should have no blocking self-heal errors.');

const brokenAction=inspectProjectSpecification({...base,actions:[{name:'Ghost',route:'/missing'}]});
assert.equal(brokenAction.checkResults.broken_actions.passed,false);
const emptyPages=inspectProjectSpecification({...base,pages:[]});
assert.equal(emptyPages.checkResults.empty_pages.passed,false);
const overflow=inspectProjectSpecification({...base,pages:[{...base.pages[0],components:[{type:'panel',minWidth:900}]}]});
assert.equal(overflow.checkResults.mobile_overflow.passed,false);
const badData=inspectProjectSpecification({...base,dataModels:[{name:'Customer',fields:[]}]});
assert.equal(badData.checkResults.data_contracts.passed,false);
const secretField=inspectProjectSpecification({...base,data:{Customer:{fields:['name','api_key']}}});
assert.equal(secretField.checkResults.ownership_permissions.passed,false);

const securedBase=applySoolenMaxSecurity(base);
const securedReport=inspectProjectSpecification(securedBase);
assert.equal(securedReport.checkResults.ownership_permissions.passed,true,`Canonical MAX metadata must not self-block: ${JSON.stringify(securedReport.issues)}`);
const nestedSecuritySecret=inspectProjectSpecification({...securedBase,security:{...securedBase.security,secrets:{...securedBase.security.secrets,apiKey:'must-never-be-generated'}}});
assert.equal(nestedSecuritySecret.checkResults.ownership_permissions.passed,false,'Nested apiKey under the trusted security.secrets container must still fail closed.');
const loggingToken=inspectProjectSpecification({...securedBase,security:{...securedBase.security,logging:{...securedBase.security.logging,authToken:'must-never-be-generated'}}});
assert.equal(loggingToken.checkResults.ownership_permissions.passed,false,'Only canonical tokensRedacted metadata is trusted; authToken must still fail closed.');
const designTokensSafe=inspectProjectSpecification({...securedBase,designSystem:{...securedBase.designSystem,designTokens:{spacing:'8px grid',radius:'16px',typography:'responsive scale'}}});
assert.equal(designTokensSafe.checkResults.ownership_permissions.passed,true,`Canonical designSystem.designTokens must not be mistaken for credentials: ${JSON.stringify(designTokensSafe.issues)}`);
const designTokensSecret=inspectProjectSpecification({...securedBase,designSystem:{...securedBase.designSystem,designTokens:{spacing:'8px grid',authToken:'must-never-be-generated'}}});
assert.equal(designTokensSecret.checkResults.ownership_permissions.passed,false,'Nested authToken inside designTokens must still fail closed.');

const badRoute=inspectProjectSpecification({...base,navigation:[...base.navigation,{label:'Ghost',route:'/ghost'}]});
assert.equal(badRoute.checkResults.missing_routes.passed,false);
const apiWarning=inspectProjectSpecification({...base,features:[{name:'Payments API',description:'External checkout'}],qualityPlan:{...qualityPlan,stability:['Fast UI','Clear layout','Simple status']}});
assert.ok(apiWarning.issues.some(issue=>issue.code==='api_failures'));
const unsafeMedia=inspectProjectSpecification({...base,visualAssets:[{type:'hero',description:'Hero',url:'http://example.com/hero.jpg'}]});
assert.equal(unsafeMedia.checkResults.media_integrity.passed,false);
const inaccessible=inspectProjectSpecification({...base,pages:[{...base.pages[0],components:[{type:'button',accessibility:false}]}]});
assert.equal(inaccessible.checkResults.accessibility_basics.passed,false);
const lowQuality=inspectProjectSpecification({...base,qualityPlan:{}});
assert.ok(lowQuality.issues.some(issue=>issue.code==='release_readiness'));
assert.ok(buildSelfHealInstruction({specification:badRoute}).includes('VERIFIED FINDINGS TO ADDRESS'));

const rawSelfTest=selfTestGeneratedApp({name:'No pages'});
assert.equal(rawSelfTest.ok,false);
assert.equal(rawSelfTest.checks.hasExplicitPages,false);
const rawExecution=verifyGeneratedAppExecution({name:'No pages'});
assert.equal(rawExecution.ok,false);
assert.ok(rawExecution.errors.includes('NO_PAGES'));

// Create path: candidate is deterministically verified, normal repair is re-run, targeted rescue is bounded,
// and an unverified output is never persisted or relabeled as success.
assert.match(generate,/runSoolenAdultMode/);
assert.match(generate,/verifyGeneration/);
assert.match(generate,/buildRepairInstruction/);
assert.match(generate,/buildSelfHealInstruction/);
assert.match(generate,/repair:async/);
assert.match(generate,/maxRepairs:3/);
assert.match(generate,/if\(adult\.generationStatus!=="verified"\)\{/);
assert.match(generate,/for\(let attempt=1;attempt<=QUALITY_GATE_RESCUE_ATTEMPTS;attempt\+=1\)/);
assert.match(generate,/buildGenerationQualityDiagnostics/);
assert.match(generate,/buildQualityGateRescueInstruction/);
assert.match(generate,/review=runCriticChecks\(generationResult,adultRequirements\)/);
assert.match(generate,/report=verifyGeneration\(generationResult\)/);
assert.match(generate,/if\(review\.passed&&report\.passed\)/);
assert.match(generate,/throw qualityGateError\("Soolen Super Brain could not verify the generated specification after autonomous repair attempts\.",rescueDiagnostics\)/);
assert.match(generate,/const verified=verifyGeneration\(generationResult\),finalReview=runCriticChecks\(generationResult,adultRequirements\);/);
assert.match(generate,/if\(!verified\.passed\|\|!finalReview\.passed\)/);
assert.match(generate,/sourceEngineeringEvidence/);
assert.match(generate,/sandboxVerified:status==="verified"/);
assert.match(generate,/requiredForGeneration:false/);
assert.match(generate,/requiredBeforeSourceRelease:true/);
assert.doesNotMatch(generate,/if\(adult\.status!=="verified"\)throw new Error/,'External source sandbox availability must not replace deterministic specification verification.');
assert.match(generate,/persistBuilderGeneratedProject/);
assert.match(builderDomain,/persistBuilderGeneratedProject/);
assert.match(builderAdapter,/server_persist_generated_project/);
const finalVerifyIndex=generate.indexOf('const verified=verifyGeneration(generationResult),finalReview=runCriticChecks(generationResult,adultRequirements)');
const persistenceIndex=generate.indexOf('const persistence=await persistBuilderGeneratedProject',finalVerifyIndex);
assert.ok(finalVerifyIndex>=0&&persistenceIndex>finalVerifyIndex,'Create must finish final deterministic verification after any rescue before LANERIQ Cloud App + Website persistence.');

// Modify path: quality regression repair + self-heal revalidation happen before Cloud atomic version persistence.
assert.match(modify,/function qualityRegressed/);
assert.match(modify,/AI quality repair/);
assert.match(modify,/if\(qualityRegressed\(currentQuality,repaired\.quality\)\)throw new Error/);
assert.match(modify,/if\(!candidate\.selfHeal\.passed\)/);
assert.match(modify,/AI self-heal/);
assert.match(modify,/if\(!healed\.selfHeal\.passed\)throw new Error/);
assert.match(modify,/if\(qualityRegressed\(currentQuality,healed\.quality\)\)throw new Error/);
assert.match(modify,/saveBuilderModification/);
assert.match(builderAdapter,/server_save_app_modification/);
assert.ok(modify.indexOf('if(!candidate.selfHeal.passed)') < modify.indexOf('const save=await saveBuilderModification'),'Self-heal must complete before Cloud version persistence.');
assert.match(modify,/PREVIOUS KNOWN-GOOD SPECIFICATION/);

for(const id of required)assert.match(policy,new RegExp(`add\\("${id}"|checkResults\\[check\\]|${id}`));
assert.match(policy,/assessBuildQuality/);
assert.match(policy,/Explicit min-width|Explicit \$\{key\}/i);
assert.match(policy,/credential field|Secret-like field\/key/i);
assert.match(policy,/TRUSTED_NON_SECRET_METADATA_PATHS/);
assert.match(policy,/isTrustedNonSecretMetadataPath/);
assert.match(policy,/designSystem\.designTokens/);
assert.match(policy,/unsafe URL|insecure HTTP media/i);
assert.match(policy,/Accessibility is explicitly disabled/i);

console.log('✓ All 10 declared Self-Heal categories have executable deterministic checks');
console.log('✓ Raw missing-page output is detected before normalization can hide the structural failure');
console.log('✓ Canonical MAX/design metadata survives Self-Heal while nested credential-like fields remain fail-closed');
console.log('✓ Create performs normal autonomous repair, bounded targeted rescue, and final deterministic verification before LANERIQ Cloud persistence');
console.log('✓ Targeted rescue cannot bypass the same critic + generation verification gates');
console.log('✓ Source sandbox evidence remains truthful and separate from verified specification persistence');
console.log('✓ Modify blocks quality regression, re-verifies self-heal output and saves only after the candidate passes');
console.log('✓ Unsafe routes, overflow, data contracts, credential fields, media and explicit accessibility failures are fail-closed');