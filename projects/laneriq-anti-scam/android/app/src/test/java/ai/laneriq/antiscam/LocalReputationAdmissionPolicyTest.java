package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class LocalReputationAdmissionPolicyTest {
    @Test public void unverifiedLocalCacheCannotWriteKnownMalicious() {
        assertFalse(LocalReputationAdmissionPolicy.mayWriteUnverified(
                LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS));
        assertTrue(LocalReputationAdmissionPolicy.mayWriteUnverified(
                LocalThreatReputationStore.Verdict.HIGH_RISK));
    }

    @Test public void legacyUnverifiedKnownMaliciousIsSanitizedToUnknown() {
        assertEquals(
                LocalThreatReputationStore.Verdict.UNKNOWN,
                LocalReputationAdmissionPolicy.sanitizeStoredVerdict(
                        LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS,
                        false));
    }

    @Test public void onlyVerifiedStrongPathMayPreserveKnownMalicious() {
        assertEquals(
                LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS,
                LocalReputationAdmissionPolicy.sanitizeStoredVerdict(
                        LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS,
                        true));
    }
}
