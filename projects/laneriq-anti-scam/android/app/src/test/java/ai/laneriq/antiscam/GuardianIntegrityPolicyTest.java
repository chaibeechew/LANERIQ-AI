package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class GuardianIntegrityPolicyTest {
    @Test public void freshLeaseMayClaimProtected() {
        GuardianIntegrityPolicy.Decision d = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, true, true, true, 7L,
                        ProtectionTruth.State.ACTIVE, "", 0));
        assertEquals(GuardianIntegrityPolicy.State.ACTIVE, d.state);
        assertTrue(d.mayClaimProtected);
        assertFalse(d.unexpectedProtectionLoss);
        assertFalse(d.freezeSensitiveLaneriqActions);
        assertFalse(d.hackerAttributionAllowed);
    }

    @Test public void explicitUserPauseIsNotTamper() {
        GuardianIntegrityPolicy.Decision d = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        false, false, false, true, 0L,
                        ProtectionTruth.State.PAUSED, "user-stop", 0));
        assertEquals(GuardianIntegrityPolicy.State.USER_PAUSED, d.state);
        assertFalse(d.unexpectedProtectionLoss);
        assertFalse(d.freezeSensitiveLaneriqActions);
    }

    @Test public void staleLeaseWhileOptedInBecomesUnexpectedProtectionLoss() {
        GuardianIntegrityPolicy.Decision d = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, false, true, true, 42L,
                        ProtectionTruth.State.DEGRADED_STALE, "", 0));
        assertEquals(GuardianIntegrityPolicy.State.PROTECTION_LOST_UNEXPECTEDLY, d.state);
        assertTrue(d.unexpectedProtectionLoss);
        assertTrue(d.freezeSensitiveLaneriqActions);
        assertFalse(d.hackerAttributionAllowed);
    }

    @Test public void offlineServiceWhileOptedInBecomesUnexpectedProtectionLoss() {
        GuardianIntegrityPolicy.Decision d = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, false, false, true, 0L,
                        ProtectionTruth.State.DEGRADED_OFFLINE,
                        "unexpected-service-destroy", 1));
        assertEquals(GuardianIntegrityPolicy.State.PROTECTION_LOST_UNEXPECTEDLY, d.state);
        assertTrue(d.freezeSensitiveLaneriqActions);
    }

    @Test public void restartLoopOpensSurvivalCircuitAndFreezesSensitiveFlows() {
        GuardianIntegrityPolicy.Decision d = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, false, false, true, 0L,
                        ProtectionTruth.State.DEGRADED_OFFLINE,
                        "restore-failed",
                        RestartCircuitBreaker.MAX_RESTARTS_IN_WINDOW));
        assertEquals(GuardianIntegrityPolicy.State.RESTORE_THROTTLED, d.state);
        assertTrue(d.unexpectedProtectionLoss);
        assertTrue(d.freezeSensitiveLaneriqActions);
    }

    @Test public void rebootNeedsFreshSessionBeforeProtectedClaim() {
        GuardianIntegrityPolicy.Decision d = GuardianIntegrityPolicy.evaluate(
                new GuardianIntegrityPolicy.Evidence(
                        true, false, true, false, 0L,
                        ProtectionTruth.State.UNKNOWN, "", 0));
        assertEquals(GuardianIntegrityPolicy.State.VERIFYING, d.state);
        assertFalse(d.mayClaimProtected);
        assertTrue(d.freezeSensitiveLaneriqActions);
    }
}
