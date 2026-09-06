package ai.laneriq.antiscam;

import org.junit.Test;
import static org.junit.Assert.*;

public class InstallSourceContinuityPolicyTest {
    @Test public void firstSourcePinsBaselineWithoutCallingItAttack() {
        InstallSourceContinuityPolicy.Decision d = InstallSourceContinuityPolicy.evaluate("", "com.android.vending");
        assertEquals(InstallSourceContinuityPolicy.State.BASELINE_REQUIRED, d.state);
        assertTrue(d.continuityAcceptable);
        assertTrue(d.shouldPinBaseline);
        assertFalse(d.hackerAttributionAllowed);
    }

    @Test public void changedSourceRequiresReview() {
        InstallSourceContinuityPolicy.Decision d = InstallSourceContinuityPolicy.evaluate(
                "com.android.vending", "com.android.packageinstaller");
        assertEquals(InstallSourceContinuityPolicy.State.CHANGED, d.state);
        assertFalse(d.continuityAcceptable);
        assertTrue(d.unexpectedChange);
        assertFalse(d.hackerAttributionAllowed);
    }
}
