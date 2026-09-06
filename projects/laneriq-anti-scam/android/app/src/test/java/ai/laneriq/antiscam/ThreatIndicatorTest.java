package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class ThreatIndicatorTest {
    @Test public void domainIndicatorIsDeterministicHashNotRawDomain() {
        String a = ThreatIndicator.domainHash("Example.COM.");
        String b = ThreatIndicator.domainHash("example.com");
        assertEquals(a, b);
        assertEquals(64, a.length());
        assertFalse(a.contains("example"));
    }

    @Test public void rawUrlIsRejectedFromDomainIndicatorPath() {
        try {
            ThreatIndicator.domainHash("https://example.com/private/path");
            fail("raw URL should not be accepted");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("raw URL"));
        }
    }

    @Test public void fileHashMustBeRealSha256Shape() {
        assertTrue(ThreatIndicator.looksLikeSha256("a".repeat(64)));
        assertFalse(ThreatIndicator.looksLikeSha256("not-a-hash"));
    }
}
