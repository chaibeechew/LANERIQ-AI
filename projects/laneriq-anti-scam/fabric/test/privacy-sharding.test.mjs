import test from 'node:test';
import assert from 'node:assert/strict';

import { RiskLevel } from '../contracts.mjs';
import { minimizeTelemetry, containsDisallowedDefaultField, pseudonymizeInstallationId } from '../p2-privacy-envelope.mjs';
import { selectRendezvousShard, mapKeysToShards } from '../p2-rendezvous-sharding.mjs';

test('P2 privacy envelope pseudonymizes device identity and excludes raw private fields', () => {
  const envelope = minimizeTelemetry({
    eventId: 'e1',
    installationId: 'real-install-id',
    type: 'suspicious_domain',
    occurredAtMs: 1000,
    risk: RiskLevel.REVIEW,
    fingerprint: 'sha256:abc',
    source: 'guardian',
    regionHint: 'sea',
    evidence: ['a'],
    rawUrl: 'https://private.example/path?token=secret',
    rawText: 'private message',
  }, { privacySalt: 'test-salt' });

  assert.notEqual(envelope.devicePseudonym, 'real-install-id');
  assert.equal(Object.hasOwn(envelope, 'installationId'), false);
  assert.equal(Object.hasOwn(envelope, 'rawUrl'), false);
  assert.equal(Object.hasOwn(envelope, 'rawText'), false);
  assert.equal(containsDisallowedDefaultField(envelope), false);
});

test('P2 scoped pseudonym is deterministic for the same salt and changes across salts', () => {
  const a = pseudonymizeInstallationId('device-1', 'region-a-salt');
  const b = pseudonymizeInstallationId('device-1', 'region-a-salt');
  const c = pseudonymizeInstallationId('device-1', 'region-b-salt');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('P2 rendezvous sharding is deterministic and ignores unhealthy nodes', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c', healthy: false }];
  const first = selectRendezvousShard('device-123', nodes);
  const second = selectRendezvousShard('device-123', nodes);
  assert.equal(first, second);
  assert.notEqual(first, 'c');
});

test('P2 removing one shard only remaps keys that selected that shard', () => {
  const keys = Array.from({ length: 100 }, (_, i) => `device-${i}`);
  const before = mapKeysToShards(keys, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const after = mapKeysToShards(keys, [{ id: 'a' }, { id: 'b' }]);
  for (const key of keys) {
    if (before.get(key) !== 'c') assert.equal(before.get(key), after.get(key));
  }
});
