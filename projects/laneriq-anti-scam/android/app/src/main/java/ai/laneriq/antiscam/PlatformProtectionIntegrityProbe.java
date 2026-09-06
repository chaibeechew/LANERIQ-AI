package ai.laneriq.antiscam;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import android.os.PowerManager;

/** Captures only coarse technical protection state; never private content. */
public final class PlatformProtectionIntegrityProbe {
    public static final class Snapshot {
        public final PlatformProtectionIntegrityPolicy.Decision decision;
        public final boolean alertsAvailable;
        public final boolean backgroundRestricted;
        public final boolean batteryOptimizationExemption;

        Snapshot(PlatformProtectionIntegrityPolicy.Decision decision,
                 boolean alertsAvailable,
                 boolean backgroundRestricted,
                 boolean batteryOptimizationExemption) {
            this.decision = decision;
            this.alertsAvailable = alertsAvailable;
            this.backgroundRestricted = backgroundRestricted;
            this.batteryOptimizationExemption = batteryOptimizationExemption;
        }
    }

    private PlatformProtectionIntegrityProbe() {}

    public static Snapshot capture(Context context) {
        if (context == null) {
            PlatformProtectionIntegrityPolicy.Decision d =
                    PlatformProtectionIntegrityPolicy.evaluate(null);
            return new Snapshot(d, false, false, false);
        }
        Context app = context.getApplicationContext();
        AlertDeliveryIntegrity.Decision alert = AlertDeliveryIntegrity.capture(app);

        boolean backgroundRestricted = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ActivityManager am = (ActivityManager) app.getSystemService(Context.ACTIVITY_SERVICE);
            backgroundRestricted = am != null && am.isBackgroundRestricted();
        }

        boolean batteryExempt = true;
        PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            batteryExempt = pm.isIgnoringBatteryOptimizations(app.getPackageName());
        }

        PlatformProtectionIntegrityPolicy.Decision decision =
                PlatformProtectionIntegrityPolicy.evaluate(
                        new PlatformProtectionIntegrityPolicy.Evidence(
                                true,
                                alert.mayClaimUserAlertsAvailable,
                                backgroundRestricted,
                                batteryExempt));
        return new Snapshot(decision,
                alert.mayClaimUserAlertsAvailable,
                backgroundRestricted,
                batteryExempt);
    }
}
