package ai.laneriq.antiscam;

public final class ResourcePolicy {
    public enum Mode {
        NORMAL,
        CONSERVE,
        CRITICAL
    }

    public static final long NORMAL_INTERVAL_MS = 30_000L;
    public static final long CONSERVE_INTERVAL_MS = 120_000L;
    public static final long CRITICAL_INTERVAL_MS = 300_000L;

    // Mirrors Android PowerManager thermal status ordering without depending on Android in tests.
    public static final int THERMAL_NONE = 0;
    public static final int THERMAL_LIGHT = 1;
    public static final int THERMAL_MODERATE = 2;
    public static final int THERMAL_SEVERE = 3;

    private ResourcePolicy() {}

    public static Mode evaluate(boolean powerSaveMode, int thermalStatus) {
        if (thermalStatus >= THERMAL_SEVERE) return Mode.CRITICAL;
        if (powerSaveMode || thermalStatus >= THERMAL_MODERATE) return Mode.CONSERVE;
        return Mode.NORMAL;
    }

    public static long intervalMs(Mode mode) {
        if (mode == Mode.CRITICAL) return CRITICAL_INTERVAL_MS;
        if (mode == Mode.CONSERVE) return CONSERVE_INTERVAL_MS;
        return NORMAL_INTERVAL_MS;
    }
}
