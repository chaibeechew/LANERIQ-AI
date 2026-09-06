package ai.laneriq.antiscam;

public final class ProtectionTruth {
    public enum State {
        ACTIVE,
        DEGRADED_OFFLINE,
        DEGRADED_STALE,
        DEGRADED_CLOCK,
        PAUSED,
        UNKNOWN
    }

    private static final long MAX_FUTURE_SKEW_MS = 5_000L;

    private ProtectionTruth() {}

    public static State evaluate(
            boolean userOptedIn,
            boolean serviceEnabled,
            long heartbeatAtMs,
            long nowMs,
            long ttlMs) {
        if (nowMs <= 0L || heartbeatAtMs < 0L || ttlMs <= 0L) return State.UNKNOWN;
        if (!userOptedIn) return State.PAUSED;
        if (!serviceEnabled) return State.DEGRADED_OFFLINE;
        if (heartbeatAtMs == 0L) return State.DEGRADED_STALE;
        if (heartbeatAtMs > nowMs + MAX_FUTURE_SKEW_MS) return State.DEGRADED_CLOCK;
        long age = Math.max(0L, nowMs - heartbeatAtMs);
        return age <= ttlMs ? State.ACTIVE : State.DEGRADED_STALE;
    }

    public static State evaluateAge(
            boolean userOptedIn,
            boolean serviceEnabled,
            boolean heartbeatPresent,
            long heartbeatAgeMs,
            long ttlMs,
            boolean clockValid) {
        if (ttlMs <= 0L) return State.UNKNOWN;
        if (!userOptedIn) return State.PAUSED;
        if (!serviceEnabled) return State.DEGRADED_OFFLINE;
        if (!heartbeatPresent) return State.DEGRADED_STALE;
        if (!clockValid || heartbeatAgeMs < 0L) return State.DEGRADED_CLOCK;
        return heartbeatAgeMs <= ttlMs ? State.ACTIVE : State.DEGRADED_STALE;
    }
}
