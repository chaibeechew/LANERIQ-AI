const SHA256=/^[0-9a-f]{64}$/i;

export function evaluateSupplyChainProvenance(input={}) {
  const blockers=[];
  if(input.lockfilePinned!==true) blockers.push('LOCKFILE_NOT_PINNED');
  if(input.sbomGenerated!==true) blockers.push('SBOM_MISSING');
  if(input.sbomArtifactBound!==true) blockers.push('SBOM_NOT_ARTIFACT_BOUND');
  if(input.dependencySourcesVerified!==true) blockers.push('DEPENDENCY_SOURCE_UNVERIFIED');
  if(input.actionsPinnedOrTrusted!==true) blockers.push('CI_ACTION_TRUST_UNVERIFIED');
  if(input.secretScanPassed!==true) blockers.push('SECRET_SCAN_NOT_PASSED');
  if(input.knownCriticalVulnerabilities!==0) blockers.push('CRITICAL_VULNERABILITY_PRESENT');
  if(!SHA256.test(String(input.artifactSha256||''))) blockers.push('ARTIFACT_SHA_INVALID');
  return {ready:blockers.length===0, blockers};
}
