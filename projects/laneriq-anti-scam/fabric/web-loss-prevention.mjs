import { clamp01 } from './contracts.mjs';

export const WebDecision = Object.freeze({
  ALLOW: 'ALLOW',
  WARN: 'WARN',
  BLOCK: 'BLOCK',
});

/**
 * Decision core for in-app browser / DNS / VPN / URL reputation adapters.
 * It never treats lack of evidence as proof that a site is safe.
 */
export function evaluateWebRisk({
  knownMalicious = false,
  phishingReputation = 0,
  localHeuristicRisk = 0,
  newlyRegisteredDomain = false,
  credentialHarvestPattern = false,
  paymentContext = false,
  bankingContext = false,
  remoteControlRisk = false,
} = {}) {
  const reputation = clamp01(phishingReputation);
  const heuristic = clamp01(localHeuristicRisk);

  if (knownMalicious) {
    return {
      decision: WebDecision.BLOCK,
      riskScore: 1,
      reason: 'known_malicious_destination',
      claim: 'Known malicious destination blocked before navigation.',
    };
  }

  let score = Math.max(reputation, heuristic);
  if (newlyRegisteredDomain) score += 0.12;
  if (credentialHarvestPattern) score += 0.30;
  if (paymentContext || bankingContext) score += 0.10;
  if (remoteControlRisk && (paymentContext || bankingContext)) score += 0.35;
  score = clamp01(score);

  if (score >= 0.75) {
    return {
      decision: WebDecision.BLOCK,
      riskScore: score,
      reason: remoteControlRisk && (paymentContext || bankingContext)
        ? 'high_risk_destination_during_sensitive_remote_control_context'
        : 'high_web_risk',
      claim: 'High-risk navigation blocked based on available security evidence.',
    };
  }

  if (score >= 0.35) {
    return {
      decision: WebDecision.WARN,
      riskScore: score,
      reason: 'web_risk_requires_review',
      claim: 'Risk signals found. User review is required before continuing.',
    };
  }

  return {
    decision: WebDecision.ALLOW,
    riskScore: score,
    reason: 'no_high_risk_signal_found_in_this_check',
    claim: 'No high-risk signal found in this check; this is not a guarantee that the site is safe.',
  };
}

export function shouldFailClosedForSensitiveAction(webDecision, { bankingContext = false, paymentContext = false } = {}) {
  const sensitive = bankingContext || paymentContext;
  if (!sensitive) return false;
  return webDecision?.decision === WebDecision.BLOCK;
}
