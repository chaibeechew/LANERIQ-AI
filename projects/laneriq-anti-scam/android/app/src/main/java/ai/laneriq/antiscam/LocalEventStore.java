package ai.laneriq.antiscam;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;
import java.util.UUID;

public final class LocalEventStore {
    private static final String PREFS = "laneriq_guardian_events";
    private static final String K_LOG = "bounded_event_log";
    private static final String K_LAST_PREFIX = "last:";
    private static final int MAX_EVENTS = 128;
    private static final int MAX_FIELD_LENGTH = 192;
    private static final int SCHEMA_VERSION = 2;

    private final SharedPreferences prefs;

    public LocalEventStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized String recordOnce(String type, String fingerprint, long dedupeWindowMs) {
        return recordOnce(type, fingerprint, "guardian", "info", dedupeWindowMs);
    }

    public synchronized String recordOnce(
            String type,
            String fingerprint,
            String source,
            String severity,
            long dedupeWindowMs) {
        long now = System.currentTimeMillis();
        String normalizedType = normalize(type, "unknown");
        String normalizedFingerprint = normalize(fingerprint, "unknown");
        String normalizedSource = normalize(source, "guardian");
        String normalizedSeverity = normalize(severity, "info");
        long safeWindow = Math.max(0L, dedupeWindowMs);

        String dedupeKey = K_LAST_PREFIX + normalizedType + ":" + normalizedFingerprint;
        long last = prefs.getLong(dedupeKey, 0L);
        if (last > 0L && Math.max(0L, now - last) < safeWindow) return null;

        String eventId = UUID.randomUUID().toString();
        JSONArray oldLog = parseLog();
        JSONArray next = new JSONArray();
        int start = Math.max(0, oldLog.length() - (MAX_EVENTS - 1));
        for (int i = start; i < oldLog.length(); i++) {
            next.put(oldLog.opt(i));
        }

        JSONObject event = new JSONObject();
        try {
            event.put("schema_version", SCHEMA_VERSION);
            event.put("event_id", eventId);
            event.put("type", normalizedType);
            event.put("fingerprint", normalizedFingerprint);
            event.put("source", normalizedSource);
            event.put("severity", normalizedSeverity);
            event.put("at_ms", now);
            next.put(event);
        } catch (Exception ignored) {
            return null;
        }

        prefs.edit()
                .putLong(dedupeKey, now)
                .putString(K_LOG, next.toString())
                .apply();
        return eventId;
    }

    public synchronized int count() {
        return parseLog().length();
    }

    public synchronized String readLog() {
        return prefs.getString(K_LOG, "[]");
    }

    private JSONArray parseLog() {
        try {
            return new JSONArray(prefs.getString(K_LOG, "[]"));
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static String normalize(String value, String fallback) {
        String normalized = value == null ? fallback : value.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) normalized = fallback;
        if (normalized.length() > MAX_FIELD_LENGTH) {
            normalized = normalized.substring(0, MAX_FIELD_LENGTH);
        }
        return normalized;
    }
}
