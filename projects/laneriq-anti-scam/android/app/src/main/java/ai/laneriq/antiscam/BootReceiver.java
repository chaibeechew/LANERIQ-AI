package ai.laneriq.antiscam;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        ProtectionLeaseStore leaseStore = new ProtectionLeaseStore(context);
        if (!leaseStore.isUserOptedIn()) return;

        ProtectionLeaseStore.Lease current = leaseStore.read();
        if (current.mayClaimGuardianActive()) return;

        String trigger = intent == null ? "unknown" : String.valueOf(intent.getAction());
        LocalEventStore events = new LocalEventStore(context);

        if (!leaseStore.allowAutomaticRestart(System.currentTimeMillis())) {
            leaseStore.serviceStopped("restart-circuit-open");
            events.recordOnce("guardian_restore_blocked", trigger, "boot-receiver", "warning", 60_000L);
            return;
        }

        events.recordOnce("guardian_restore_request", trigger, "boot-receiver", "info", 10_000L);

        Intent service = new Intent(context, GuardianService.class)
                .setAction(GuardianService.ACTION_RESTORE)
                .putExtra(GuardianService.EXTRA_START_REASON, trigger);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(service);
            } else {
                context.startService(service);
            }
        } catch (RuntimeException e) {
            leaseStore.serviceStopped("automatic-restore-start-failed");
            events.recordOnce(
                    "guardian_restore_failed",
                    e.getClass().getSimpleName(),
                    "boot-receiver",
                    "warning",
                    60_000L);
        }
    }
}
