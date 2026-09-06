import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEADMAN_RETENTION_MS,
  retentionCutoffMs,
} from '../../cloud/lib/supabase-deadman-store.mjs';
import { assertGuardianCloudAdmission } from '../../cloud/lib/guardian-admission-policy.mjs';

const sql = readFileSync(new URL('../../cloud/sql/001_guardian_deadman.sql', import.meta.url), 'utf8');

test('L4 default Dead-Man retention is 30 days and bounded', () => {
  const now = 1_800_000_000_000;
  assert.equal(DEADMAN_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(retentionCutoffMs(now), now - DEADMAN_RETENTION_MS);
  assert.throws(() => retentionCutoffMs(now, 60 * 60 * 1000), /INVALID_DEADMAN_RETENTION/);
  assert.throws(() => retentionCutoffMs(now, 91 * 24 * 60 * 60 * 1000), /INVALID_DEADMAN_RETENTION/);
});

test('L4 SQL enforces replay plus durable per-install heartbeat abuse bound', () => {
  assert.match(sql, /p_lease_epoch < current_row\.lease_epoch/);
  assert.match(sql, /p_heartbeat_sequence <= current_row\.heartbeat_sequence/);
  assert.match(sql, /p_received_at_ms <= current_row\.received_at_ms/);
  assert.match(sql, /p_received_at_ms - current_row\.received_at_ms < 15000/);
});

test('L4 SQL exposes service-role-only exact deletion and retention purge', () => {
  assert.match(sql, /create or replace function public\.delete_anti_scam_guardian_lease/);
  assert.match(sql, /revoke all on function public\.delete_anti_scam_guardian_lease\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.delete_anti_scam_guardian_lease\(text\) to service_role/);
  assert.match(sql, /create or replace function public\.purge_anti_scam_guardian_leases/);
  assert.match(sql, /p_cutoff_received_at_ms > server_now_ms - 86400000/);
  assert.match(sql, /grant execute on function public\.purge_anti_scam_guardian_leases\(bigint\) to service_role/);
  assert.match(sql, /anti_scam_guardian_leases_received_idx/);
});

test('L4 regional admission requires trusted ingress and exact residency match', () => {
  const result = assertGuardianCloudAdmission({
    requestContext: {
      trustedIngress: true,
      requestBytes: 1024,
      requiredResidencyRegion: 'ap-southeast-1',
    },
    deploymentRegion: 'ap-southeast-1',
    allowedRegions: ['ap-southeast-1', 'eu-west-1'],
  });
  assert.equal(result.admitted, true);
  assert.equal(result.privateContentRoutingAllowed, false);

  assert.throws(() => assertGuardianCloudAdmission({
    requestContext: { trustedIngress: false, requestBytes: 100 },
    deploymentRegion: 'ap-southeast-1',
    allowedRegions: ['ap-southeast-1'],
  }), /TRUSTED_INGRESS_REQUIRED/);
});
