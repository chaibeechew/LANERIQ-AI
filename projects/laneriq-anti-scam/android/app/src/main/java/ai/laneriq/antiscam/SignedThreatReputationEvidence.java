package ai.laneriq.antiscam;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Verifies time-bounded ES256/P-256 threat-reputation evidence before a strong
 * verdict can enter the Android local cache. No boolean flag can create a
 * VerifiedEvidence token.
 */
public final class SignedThreatReputationEvidence {
    public enum IndicatorType { DOMAIN_SHA256, FILE_SHA256 }

    private static final long MAX_FUTURE_SKEW_MS = 5L * 60L * 1000L;
    private static final long MAX_TTL_MS = 7L * 24L * 60L * 60L * 1000L;

    public static final class Payload {
        public final int schema;
        public final String evidenceId;
        public final String sourceId;
        public final String sourceVersion;
        public final IndicatorType indicatorType;
        public final String indicatorHash;
        public final LocalThreatReputationStore.Verdict verdict;
        public final long issuedAtMs;
        public final long expiresAtMs;

        public Payload(int schema,
                       String evidenceId,
                       String sourceId,
                       String sourceVersion,
                       IndicatorType indicatorType,
                       String indicatorHash,
                       LocalThreatReputationStore.Verdict verdict,
                       long issuedAtMs,
                       long expiresAtMs) {
            this.schema = schema;
            this.evidenceId = safeToken(evidenceId);
            this.sourceId = safeToken(sourceId);
            this.sourceVersion = safeToken(sourceVersion);
            this.indicatorType = indicatorType;
            this.indicatorHash = normalizeHash(indicatorHash);
            this.verdict = verdict;
            this.issuedAtMs = issuedAtMs;
            this.expiresAtMs = expiresAtMs;
        }
    }

    /** Opaque proof token. Constructor is private so ordinary callers cannot forge it. */
    public static final class VerifiedEvidence {
        public final String evidenceId;
        public final String sourceId;
        public final String sourceVersion;
        public final IndicatorType indicatorType;
        public final String indicatorHash;
        public final LocalThreatReputationStore.Verdict verdict;
        public final long expiresAtMs;

        private VerifiedEvidence(Payload payload) {
            evidenceId = payload.evidenceId;
            sourceId = payload.sourceId;
            sourceVersion = payload.sourceVersion;
            indicatorType = payload.indicatorType;
            indicatorHash = payload.indicatorHash;
            verdict = payload.verdict;
            expiresAtMs = payload.expiresAtMs;
        }
    }

    public static final class Verifier {
        private final Map<String, String> pinnedKeys;

        private Verifier(Map<String, String> pinnedKeys) {
            this.pinnedKeys = Collections.unmodifiableMap(new HashMap<>(pinnedKeys));
        }

        public VerifiedEvidence verify(Payload payload, String signatureBase64, long nowMs) {
            if (!validPayload(payload, nowMs)) return null;
            if (signatureBase64 == null || signatureBase64.trim().isEmpty()) return null;
            String publicKeyBase64 = pinnedKeys.get(payload.sourceId);
            if (publicKeyBase64 == null || publicKeyBase64.trim().isEmpty()) return null;

            try {
                byte[] encodedKey = Base64.getDecoder().decode(publicKeyBase64.trim());
                PublicKey key = KeyFactory.getInstance("EC")
                        .generatePublic(new X509EncodedKeySpec(encodedKey));
                Signature signature = Signature.getInstance("SHA256withECDSA");
                signature.initVerify(key);
                signature.update(canonicalPayload(payload).getBytes(StandardCharsets.UTF_8));
                byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64.trim());
                if (signatureBytes.length == 0 || !signature.verify(signatureBytes)) return null;
                return new VerifiedEvidence(payload);
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private SignedThreatReputationEvidence() {}

    public static Verifier productionVerifier() {
        return new Verifier(TrustedThreatFeedKeys.pinnedX509Base64BySource());
    }

    /** Test-only factory; production code must use productionVerifier(). */
    static Verifier verifierForTests(Map<String, String> pinnedKeys) {
        return new Verifier(pinnedKeys == null ? Collections.emptyMap() : pinnedKeys);
    }

    public static String canonicalPayload(Payload payload) {
        if (payload == null) throw new IllegalArgumentException("payload required");
        return "schema=" + payload.schema + "\n"
                + "evidence_id=" + payload.evidenceId + "\n"
                + "source_id=" + payload.sourceId + "\n"
                + "source_version=" + payload.sourceVersion + "\n"
                + "indicator_type=" + (payload.indicatorType == null ? "unknown" : payload.indicatorType.name()) + "\n"
                + "indicator_hash=" + payload.indicatorHash + "\n"
                + "verdict=" + (payload.verdict == null ? "UNKNOWN" : payload.verdict.name()) + "\n"
                + "issued_at_ms=" + payload.issuedAtMs + "\n"
                + "expires_at_ms=" + payload.expiresAtMs + "\n";
    }

    private static boolean validPayload(Payload payload, long nowMs) {
        if (payload == null || payload.schema != 1) return false;
        if (payload.evidenceId.isEmpty() || payload.sourceId.isEmpty()) return false;
        if (payload.indicatorType == null || !ThreatIndicator.looksLikeSha256(payload.indicatorHash)) return false;
        if (payload.verdict == null || payload.verdict == LocalThreatReputationStore.Verdict.UNKNOWN) return false;
        if (payload.issuedAtMs <= 0L || payload.expiresAtMs <= payload.issuedAtMs) return false;
        if (payload.issuedAtMs > nowMs + MAX_FUTURE_SKEW_MS) return false;
        if (payload.expiresAtMs <= nowMs) return false;
        return payload.expiresAtMs - payload.issuedAtMs <= MAX_TTL_MS;
    }

    private static String normalizeHash(String value) {
        if (value == null) return "";
        String normalized = value.trim().toLowerCase(Locale.US);
        return ThreatIndicator.looksLikeSha256(normalized) ? normalized : "";
    }

    private static String safeToken(String value) {
        if (value == null) return "";
        return value.trim().replace('\n', '_').replace('\r', '_').replace('=', '_');
    }
}
