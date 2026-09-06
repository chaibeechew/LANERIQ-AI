import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSupplyChainProvenance } from '../supply-chain-provenance-gate.mjs';
import { evaluateReproducibleBuild } from '../reproducible-build-gate.mjs';
import { evaluateScaleEvidence } from '../slo-capacity-cost-gate.mjs';

test('supply-chain gate requires SBOM provenance zero critical vulns and artifact binding',()=>{
  const good=evaluateSupplyChainProvenance({lockfilePinned:true,sbomGenerated:true,sbomArtifactBound:true,dependencySourcesVerified:true,actionsPinnedOrTrusted:true,secretScanPassed:true,knownCriticalVulnerabilities:0,artifactSha256:'a'.repeat(64)});
  assert.equal(good.ready,true);
  assert.equal(evaluateSupplyChainProvenance({...good,lockfilePinned:false}).ready,false);
});

test('reproducible build requires two clean identical source/toolchain/artifact runs',()=>{
  const r={artifactSha256:'b'.repeat(64),sourceSha:'c'.repeat(40),toolchain:'jdk17-gradle8.11.1-agp8.10.1',cleanBuild:true};
  assert.equal(evaluateReproducibleBuild([r,{...r}]).ready,true);
  assert.equal(evaluateReproducibleBuild([r,{...r,artifactSha256:'d'.repeat(64)}]).ready,false);
});

test('scale gate enforces production multi-region failover SLO headroom and cost',()=>{
  const evidence={regionsVerified:2,failoverPassed:true,p95Ms:120,p95BudgetMs:250,errorRate:.001,errorRateBudget:.005,headroomPercent:40,costPer1k:.2,costBudgetPer1k:.5,syntheticOnly:false};
  assert.equal(evaluateScaleEvidence(evidence).ready,true);
  assert.equal(evaluateScaleEvidence({...evidence,syntheticOnly:true}).ready,false);
});
