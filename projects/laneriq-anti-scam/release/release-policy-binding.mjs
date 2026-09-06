import crypto from 'node:crypto';
const SHA40=/^[0-9a-f]{40}$/i; const SHA256=/^[0-9a-f]{64}$/i;
export function buildReleaseBinding(input={}){
  const fields={sourceSha:String(input.sourceSha||''),artifactSha256:String(input.artifactSha256||''),evidenceBundleSha256:String(input.evidenceBundleSha256||''),policySha256:String(input.policySha256||''),configSha256:String(input.configSha256||''),signingCertSha256:String(input.signingCertSha256||'')};
  const valid=SHA40.test(fields.sourceSha)&&Object.entries(fields).filter(([k])=>k!=='sourceSha').every(([,v])=>SHA256.test(v));
  if(!valid) return {ready:false,code:'RELEASE_BINDING_INPUT_INVALID'};
  const canonical=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const bindingSha256=crypto.createHash('sha256').update(canonical).digest('hex');
  return {ready:true,code:'RELEASE_BINDING_CREATED',...fields,bindingSha256};
}
export function verifyReleaseBinding(binding,current={}){
  const rebuilt=buildReleaseBinding(current); if(!rebuilt.ready) return rebuilt;
  return rebuilt.bindingSha256===binding?.bindingSha256?{ready:true,code:'RELEASE_BINDING_VERIFIED',bindingSha256:rebuilt.bindingSha256}:{ready:false,code:'RELEASE_BINDING_MISMATCH'};
}
