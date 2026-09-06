import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const page=read('app/image-studio/page.js');
const generate=read('app/api/images/generate/route.js');
const save=read('app/api/images/save/route.js');
const readiness=read('app/api/images/readiness/route.js');
const gateway=read('lib/ai/image-generation-gateway.js');
const hardenedRuntime=read('lib/ai/image-production-hardened-runtime.js');
const persistence=read('lib/ai/image-output-persistence.js');
const placement=read('lib/ai/image-placement-policy.js');
const assetMigration=read('supabase/migrations/20260901124338_harden_upload_reference_asset_contract.sql');
const replayMigration=read('supabase/migrations/20260903093000_image_generation_request_replay.sql');

// Customer surface: bounded prompt, stable IDs, same-origin requests, honest model/local labeling and private persistence.
assert.match(page,/maxLength=\{4000\}/);
assert.match(page,/useRef/);
assert.match(page,/generationRequestId\.current\|\|newRequestId\("image"\)/);
assert.match(page,/generationRequestId\.current=requestId/);
assert.match(page,/IMAGE_GENERATION_IN_PROGRESS/);
assert.match(page,/return postGeneration\(payload,attempt\+1\)/);
assert.match(page,/Retry will resume the same request instead of creating a duplicate/);
assert.match(page,/newRequestId\("image-save"\)/);
assert.match(page,/fetch\("\/api\/images\/generate"/);
assert.match(page,/fetch\("\/api\/images\/save"/);
assert.match(page,/credentials:"same-origin"/);
assert.match(page,/cache:"no-store"/);
assert.match(page,/Save to Library/);
assert.match(page,/Saved to Library/);
assert.match(page,/item\?\.persisted\|\|item\?\.assetId/);
assert.match(page,/private Asset Library/);
assert.match(page,/no model output was claimed/);
assert.match(page,/item\.source==="model"\?"Model":"Local"/);
assert.match(page,/font-size:16px/);
assert.match(page,/min-height:44px/);

// Generate: authenticated + verified, bounded, request-ledger idempotent, placement-aware, credit-aware and hardened before release.
assert.match(generate,/auth\.getUser\(\)/);
assert.match(generate,/confirmed_at/);
assert.match(generate,/createAdminClient/);
assert.match(generate,/MAX_REQUEST_BYTES=32\*1024/);
assert.match(generate,/REQUEST_ID=\/\^\[a-zA-Z0-9\._:-\]/);
assert.match(generate,/STALE_PENDING_MS=90\*1000/);
assert.match(generate,/requestHash\(/);
assert.match(generate,/image_generation_requests/);
assert.match(generate,/claimRequest\(admin/);
assert.match(generate,/IMAGE_REQUEST_ID_CONFLICT/);
assert.match(generate,/IMAGE_GENERATION_IN_PROGRESS/);
assert.match(generate,/IMAGE_GENERATION_RETRY_NEW_ID/);
assert.match(generate,/claim\.state==="replay"/);
assert.match(generate,/replayPersistedImages/);
assert.match(generate,/persistGeneratedImages/);
assert.match(generate,/durable:true/);
assert.match(generate,/prompt\.length>4000/);
assert.match(generate,/Math\.min\(4,Math\.max\(1/);
assert.match(generate,/STYLES=new Set/);
assert.match(generate,/PALETTES=new Set/);
assert.match(generate,/getImagePlacementPolicy\(mode\)/);
assert.match(generate,/buildImagePlacementPrompt\(prompt,mode\)/);
assert.match(generate,/if\(mode!=="icon"&&gateway\.configured\)/);
assert.match(generate,/consumeAiCredits\(user\.id/);
assert.match(generate,/refundAiCredits\(user\.id/);
assert.match(generate,/completeRequest\(admin/);
assert.match(generate,/failRequest\(admin/);
assert.match(generate,/source:"model"/);
assert.match(generate,/source:"local"/);
assert.match(generate,/modelFallback:Boolean\(modelFailureCode\)/);
assert.match(generate,/runImageProductionHardenedGeneration/);
assert.match(generate,/REAL_OUTPUT_QUALITY_VERIFIED/);
assert.doesNotMatch(generate,/generateExternalImages/);
const providerCallIndex=generate.indexOf('const hardened=await runImageProductionHardenedGeneration');
const requestClaimIndex=generate.indexOf('claimRequest(admin');
const hardenedSuccessIndex=generate.indexOf('if(hardened.generated)',providerCallIndex);
const durableCaptureIndex=generate.indexOf('const durableImages=await persistGeneratedImages',hardenedSuccessIndex);
const providerSuccessIndex=generate.indexOf('replayed:false,durable:true',durableCaptureIndex);
assert.ok(requestClaimIndex>=0&&providerCallIndex>requestClaimIndex,'Hardened provider execution must happen only after the request replay ledger is claimed.');
assert.ok(hardenedSuccessIndex>providerCallIndex&&durableCaptureIndex>hardenedSuccessIndex&&providerSuccessIndex>durableCaptureIndex,'Provider output must pass hardened execution and then be durably captured before first-run model output is returned to the browser.');
assert.match(generate,/return noStore\(\{error:"Unable to generate image right now\."\},500\)/);
assert.doesNotMatch(generate,/return noStore\(\{error:error\?\.message/);

// Hardened runtime: approved provider bytes are server-captured, independently observed and hash/signature bound before the route may claim model success.
assert.match(hardenedRuntime,/runCreativeMediaHardenedExecution/);
assert.match(hardenedRuntime,/generateCreativeImage/);
assert.match(hardenedRuntime,/isApprovedImageOutputUrl/);
assert.match(hardenedRuntime,/captureHttpsImage/);
assert.match(hardenedRuntime,/capturedSha256/);
assert.match(hardenedRuntime,/IMAGE_OBSERVER_CAPTURE_HASH_MISMATCH/);
assert.match(hardenedRuntime,/createHmac\('sha256'/);
assert.match(hardenedRuntime,/providerSelfReported:false/);
assert.match(hardenedRuntime,/REAL_OUTPUT_QUALITY_VERIFIED/);
assert.match(hardenedRuntime,/IMAGE_HARDENED_QUALITY_GATE_FAILED/);

// Provider persistence: approved host/data output only, signature validation, private storage, signed display and rollback on partial failure.
assert.match(persistence,/isApprovedImageOutputUrl/);
assert.match(persistence,/MAX_IMAGE_BYTES=8\*1024\*1024/);
assert.match(persistence,/89504e470d0a1a0a/);
assert.match(persistence,/buffer\[0\]===0xff&&buffer\[1\]===0xd8/);
assert.match(persistence,/toString\("ascii"\)==="RIFF"/);
assert.match(persistence,/toString\("ascii"\)==="WEBP"/);
assert.match(persistence,/redirect:"error"/);
assert.match(persistence,/cache:"no-store"/);
assert.match(persistence,/createHash\("sha256"\)/);
assert.match(persistence,/storage\.from\("user-assets"\)\.upload/);
assert.match(persistence,/generationRequestId:requestId/);
assert.match(persistence,/reusableAcrossUsers:false/);
assert.match(persistence,/rawPrivateAssetsReusableAcrossCustomers:false/);
assert.match(persistence,/createSignedUrl/);
assert.match(persistence,/SIGNED_URL_TTL_SECONDS=60\*60/);
assert.match(persistence,/rollbackCreated/);
assert.match(persistence,/storage\.from\("user-assets"\)\.remove\(paths\)/);
assert.match(persistence,/from\("asset_library"\)\.delete\(\)\.in\("id",ids\)/);

// Gateway: selected runtime only, bounded timeout/output, output-host allowlist before server capture, provider errors hidden.
assert.match(gateway,/assertRuntimeUrlAllowed/);
assert.match(gateway,/timeoutMs: 45000/);
assert.match(gateway,/maxDataImageLength: 8 \* 1024 \* 1024/);
assert.match(gateway,/maxCount: 4/);
assert.match(gateway,/maxDimension: 8192/);
assert.match(gateway,/IMAGE_GENERATION_OUTPUT_HOST_ALLOWLIST/);
assert.match(gateway,/isApprovedImageOutputUrl/);
assert.match(gateway,/url\.protocol !== "https:" \|\| url\.username \|\| url\.password/);
assert.match(gateway,/return isApprovedImageOutputUrl\(image\) \? image : null/);
assert.match(gateway,/data:image\\\/\(\?:png\|jpeg\|webp\);base64/);
assert.match(gateway,/redirect: "error"/);
assert.match(gateway,/cache: "no-store"/);
assert.match(gateway,/The connected image runtime rejected the request/);
assert.doesNotMatch(gateway,/data\?\.error \|\| data\?\.message/);

// Save: authenticated private user storage, strict binary/SVG validation, SSRF/output-host control and fingerprint replay safety.
assert.match(save,/auth\.getUser\(\)/);
assert.match(save,/MAX_REQUEST_BYTES=9\*1024\*1024/);
assert.match(save,/MAX_IMAGE_BYTES=8\*1024\*1024/);
assert.match(save,/imageSignatureMatches/);
assert.match(save,/89504e470d0a1a0a/);
assert.match(save,/buffer\[0\]===0xff&&buffer\[1\]===0xd8/);
assert.match(save,/toString\("ascii"\)==="RIFF"/);
assert.match(save,/toString\("ascii"\)==="WEBP"/);
assert.match(save,/sanitizeSvg/);
assert.match(save,/<script\|<foreignObject\|<iframe\|<object\|<embed\|javascript:/);
assert.match(save,/IMAGE_GENERATION_OUTPUT_HOST_ALLOWLIST/);
assert.match(save,/url\.protocol!=="https:"\|\|url\.username\|\|url\.password/);
assert.match(save,/setTimeout\(\(\)=>controller\.abort\(\),20000\)/);
assert.match(save,/createHash\("sha256"\)/);
assert.match(save,/\.eq\("user_id",user\.id\)\.eq\("content_fingerprint",fingerprint\)/);
assert.match(save,/storagePath=`\$\{user\.id\}\//);
assert.match(save,/storage\.from\("user-assets"\)\.upload/);
assert.match(save,/user_id:user\.id/);
assert.match(save,/reusableAcrossUsers:false/);
assert.match(save,/rawPrivateAssetsReusableAcrossCustomers:false/);
assert.match(save,/String\(dbError\.code\|\|""\)==="23505"/);
assert.match(save,/Cache-Control":"private, no-store/);

// Database safety: saved assets stay private and the provider replay ledger is service-only.
assert.match(assetMigration,/asset_library_user_fingerprint_unique_idx/);
assert.match(assetMigration,/user_id, content_fingerprint/);
assert.match(assetMigration,/reusableAcrossUsers/);
assert.match(assetMigration,/rawPrivateAssetsReusableAcrossCustomers/);
assert.match(assetMigration,/revoke insert, update, delete on table public\.asset_library from anon/i);
assert.match(replayMigration,/create table if not exists public\.image_generation_requests/i);
assert.match(replayMigration,/unique \(user_id, request_id\)/i);
assert.match(replayMigration,/enable row level security/i);
assert.match(replayMigration,/revoke all on table public\.image_generation_requests from public, anon, authenticated/i);
assert.match(replayMigration,/grant select, insert, update, delete on table public\.image_generation_requests to service_role/i);

// Safe production readiness exposes only sanitized readiness/evidence state and never provider credentials, endpoints or signing secrets.
assert.match(readiness,/externalProviderConnected:config\.connected/);
assert.match(readiness,/externalProviderAllowed:config\.configured/);
assert.match(readiness,/durableProviderCapture:true/);
assert.match(readiness,/idempotentReplay:true/);
assert.match(readiness,/hardenedExecutionWired:true/);
assert.match(readiness,/independentObserverRequired:true/);
assert.match(readiness,/signedMarketEvidenceRequired:true/);
assert.match(readiness,/evidenceBundleVerified:market\.evidenceBundleVerified/);
assert.match(readiness,/marketSalesReady:market\.marketReady/);
assert.match(readiness,/truth:market\.truth/);
assert.match(readiness,/Cache-Control":"private, no-store/);
assert.doesNotMatch(readiness,/IMAGE_GENERATION_TOKEN|IMAGE_GENERATION_ENDPOINT|IMAGE_QUALITY_OBSERVER_TOKEN|IMAGE_QUALITY_OBSERVER_SIGNING_SECRET|IMAGE_MARKET_EVIDENCE_SIGNING_SECRET|CLOUDFLARE_AI_API_TOKEN|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);

// Placement contract must explicitly cover every Image Studio output type with responsive crop guidance.
for(const mode of ['wallpaper','background','hero','product','icon','image'])assert.match(placement,new RegExp(`${mode}:\\{usage:`));
assert.match(placement,/mobileCrop/);
assert.match(placement,/safeArea/);
assert.match(placement,/Do not add text unless the customer explicitly requests it/);

// Run exported gateway policy against hostile/approved output URLs, not only source-shape checks.
process.env.IMAGE_GENERATION_ENDPOINT='https://images.example.test/v1/generate';
process.env.IMAGE_GENERATION_OUTPUT_HOST_ALLOWLIST='cdn.example.test';
const gatewayModule=await import(`${pathToFileURL(path.join(root,'lib/ai/image-generation-gateway.js')).href}?contract=${Date.now()}`);
assert.equal(gatewayModule.isApprovedImageOutputUrl('https://images.example.test/output/a.png'),true);
assert.equal(gatewayModule.isApprovedImageOutputUrl('https://cdn.example.test/output/a.webp'),true);
assert.equal(gatewayModule.isApprovedImageOutputUrl('https://evil.example.test/track.png'),false);
assert.equal(gatewayModule.isApprovedImageOutputUrl('http://cdn.example.test/output/a.png'),false);
assert.equal(gatewayModule.isApprovedImageOutputUrl('https://user:pass@cdn.example.test/a.png'),false);
assert.equal(gatewayModule.normalizeGeneratedImageValue('https://evil.example.test/track.png'),null);
assert.ok(gatewayModule.normalizeGeneratedImageValue('data:image/png;base64,iVBORw0KGgo='));
assert.equal(gatewayModule.normalizeGeneratedImageValue('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),null);

console.log('Image Studio contract passed: auth, replay-safe hardened provider execution, independent byte-hash-bound quality evidence, durable private provider capture, signed market readiness, bounded output hosts, automatic credit refund, mobile request recovery and private Asset Library persistence are locked.');
