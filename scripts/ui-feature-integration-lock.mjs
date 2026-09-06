import { execFileSync } from 'node:child_process';

const baseSha=String(process.env.BASE_SHA||'').trim();
const headSha=String(process.env.HEAD_SHA||'').trim();
const prNumber=Number(process.env.PR_NUMBER||0);
const headBranch=String(process.env.HEAD_BRANCH||'').trim();
const CANONICAL_UI_PR=407;
const CANONICAL_UI_BRANCH='ui/canonical-cleanup-round1';

function fail(message,details=[]){
  console.error(`\nUI / Feature Integration Lock: BLOCKED\n${message}`);
  for(const detail of details)console.error(` - ${detail}`);
  process.exit(1);
}

if(!baseSha||!headSha){
  console.log('UI / Feature Integration Lock: push/non-PR event; protected-path diff check skipped.');
  process.exit(0);
}

try{
  execFileSync('git',['merge-base','--is-ancestor',baseSha,headSha],{stdio:'ignore'});
}catch{
  fail('PR head does not contain the latest main/base SHA. Re-align this PR to latest main before integration.',[
    `base=${baseSha}`,
    `head=${headSha}`,
  ]);
}

const changed=execFileSync('git',['diff','--name-only',`${baseSha}...${headSha}`],{encoding:'utf8'})
  .split(/\r?\n/).map(v=>v.trim()).filter(Boolean);

const exactProtected=new Set([
  'app/layout.js',
  'app/template.js',
  'app/globals.css',
  'app/page.js',
  'app/canonical-core-ui.css',
]);
const protectedPrefixes=['app/auth/','app/login/'];
const protectedPatterns=[
  /^app\/components\/.*(?:Canonical|Header|Navigation|BottomNav|Nav|Logo|Brand|LIUI).*\.(?:js|jsx|ts|tsx)$/i,
  /^app\/(?:canonical|liui|home)-.*\.css$/i,
  /^lib\/product\/laneriq-.*(?:master|registry).*\.(?:js|mjs|ts)$/i,
  /^public\/(?:laneriq|soolen).+\.(?:png|jpe?g|webp|svg|avif)$/i,
];

const protectedChanges=changed.filter(path=>
  exactProtected.has(path)
  || protectedPrefixes.some(prefix=>path.startsWith(prefix))
  || protectedPatterns.some(pattern=>pattern.test(path))
);

if(!protectedChanges.length){
  console.log('✓ UI / Feature Integration Lock: no protected Global UI files changed.');
  console.log('✓ PR head contains the latest main/base SHA.');
  process.exit(0);
}

if(prNumber!==CANONICAL_UI_PR||headBranch!==CANONICAL_UI_BRANCH){
  fail(`Protected Global UI changes belong only to Canonical UI PR #${CANONICAL_UI_PR}.`,[
    `current PR=${prNumber||'unknown'} branch=${headBranch||'unknown'}`,
    `canonical branch=${CANONICAL_UI_BRANCH}`,
    ...protectedChanges,
  ]);
}

console.log(`✓ Canonical UI Owner verified: PR #${CANONICAL_UI_PR} (${CANONICAL_UI_BRANCH}).`);
for(const path of protectedChanges)console.log(`  UI: ${path}`);
