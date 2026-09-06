package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class SafeWebEvaluatorTest {
    @Test public void malformedOrUnsupportedUrlBlocks() {
        assertEquals(
                SafeWebEvaluator.Decision.BLOCK,
                SafeWebEvaluator.evaluate("file:///etc/passwd").decision);
    }

    @Test public void suspiciousRawIpAndHttpWarnOrBlock() {
        SafeWebEvaluator.Result result = SafeWebEvaluator.evaluate("http://192.168.1.10/verify-account");
        assertTrue(result.score >= 30);
        assertTrue(result.decision == SafeWebEvaluator.Decision.WARN || result.decision == SafeWebEvaluator.Decision.BLOCK);
    }

    @Test public void highRiskCredentialStyleUrlBlocks() {
        SafeWebEvaluator.Result result = SafeWebEvaluator.evaluate(
                "http://secure-login-account-update-example-example-example.com/@verify?redirect=http://evil.example");
        assertEquals(SafeWebEvaluator.Decision.BLOCK, result.decision);
    }

    @Test public void ordinaryHttpsUrlDoesNotClaimSafe() {
        SafeWebEvaluator.Result result = SafeWebEvaluator.evaluate("https://example.com/");
        assertEquals(SafeWebEvaluator.Decision.ALLOW_WITH_CAUTION, result.decision);
        assertTrue(result.reason.toLowerCase().contains("not proof"));
    }
}
