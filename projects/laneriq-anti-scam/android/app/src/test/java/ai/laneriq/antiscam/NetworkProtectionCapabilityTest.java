package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class NetworkProtectionCapabilityTest {
    @Test public void guardianAloneCannotClaimSystemWideWebShield() {
        NetworkProtectionCapability.Evidence evidence = new NetworkProtectionCapability.Evidence(
                false, true, false, false, false, true);
        assertEquals(NetworkProtectionCapability.State.MANUAL_CHECK_ONLY,
                NetworkProtectionCapability.evaluate(evidence));
        assertFalse(NetworkProtectionCapability.mayClaimSystemWideBlocking(evidence));
    }

    @Test public void implementedButNoTunnelCannotClaimSystemWideBlocking() {
        NetworkProtectionCapability.Evidence evidence = new NetworkProtectionCapability.Evidence(
                true, true, true, false, true, true);
        assertEquals(NetworkProtectionCapability.State.WEB_SHIELD_READY_NOT_ACTIVE,
                NetworkProtectionCapability.evaluate(evidence));
        assertFalse(NetworkProtectionCapability.mayClaimSystemWideBlocking(evidence));
    }

    @Test public void staleThreatPolicyDegradesNetworkProtection() {
        NetworkProtectionCapability.Evidence evidence = new NetworkProtectionCapability.Evidence(
                true, true, true, true, false, true);
        assertEquals(NetworkProtectionCapability.State.DEGRADED,
                NetworkProtectionCapability.evaluate(evidence));
    }

    @Test public void onlyFullNetworkEvidenceMayClaimSystemWideBlocking() {
        NetworkProtectionCapability.Evidence evidence = new NetworkProtectionCapability.Evidence(
                true, true, true, true, true, true);
        assertEquals(NetworkProtectionCapability.State.SYSTEM_WIDE_ACTIVE,
                NetworkProtectionCapability.evaluate(evidence));
        assertTrue(NetworkProtectionCapability.mayClaimSystemWideBlocking(evidence));
    }
}
