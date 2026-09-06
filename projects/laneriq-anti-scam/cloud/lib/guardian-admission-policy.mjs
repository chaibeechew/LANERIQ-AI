const REGION = /^[a-z]{2}(?:-[a-z0-9]+)+-[0-9]+$/;

function normalizedRegions(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  return [...new Set(values.map(item => String(item).trim().toLowerCase()).filter(Boolean))];
}

export function assertGuardianCloudAdmission({
  requestContext = {},
  deploymentRegion = process.env.LANERIQ_ANTI_SCAM_DEPLOYMENT_REGION,
  allowedRegions = process.env.LANERIQ_ANTI_SCAM_ALLOWED_REGIONS,
  maxRequestBytes = 32 * 1024,
} = {}) {
  if (requestContext?.trustedIngress !== true) throw new Error('TRUSTED_INGRESS_REQUIRED');
  const requestBytes = Number(requestContext?.requestBytes);
  if (!Number.isFinite(requestBytes) || requestBytes <= 0 || requestBytes > maxRequestBytes) {
    throw new Error('GUARDIAN_REQUEST_SIZE_REJECTED');
  }

  const region = String(deploymentRegion || '').trim().toLowerCase();
  if (!REGION.test(region)) throw new Error('DEPLOYMENT_REGION_NOT_CONFIGURED');
  const allowed = normalizedRegions(allowedRegions);
  if (!allowed.length || !allowed.every(item => REGION.test(item))) throw new Error('ALLOWED_REGIONS_NOT_CONFIGURED');
  if (!allowed.includes(region)) throw new Error('DEPLOYMENT_REGION_NOT_ALLOWED');

  const residency = String(requestContext?.requiredResidencyRegion || '').trim().toLowerCase();
  if (residency) {
    if (!REGION.test(residency)) throw new Error('INVALID_REQUIRED_RESIDENCY_REGION');
    if (residency !== region) throw new Error('RESIDENCY_REGION_MISMATCH');
  }

  return Object.freeze({
    admitted: true,
    deploymentRegion: region,
    requiredResidencyRegion: residency || null,
    requestBytes,
    privateContentRoutingAllowed: false,
  });
}
