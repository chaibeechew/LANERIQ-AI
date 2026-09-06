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
     * Production signed-evidence ingestion. The strong token is created only after
     * verification against the currently pinned Android threat-feed trust roots.
     */
    public SignedThreatReputationEvidence.VerifiedEvidence ingestSignedEvidence(
            SignedThreatReputationEvidence.Payload payload,
            String signatureBase64) {
        long now = System.currentTimeMillis();
        SignedThreatReputationEvidence.VerifiedEvidence evidence =
                SignedThreatReputationEvidence.productionVerifier().verify(payload, signatureBase64, now);
        if (evidence == null) return null;
        persistVerifiedEvidence(evidence);
        return evidence;
    }

    private void persistVerifiedEvidence(SignedThreatReputationEvidence.VerifiedEvidence evidence) {
        long now = System.currentTimeMillis();
        if (evidence.expiresAtMs <= now || evidence.expiresAtMs - now > MAX_TTL_MS) {
            throw new SecurityException("verified threat evidence expired or exceeds local TTL bound");
        }

        String prefix = prefixFor(evidence.indicatorType);
        String key = prefix + evidence.indicatorHash;
        prefs.edit()
                .putString(key + ":verdict", evidence.verdict.name())
                .putString(key + ":source", evidence.sourceId + ":" + evidence.sourceVersion)
                .putString(key + ":evidence_id", evidence.evidenceId)
                .putBoolean(key + ":verified_strong", true)
                .putLong(key + ":expires", evidence.expiresAtMs)
                .putInt(key + ":signed_schema", evidence.schema)
                .putString(key + ":signed_source_id", evidence.sourceId)
                .putString(key + ":signed_source_version", evidence.sourceVersion)
                .putString(key + ":signed_indicator_type", evidence.indicatorType.name())
                .putString(key + ":signed_indicator_hash", evidence.indicatorHash)
                .putLong(key + ":signed_issued_at", evidence.issuedAtMs)
                .putString(key + ":signed_signature", evidence.signatureBase64)
                .apply();
    }

    private void putUnverified(String key, Verdict verdict, String sourceVersion, long ttlMs) {
        if (verdict == null || verdict == Verdict.UNKNOWN) return;
        if (!LocalReputationAdmissionPolicy.mayWriteUnverified(verdict)) {
            throw new SecurityException("Strong reputation verdict requires verified signed evidence");
        }
        long boundedTtl = Math.min(MAX_TTL_MS, Math.max(60_000L, ttlMs));
        long expires = System.currentTimeMillis() + boundedTtl;
        clearSignedEnvelope(key);
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

        Verdict stored = readVerdict(key);
        boolean markedVerifiedStrong = prefs.getBoolean(key + ":verified_strong", false);

        if (markedVerifiedStrong) {
            SignedThreatReputationEvidence.VerifiedEvidence reverified = reverifySignedEnvelope(key, now);
            if (reverified == null || !key.equals(prefixFor(reverified.indicatorType) + reverified.indicatorHash)) {
                clearKey(key);
                return unknown("signed-cache-reverification-failed");
            }
            return new Entry(
                    reverified.verdict,
                    reverified.sourceId + ":" + reverified.sourceVersion,
                    reverified.expiresAtMs,
                    true,
                    true,
                    reverified.evidenceId);
        }

        Verdict verdict = LocalReputationAdmissionPolicy.sanitizeStoredVerdict(stored, false);
        if (stored == Verdict.KNOWN_MALICIOUS && verdict != stored) {
            clearKey(key);
            return unknown("legacy-unverified-strong-record-removed");
        }

        return new Entry(
                verdict,
                prefs.getString(key + ":source", "unknown"),
                expires,
                verdict != Verdict.UNKNOWN,
                false,
                "");
    }

    private SignedThreatReputationEvidence.VerifiedEvidence reverifySignedEnvelope(String key, long now) {
        try {
            int schema = prefs.getInt(key + ":signed_schema", 0);
            String evidenceId = prefs.getString(key + ":evidence_id", "");
            String sourceId = prefs.getString(key + ":signed_source_id", "");
            String sourceVersion = prefs.getString(key + ":signed_source_version", "");
            SignedThreatReputationEvidence.IndicatorType indicatorType =
                    SignedThreatReputationEvidence.IndicatorType.valueOf(
                            prefs.getString(key + ":signed_indicator_type", ""));
            String indicatorHash = prefs.getString(key + ":signed_indicator_hash", "");
            Verdict verdict = readVerdict(key);
            long issuedAt = prefs.getLong(key + ":signed_issued_at", 0L);
            long expiresAt = prefs.getLong(key + ":expires", 0L);
            String signature = prefs.getString(key + ":signed_signature", "");

            SignedThreatReputationEvidence.Payload payload = new SignedThreatReputationEvidence.Payload(
                    schema,
                    evidenceId,
                    sourceId,
                    sourceVersion,
                    indicatorType,
                    indicatorHash,
                    verdict,
                    issuedAt,
                    expiresAt);
            return SignedThreatReputationEvidence.productionVerifier().verify(payload, signature, now);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Verdict readVerdict(String key) {
        try {
            return Verdict.valueOf(prefs.getString(key + ":verdict", Verdict.UNKNOWN.name()));
        } catch (Exception ignored) {
            return Verdict.UNKNOWN;
        }
    }

    private String prefixFor(SignedThreatReputationEvidence.IndicatorType indicatorType) {
        if (indicatorType == SignedThreatReputationEvidence.IndicatorType.DOMAIN_SHA256) return "domain:";
        if (indicatorType == SignedThreatReputationEvidence.IndicatorType.FILE_SHA256) return "file:";
        throw new SecurityException("unsupported verified indicator type");
    }

    private Entry unknown(String source) {
        return new Entry(Verdict.UNKNOWN, source, 0L, false, false, "");
    }

    private void clearSignedEnvelope(String key) {
        prefs.edit()
                .remove(key + ":signed_schema")
                .remove(key + ":signed_source_id")
                .remove(key + ":signed_source_version")
                .remove(key + ":signed_indicator_type")
                .remove(key + ":signed_indicator_hash")
                .remove(key + ":signed_issued_at")
                .remove(key + ":signed_signature")
                .apply();
    }

    private void clearKey(String key) {
        clearSignedEnvelope(key);
        prefs.edit()
                .remove(key + ":verdict")
                .remove(key + ":source")
                .remove(key + ":evidence_id")
                .remove(key + ":verified_strong")
                .remove(key + ":expires")
                .apply();
    }
}
