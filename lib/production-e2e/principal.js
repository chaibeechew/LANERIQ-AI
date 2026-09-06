import { resolveEvidencePrincipal } from "../cloud-adapters/production-e2e-evidence-data.js";

export async function getProductionEvidencePrincipal(){
  return await resolveEvidencePrincipal();
}
