import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGuardianOemMatrix, validateGuardianDeviceRecord } from '../l3-device-evidence.mjs';

function record(manufacturer, model, overrides = {}) {
  return {
    schema: 1,
    product: 'LANERIQ Anti Scam',
    appId: 'ai.laneriq.antiscam.test',
    device: { manufacturer, model, sdk: '36', buildFingerprint: `${manufacturer}/${model}` },
    soakSeconds: 86_400,
    checks: {
      processKillRecovery: true,
      forceStopBoundary: true,
      userReopenRecovery: true,
      notificationTransition: true,
      batterySaverTransition: true,
      rebootRecovery: true,
      soak24h: true,
    },
    ...overrides,
  };
}

test('L3 rejects a short soak even when all booleans are true', () => {
  const result = validateGuardianDeviceRecord(record('google', 'pixel', { soakSeconds: 60 }));
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('soak_duration'));
});

test('L3 rejects Force Stop semantics that were not actually verified', () => {
  const r = record('google', 'pixel');
  r.checks.forceStopBoundary = false;
  assert.equal(validateGuardianDeviceRecord(r).valid, false);
});

test('L3 requires the complete OEM matrix rather than one successful phone', () => {
  const one = evaluateGuardianOemMatrix([record('google', 'pixel-9')]);
  assert.equal(one.ready, false);
  assert.ok(one.missingManufacturers.includes('samsung'));

  const all = evaluateGuardianOemMatrix([
    record('google', 'pixel-9'),
    record('samsung', 's25'),
    record('xiaomi', '15'),
    record('oppo', 'find-x'),
    record('vivo', 'x-series'),
  ]);
  assert.equal(all.ready, true);
});
