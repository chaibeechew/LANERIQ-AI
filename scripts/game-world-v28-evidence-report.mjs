import fs from 'node:fs';
import path from 'node:path';
import {buildEvidenceOrchestratorV28,createRemainingEvidencePlanV28} from '../lib/game/game-world-evidence-orchestrator-v28.js';
const input={seed:'v28-ci-report',worldId:'v28-evidence',worldSizeMeters:12000,city:{sizeMeters:840,blockMeters:120,maxBuildings:64}};
const v=buildEvidenceOrchestratorV28(input,{});
const report={generatedAt:new Date().toISOString(),schema:'laneriq-game-world-evidence-v28',evidenceClassNotice:'SIMULATED and STATIC_PREFLIGHT results are not real-device or real-engine evidence.',readiness:v.readiness,scorecard:v.scorecard,simulation:{evidenceClass:v.simulation.evidenceClass,summary:v.simulation.summary,runs:v.simulation.runs},enginePreflight:{evidenceClass:v.preflight.evidenceClass,summary:v.preflight.summary,checks:v.preflight.checks,coordinates:v.preflight.coordinates},remainingEvidence:createRemainingEvidencePlanV28(v),truth:v.truth};
fs.mkdirSync(path.join(process.cwd(),'test-results'),{recursive:true});
fs.writeFileSync(path.join(process.cwd(),'test-results','game-world-v28-evidence.json'),JSON.stringify(report,null,2));
console.log('V28 evidence report written',JSON.stringify({betaReady:v.readiness.marketBetaReady,production:v.readiness.production100,simulatedRuns:v.simulation.summary.runs,remaining:v.unresolved.length}));
