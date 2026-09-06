package ai.laneriq.antiscam;

import android.app.NotificationManager;
import android.content.Context;

public final class AlertDeliveryIntegrity {
    public enum State { AVAILABLE, DEGRADED, UNKNOWN }

    public static final class Decision {
        public final State state;
        public final boolean mayClaimUserAlertsAvailable;
        public final boolean companionWitnessShouldWarn;
        public final String reason;

        Decision(State state,
                 boolean mayClaimUserAlertsAvailable,
                 boolean companionWitnessShouldWarn,
                 String reason) {
            this.state = state;
            this.mayClaimUserAlertsAvailable = mayClaimUserAlertsAvailable;
            this.companionWitnessShouldWarn = companionWitnessShouldWarn;
            this.reason = reason;
        }
    }

    private AlertDeliveryIntegrity() {}

    public static Decision evaluate(boolean notificationManagerAvailable, boolean notificationsEnabled) {
        if (!notificationManagerAvailable) {
            return new Decision(State.UNKNOWN, false, true,
                    "notification delivery capability cannot be verified");
        }
        if (!notificationsEnabled) {
            return new Decision(State.DEGRADED, false, true,
                    "Anti Scam notifications are disabled or blocked");
        }
        return new Decision(State.AVAILABLE, true, false,
                "Anti Scam notifications are enabled");
    }

    public static Decision capture(Context context) {
        if (context == null) return evaluate(false, false);
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return evaluate(false, false);
        return evaluate(true, manager.areNotificationsEnabled());
    }
}
