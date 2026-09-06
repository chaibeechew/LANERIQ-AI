import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const promotion = read("app/api/admin/control-tower/promotion/route.js");
const attestationMigration = read("supabase/migrations/20260906203000_admin_control_tower_release_attestations.sql");
const atomicMigration = read("supabase/migrations/20260906203500_admin_control_tower_atomic_production_promotion.sql");

assert.match(promotion, /computeControlTowerTechnicalCeiling/);
assert.match(promotion, /TECHNICAL_CEILING_NOT_MET/);
assert.match(promotion, /technicalCeiling\.technicalCeilingEligible/);
assert.match(promotion, /promote_control_tower_production_with_attestation/);
assert.match(promotion, /p_expected_updated_at/);
assert.match(promotion, /p_digest/);
assert.match(promotion, /p_manifest/);
assert.match(promotion, /p_technical_ceiling/);
assert.match(promotion, /production-truth\.v2/);
assert.match(promotion, /technical_ceiling_digest/);
assert.doesNotMatch(promotion, /release_promoted_to_production"\s*:/);

assert.match(attestationMigration, /control_tower_release_attestations/);
assert.match(attestationMigration, /unique \(release_id, digest\)/i);
assert.match(attestationMigration, /before update or delete/i);
assert.match(attestationMigration, /release attestations are immutable/i);
assert.match(attestationMigration, /actor_role not in \('owner', 'super_admin'\)/);
assert.match(attestationMigration, /append_control_tower_audit/);
assert.match(attestationMigration, /release_attestation_sealed/);
assert.match(attestationMigration, /digest ~ '\^\[0-9a-f\]\{64\}\$'/);

assert.match(atomicMigration, /promote_control_tower_production_with_attestation/);
assert.match(atomicMigration, /actor_role not in \('owner', 'super_admin'\)/);
assert.match(atomicMigration, /production_verified/);
assert.match(atomicMigration, /exact_sha/);
assert.match(atomicMigration, /Technical Ceiling 100 with zero blockers is required/);
assert.match(atomicMigration, /current_release\.release_status <> 'active'/);
assert.match(atomicMigration, /current_release\.stage <> 'release_candidate'/);
assert.match(atomicMigration, /serialization_failure/);
assert.match(atomicMigration, /append_control_tower_release_attestation/);
assert.match(atomicMigration, /release_promoted_to_production/);
assert.match(atomicMigration, /for update/i);

const attestationPosition = atomicMigration.indexOf("append_control_tower_release_attestation");
const updatePosition = atomicMigration.indexOf("update public.control_tower_releases");
const auditPosition = atomicMigration.indexOf("release_promoted_to_production");
assert.ok(attestationPosition >= 0 && updatePosition > attestationPosition);
assert.ok(auditPosition > updatePosition);

console.log("Control Tower atomic attestation tests passed.");
