package ai.laneriq.antiscam;

import static org.junit.Assert.*;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.Collections;

public class SignedThreatReputationEvidenceTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final String FILE_HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private KeyPair keyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        return generator.generateKeyPair();
    }

    private String sign(KeyPair pair, SignedThreatReputationEvidence.Payload payload) throws Exception {
        Signature signature = Signature.getInstance("SHA256withECDSA");
        signature.initSign(pair.getPrivate());
        signature.update(SignedThreatReputationEvidence.canonicalPayload(payload).getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(signature.sign());
    }

    private SignedThreatReputationEvidence.Payload payload(String source, long issued, long expires) {
        return new SignedThreatReputationEvidence.Payload(
                1,
                "evidence-1",
                source,
                "feed-v1",
                SignedThreatReputationEvidence.IndicatorType.FILE_SHA256,
                FILE_HASH,
                LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS,
                issued,
                expires);
    }

    @Test public void validPinnedSignatureCreatesOpaqueVerifiedEvidence() throws Exception {
        KeyPair pair = keyPair();
        String publicKey = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());
        SignedThreatReputationEvidence.Verifier verifier = SignedThreatReputationEvidence.verifierForTests(
                Collections.singletonMap("feed-a", publicKey));
        SignedThreatReputationEvidence.Payload payload = payload("feed-a", NOW - 1_000L, NOW + 60_000L);

        SignedThreatReputationEvidence.VerifiedEvidence verified = verifier.verify(payload, sign(pair, payload), NOW);
        assertNotNull(verified);
        assertEquals(FILE_HASH, verified.indicatorHash);
        assertEquals(LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS, verified.verdict);
    }

    @Test public void unknownSourceCannotVerifyEvenWithCryptographicallyValidSignature() throws Exception {
        KeyPair pair = keyPair();
        SignedThreatReputationEvidence.Verifier verifier = SignedThreatReputationEvidence.verifierForTests(Collections.emptyMap());
        SignedThreatReputationEvidence.Payload payload = payload("feed-a", NOW - 1_000L, NOW + 60_000L);
        assertNull(verifier.verify(payload, sign(pair, payload), NOW));
    }

    @Test public void payloadTamperingInvalidatesSignature() throws Exception {
        KeyPair pair = keyPair();
        String publicKey = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());
        SignedThreatReputationEvidence.Verifier verifier = SignedThreatReputationEvidence.verifierForTests(
                Collections.singletonMap("feed-a", publicKey));
        SignedThreatReputationEvidence.Payload signed = payload("feed-a", NOW - 1_000L, NOW + 60_000L);
        String signature = sign(pair, signed);
        SignedThreatReputationEvidence.Payload tampered = new SignedThreatReputationEvidence.Payload(
                1, "evidence-1", "feed-a", "feed-v2",
                SignedThreatReputationEvidence.IndicatorType.FILE_SHA256,
                FILE_HASH,
                LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS,
                NOW - 1_000L, NOW + 60_000L);
        assertNull(verifier.verify(tampered, signature, NOW));
    }

    @Test public void expiredFutureAndOverlongEvidenceFailClosed() throws Exception {
        KeyPair pair = keyPair();
        String publicKey = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());
        SignedThreatReputationEvidence.Verifier verifier = SignedThreatReputationEvidence.verifierForTests(
                Collections.singletonMap("feed-a", publicKey));

        SignedThreatReputationEvidence.Payload expired = payload("feed-a", NOW - 120_000L, NOW - 1L);
        assertNull(verifier.verify(expired, sign(pair, expired), NOW));

        SignedThreatReputationEvidence.Payload future = payload("feed-a", NOW + 6L * 60L * 1000L, NOW + 7L * 60L * 1000L);
        assertNull(verifier.verify(future, sign(pair, future), NOW));

        SignedThreatReputationEvidence.Payload overlong = payload("feed-a", NOW, NOW + 8L * 24L * 60L * 60L * 1000L);
        assertNull(verifier.verify(overlong, sign(pair, overlong), NOW));
    }

    @Test public void exactFileHashBindingIsRequiredForMaliciousVerdict() throws Exception {
        KeyPair pair = keyPair();
        String publicKey = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());
        SignedThreatReputationEvidence.Verifier verifier = SignedThreatReputationEvidence.verifierForTests(
                Collections.singletonMap("feed-a", publicKey));
        SignedThreatReputationEvidence.Payload payload = payload("feed-a", NOW - 1_000L, NOW + 60_000L);
        SignedThreatReputationEvidence.VerifiedEvidence verified = verifier.verify(payload, sign(pair, payload), NOW);
        assertNotNull(verified);

        AppRiskVerdict.Evidence local = new AppRiskVerdict.Evidence(false, false, 0, false);
        AppRiskVerdict.Result malicious = AppRiskVerdict.evaluateWithVerifiedMalwareEvidence(local, FILE_HASH, verified);
        assertEquals(AppRiskVerdict.Verdict.MALICIOUS, malicious.verdict);
        assertTrue(malicious.malwareEvidencePresent);
        assertEquals("evidence-1", malicious.evidenceId);

        String differentHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        AppRiskVerdict.Result mismatch = AppRiskVerdict.evaluateWithVerifiedMalwareEvidence(local, differentHash, verified);
        assertNotEquals(AppRiskVerdict.Verdict.MALICIOUS, mismatch.verdict);
        assertFalse(mismatch.malwareEvidencePresent);
    }

    @Test public void productionVerifierFailsClosedUntilRealFeedKeyIsPinned() throws Exception {
        KeyPair pair = keyPair();
        SignedThreatReputationEvidence.Payload payload = payload("unconfigured-feed", NOW - 1_000L, NOW + 60_000L);
        assertNull(SignedThreatReputationEvidence.productionVerifier().verify(payload, sign(pair, payload), NOW));
    }
}
