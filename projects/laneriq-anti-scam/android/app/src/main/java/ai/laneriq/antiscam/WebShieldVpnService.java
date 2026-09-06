package ai.laneriq.antiscam;

import android.content.Intent;
import android.net.VpnService;
import android.os.IBinder;

/**
 * Android Web Shield control-plane.
 *
 * This service intentionally refuses to establish a fake tunnel. A production
 * VPN tunnel may only be created once WebShieldDataPlaneContract reports that
 * the forwarding/filter implementation has passed its external release gates.
 */
public final class WebShieldVpnService extends VpnService {
    public static final String ACTION_START = "ai.laneriq.antiscam.webshield.START";
    public static final String ACTION_STOP = "ai.laneriq.antiscam.webshield.STOP";

    private WebShieldStateStore state;

    @Override public void onCreate() {
        super.onCreate();
        state = new WebShieldStateStore(this);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            state.setUserOptedIn(false);
            state.markStopped("user-stop");
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

        if (!WebShieldDataPlaneContract.isProductionDataPlaneReady()) {
            state.markTunnel(false, false, false, WebShieldDataPlaneContract.reason());
            new LocalEventStore(this).recordOnce(
                    "web_shield_not_started",
                    "dataplane-not-ready",
                    60_000L);
            stopSelf();
            return START_NOT_STICKY;
        }

        // A real Builder()/packet-forwarding engine must be inserted only after
        // L1 network-matrix and false-positive evidence exists. Until then, the
        // Truth Gate prevents SYSTEM_WIDE_ACTIVE from ever being claimed.
        state.markTunnel(false, false, false, "dataplane-adapter-missing");
        stopSelf();
        return START_NOT_STICKY;
    }

    @Override public void onRevoke() {
        if (state != null) state.markConsent(false, "vpn-revoked-by-platform");
        stopSelf();
        super.onRevoke();
    }

    @Override public void onDestroy() {
        if (state != null && state.read().tunnelEstablished) {
            state.markStopped("service-destroyed");
        }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) {
        return super.onBind(intent);
    }
}
