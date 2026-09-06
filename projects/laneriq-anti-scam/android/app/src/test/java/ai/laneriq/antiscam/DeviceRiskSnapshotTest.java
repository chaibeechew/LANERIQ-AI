package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class DeviceRiskSnapshotTest {
    @Test public void noSignalsRemainLowLocalSignal() {
        DeviceRiskSnapshot snapshot = DeviceRiskSnapshot.fromSignals(false, false, false);
        assertEquals(0, snapshot.signalCount);
        assertEquals("low-local-signal", snapshot.riskLevel);
        assertEquals("false:false:false", snapshot.fingerprint);
    }

    @Test public void oneSignalRequiresReview() {
        DeviceRiskSnapshot snapshot = DeviceRiskSnapshot.fromSignals(true, false, false);
        assertEquals(1, snapshot.signalCount);
        assertEquals("review", snapshot.riskLevel);
        assertTrue(snapshot.summary.contains("Developer options"));
    }

    @Test public void multipleSignalsAreElevatedButNotMalwareVerdict() {
        DeviceRiskSnapshot snapshot = DeviceRiskSnapshot.fromSignals(true, true, true);
        assertEquals(3, snapshot.signalCount);
        assertEquals("elevated", snapshot.riskLevel);
    }
}
