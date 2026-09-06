package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class ResourcePolicyTest {
    @Test public void normalModeUsesFastCadence() {
        ResourcePolicy.Mode mode = ResourcePolicy.evaluate(false, ResourcePolicy.THERMAL_NONE);
        assertEquals(ResourcePolicy.Mode.NORMAL, mode);
        assertEquals(ResourcePolicy.NORMAL_INTERVAL_MS, ResourcePolicy.intervalMs(mode));
    }

    @Test public void powerSaveUsesConserveCadence() {
        ResourcePolicy.Mode mode = ResourcePolicy.evaluate(true, ResourcePolicy.THERMAL_NONE);
        assertEquals(ResourcePolicy.Mode.CONSERVE, mode);
        assertEquals(ResourcePolicy.CONSERVE_INTERVAL_MS, ResourcePolicy.intervalMs(mode));
    }

    @Test public void severeThermalUsesCriticalCadence() {
        ResourcePolicy.Mode mode = ResourcePolicy.evaluate(false, ResourcePolicy.THERMAL_SEVERE);
        assertEquals(ResourcePolicy.Mode.CRITICAL, mode);
        assertEquals(ResourcePolicy.CRITICAL_INTERVAL_MS, ResourcePolicy.intervalMs(mode));
    }
}
