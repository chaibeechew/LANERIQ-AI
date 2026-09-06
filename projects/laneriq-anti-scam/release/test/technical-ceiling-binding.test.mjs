import test from 'node:test';
import assert from 'node:assert/strict';
import { claimedProtectionLevel } from '../../fabric/protection-degradation-lattice.mjs';
import { evaluateConfigDrift } from '../config-drift-gate.mjs';
import { buildReleaseBinding, verifyReleaseBinding } from '../release-policy-binding.mjs';

test('overall protection cannot exceed weakest layer',()=>{
  assert.equal(claimedProtectionLevel({guardian:'VERIFIED',web:'DEGRADED',malware:'VERIFIED',cloud:'VERIFIED'}).overall,'DEGRADED');
  assert.equal(claimedProtectionLevel({guardian:'VERIFIED',web:'VERIFIED',malware:'VERIFIED',cloud:'VERIFIED'}).canClaimFullProtection,true);
});

test('security config drift fails closed without approved rollbackable ticket',()=>{
  const baseline={vpnMode:'manual',regionPolicy:'my',retentionMs:30000};
  assert.equal(evaluateConfigDrift({baseline,current:{...baseline,vpnMode:'always-on'}}).ready,false);
  assert.equal(evaluateConfigDrift({baseline,current:{...baseline,vpnMode:'always-on'},approvedChangeTicket:{approved:true,rollbackPlanVerified:true,auditRecorded:true}}).ready,true);
});

test('release binding detects any source artifact evidence policy config or signing mismatch',()=>{
  const current={sourceSha:'a'.repeat(40),artifactSha256:'b'.repeat(64),evidenceBundleSha256:'c'.repeat(64),policySha256:'d'.repeat(64),configSha256:'e'.repeat(64),signingCertSha256:'f'.repeat(64)};
  const binding=buildReleaseBinding(current); assert.equal(binding.ready,true);
  assert.equal(verifyReleaseBinding(binding,current).ready,true);
  assert.equal(verifyReleaseBinding(binding,{...current,configSha256:'1'.repeat(64)}).ready,false);
});
