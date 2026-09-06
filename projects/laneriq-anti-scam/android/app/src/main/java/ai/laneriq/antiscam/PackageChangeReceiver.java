package ai.laneriq.antiscam;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

public class PackageChangeReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        ProtectionLeaseStore leaseStore = new ProtectionLeaseStore(context);
        if (!leaseStore.isUserOptedIn()) return;

        Uri data = intent == null ? null : intent.getData();
        String packageName = data == null ? null : data.getSchemeSpecificPart();
        if (packageName == null || packageName.trim().isEmpty()) return;
        if (packageName.equals(context.getPackageName())) return;

        LocalEventStore events = new LocalEventStore(context);
        String eventId = events.recordOnce(
                "package_broadcast",
                packageName,
                "package-receiver",
                "info",
                30_000L);
        if (eventId == null) return;

        Intent service = new Intent(context, GuardianService.class)
                .setAction(GuardianService.ACTION_PACKAGE_CHANGED)
                .putExtra(GuardianService.EXTRA_PACKAGE, packageName)
                .putExtra(GuardianService.EXTRA_START_REASON, "package-change");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(service);
            } else {
                context.startService(service);
            }
        } catch (RuntimeException e) {
            // Preserve the package event locally. A background-start restriction is
            // not proof that the already-running Guardian died. Only mark the lease
            // offline if it was already not claimable.
            ProtectionLeaseStore.Lease current = leaseStore.read();
            if (!current.mayClaimGuardianActive()) {
                leaseStore.serviceStopped("package-event-delivery-blocked");
            }
            events.recordOnce(
                    "package_delivery_deferred",
                    e.getClass().getSimpleName(),
                    "package-receiver",
                    "warning",
                    60_000L);
        }
    }
}
