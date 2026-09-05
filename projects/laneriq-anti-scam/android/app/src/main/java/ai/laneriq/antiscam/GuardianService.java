package ai.laneriq.antiscam;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

public class GuardianService extends Service {
    public static final String ACTION_START = "ai.laneriq.antiscam.guardian.START";
    public static final String ACTION_RESTORE = "ai.laneriq.antiscam.guardian.RESTORE";
    public static final String ACTION_STOP = "ai.laneriq.antiscam.guardian.STOP";
    public static final String ACTION_PACKAGE_CHANGED = "ai.laneriq.antiscam.guardian.PACKAGE_CHANGED";
    public static final String EXTRA_PACKAGE = "package";
    public static final String EXTRA_START_REASON = "start_reason";

    private static final String CHANNEL_PROTECTION = "laneriq_guardian_protection";
    private static final String CHANNEL_ALERTS = "laneriq_guardian_alerts";
    private static final int NOTIFICATION_ID = 5201;
    private static final int ALERT_ID = 5202;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private ProtectionLeaseStore leaseStore;
    private LocalEventStore eventStore;
    private ResourceGovernor governor;
    private EmergencyModeStore emergencyStore;
    private String lastAlertFingerprint = "";
    private int consecutiveHealthyTicks = 0;
    private int consecutiveLowRiskTicks = 0;

    private final Runnable monitor = new Runnable() {
        @Override public void run() {
            runRiskCheck();
            handler.postDelayed(this, governor.nextGuardianIntervalMs());
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        leaseStore = new ProtectionLeaseStore(this);
        eventStore = new LocalEventStore(this);
        governor = new ResourceGovernor(this);
        emergencyStore = new EmergencyModeStore(this);
        createChannels();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            leaseStore.setUserOptedIn(false);
            leaseStore.serviceStopped("user-stop");
            emergencyStore.clear();
            eventStore.recordOnce("guardian_stop", "user", 1_000L);
            handler.removeCallbacks(monitor);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID,
                buildProtectionNotification("Guardian starting • verifying local protection state"));

        ProtectionLeaseStore.Lease before = leaseStore.read();
        if (!before.serviceEnabled || !before.mayClaimGuardianActive()) {
            String reason = intent == null ? null : intent.getStringExtra(EXTRA_START_REASON);
            if (reason == null || reason.trim().isEmpty()) {
                reason = ACTION_RESTORE.equals(action) ? "automatic-restore" : "direct-start";
            }
            leaseStore.serviceStarted(reason);
            eventStore.recordOnce("guardian_start", reason, 5_000L);
        }

        handler.removeCallbacks(monitor);
        handler.post(monitor);

        if (ACTION_PACKAGE_CHANGED.equals(action)) {
            String packageName = intent == null ? null : intent.getStringExtra(EXTRA_PACKAGE);
            if (packageName != null && !packageName.trim().isEmpty()) {
                String eventId = eventStore.recordOnce(
                        "package_change", packageName, 30_000L);
                if (eventId != null) {
                    showAlert(
                            "New app activity detected",
                            "Installed or updated: " + packageName +
                                    ". Review it before sensitive banking or payment activity.");
                }
            }
        }
        return START_STICKY;
    }

    private void runRiskCheck() {
        DeviceRiskSnapshot snapshot = DeviceRiskSnapshot.capture(getContentResolver());
        boolean constrained = governor.shouldReduceBackgroundWork();

        if (snapshot.signalCount >= 2) {
            consecutiveLowRiskTicks = 0;
            emergencyStore.refresh(EmergencyModeStore.Level.URGENT, snapshot.fingerprint);
        } else if (snapshot.signalCount == 1) {
            consecutiveLowRiskTicks = 0;
            emergencyStore.refresh(EmergencyModeStore.Level.REVIEW, snapshot.fingerprint);
        } else {
            consecutiveLowRiskTicks++;
            if (consecutiveLowRiskTicks >= 2) emergencyStore.clear();
        }

        leaseStore.heartbeat(
                snapshot.riskLevel,
                "guardian,device-signals,event-dedup,resource-governor,emergency-mode,lease-v2");

        ProtectionLeaseStore.Lease lease = leaseStore.read();
        EmergencyModeStore.State emergency = emergencyStore.read();
        GuardianHealth.State health = GuardianHealth.evaluate(
                lease.state,
                snapshot.riskLevel,
                constrained,
                lease.recentRestartAttempts);

        if (lease.mayClaimGuardianActive()) {
            consecutiveHealthyTicks++;
            if (consecutiveHealthyTicks >= 3) {
                leaseStore.resetAutomaticRestartCircuit();
            }
        } else {
            consecutiveHealthyTicks = 0;
        }

        String summary;
        if (emergency.level == EmergencyModeStore.Level.URGENT) {
            summary = "URGENT • remote-control risk signals • avoid banking/payments until reviewed";
        } else {
            switch (health) {
                case HEALTHY:
                    summary = "Guardian active • no elevated local signals";
                    break;
                case REVIEW_REQUIRED:
                    summary = "Guardian active • review needed • " + snapshot.summary;
                    break;
                case DEGRADED:
                    summary = "Guardian degraded • protection state needs attention";
                    break;
                case PAUSED:
                    summary = "Guardian paused";
                    break;
                default:
                    summary = "Guardian status unknown • verification required";
                    break;
            }
        }
        if (constrained) summary += " • reduced background cadence";

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildProtectionNotification(summary));

        if (snapshot.signalCount > 0 && !snapshot.fingerprint.equals(lastAlertFingerprint)) {
            String eventId = eventStore.recordOnce(
                    "risk_signal_set", snapshot.fingerprint, 120_000L);
            if (eventId != null) {
                if (snapshot.signalCount >= 2) {
                    eventStore.recordOnce("emergency_mode", "urgent:" + snapshot.fingerprint, 120_000L);
                    showAlert(
                            "LANERIQ URGENT • pause payments",
                            snapshot.summary +
                                    ". Multiple technical remote-control risk signals are present. " +
                                    "Do not approve transfers, payments, password recovery or remote-support requests until you review these settings. " +
                                    "These signals are not proof of malware.");
                } else {
                    showAlert(
                            "LANERIQ Guardian review needed",
                            snapshot.summary +
                                    ". This signal is not proof of malware. Review it before banking or payments.");
                }
            }
            lastAlertFingerprint = snapshot.fingerprint;
        } else if (snapshot.signalCount == 0) {
            lastAlertFingerprint = "";
        }

        if (lease.state != ProtectionTruth.State.ACTIVE) {
            eventStore.recordOnce("lease_not_active", lease.state.name(), 60_000L);
        }
        if (!GuardianHealth.mayClaimGuardianActive(health)) {
            eventStore.recordOnce("guardian_health_not_active", health.name(), 60_000L);
        }
    }

    private Notification buildProtectionNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(
                this, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(this, GuardianService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(
                this, 2, stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new Notification.Builder(this, CHANNEL_PROTECTION)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("LANERIQ Anti Scam • Guardian")
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
        PendingIntent openPi = PendingIntent.getActivity(
                this, 3, open,
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
                "Guardian Protection Status",
                NotificationManager.IMPORTANCE_LOW);
        protection.setDescription("Persistent LANERIQ Anti Scam Guardian status");
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

    @Override public void onTaskRemoved(Intent rootIntent) {
        if (eventStore != null) {
            eventStore.recordOnce("ui_task_removed", "guardian-remains-running", 30_000L);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override public void onDestroy() {
        handler.removeCallbacks(monitor);
        if (eventStore != null) {
            eventStore.recordOnce("guardian_destroyed", "service-lifecycle", 10_000L);
        }
        if (leaseStore != null) leaseStore.serviceStopped("service-destroyed");
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) {
        return null;
    }
}
