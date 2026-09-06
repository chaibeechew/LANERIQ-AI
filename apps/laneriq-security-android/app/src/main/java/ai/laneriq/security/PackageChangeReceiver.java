package ai.laneriq.security;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

public class PackageChangeReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!GuardianService.isEnabled(context)) return;
        Uri data = intent == null ? null : intent.getData();
        String packageName = data == null ? "unknown package" : data.getSchemeSpecificPart();
        Intent service = new Intent(context, GuardianService.class)
                .setAction(GuardianService.ACTION_PACKAGE_CHANGED)
                .putExtra(GuardianService.EXTRA_PACKAGE, packageName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(service);
        } else {
            context.startService(service);
        }
    }
}
