package ai.laneriq.antiscam;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

/**
 * User-controlled recovery UI for protection delivery failures. It does not
 * silently change sensitive system settings and does not require broad access.
 */
public final class RecoveryCenterDialog {
    private RecoveryCenterDialog() {}

    public static void show(Activity activity) {
        if (activity == null) return;
        ProtectionLeaseStore.Lease lease = new ProtectionLeaseStore(activity).read();
        GuardianIntegrityPolicy.Decision guardian = GuardianIntegrityPolicy.evaluate(lease);
        AppSelfIntegrityStore.Result self = new AppSelfIntegrityStore(activity).probe();
        PlatformProtectionIntegrityProbe.Snapshot platform =
                PlatformProtectionIntegrityProbe.capture(activity);
        NetworkProtectionCapability.State webShield = NetworkProtectionCapability.evaluate(
                new NetworkProtectionCapability.Evidence(
                        false,
                        lease.userOptedIn,
                        false,
                        false,
                        false,
                        true));

        String message =
                "Guardian integrity: " + guardian.state.name() + "\n" +
                "App signing continuity: " + self.state.name() + "\n" +
                "Platform delivery: " + platform.decision.state.name() + "\n" +
                "Alerts available: " + platform.alertsAvailable + "\n" +
                "Background restricted: " + platform.backgroundRestricted + "\n" +
                "Battery optimization exemption: " + platform.batteryOptimizationExemption + "\n" +
                "System-wide Web Shield: " + webShield.name() + "\n\n" +
                "Recovery order:\n" +
                "1. Restore Guardian and verify a fresh heartbeat.\n" +
                "2. Re-enable notifications so urgent warnings can reach you.\n" +
                "3. Review battery/background restrictions.\n" +
                "4. Review Accessibility services and remote-support apps.\n" +
                "5. Review VPN settings when system-wide Web Shield is enabled in a future verified build.\n\n" +
                "If protection stopped unexpectedly, avoid transfers, payments, password recovery and remote-support requests until protection is verified again. " +
                "A missing Guardian does not by itself prove hacker activity.";

        new AlertDialog.Builder(activity)
                .setTitle("Protection Recovery Center")
                .setMessage(message)
                .setNegativeButton("Close", null)
                .setNeutralButton("App settings", (d, w) -> openAppDetails(activity))
                .setPositiveButton("More recovery options", (d, w) -> showOptions(activity))
                .show();
    }

    private static void showOptions(Activity activity) {
        String[] items = new String[] {
                "Notification settings",
                "Battery optimization settings",
                "Accessibility settings",
                "VPN settings",
                "App details"
        };
        new AlertDialog.Builder(activity)
                .setTitle("Recovery options")
                .setItems(items, (dialog, which) -> {
                    switch (which) {
                        case 0:
                            openNotifications(activity);
                            break;
                        case 1:
                            safeStart(activity, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                            break;
                        case 2:
                            safeStart(activity, new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
                            break;
                        case 3:
                            safeStart(activity, new Intent(Settings.ACTION_VPN_SETTINGS));
                            break;
                        default:
                            openAppDetails(activity);
                    }
                })
                .show();
    }

    private static void openNotifications(Activity activity) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
        safeStart(activity, intent);
    }

    private static void openAppDetails(Activity activity) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + activity.getPackageName()));
        safeStart(activity, intent);
    }

    private static void safeStart(Activity activity, Intent intent) {
        try {
            activity.startActivity(intent);
        } catch (Exception ignored) {
            openAppDetails(activity);
        }
    }
}
