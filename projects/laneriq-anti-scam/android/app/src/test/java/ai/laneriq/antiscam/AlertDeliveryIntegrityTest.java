package ai.laneriq.antiscam;

import org.junit.Test;

import static org.junit.Assert.*;

public class AlertDeliveryIntegrityTest {
    @Test public void enabledNotificationsSupportAlertDeliveryClaim() {
        AlertDeliveryIntegrity.Decision d = AlertDeliveryIntegrity.evaluate(true, true);
        assertEquals(AlertDeliveryIntegrity.State.AVAILABLE, d.state);
        assertTrue(d.mayClaimUserAlertsAvailable);
        assertFalse(d.companionWitnessShouldWarn);
    }

    @Test public void disabledNotificationsDegradeAlertDeliveryWithoutCallingItHacking() {
        AlertDeliveryIntegrity.Decision d = AlertDeliveryIntegrity.evaluate(true, false);
        assertEquals(AlertDeliveryIntegrity.State.DEGRADED, d.state);
        assertFalse(d.mayClaimUserAlertsAvailable);
        assertTrue(d.companionWitnessShouldWarn);
    }

    @Test public void missingNotificationManagerFailsClosed() {
        AlertDeliveryIntegrity.Decision d = AlertDeliveryIntegrity.evaluate(false, false);
        assertEquals(AlertDeliveryIntegrity.State.UNKNOWN, d.state);
        assertFalse(d.mayClaimUserAlertsAvailable);
        assertTrue(d.companionWitnessShouldWarn);
    }
}
