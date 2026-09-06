const FORBIDDEN = new Set(['phone','email','message','contacts','location','imei','imsi','advertisingId','rawUrl','clipboard','keystrokes']);

export function evaluatePrivacyEnvelope(event, { maxFields = 16, maxBytes = 2048 } = {}) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return { ok:false, code:'EVENT_INVALID' };
  const keys = Object.keys(event);
  if (keys.length > maxFields) return { ok:false, code:'FIELD_BUDGET_EXCEEDED' };
  for (const key of keys) if (FORBIDDEN.has(key)) return { ok:false, code:'FORBIDDEN_FIELD', field:key };
  const json = JSON.stringify(event);
  if (Buffer.byteLength(json, 'utf8') > maxBytes) return { ok:false, code:'BYTE_BUDGET_EXCEEDED' };
  return { ok:true, code:'PRIVACY_BUDGET_OK', fieldCount:keys.length, bytes:Buffer.byteLength(json, 'utf8') };
}

export function redactToAllowed(event, allowedFields = []) {
  const allowed = new Set(allowedFields);
  return Object.fromEntries(Object.entries(event || {}).filter(([k]) => allowed.has(k) && !FORBIDDEN.has(k)));
}
