import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PROJECT_RELATIVE = 'projects/laneriq-anti-scam';
const PROJECT_DIRS = Object.freeze(['android', 'cloud', 'fabric', 'release']);
const WORKFLOWS = Object.freeze([
  '.github/workflows/laneriq-anti-scam-p0-android.yml',
  '.github/workflows/laneriq-anti-scam-production-aab.yml',
  '.github/workflows/laneriq-anti-scam-cloud-deadman-deploy.yml',
  '.github/workflows/laneriq-anti-scam-final-store-release-gate.yml',
]);

function posix(relative) {
  return relative.split(path.sep).join('/');
}

function excluded(relative) {
  const p = posix(relative);
  if (p.includes('/build/') || p.includes('/.gradle/') || p.includes('/node_modules/')) return true;
  if (p.endsWith('/release/PUBLIC_RELEASE_EVIDENCE.json')) return true;
  if (p.includes('/release/evidence/')) return true;
  if (p.endsWith('/release/final-launch-report.json')) return true;
  if (p.endsWith('/release/launch-report.json')) return true;
  if (p.endsWith('/release/l1-l5-execution-status.json')) return true;
  return false;
}

function walkFiles(root, absolute, out) {
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    const relative = posix(path.relative(root, absolute));
    if (!excluded(relative)) out.push(relative);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const name of fs.readdirSync(absolute).sort()) {
    walkFiles(root, path.join(absolute, name), out);
  }
}

export function releaseSourceFiles(root = process.cwd()) {
  const files = [];
  for (const dir of PROJECT_DIRS) {
    walkFiles(root, path.join(root, PROJECT_RELATIVE, dir), files);
  }
  for (const workflow of WORKFLOWS) {
    const absolute = path.join(root, workflow);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      throw new Error(`RELEASE_WORKFLOW_MISSING:${workflow}`);
    }
    files.push(posix(workflow));
  }
  return Object.freeze([...new Set(files)].sort());
}

export function computeReleaseSourceDigest({ root = process.cwd() } = {}) {
  const files = releaseSourceFiles(root);
  if (!files.length) throw new Error('RELEASE_SOURCE_SET_EMPTY');
  const manifest = [];
  for (const relative of files) {
    const bytes = fs.readFileSync(path.join(root, relative));
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    manifest.push(Object.freeze({ path: relative, sha256, size: bytes.length }));
  }
  const canonical = manifest
    .map(item => `${item.path}\t${item.sha256}\t${item.size}\n`)
    .join('');
  const sha256 = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return Object.freeze({
    schema: 1,
    algorithm: 'sha256',
    sha256,
    fileCount: manifest.length,
    manifest: Object.freeze(manifest),
    exclusions: Object.freeze([
      'PUBLIC_RELEASE_EVIDENCE.json',
      'release/evidence/**',
      'generated launch/status reports',
      'build/.gradle/node_modules outputs',
    ]),
    truth: 'This digest binds executable/release-governance source while excluding the signed evidence bundle itself to avoid self-referential commit hashing.',
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = computeReleaseSourceDigest();
  if (process.argv.includes('--digest-only')) console.log(result.sha256);
  else console.log(JSON.stringify(result, null, 2));
}
