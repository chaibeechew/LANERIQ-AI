package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class PlatformProtectionIntegrityPolicyTest {
    @Test public void healthyRequiresAlertsBackgroundAndPowerEvidence() {
        PlatformProtectionIntegrityPolicy.Decision d = PlatformProtectionIntegrityPolicy.evaluate(
                new PlatformProtectionIntegrityPolicy.Evidence(true, true, false, true));
        assertEquals(PlatformProtectionIntegrityPolicy.State.HEALTHY, d.state);
        assertTrue(d.mayClaimFullGuardianDelivery);
        assertFalse(d.hackerAttributionAllowed);
    }

    @Test public void disabledAlertsDegradeDeliveryWithoutHackerClaim() {
        PlatformProtectionIntegrityPolicy.Decision d = PlatformProtectionIntegrityPolicy.evaluate(
                new PlatformProtectionIntegrityPolicy.Evidence(true, false, false, true));
        assertEquals(PlatformProtectionIntegrityPolicy.State.ALERTS_DEGRADED, d.state);
        assertFalse(d.mayClaimFullGuardianDelivery);
        assertFalse(d.hackerAttributionAllowed);
    }

    @Test public void multipleRestrictionsCannotRemainHealthy() {
        PlatformProtectionIntegrityPolicy.Decision d = PlatformProtectionIntegrityPolicy.evaluate(
                new PlatformProtectionIntegrityPolicy.Evidence(true, false, true, false));
        assertEquals(PlatformProtectionIntegrityPolicy.State.MULTIPLE_RESTRICTIONS, d.state);
        assertFalse(d.mayClaimFullGuardianDelivery);
    }

    @Test public void unavailableEvidenceFailsClosed() {
        PlatformProtectionIntegrityPolicy.Decision d = PlatformProtectionIntegrityPolicy.evaluate(null);
        assertEquals(PlatformProtectionIntegrityPolicy.State.UNKNOWN, d.state);
        assertFalse(d.mayClaimFullGuardianDelivery);
    }
}
