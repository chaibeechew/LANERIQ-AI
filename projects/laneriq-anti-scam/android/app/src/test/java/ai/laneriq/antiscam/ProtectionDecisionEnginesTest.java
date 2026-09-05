package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class ProtectionDecisionEnginesTest {
    @Test public void knownMaliciousWebReputationBlocks() {
        SafeWebEvaluator.Result local = SafeWebEvaluator.evaluate("https://example.com");
        WebShieldPolicy.Decision decision = WebShieldPolicy.decide(
                local, WebShieldPolicy.Reputation.KNOWN_MALICIOUS);
        assertEquals(WebShieldPolicy.Action.BLOCK, decision.action);
        assertTrue(decision.knownMaliciousEvidence);
        assertFalse(decision.userOverrideAllowed);
    }

    @Test public void heuristicOnlyHighWebRiskStopsAtInterstitialNotKnownMalicious() {
        SafeWebEvaluator.Result local = SafeWebEvaluator.evaluate(
                "http://verify-bank-wallet-support-payment.example.com@127.0.0.1/refund");
        assertEquals(SafeWebEvaluator.Decision.BLOCK, local.decision);
        WebShieldPolicy.Decision decision = WebShieldPolicy.decide(
                local, WebShieldPolicy.Reputation.UNKNOWN);
        assertEquals(WebShieldPolicy.Action.INTERSTITIAL, decision.action);
        assertFalse(decision.knownMaliciousEvidence);
        assertTrue(decision.userOverrideAllowed);
    }

    @Test public void unknownWebDestinationIsNeverCalledSafe() {
        SafeWebEvaluator.Result local = SafeWebEvaluator.evaluate("https://example.com");
        WebShieldPolicy.Decision decision = WebShieldPolicy.decide(
                local, WebShieldPolicy.Reputation.UNKNOWN);
        assertEquals(WebShieldPolicy.Action.ALLOW_WITH_CAUTION, decision.action);
        assertTrue(decision.reason.toLowerCase().contains("unknown"));
    }

    @Test public void riskyPermissionsAloneCannotCreateMalwareVerdict() {
        AppRiskVerdict.Evidence evidence = new AppRiskVerdict.Evidence(
                false, false, false, true, true, 12, true);
        AppRiskVerdict.Result result = AppRiskVerdict.evaluate(evidence);
        assertEquals(AppRiskVerdict.Verdict.HIGH_RISK, result.verdict);
        assertFalse(result.malwareEvidencePresent);
    }

    @SuppressWarnings("deprecation")
    @Test public void legacyScannerBooleanCannotCreateMalwareVerdict() {
        AppRiskVerdict.Evidence evidence = new AppRiskVerdict.Evidence(
                false, true, false, false, false, 0, false);
        AppRiskVerdict.Result result = AppRiskVerdict.evaluate(evidence);
        assertNotEquals(AppRiskVerdict.Verdict.MALICIOUS, result.verdict);
        assertFalse(result.malwareEvidencePresent);
    }

    @Test public void paymentFreezesOnWebPlusRemoteControlRisk() {
        SensitiveActionGate.Decision decision = SensitiveActionGate.evaluate(
                SensitiveActionGate.Context.PAYMENT,
                new SensitiveActionGate.Signals(true, false, 1, false, true));
        assertEquals(SensitiveActionGate.Action.FREEZE, decision.action);
    }

    @Test public void generalContextWarnsInsteadOfOverblockingWeakSignal() {
        SensitiveActionGate.Decision decision = SensitiveActionGate.evaluate(
                SensitiveActionGate.Context.GENERAL,
                new SensitiveActionGate.Signals(false, false, 1, false, true));
        assertEquals(SensitiveActionGate.Action.WARN, decision.action);
    }

    @Test public void emergencyPlanAvoidsPaymentAfterFreeze() {
        SensitiveActionGate.Decision gate = SensitiveActionGate.evaluate(
                SensitiveActionGate.Context.BANKING,
                new SensitiveActionGate.Signals(false, false, 2, false, true));
        EmergencyProtection.Plan plan = EmergencyProtection.from(gate, 2);
        assertEquals(EmergencyProtection.Level.URGENT, plan.level);
        assertTrue(plan.freezeLaneriqSensitiveFlows);
        assertTrue(plan.adviseAvoidPayments);
        assertTrue(plan.adviseReviewAccessibility);
    }

    @Test public void privacyDefaultAllowsOnlyMinimizedThreatFields() {
        assertTrue(PrivacyEnforcement.mayUploadByDefault("file_hash"));
        assertTrue(PrivacyEnforcement.mayUploadByDefault("domain_hash"));
        assertFalse(PrivacyEnforcement.mayUploadByDefault("raw_message"));
        assertFalse(PrivacyEnforcement.mayUploadByDefault("screen_content"));
        assertFalse(PrivacyEnforcement.mayUploadByDefault("auth_token"));
    }

    @Test public void sensitivePrivateFieldsRequireSeparateConsentAndRemainForbiddenForOrdinaryTelemetry() {
        assertTrue(PrivacyEnforcement.requiresSeparateExplicitConsent("photo"));
        assertTrue(PrivacyEnforcement.isAlwaysForbiddenForThreatTelemetry("password"));
        assertTrue(PrivacyEnforcement.isAlwaysForbiddenForThreatTelemetry("private_key"));
    }
}
