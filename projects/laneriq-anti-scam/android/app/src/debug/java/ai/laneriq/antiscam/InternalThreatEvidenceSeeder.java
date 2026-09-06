package ai.laneriq.antiscam;

import android.content.Context;
import android.content.SharedPreferences;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.UUID;

/** Debug-only signer for deterministic real-device L1 blocking tests. */
final class InternalThreatEvidenceSeeder {
    private static final String TEST_PRIVATE_KEY_PKCS8_B64 =
            "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDvZKO53bJIDC5mpA8Q1YabxfHo6zgpk1AVozZFhyPUGhRANCAATWkhiybbjrKJZG9LRwo5jJk0JnjjeroDjADYcvjELG3BV3obV+Jg4czdA9hNqSJorDggHhkbnitv0SxabqSnju";
    private static final long TEST_TTL_MS = 2L * 60L * 1000L;
    private static final String PREFS = "laneriq_local_threat_reputation";

    private InternalThreatEvidenceSeeder() {}

    static String seedKnownMaliciousDomain(Context context, String domain) throws Exception {
        if (!BuildConfig.DEBUG) throw new SecurityException("debug-only threat evidence seeder");
        String indicatorHash = ThreatIndicator.domainHash(domain);
        long now = System.currentTimeMillis();
        SignedThreatReputationEvidence.Payload payload = new SignedThreatReputationEvidence.Payload(
                1,
                "internal-dns-block-" + UUID.randomUUID(),
                TrustedThreatFeedKeys.INTERNAL_TEST_SOURCE_ID,
                "debug-p256-v1",
                SignedThreatReputationEvidence.IndicatorType.DOMAIN_SHA256,
                indicatorHash,
                LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS,
                now,
                now + TEST_TTL_MS);

        PrivateKey privateKey = KeyFactory.getInstance("EC").generatePrivate(
                new PKCS8EncodedKeySpec(Base64.getDecoder().decode(TEST_PRIVATE_KEY_PKCS8_B64)));
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(privateKey);
        signer.update(SignedThreatReputationEvidence.canonicalPayload(payload).getBytes(StandardCharsets.UTF_8));
        String signatureBase64 = Base64.getEncoder().encodeToString(signer.sign());

        SignedThreatReputationEvidence.VerifiedEvidence verified =
                new LocalThreatReputationStore(context).ingestSignedEvidence(payload, signatureBase64);
        if (verified == null) throw new SecurityException("debug signed threat evidence verification failed");
        return verified.evidenceId;
    }

    static void clearDomain(Context context, String domain) {
        String key = "domain:" + ThreatIndicator.domainHash(domain);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
                .remove(key + ":verdict")
                .remove(key + ":source")
                .remove(key + ":evidence_id")
                .remove(key + ":verified_strong")
                .remove(key + ":expires")
                .remove(key + ":signed_schema")
                .remove(key + ":signed_source_id")
                .remove(key + ":signed_source_version")
                .remove(key + ":signed_indicator_type")
                .remove(key + ":signed_indicator_hash")
                .remove(key + ":signed_issued_at")
                .remove(key + ":signed_signature")
                .apply();
    }
}
