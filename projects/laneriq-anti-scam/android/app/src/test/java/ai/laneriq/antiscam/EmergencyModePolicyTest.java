package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class EmergencyModePolicyTest {
    @Test public void twoSignalsEscalateImmediatelyToUrgent() {
        EmergencyModePolicy.Decision d = EmergencyModePolicy.evaluate(
                2, EmergencyModeStore.Level.NONE, 0);
        assertEquals(EmergencyModeStore.Level.URGENT, d.level);
        assertEquals(0, d.nextLowRiskTicks);
        assertFalse(d.shouldClearStoredState);
    }

    @Test public void oneSignalUsesReviewNotUrgent() {
        EmergencyModePolicy.Decision d = EmergencyModePolicy.evaluate(
                1, EmergencyModeStore.Level.NONE, 0);
        assertEquals(EmergencyModeStore.Level.REVIEW, d.level);
    }

    @Test public void oneCleanTickDoesNotInstantlyClearUrgentState() {
        EmergencyModePolicy.Decision d = EmergencyModePolicy.evaluate(
                0, EmergencyModeStore.Level.URGENT, 0);
        assertEquals(EmergencyModeStore.Level.URGENT, d.level);
        assertFalse(d.shouldClearStoredState);
    }

    @Test public void twoCleanTicksClearPersistedEmergencyState() {
        EmergencyModePolicy.Decision d = EmergencyModePolicy.evaluate(
                0, EmergencyModeStore.Level.URGENT, 1);
        assertEquals(EmergencyModeStore.Level.NONE, d.level);
        assertTrue(d.shouldClearStoredState);
    }
}
