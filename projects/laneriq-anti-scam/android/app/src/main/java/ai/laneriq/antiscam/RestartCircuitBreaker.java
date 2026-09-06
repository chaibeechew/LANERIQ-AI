package ai.laneriq.antiscam;

public final class RestartCircuitBreaker {
    public static final int MAX_RESTARTS_IN_WINDOW = 3;
    public static final long WINDOW_MS = 10 * 60_000L;

    private RestartCircuitBreaker() {}

    public static Decision evaluate(
            int attemptsInWindow,
            long windowStartedAtMs,
            long nowMs) {
        if (nowMs <= 0L || windowStartedAtMs < 0L || attemptsInWindow < 0) {
            return new Decision(false, 0, nowMs, "invalid-input");
        }

        boolean expired = windowStartedAtMs == 0L || nowMs - windowStartedAtMs >= WINDOW_MS;
        if (expired) {
            return new Decision(true, 1, nowMs, "new-window");
        }

        if (attemptsInWindow >= MAX_RESTARTS_IN_WINDOW) {
            return new Decision(false, attemptsInWindow, windowStartedAtMs, "circuit-open");
        }

        return new Decision(true, attemptsInWindow + 1, windowStartedAtMs, "allowed");
    }

    public static final class Decision {
        public final boolean allowRestart;
        public final int nextAttemptsInWindow;
        public final long nextWindowStartedAtMs;
        public final String reason;

        Decision(boolean allowRestart, int nextAttemptsInWindow, long nextWindowStartedAtMs, String reason) {
            this.allowRestart = allowRestart;
            this.nextAttemptsInWindow = nextAttemptsInWindow;
            this.nextWindowStartedAtMs = nextWindowStartedAtMs;
            this.reason = reason;
        }
    }
}
