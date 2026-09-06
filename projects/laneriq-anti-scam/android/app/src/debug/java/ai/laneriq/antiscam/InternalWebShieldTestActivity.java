package ai.laneriq.antiscam;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Debug-only L1 real-device test entry.
 *
 * This source set is excluded from release/AAB builds. It never bypasses
 * Android's VPN consent UI and never upgrades Production Web Shield claims.
 */
public final class InternalWebShieldTestActivity extends Activity {
    private static final int REQUEST_VPN = 7301;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        new AlertDialog.Builder(this)
                .setTitle("LANERIQ Internal DNS Shield Test")
                .setMessage(
                        "This debug-only test creates an Android VPN interface that intercepts the system DNS path for L1 validation. " +
                        "It does not prove full firewall coverage, DoH/DoT blocking, direct-IP blocking or Production readiness. " +
                        "Android will show its own VPN permission screen before the test can start.")
                .setNegativeButton("Cancel", (dialog, which) -> finish())
                .setNeutralButton("Stop Test", (dialog, which) -> {
                    stopInternalShield();
                    finish();
                })
                .setPositiveButton("Begin Internal Test", (dialog, which) -> requestVpnConsent())
                .setOnCancelListener(dialog -> finish())
                .show();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_VPN) return;
        if (resultCode == RESULT_OK) {
            startInternalShield();
        } else {
            new WebShieldStateStore(this).markConsent(false, "internal-test-vpn-consent-declined");
            Toast.makeText(this, "VPN permission not granted; test remains off", Toast.LENGTH_LONG).show();
        }
        finish();
    }

    private void requestVpnConsent() {
        WebShieldStateStore state = new WebShieldStateStore(this);
        state.setUserOptedIn(true);
        Intent prepare = VpnService.prepare(this);
        if (prepare == null) {
            state.markConsent(true, "internal-test-vpn-consent-already-granted");
            startInternalShield();
            finish();
            return;
        }
        try {
            startActivityForResult(prepare, REQUEST_VPN);
        } catch (Exception e) {
            state.setUserOptedIn(false);
            state.markConsent(false, "internal-test-vpn-consent-launch-failed");
            Toast.makeText(this, "Android VPN permission screen could not open", Toast.LENGTH_LONG).show();
            finish();
        }
    }

    private void startInternalShield() {
        Intent service = new Intent(this, WebShieldVpnService.class)
                .setAction(WebShieldVpnService.ACTION_START_INTERNAL_TEST);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
            else startService(service);
            new LocalEventStore(this).recordOnce(
                    "web_shield_internal_test_requested",
                    "explicit-user-consent",
                    10_000L);
            Toast.makeText(this, "Internal DNS Shield test requested", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            new WebShieldStateStore(this).markStopped("internal-test-service-start-failed");
            new LocalEventStore(this).recordOnce(
                    "web_shield_internal_test_start_failed",
                    e.getClass().getSimpleName(),
                    60_000L);
            Toast.makeText(this, "Internal DNS Shield could not start", Toast.LENGTH_LONG).show();
        }
    }

    private void stopInternalShield() {
        Intent service = new Intent(this, WebShieldVpnService.class)
                .setAction(WebShieldVpnService.ACTION_STOP);
        try { startService(service); }
        catch (Exception ignored) { new WebShieldStateStore(this).markStopped("internal-test-stop-fallback"); }
    }
}
