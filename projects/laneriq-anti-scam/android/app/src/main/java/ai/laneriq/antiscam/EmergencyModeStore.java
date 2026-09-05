package ai.laneriq.antiscam;

import android.content.Context;
import android.content.SharedPreferences;

public final class EmergencyModeStore {
    public enum Level { NONE, REVIEW, URGENT }

    public static final class State {
        public final Level level;
        public final String reasonFingerprint;
        public final long activatedAtMs;
        public final long expiresAtMs;
        public final boolean active;

        State(Level level, String reasonFingerprint, long activatedAtMs, long expiresAtMs, boolean active) {
            this.level = level;
            this.reasonFingerprint = reasonFingerprint;
            this.activatedAtMs = activatedAtMs;
            this.expiresAtMs = expiresAtMs;
            this.active = active;
        }
    }

    private static final String PREFS = "laneriq_emergency_mode";
    private static final String K_LEVEL = "level";
    private static final String K_REASON = "reason_fingerprint";
    private static final String K_ACTIVATED = "activated_at_ms";
    private static final String K_EXPIRES = "expires_at_ms";
    public static final long DEFAULT_TTL_MS = 10L * 60L * 1000L;

    private final SharedPreferences prefs;

    public EmergencyModeStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void refresh(Level level, String reasonFingerprint) {
        if (level == null || level == Level.NONE) {
            clear();
            return;
        }
        long now = System.currentTimeMillis();
        long activated = prefs.getLong(K_ACTIVATED, 0L);
        if (activated <= 0L || read().level != level) activated = now;
        prefs.edit()
                .putString(K_LEVEL, level.name())
                .putString(K_REASON, reasonFingerprint == null ? "unknown" : reasonFingerprint)
                .putLong(K_ACTIVATED, activated)
                .putLong(K_EXPIRES, now + DEFAULT_TTL_MS)
                .apply();
    }

    public void clear() {
        prefs.edit().clear().apply();
    }

    public State read() {
        long now = System.currentTimeMillis();
        long expires = prefs.getLong(K_EXPIRES, 0L);
        Level level;
        try {
            level = Level.valueOf(prefs.getString(K_LEVEL, Level.NONE.name()));
        } catch (Exception ignored) {
            level = Level.NONE;
        }
        boolean active = level != Level.NONE && expires > now;
        if (!active && level != Level.NONE) {
            clear();
            level = Level.NONE;
        }
        return new State(
                level,
                prefs.getString(K_REASON, ""),
                prefs.getLong(K_ACTIVATED, 0L),
                active ? expires : 0L,
                active);
    }
}
