package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class SignerContinuityPolicyTest {
    @Test public void firstSeenSignerEstablishesBaselineWithoutClaimingPublisherIdentity() {
        SignerContinuityPolicy.Decision d = SignerContinuityPolicy.evaluate("", "abcd");
        assertEquals(SignerContinuityPolicy.State.BASELINE_REQUIRED, d.state);
        assertTrue(d.continuityAcceptable);
        assertTrue(d.shouldPinBaseline);
        assertFalse(d.unexpectedSignerChange);
    }

    @Test public void sameSignerVerifiesContinuity() {
        SignerContinuityPolicy.Decision d = SignerContinuityPolicy.evaluate("ABCD", "abcd");
        assertEquals(SignerContinuityPolicy.State.CONTINUITY_VERIFIED, d.state);
        assertTrue(d.continuityAcceptable);
    }

    @Test public void changedSignerIsUnexpected() {
        SignerContinuityPolicy.Decision d = SignerContinuityPolicy.evaluate("abcd", "ef01");
        assertEquals(SignerContinuityPolicy.State.MISMATCH, d.state);
        assertFalse(d.continuityAcceptable);
        assertTrue(d.unexpectedSignerChange);
    }

    @Test public void missingRuntimeSignerNeverPassesContinuity() {
        SignerContinuityPolicy.Decision d = SignerContinuityPolicy.evaluate("abcd", "");
        assertEquals(SignerContinuityPolicy.State.UNAVAILABLE, d.state);
        assertFalse(d.continuityAcceptable);
    }
}
