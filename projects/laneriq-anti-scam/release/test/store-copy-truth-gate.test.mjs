import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateStoreCopyTruth } from '../store-copy-truth-gate.mjs';

test('current store listing draft contains no unsupported positive absolute claim', () => {
  const copy = fs.readFileSync(path.join(process.cwd(), 'projects/laneriq-anti-scam/release/STORE_LISTING_COPY_DRAFT.md'), 'utf8');
  const result = evaluateStoreCopyTruth(copy);
  assert.equal(result.passed, true, JSON.stringify(result.violations));
});

test('absolute marketing claims fail the gate', () => {
  const result = evaluateStoreCopyTruth('LANERIQ gives 100% protected security and is hacker-proof.');
  assert.equal(result.passed, false);
  assert.ok(result.violations.length >= 1);
});

test('explicit truth boundaries are allowed', () => {
  const result = evaluateStoreCopyTruth('LANERIQ cannot guarantee 100% protected security and does not claim virus-free results.');
  assert.equal(result.passed, true);
});
