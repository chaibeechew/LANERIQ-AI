const REQUIRED_CHECKS = Object.freeze([
  'processKillRecovery',
  'forceStopBoundary',
  'userReopenRecovery',
  'notificationTransition',
  'batterySaverTransition',
  'rebootRecovery',
  'soak24h',
]);

export function validateGuardianDeviceRecord(record = {}) {
  const reasons = [];
  if (record.schema !== 1) reasons.push('schema');
  if (record.product !== 'LANERIQ Anti Scam') reasons.push('product');
  if (!record.device?.manufacturer || !record.device?.model) reasons.push('device_identity');
  if (!Number.isFinite(Number(record.soakSeconds)) || Number(record.soakSeconds) < 86_400) reasons.push('soak_duration');
  for (const check of REQUIRED_CHECKS) if (record.checks?.[check] !== true) reasons.push(check);
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function evaluateGuardianOemMatrix(records = [], {
  requiredManufacturers = ['google', 'samsung', 'xiaomi', 'oppo', 'vivo'],
} = {}) {
  const accepted = [];
  for (const record of records) {
    const validation = validateGuardianDeviceRecord(record);
    if (validation.valid) accepted.push(record);
  }

  const seen = new Set(accepted.map(record => String(record.device.manufacturer).trim().toLowerCase()));
  const missingManufacturers = requiredManufacturers.filter(name => !seen.has(String(name).toLowerCase()));
  const uniqueModels = new Set(accepted.map(record => `${String(record.device.manufacturer).toLowerCase()}:${String(record.device.model).toLowerCase()}`));

  return Object.freeze({
    ready: missingManufacturers.length === 0 && uniqueModels.size >= requiredManufacturers.length,
    acceptedDeviceCount: accepted.length,
    uniqueModelCount: uniqueModels.size,
    missingManufacturers: Object.freeze(missingManufacturers),
    truth: 'OEM matrix readiness is raw technical evidence only; Public Production still requires a trusted signed release-evidence token referencing immutable test artifacts.',
  });
}
