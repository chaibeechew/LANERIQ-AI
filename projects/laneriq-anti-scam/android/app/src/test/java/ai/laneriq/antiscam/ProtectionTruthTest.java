package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class ProtectionTruthTest {
    private static final long TTL = 90_000L;
    private static final long NOW = 1_000_000L;

    @Test public void activeRequiresFreshHeartbeat() {
        assertEquals(
                ProtectionTruth.State.ACTIVE,
                ProtectionTruth.evaluate(true, true, NOW - 10_000L, NOW, TTL));
    }

    @Test public void staleHeartbeatDowngradesProtection() {
        assertEquals(
                ProtectionTruth.State.DEGRADED_STALE,
                ProtectionTruth.evaluate(true, true, NOW - TTL - 1L, NOW, TTL));
    }

    @Test public void optedInButServiceOfflineIsDegraded() {
        assertEquals(
                ProtectionTruth.State.DEGRADED_OFFLINE,
                ProtectionTruth.evaluate(true, false, NOW - 1_000L, NOW, TTL));
    }

    @Test public void userPauseCannotDisplayActive() {
        assertEquals(
                ProtectionTruth.State.PAUSED,
                ProtectionTruth.evaluate(false, false, 0L, NOW, TTL));
    }

    @Test public void missingHeartbeatCannotDisplayActive() {
        assertEquals(
                ProtectionTruth.State.DEGRADED_STALE,
                ProtectionTruth.evaluate(true, true, 0L, NOW, TTL));
    }

    @Test public void invalidClockEvidenceIsUnknown() {
        assertEquals(
                ProtectionTruth.State.UNKNOWN,
                ProtectionTruth.evaluate(true, true, -1L, NOW, TTL));
    }

    @Test public void futureHeartbeatCannotUpgradeProtection() {
        assertEquals(
                ProtectionTruth.State.DEGRADED_CLOCK,
                ProtectionTruth.evaluate(true, true, NOW + 60_000L, NOW, TTL));
    }

    @Test public void monotonicAgeCanProveActive() {
        assertEquals(
                ProtectionTruth.State.ACTIVE,
                ProtectionTruth.evaluateAge(true, true, true, 5_000L, TTL, true));
    }

    @Test public void bootSessionMismatchBehavesAsMissingHeartbeat() {
        assertEquals(
                ProtectionTruth.State.DEGRADED_STALE,
                ProtectionTruth.evaluateAge(true, true, false, Long.MAX_VALUE, TTL, true));
    }

    @Test public void brokenMonotonicEvidenceIsClockDegraded() {
        assertEquals(
                ProtectionTruth.State.DEGRADED_CLOCK,
                ProtectionTruth.evaluateAge(true, true, true, -1L, TTL, false));
    }
}
