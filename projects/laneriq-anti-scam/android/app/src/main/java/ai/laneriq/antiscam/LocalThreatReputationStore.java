package ai.laneriq.antiscam;

import android.content.Context;
import android.content.SharedPreferences;

public final class LocalThreatReputationStore {
    public enum Verdict { KNOWN_MALICIOUS, HIGH_RISK, KNOWN_BENIGN, UNKNOWN }

    public static final class Entry {
        public final Verdict verdict;
        public final String sourceVersion;
        public final long expiresAtMs;
        public final boolean fresh;

        Entry(Verdict verdict, String sourceVersion, long expiresAtMs, boolean fresh) {
            this.verdict = verdict;
            this.sourceVersion = sourceVersion;
            this.expiresAtMs = expiresAtMs;
            this.fresh = fresh;
        }
    }

    private static final String PREFS = "laneriq_local_threat_reputation";
    private static final long MAX_TTL_MS = 7L * 24L * 60L * 60L * 1000L;
    private final SharedPreferences prefs;

    public LocalThreatReputationStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /**
     * Unverified/local cache admission. KNOWN_MALICIOUS is deliberately rejected
     * until Android has a real signed reputation-evidence ingestion adapter.
     */
    public void putDomain(String domain, Verdict verdict, String sourceVersion, long ttlMs) {
        putUnverified("domain:" + ThreatIndicator.domainHash(domain), verdict, sourceVersion, ttlMs);
    }

    public Entry lookupDomain(String domain) {
        return lookup("domain:" + ThreatIndicator.domainHash(domain));
    }

    public void putFileHash(String sha256, Verdict verdict, String sourceVersion, long ttlMs) {
        putUnverified("file:" + ThreatIndicator.canonicalFileHash(sha256), verdict, sourceVersion, ttlMs);
    }

    public Entry lookupFileHash(String sha256) {
        return lookup("file:" + ThreatIndicator.canonicalFileHash(sha256));
    }

    private void putUnverified(String key, Verdict verdict, String sourceVersion, long ttlMs) {
        if (verdict == null || verdict == Verdict.UNKNOWN) return;
        if (!LocalReputationAdmissionPolicy.mayWriteUnverified(verdict)) {
            throw new SecurityException("Strong reputation verdict requires verified signed evidence");
        }
        long boundedTtl = Math.min(MAX_TTL_MS, Math.max(60_000L, ttlMs));
        long expires = System.currentTimeMillis() + boundedTtl;
        prefs.edit()
                .putString(key + ":verdict", verdict.name())
                .putString(key + ":source", sourceVersion == null ? "unverified-local" : sourceVersion)
                .putBoolean(key + ":verified_strong", false)
                .putLong(key + ":expires", expires)
                .apply();
    }

    private Entry lookup(String key) {
        long now = System.currentTimeMillis();
        long expires = prefs.getLong(key + ":expires", 0L);
        if (expires <= now) {
            clearKey(key);
            return new Entry(Verdict.UNKNOWN, "none", 0L, false);
        }

        Verdict stored;
        try {
            stored = Verdict.valueOf(prefs.getString(key + ":verdict", Verdict.UNKNOWN.name()));
        } catch (Exception ignored) {
            stored = Verdict.UNKNOWN;
        }
        boolean verifiedStrong = prefs.getBoolean(key + ":verified_strong", false);
        Verdict verdict = LocalReputationAdmissionPolicy.sanitizeStoredVerdict(stored, verifiedStrong);
        if (stored == Verdict.KNOWN_MALICIOUS && verdict != stored) {
            // Remove any legacy/unproven strong record rather than silently trusting it.
            clearKey(key);
            return new Entry(Verdict.UNKNOWN, "legacy-unverified-strong-record-removed", 0L, false);
        }

        return new Entry(verdict,
                prefs.getString(key + ":source", "unknown"),
                expires,
                verdict != Verdict.UNKNOWN);
    }

    private void clearKey(String key) {
        prefs.edit()
                .remove(key + ":verdict")
                .remove(key + ":source")
                .remove(key + ":verified_strong")
                .remove(key + ":expires")
                .apply();
    }
}
