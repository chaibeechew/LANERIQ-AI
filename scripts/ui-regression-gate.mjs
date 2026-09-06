import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=file=>fs.readFileSync(file,'utf8');
const mustExist=(id,file)=>assert.ok(fs.existsSync(file),`${id} missing: ${file}`);

const required=[
  ['Home','app/page.js'],
  ['Login / Email / Verification','app/auth/page.js'],
  ['Create','app/create/page.js'],
  ['Global Layout','app/layout.js'],
  ['Canonical Header / Navigation / Bottom Nav','app/components/LIUIRealProductSurface.js'],
];
for(const [id,file] of required)mustExist(id,file);

const home=read('app/page.js');
const auth=read('app/auth/page.js');
const create=read('app/create/page.js');
const layout=read('app/layout.js');
const shell=read('app/components/LIUIRealProductSurface.js');

assert.match(home,/export default/,'Home must remain a real route component');
assert.match(auth,/\/api\/auth\/verification\/request/,'Email entry must remain wired to verification request');
assert.match(auth,/\/api\/auth\/verification\/verify/,'Verification must remain wired to verification verify');
assert.match(auth,/\botp\b/i,'Verification code state/input must remain present');
assert.match(create,/\/api\/orchestrate/,'Create must remain wired to orchestration');
assert.match(create,/\/api\/generate/,'Create must remain wired to generation');
assert.match(layout,/LIUIRealProductSurface/,'Global layout must mount the canonical UI shell');
assert.match(shell,/liuiReferenceHeader/,'Canonical Header missing');
assert.match(shell,/liuiRealBottomNav/,'Canonical Bottom Nav missing');
assert.match(shell,/data-liui-nav|liuiReferenceRail|canonical/i,'Canonical Navigation marker missing');

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));else out.push(full.replaceAll('\\','/'));
  }
  return out;
}
function stripComments(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/^\s*\/\/.*$/gm,'');
}

const appFiles=walk('app');
const cssFiles=appFiles.filter(file=>file.endsWith('.css'));
const css=cssFiles.map(read).join('\n');
assert.match(css,/env\(safe-area-inset-top\)/,'Mobile safe-area top protection missing');
assert.match(css,/env\(safe-area-inset-bottom\)/,'Mobile safe-area bottom protection missing');
assert.match(css,/max-width\s*:\s*100vw/i,'Mobile overflow guard missing');
assert.match(css,/min-(?:height|width)\s*:\s*(?:44|48|56)px/i,'Mobile touch-target protection missing');

// Customer-facing source must never expose a fixed total page count. Internal docs/tests and comment-only historical notes are intentionally out of scope.
const customerSourceFiles=appFiles.filter(file=>
  /\.(?:js|jsx|ts|tsx)$/.test(file)
  && !file.startsWith('app/api/')
);
const forbidden=[];
const fixedPageCopy=[
  /\b(?:18|23|25)\s*[- ]?pages?\b/ig,
  /\b(?:18|23|25)\s*[页頁]\b/ig,
  /\b(?:eighteen|twenty[- ]?three|twenty[- ]?five)\s+(?:purpose-built\s+screens|pages?)\b/ig,
  /\b18[- ]page\s+master\s+layout\b/ig,
  /\blegacy\s+18[- ]page\b/ig,
];
for(const file of customerSourceFiles){
  const source=stripComments(read(file));
  for(const pattern of fixedPageCopy){
    pattern.lastIndex=0;
    const match=pattern.exec(source);
    if(match)forbidden.push(`${file}: ${match[0]}`);
  }
}
assert.equal(forbidden.length,0,`Hard-coded/legacy customer page-count copy detected:\n${forbidden.map(v=>` - ${v}`).join('\n')}`);

console.log('✓ Home');
console.log('✓ Login / Email / Verification');
console.log('✓ Create');
console.log('✓ Header / Navigation / Bottom Nav');
console.log('✓ Mobile safe area / overflow / touch-target static protections');
console.log('✓ No hard-coded 18 / 23 / 25 customer-facing page count');
console.log('✓ No legacy 18-page customer copy');
console.log('UI Regression Gate: PASS (CODE/CI). Runtime browser QA and exact Production SHA convergence remain separate mandatory release evidence.');
