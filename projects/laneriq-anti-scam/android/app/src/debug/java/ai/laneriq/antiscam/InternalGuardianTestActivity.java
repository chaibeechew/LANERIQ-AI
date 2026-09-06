package ai.laneriq.antiscam;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

/**
 * Debug-only, shell-permission-protected lifecycle controller used by the L3
 * real-device harness. Release builds do not contain this Activity.
 */
public final class InternalGuardianTestActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        String mode = getIntent() == null ? "" : getIntent().getStringExtra("mode");
        if ("start".equals(mode)) startGuardianForTest();
        else if ("pause".equals(mode)) pauseGuardianForTest();
        finish();
    }

    private void startGuardianForTest() {
        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        store.resetAutomaticRestartCircuit();
        store.setUserOptedIn(true);
        Intent service = new Intent(this, GuardianService.class)
                .setAction(GuardianService.ACTION_START)
                .putExtra(GuardianService.EXTRA_START_REASON, "l3-adb-internal-test");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
        else startService(service);
        new LocalEventStore(this).recordOnce(
                "guardian_l3_internal_test_start",
                "shell-authorized-debug-controller",
                5_000L);
    }

    private void pauseGuardianForTest() {
        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        store.setUserOptedIn(false);
        Intent service = new Intent(this, GuardianService.class).setAction(GuardianService.ACTION_STOP);
        try { startService(service); }
        catch (Exception ignored) { store.serviceStopped("l3-debug-pause-fallback"); }
        new LocalEventStore(this).recordOnce(
                "guardian_l3_internal_test_pause",
                "shell-authorized-debug-controller",
                5_000L);
    }
}
