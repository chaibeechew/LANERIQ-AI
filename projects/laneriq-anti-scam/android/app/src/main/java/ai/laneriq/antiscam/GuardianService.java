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
    private AppSelfIntegrityStore selfIntegrityStore;
    private AppSelfIntegrityStore.Result selfIntegrity;
    private String lastAlertFingerprint = "";
    private int consecutiveHealthyTicks = 0;
    private int consecutiveLowRiskTicks = 0;
    private boolean intentionalStopRequested = false;

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
        selfIntegrityStore = new AppSelfIntegrityStore(this);
        createChannels();

        selfIntegrity = selfIntegrityStore.probe();
        eventStore.recordOnce("self_integrity_state", selfIntegrity.state.name(), 60_000L);
        if (selfIntegrity.unexpectedSignerChange) {
            emergencyStore.refresh(EmergencyModeStore.Level.URGENT, "app-signer-mismatch");
            showAlert(
                    "LANERIQ integrity warning",
                    "The Anti Scam app signing identity changed unexpectedly. Protection claims are suspended until the app integrity is reviewed. " +
                            "This signal alone does not prove a hacker changed the app.");
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            intentionalStopRequested = true;
            leaseStore.setUserOptedIn(false);
            leaseStore.serviceStopped("user-stop");
            emergencyStore.clear();
            eventStore.recordOnce("guardian_stop", "user", 1_000L);
            handler.removeCallbacks(monitor);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        intentionalStopRequested = false;
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
        selfIntegrity = selfIntegrityStore.probe();
        AlertDeliveryIntegrity.Decision alertDelivery = AlertDeliveryIntegrity.capture(this);

        EmergencyModeStore.State currentEmergency = emergencyStore.read();
        EmergencyModePolicy.Decision emergencyDecision = EmergencyModePolicy.evaluate(
                snapshot.signalCount,
                currentEmergency.level,
                consecutiveLowRiskTicks);
        consecutiveLowRiskTicks = emergencyDecision.nextLowRiskTicks;
        if (selfIntegrity.unexpectedSignerChange) {
            emergencyStore.refresh(EmergencyModeStore.Level.URGENT, "app-signer-mismatch");
            consecutiveLowRiskTicks = 0;
        } else if (emergencyDecision.shouldClearStoredState) {
            emergencyStore.clear();
        } else if (emergencyDecision.level != EmergencyModeStore.Level.NONE) {
            emergencyStore.refresh(emergencyDecision.level, snapshot.fingerprint);
        }

        leaseStore.heartbeat(
                snapshot.riskLevel,
                "guardian,device-signals,event-dedup,resource-governor,emergency-mode,anti-tamper,self-integrity,alert-integrity,lease-v3");

        ProtectionLeaseStore.Lease lease = leaseStore.read();
        EmergencyModeStore.State emergency = emergencyStore.read();
        GuardianHealth.State health = GuardianHealth.evaluate(
                lease.state,
                snapshot.riskLevel,
                constrained,
                lease.recentRestartAttempts);
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(lease);

        boolean integrityClaimable = integrity.mayClaimProtected && selfIntegrity.continuityAcceptable;
        if (lease.mayClaimGuardianActive() && integrityClaimable) {
            consecutiveHealthyTicks++;
            if (consecutiveHealthyTicks >= 3) {
                leaseStore.resetAutomaticRestartCircuit();
            }
        } else {
            consecutiveHealthyTicks = 0;
        }

        String summary;
        if (selfIntegrity.unexpectedSignerChange) {
            summary = "URGENT • app integrity mismatch • protection claims suspended";
        } else if (emergency.level == EmergencyModeStore.Level.URGENT) {
            summary = "URGENT • remote-control risk signals • avoid banking/payments until reviewed";
        } else if (!integrity.mayClaimProtected) {
            summary = "Guardian integrity • " + integrity.state.name() + " • " + integrity.reason;
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
        if (!alertDelivery.mayClaimUserAlertsAvailable) summary += " • alerts degraded";

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildProtectionNotification(summary));

        if (selfIntegrity.unexpectedSignerChange) {
            eventStore.recordOnce("self_integrity_mismatch", selfIntegrity.state.name(), 120_000L);
        }
        if (!alertDelivery.mayClaimUserAlertsAvailable) {
            eventStore.recordOnce("alert_delivery_degraded", alertDelivery.state.name(), 120_000L);
        }

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
        if (integrity.unexpectedProtectionLoss) {
            eventStore.recordOnce("unexpected_protection_loss", integrity.state.name(), 60_000L);
        }
    }

    private Notification buildProtectionNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(
                this, 1, open,
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
                .addAction(android.R.drawable.ic_menu_view, "Open Anti Scam", openPi)
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
        if (intentionalStopRequested) {
            if (eventStore != null) {
                eventStore.recordOnce("guardian_destroyed", "expected-user-stop", 10_000L);
            }
        } else {
            if (eventStore != null) {
                eventStore.recordOnce("guardian_destroyed", "unexpected-service-end", 10_000L);
            }
            if (leaseStore != null && leaseStore.isUserOptedIn()) {
                leaseStore.serviceStopped("unexpected-service-destroy");
            }
        }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) {
        return null;
    }
}
