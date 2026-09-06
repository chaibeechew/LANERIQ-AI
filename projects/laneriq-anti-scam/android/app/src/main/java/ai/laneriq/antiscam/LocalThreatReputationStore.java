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
        public final boolean verifiedStrongEvidence;
        public final String evidenceId;

        Entry(Verdict verdict,
              String sourceVersion,
              long expiresAtMs,
              boolean fresh,
              boolean verifiedStrongEvidence,
              String evidenceId) {
            this.verdict = verdict;
            this.sourceVersion = sourceVersion;
            this.expiresAtMs = expiresAtMs;
            this.fresh = fresh;
            this.verifiedStrongEvidence = verifiedStrongEvidence;
            this.evidenceId = evidenceId;
        }
    }

    private static final String PREFS = "laneriq_local_threat_reputation";
    private static final long MAX_TTL_MS = 7L * 24L * 60L * 60L * 1000L;
    private final SharedPreferences prefs;

    public LocalThreatReputationStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Ordinary local writes can never manufacture KNOWN_MALICIOUS. */
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

    /**
     * Strong/verified admission accepts only the opaque token emitted after
     * cryptographic verification by SignedThreatReputationEvidence.Verifier.
     */
    public void putVerifiedEvidence(SignedThreatReputationEvidence.VerifiedEvidence evidence) {
        if (evidence == null) throw new SecurityException("verified threat evidence required");
        if (!ThreatIndicator.looksLikeSha256(evidence.indicatorHash)) {
            throw new SecurityException("verified indicator hash invalid");
        }
        if (evidence.verdict == null || evidence.verdict == Verdict.UNKNOWN) {
            throw new SecurityException("verified threat verdict invalid");
        }

        long now = System.currentTimeMillis();
        if (evidence.expiresAtMs <= now || evidence.expiresAtMs - now > MAX_TTL_MS) {
            throw new SecurityException("verified threat evidence expired or exceeds local TTL bound");
        }

        String prefix;
        switch (evidence.indicatorType) {
            case DOMAIN_SHA256:
                prefix = "domain:";
                break;
            case FILE_SHA256:
                prefix = "file:";
                break;
            default:
                throw new SecurityException("unsupported verified indicator type");
        }

        String key = prefix + evidence.indicatorHash;
        prefs.edit()
                .putString(key + ":verdict", evidence.verdict.name())
                .putString(key + ":source", evidence.sourceId + ":" + evidence.sourceVersion)
                .putString(key + ":evidence_id", evidence.evidenceId)
                .putBoolean(key + ":verified_strong", true)
                .putLong(key + ":expires", evidence.expiresAtMs)
                .apply();
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
                .putString(key + ":evidence_id", "")
                .putBoolean(key + ":verified_strong", false)
                .putLong(key + ":expires", expires)
                .apply();
    }

    private Entry lookup(String key) {
        long now = System.currentTimeMillis();
        long expires = prefs.getLong(key + ":expires", 0L);
        if (expires <= now) {
            clearKey(key);
            return unknown("none");
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
            clearKey(key);
            return unknown("legacy-unverified-strong-record-removed");
        }

        return new Entry(
                verdict,
                prefs.getString(key + ":source", "unknown"),
                expires,
                verdict != Verdict.UNKNOWN,
                verifiedStrong,
                prefs.getString(key + ":evidence_id", ""));
    }

    private Entry unknown(String source) {
        return new Entry(Verdict.UNKNOWN, source, 0L, false, false, "");
    }

    private void clearKey(String key) {
        prefs.edit()
                .remove(key + ":verdict")
                .remove(key + ":source")
                .remove(key + ":evidence_id")
                .remove(key + ":verified_strong")
                .remove(key + ":expires")
                .apply();
    }
}
