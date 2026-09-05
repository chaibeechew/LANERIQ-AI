import crypto from "node:crypto";
import fs from "node:fs";

const SHA40=/^[0-9a-f]{40}$/;
const sha=String(process.env.LANERIQ_CANDIDATE_SHA||process.env.GITHUB_SHA||"").trim().toLowerCase();
if(!SHA40.test(sha)) throw new Error("CORE_RELEASE_GATE_SHA_INVALID");

const manifest={
  manifestVersion:1,
  product:"LANERIQ AI",
  gate:"CORE_RELEASE_GATE_V1",
  verdict:"PASS",
  evidenceLevel:"CODE_CI_BUILD",
  candidateSha:sha,
  checks:[
    "cloud-contract",
    "generation-contract",
    "zero-cost-provider-safety",
    "production-evidence-attestation-contract",
    "production-evidence-ledger-replay-contract",
    "release-integrity-chain-contract",
    "nextjs-production-build"
  ],
  truthBoundary:{
    exactCandidateShaVerified:true,
    codeContractsVerified:true,
    integratedBuildVerified:true,
    productionRuntimeVerified:false,
    providerLiveOutputVerified:false,
    physicalDeviceVerified:false,
    independentThirdPartyAuditVerified:false,
    officialStoreSubmissionVerified:false,
    productionMutationPerformed:false,
    supabaseMutationPerformed:false,
    emailDeliveryAdvanced:false,
    whatsappDeliveryAdvanced:false,
    smsDeliveryAdvanced:false
  },
  createdAt:new Date().toISOString()
};
const output="core-release-gate-manifest.json";
const bytes=`${JSON.stringify(manifest,null,2)}\n`;
const digest=crypto.createHash("sha256").update(bytes).digest("hex");
fs.writeFileSync(output,bytes,"utf8");
fs.writeFileSync(`${output}.sha256`,`${digest}  ${output}\n`,"utf8");
console.log(bytes);
console.log(`CORE_RELEASE_GATE_MANIFEST_SHA256=${digest}`);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`# LANERIQ Core Release Gate — PASS\n\n- Candidate SHA: \`${sha}\`\n- Evidence level: **CODE + CI + build**\n- Exact-file manifest SHA-256: \`${digest}\`\n- Production/runtime/external evidence: **not claimed by this gate**\n`,"utf8");
