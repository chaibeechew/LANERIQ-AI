export const INTERNAL_ROLES = Object.freeze([
  "owner",
  "super_admin",
  "admin",
  "support",
  "operations",
]);

const INTERNAL_ROLE_SET = new Set(INTERNAL_ROLES);
const CONTROL_TOWER_ROLE_SET = new Set(["owner", "super_admin", "admin"]);
const CONTROL_TOWER_PRIVILEGED_ROLE_SET = new Set(["owner", "super_admin"]);

export function normalizeInternalRole(role) {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

export function isInternalRole(role) {
  return INTERNAL_ROLE_SET.has(normalizeInternalRole(role));
}

export function canAccessControlTower(role) {
  return CONTROL_TOWER_ROLE_SET.has(normalizeInternalRole(role));
}

export function canManageControlTower(role) {
  return CONTROL_TOWER_ROLE_SET.has(normalizeInternalRole(role));
}

export function canPromoteControlTowerProduction(role) {
  return CONTROL_TOWER_PRIVILEGED_ROLE_SET.has(normalizeInternalRole(role));
}

export function canWaiveControlTowerGate(role) {
  return CONTROL_TOWER_PRIVILEGED_ROLE_SET.has(normalizeInternalRole(role));
}

export function controlTowerCapabilities(role) {
  const normalized = normalizeInternalRole(role);
  const access = CONTROL_TOWER_ROLE_SET.has(normalized);
  const privileged = CONTROL_TOWER_PRIVILEGED_ROLE_SET.has(normalized);
  return Object.freeze({
    access,
    manage: access,
    createRelease: access,
    manageWorkstreams: access,
    manageGovernance: access,
    initializeGates: access,
    registerEvidence: access,
    promoteReleaseCandidate: access,
    promoteProduction: privileged,
    waiveGate: privileged,
    readAudit: access,
  });
}

export function internalRoleLabel(role) {
  switch (normalizeInternalRole(role)) {
    case "owner":
      return "Owner";
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "support":
      return "Support";
    case "operations":
      return "Operations";
    default:
      return "User";
  }
}
