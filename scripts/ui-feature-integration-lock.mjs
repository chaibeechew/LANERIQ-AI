import { execFileSync } from 'node:child_process';

const baseSha=String(process.env.BASE_SHA||'').trim();
const headSha=String(process.env.HEAD_SHA||'').trim();
const labelsRaw=String(process.env.PR_LABELS||'[]');
let labels=[];
try{labels=JSON.parse(labelsRaw)}catch{labels=[]}
labels=Array.isArray(labels)?labels.map(String):[];

const CANONICAL_UI_LABEL='canonical-ui-owner';

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
  'app/globals.css',
  'app/page.js',
]);
const protectedPrefixes=[
  'app/auth/',
];
const protectedPatterns=[
  /^app\/components\/.*(?:Header|Navigation|BottomNav|Nav|Logo|Brand|LIUI).*\.(?:js|jsx|ts|tsx)$/i,
  /^app\/(?:liui|home)-.*\.css$/i,
  /^lib\/product\/laneriq-.*(?:master|registry).*\.(?:js|mjs|ts)$/i,
  /^public\/(?:laneriq|soolen).+\.(?:png|jpe?g|webp|svg|avif)$/i,
];

const protectedChanges=changed.filter(path=>
  exactProtected.has(path)
  || protectedPrefixes.some(prefix=>path.startsWith(prefix))
  || protectedPatterns.some(pattern=>pattern.test(path))
);

if(!protectedChanges.length){
  console.log('✓ UI / Feature Integration Lock: no protected global UI files changed.');
  console.log('✓ PR head contains the latest main/base SHA.');
  process.exit(0);
}

if(!labels.includes(CANONICAL_UI_LABEL)){
  fail(`Feature PR modifies protected Global UI files but is not the Canonical UI Owner PR. Add no bypass; move/adapt these changes through the UI owner PR instead. Required owner label: ${CANONICAL_UI_LABEL}.`,protectedChanges);
}

console.log(`✓ Canonical UI Owner label present: ${CANONICAL_UI_LABEL}`);
console.log('✓ Protected Global UI changes are allowed only for this explicitly designated UI owner PR.');
for(const path of protectedChanges)console.log(`  UI: ${path}`);
