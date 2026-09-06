package ai.laneriq.security;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;

public class GuardianService extends Service {
    public static final String ACTION_START = "ai.laneriq.security.guardian.START";
    public static final String ACTION_STOP = "ai.laneriq.security.guardian.STOP";
    public static final String ACTION_PACKAGE_CHANGED = "ai.laneriq.security.guardian.PACKAGE_CHANGED";
    public static final String EXTRA_PACKAGE = "package";
    public static final String PREFS = "laneriq_guardian";
    public static final String PREF_ENABLED = "enabled";

    private static final String CHANNEL_PROTECTION = "laneriq_guardian_protection";
    private static final String CHANNEL_ALERTS = "laneriq_guardian_alerts";
    private static final int NOTIFICATION_ID = 4201;
    private static final int ALERT_ID = 4202;
    private static final long CHECK_INTERVAL_MS = 30_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String lastRiskSummary = "";

    private final Runnable monitor = new Runnable() {
        @Override public void run() {
            runRiskCheck();
            handler.postDelayed(this, CHECK_INTERVAL_MS);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        createChannels();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_ENABLED, false).apply();
            handler.removeCallbacks(monitor);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_ENABLED, true).apply();
        startForeground(NOTIFICATION_ID, buildProtectionNotification("Guardian active • monitoring device risk signals"));

        handler.removeCallbacks(monitor);
        handler.post(monitor);

        if (ACTION_PACKAGE_CHANGED.equals(action)) {
            String packageName = intent == null ? null : intent.getStringExtra(EXTRA_PACKAGE);
            if (packageName != null && !packageName.trim().isEmpty()) {
                showAlert("New app activity detected", "Installed or updated: " + packageName + ". Review it before sensitive banking or payment activity.");
            }
        }
        return START_STICKY;
    }

    private void runRiskCheck() {
        boolean developer = Settings.Global.getInt(getContentResolver(), Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1;
        boolean adb = Settings.Global.getInt(getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1;
        boolean accessibility = Settings.Secure.getInt(getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED, 0) == 1;

        StringBuilder signals = new StringBuilder();
        int riskCount = 0;
        if (developer) { riskCount++; signals.append("Developer options enabled"); }
        if (adb) { if (signals.length() > 0) signals.append(" • "); riskCount++; signals.append("ADB enabled"); }
        if (accessibility) { if (signals.length() > 0) signals.append(" • "); riskCount++; signals.append("Accessibility enabled — review active services"); }

        String summary = riskCount == 0
                ? "Guardian active • no elevated local signals"
                : "Guardian review needed • " + signals;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildProtectionNotification(summary));

        if (riskCount > 0 && !summary.equals(lastRiskSummary)) {
            showAlert("LANERIQ Guardian review needed", signals.toString() + ". These signals are not proof of malware, but should be reviewed before banking or payments.");
        }
        lastRiskSummary = summary;
    }

    private Notification buildProtectionNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(this, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(this, GuardianService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 2, stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new Notification.Builder(this, CHANNEL_PROTECTION)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("LANERIQ Anti Scam • Always-On Guardian")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(openPi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .addAction(android.R.drawable.ic_menu_view, "Open", openPi)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Guardian", stopPi)
                .build();
    }

    private void showAlert(String title, String message) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(this, 3, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification alert = new Notification.Builder(this, CHANNEL_ALERTS)
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new Notification.BigTextStyle().bigText(message))
                .setContentIntent(openPi)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .build();
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(ALERT_ID, alert);
    }

    private void createChannels() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        NotificationChannel protection = new NotificationChannel(
                CHANNEL_PROTECTION,
                "Always-On Guardian",
                NotificationManager.IMPORTANCE_LOW);
        protection.setDescription("Persistent LANERIQ Anti Scam protection status");
        protection.enableLights(false);
        protection.enableVibration(false);
        nm.createNotificationChannel(protection);

        NotificationChannel alerts = new NotificationChannel(
                CHANNEL_ALERTS,
                "Guardian Risk Alerts",
                NotificationManager.IMPORTANCE_HIGH);
        alerts.setDescription("Important LANERIQ Anti Scam device-risk alerts");
        alerts.enableLights(true);
        alerts.setLightColor(Color.CYAN);
        nm.createNotificationChannel(alerts);
    }

    public static boolean isEnabled(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        return p.getBoolean(PREF_ENABLED, false);
    }

    @Override public void onDestroy() {
        handler.removeCallbacks(monitor);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) {
        return null;
    }
}
