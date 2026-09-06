package ai.laneriq.antiscam;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.VpnService;
import android.os.Build;

/**
 * Android Web Shield control-plane.
 *
 * Production continues to fail closed until L1 external evidence allows the
 * shipping data plane. Debug/Internal Test can run the DNS-only data plane so
 * real-device network behavior can be measured without upgrading public claims.
 */
public final class WebShieldVpnService extends VpnService {
    public static final String ACTION_START = "ai.laneriq.antiscam.webshield.START";
    public static final String ACTION_START_INTERNAL_TEST = "ai.laneriq.antiscam.webshield.START_INTERNAL_TEST";
    public static final String ACTION_STOP = "ai.laneriq.antiscam.webshield.STOP";

    private static final String CHANNEL = "laneriq_web_shield";
    private static final int NOTIFICATION_ID = 5301;

    private WebShieldStateStore state;
    private WebShieldDnsDataPlane dnsDataPlane;

    @Override public void onCreate() {
        super.onCreate();
        state = new WebShieldStateStore(this);
        createNotificationChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopDataPlane("user-stop");
            state.setUserOptedIn(false);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        state.setUserOptedIn(true);
        if (VpnService.prepare(this) != null) {
            state.markConsent(false, "vpn-consent-required");
            stopSelf();
            return START_NOT_STICKY;
        }
        state.markConsent(true, "vpn-consent-present");

        if (ACTION_START_INTERNAL_TEST.equals(action)) {
            if (!BuildConfig.DEBUG) {
                state.markTunnel(false, false, false, "internal-dns-shield-not-allowed-in-release-build");
                stopSelf();
                return START_NOT_STICKY;
            }
            startAsForeground("Internal DNS Shield starting • test only");
            if (dnsDataPlane == null) dnsDataPlane = new WebShieldDnsDataPlane(this);
            if (!dnsDataPlane.startInternalTest()) {
                state.markTunnel(false, false, false, "internal-dns-shield-start-failed");
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
                return START_NOT_STICKY;
            }
            updateNotification("Internal DNS Shield active • test only • not Production evidence");
            new LocalEventStore(this).recordOnce("web_shield_internal_dns_active", "debug-only", 60_000L);
            return START_STICKY;
        }

        if (!WebShieldDataPlaneContract.isProductionDataPlaneReady()) {
            state.markTunnel(false, false, false, WebShieldDataPlaneContract.reason());
            new LocalEventStore(this).recordOnce(
                    "web_shield_not_started",
                    "dataplane-not-production-verified",
                    60_000L);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Public/shipping data-plane activation intentionally remains closed.
        // L1 must first provide network-matrix, handoff, conflict, false-positive
        // and Store declaration evidence for the exact signed release artifact.
        state.markTunnel(false, false, false, "production-dataplane-release-gate-not-satisfied");
        stopSelf();
        return START_NOT_STICKY;
    }

    @Override public void onRevoke() {
        stopDataPlane("vpn-revoked-by-platform");
        if (state != null) state.markConsent(false, "vpn-revoked-by-platform");
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
        super.onRevoke();
    }

    @Override public void onDestroy() {
        stopDataPlane("service-destroyed");
        super.onDestroy();
    }

    private void stopDataPlane(String reason) {
        if (dnsDataPlane != null) {
            try { dnsDataPlane.close(); } catch (Exception ignored) {}
            dnsDataPlane = null;
        }
        if (state != null) state.markStopped(reason);
    }

    private void createNotificationChannel() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                "Web Shield Network Protection",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Visible status for the user-enabled LANERIQ Web Shield VPN service");
        nm.createNotificationChannel(channel);
    }

    private Notification notification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(
                this,
                5301,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("LANERIQ Anti Scam • Web Shield")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(openPi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
    }

    private void startAsForeground(String text) {
        Notification notification = notification(text);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification(String text) {
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE))
                .notify(NOTIFICATION_ID, notification(text));
    }
}
