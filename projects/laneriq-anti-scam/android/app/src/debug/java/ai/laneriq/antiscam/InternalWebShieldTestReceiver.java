package ai.laneriq.antiscam;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Debug-only ADB control surface protected by android.permission.DUMP.
 * Ordinary third-party apps cannot use it; release builds do not contain it.
 */
public final class InternalWebShieldTestReceiver extends BroadcastReceiver {
    public static final String ACTION = "ai.laneriq.antiscam.test.INTERNAL_WEB_SHIELD_CONTROL";
    public static final String EXTRA_MODE = "mode";
    public static final String MODE_SEED_BLOCK = "seed-block";
    public static final String MODE_CLEAR_BLOCK = "clear-block";
    public static final String MODE_STOP = "stop";
    public static final String TEST_DOMAIN = "example.com";

    @Override public void onReceive(Context context, Intent intent) {
        if (!BuildConfig.DEBUG) return;
        String mode = intent == null ? "" : intent.getStringExtra(EXTRA_MODE);
        if (MODE_SEED_BLOCK.equals(mode)) {
            try {
                String evidenceId = InternalThreatEvidenceSeeder.seedKnownMaliciousDomain(context, TEST_DOMAIN);
                new LocalEventStore(context).recordOnce(
                        "web_shield_internal_signed_block_seeded",
                        evidenceId,
                        5_000L);
                setResultCode(0);
                setResultData("seeded:" + evidenceId);
            } catch (Exception e) {
                setResultCode(1);
                setResultData("seed-failed:" + e.getClass().getSimpleName());
            }
            return;
        }
        if (MODE_CLEAR_BLOCK.equals(mode)) {
            InternalThreatEvidenceSeeder.clearDomain(context, TEST_DOMAIN);
            new LocalEventStore(context).recordOnce(
                    "web_shield_internal_signed_block_cleared",
                    ThreatIndicator.domainHash(TEST_DOMAIN),
                    5_000L);
            setResultCode(0);
            setResultData("cleared");
            return;
        }
        if (MODE_STOP.equals(mode)) {
            Intent stop = new Intent(context, WebShieldVpnService.class)
                    .setAction(WebShieldVpnService.ACTION_STOP);
            try { context.startService(stop); }
            catch (Exception ignored) { new WebShieldStateStore(context).markStopped("debug-receiver-stop-fallback"); }
            setResultCode(0);
            setResultData("stop-requested");
            return;
        }
        setResultCode(2);
        setResultData("unknown-mode");
    }
}
