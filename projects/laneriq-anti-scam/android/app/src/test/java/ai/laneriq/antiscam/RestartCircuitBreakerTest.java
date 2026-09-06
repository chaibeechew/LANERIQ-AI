package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class RestartCircuitBreakerTest {
    @Test public void startsNewWindow() {
        RestartCircuitBreaker.Decision d = RestartCircuitBreaker.evaluate(0, 0L, 1_000L);
        assertTrue(d.allowRestart);
        assertEquals(1, d.nextAttemptsInWindow);
        assertEquals(1_000L, d.nextWindowStartedAtMs);
    }

    @Test public void opensCircuitAfterThreeAttempts() {
        long now = 100_000L;
        RestartCircuitBreaker.Decision d = RestartCircuitBreaker.evaluate(3, 90_000L, now);
        assertFalse(d.allowRestart);
        assertEquals("circuit-open", d.reason);
    }

    @Test public void expiredWindowResetsCounter() {
        long now = RestartCircuitBreaker.WINDOW_MS + 5_000L;
        RestartCircuitBreaker.Decision d = RestartCircuitBreaker.evaluate(3, 1_000L, now);
        assertTrue(d.allowRestart);
        assertEquals(1, d.nextAttemptsInWindow);
        assertEquals(now, d.nextWindowStartedAtMs);
    }
}
