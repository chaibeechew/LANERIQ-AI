export const PartitionMode = Object.freeze({
  NORMAL: 'NORMAL',
  REGION_ISOLATED: 'REGION_ISOLATED',
  GLOBAL_CONTROL_UNAVAILABLE: 'GLOBAL_CONTROL_UNAVAILABLE',
});

export function evaluatePartition({ regionalDataPlaneHealthy = true, globalControlReachable = true, signedSnapshotFresh = true } = {}) {
  if (!regionalDataPlaneHealthy) {
    return {
      mode: PartitionMode.REGION_ISOLATED,
      allowLocalProtection: true,
      allowRegionalReads: false,
      allowRegionalWrites: false,
      allowPolicyPromotion: false,
      reason: 'regional_data_plane_unhealthy',
    };
  }
  if (!globalControlReachable) {
    return {
      mode: PartitionMode.GLOBAL_CONTROL_UNAVAILABLE,
      allowLocalProtection: true,
      allowRegionalReads: true,
      allowRegionalWrites: true,
      allowPolicyPromotion: false,
      useSignedSnapshot: signedSnapshotFresh,
      reason: signedSnapshotFresh ? 'continue_with_fresh_signed_snapshot' : 'control_unreachable_snapshot_stale',
    };
  }
  return {
    mode: PartitionMode.NORMAL,
    allowLocalProtection: true,
    allowRegionalReads: true,
    allowRegionalWrites: true,
    allowPolicyPromotion: true,
    reason: 'all_control_paths_healthy',
  };
}
