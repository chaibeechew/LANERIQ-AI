package ai.laneriq.antiscam;

import android.content.Context;
import android.os.Build;
import android.os.PowerManager;

public final class ResourceGovernor {
    private final PowerManager powerManager;

    public ResourceGovernor(Context context) {
        powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    }

    public Snapshot snapshot() {
        boolean powerSave = powerManager != null && powerManager.isPowerSaveMode();
        int thermalStatus = ResourcePolicy.THERMAL_NONE;
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            thermalStatus = powerManager.getCurrentThermalStatus();
        }
        ResourcePolicy.Mode mode = ResourcePolicy.evaluate(powerSave, thermalStatus);
        return new Snapshot(powerSave, thermalStatus, mode, ResourcePolicy.intervalMs(mode));
    }

    public boolean shouldReduceBackgroundWork() {
        return snapshot().mode != ResourcePolicy.Mode.NORMAL;
    }

    public long nextGuardianIntervalMs() {
        return snapshot().intervalMs;
    }

    public static final class Snapshot {
        public final boolean powerSaveMode;
        public final int thermalStatus;
        public final ResourcePolicy.Mode mode;
        public final long intervalMs;

        Snapshot(boolean powerSaveMode, int thermalStatus, ResourcePolicy.Mode mode, long intervalMs) {
            this.powerSaveMode = powerSaveMode;
            this.thermalStatus = thermalStatus;
            this.mode = mode;
            this.intervalMs = intervalMs;
        }
    }
}
