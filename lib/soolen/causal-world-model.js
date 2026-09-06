import crypto from "node:crypto";
import { EVIDENCE_CLASSES } from "./cognitive-os.js";

export const LANERIQ_CAUSAL_WORLD_MODEL_VERSION = "0.1.0";

function text(value,max=1000){return String(value??"").trim().slice(0,max);}
function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function freeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;}

export function createWorldState(input={}){
  const variables=Array.isArray(input.variables)?input.variables.slice(0,100).map((item,index)=>({
    id:text(item?.id||`v${index+1}`,120),
    kind:text(item?.kind||"unknown",80),
    value:item?.value??null,
    unit:text(item?.unit,40),
    confidence:Math.min(1,Math.max(0,number(item?.confidence,.5))),
    sourceDigest:text(item?.sourceDigest,64),
  })):[];
  const state={
    schemaVersion:"1",
    createdAt:new Date().toISOString(),
    scope:text(input.scope||"general",120),
    variables,
    assumptions:(Array.isArray(input.assumptions)?input.assumptions:[]).slice(0,50).map(v=>text(v,400)),
    evidenceClass:text(input.evidenceClass||EVIDENCE_CLASSES.INTERNAL,40).toUpperCase(),
  };
  return freeze({...state,stateDigest:digest(state),simulationOnly:true});
}

export function createCausalHypothesis(input={}){
  const cause=text(input.cause,160);const effect=text(input.effect,160);
  if(!cause||!effect)throw new Error("LANERIQ_CAUSAL_HYPOTHESIS_ENDPOINTS_REQUIRED");
  const hypothesis={
    id:text(input.id||`${cause}->${effect}`,240),
    cause,effect,
    direction:["increase","decrease","mixed","unknown"].includes(input.direction)?input.direction:"unknown",
    strength:Math.min(1,Math.max(0,number(input.strength,.5))),
    confidence:Math.min(1,Math.max(0,number(input.confidence,.5))),
    mechanism:text(input.mechanism,800),
    falsifier:text(input.falsifier,800),
    evidenceClass:text(input.evidenceClass||EVIDENCE_CLASSES.INTERNAL,40).toUpperCase(),
  };
  return freeze({...hypothesis,hypothesisDigest:digest(hypothesis),provenCausality:false});
}

export function planWorldModelExperiment(input={}){
  const goal=text(input.goal,1000);if(!goal)throw new Error("LANERIQ_WORLD_MODEL_GOAL_REQUIRED");
  const actions=(Array.isArray(input.actions)?input.actions:[]).slice(0,20).map((action,index)=>({
    id:text(action?.id||`action-${index+1}`,100),
    description:text(action?.description||action,500),
    reversible:action?.reversible!==false,
    externalSideEffects:action?.externalSideEffects===true,
  }));
  return freeze({
    version:LANERIQ_CAUSAL_WORLD_MODEL_VERSION,
    goal,
    currentState:createWorldState(input.currentState||{}),
    hypotheses:(Array.isArray(input.hypotheses)?input.hypotheses:[]).slice(0,50).map(createCausalHypothesis),
    actions,
    scenarios:Object.freeze([
      {id:"baseline",description:"No material intervention; estimate natural trajectory."},
      {id:"intended",description:"Apply intended action under stated assumptions."},
      {id:"adversarial",description:"Stress assumptions, dependencies and correlated failures."},
      {id:"counterfactual",description:"Change one major assumption and recompute expected consequences."},
      {id:"unknown-unknown",description:"Reserve uncertainty budget for unmodeled variables and regime shifts."},
    ]),
    evidenceClass:EVIDENCE_CLASSES.SIMULATED,
    mayClaimRealWorldPredictionAccuracy:false,
    requiredPromotionEvidence:Object.freeze(["measured outcomes","out-of-sample validation","calibration report","independent verification for critical claims"]),
  });
}

export function evaluateWorldModelCalibration(input={}){
  const predictions=Array.isArray(input.predictions)?input.predictions:[];
  const measured=predictions.filter(x=>x?.measured===true&&Number.isFinite(Number(x?.predicted))&&Number.isFinite(Number(x?.actual)));
  if(!measured.length)return freeze({measuredCount:0,calibrated:false,mae:null,evidenceClass:EVIDENCE_CLASSES.INTERNAL,mayPromote:false});
  const mae=measured.reduce((sum,item)=>sum+Math.abs(Number(item.predicted)-Number(item.actual)),0)/measured.length;
  const tolerance=Math.max(0,number(input.tolerance,.1));
  return freeze({measuredCount:measured.length,mae,calibrated:mae<=tolerance,evidenceClass:EVIDENCE_CLASSES.MEASURED_OR_ATTESTED,mayPromote:mae<=tolerance&&measured.length>=Math.max(3,number(input.minimumMeasured,10)),productionVerified:false});
}
