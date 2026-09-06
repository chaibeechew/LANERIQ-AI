package ai.laneriq.antiscam;

import org.junit.Test;
import static org.junit.Assert.*;

public class VpnOwnershipIntegrityPolicyTest {
    @Test public void currentBuildCannotClaimSystemWideShield() {
        VpnOwnershipIntegrityPolicy.Decision d = VpnOwnershipIntegrityPolicy.evaluate(
                new VpnOwnershipIntegrityPolicy.Evidence(false, false, false, false, false));
        assertEquals(VpnOwnershipIntegrityPolicy.State.NOT_APPLICABLE, d.state);
        assertFalse(d.mayClaimSystemWideWebShield);
    }

    @Test public void expectedShieldWithoutOwnershipEvidenceFailsClosed() {
        VpnOwnershipIntegrityPolicy.Decision d = VpnOwnershipIntegrityPolicy.evaluate(
                new VpnOwnershipIntegrityPolicy.Evidence(true, true, true, false, false));
        assertEquals(VpnOwnershipIntegrityPolicy.State.UNVERIFIED, d.state);
        assertFalse(d.mayClaimSystemWideWebShield);
        assertTrue(d.freezeSensitiveLaneriqActions);
    }

    @Test public void lostTunnelOwnershipFreezesSensitiveLaneriqActions() {
        VpnOwnershipIntegrityPolicy.Decision d = VpnOwnershipIntegrityPolicy.evaluate(
                new VpnOwnershipIntegrityPolicy.Evidence(true, true, true, true, false));
        assertEquals(VpnOwnershipIntegrityPolicy.State.OWNERSHIP_LOST, d.state);
        assertTrue(d.freezeSensitiveLaneriqActions);
        assertFalse(d.hackerAttributionAllowed);
    }

    @Test public void verifiedHealthyOwnerMayClaimShield() {
        VpnOwnershipIntegrityPolicy.Decision d = VpnOwnershipIntegrityPolicy.evaluate(
                new VpnOwnershipIntegrityPolicy.Evidence(true, true, true, true, true));
        assertEquals(VpnOwnershipIntegrityPolicy.State.VERIFIED, d.state);
        assertTrue(d.mayClaimSystemWideWebShield);
    }
}
