package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class WitnessProofPayloadTest {
    @Test public void canonicalPayloadIsDeterministicAndMinimal() {
        WitnessProofPayload p = new WitnessProofPayload(
                "ai.laneriq.antiscam.test",
                7,
                44,
                123456,
                "ACTIVE",
                "NONE",
                "AVAILABLE",
                "p0.5-survival-1",
                120000);
        String a = p.canonical();
        String b = p.canonical();
        assertEquals(a, b);
        assertTrue(a.contains("epoch=7"));
        assertTrue(a.contains("sequence=44"));
        assertTrue(a.contains("integrity=ACTIVE"));
        assertFalse(a.contains("rawUrl"));
        assertFalse(a.contains("message"));
        assertFalse(a.contains("fileName"));
        assertFalse(a.contains("installationId"));
        assertFalse(a.contains("password"));
    }

    @Test public void tokenFieldsCannotInjectExtraCanonicalLines() {
        WitnessProofPayload p = new WitnessProofPayload(
                "pkg\nsequence=999",
                1,
                2,
                3,
                "ACTIVE\nfoo=bar",
                "NONE",
                "AVAILABLE",
                "policy\r\nattack=yes",
                4);
        String canonical = p.canonical();
        assertFalse(canonical.contains("\nsequence=999\n"));
        assertFalse(canonical.contains("\nfoo=bar\n"));
        assertFalse(canonical.contains("\nattack=yes\n"));
    }

    @Test public void negativeNumericInputsAreClampedToZero() {
        WitnessProofPayload p = new WitnessProofPayload(
                "pkg", -1, -2, -3, "ACTIVE", "NONE", "AVAILABLE", "p", -4);
        assertEquals(0, p.leaseEpoch);
        assertEquals(0, p.heartbeatSequence);
        assertEquals(0, p.leaseExpiresAtMs);
        assertEquals(0, p.observedAtMs);
    }
}
