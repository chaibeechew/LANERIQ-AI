package ai.laneriq.antiscam;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.DateFormat;
import java.util.Date;

public class MainActivity extends Activity {
    private static final int REQUEST_PICK_SECURITY_FILE = 7101;

    private TextView status;
    private TextView protectionTools;
    private TextView eventLog;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(buildUi());
        requestNotificationPermissionIfNeeded();
        refreshStatus();
    }

    @Override protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_PICK_SECURITY_FILE && resultCode == RESULT_OK && data != null && data.getData() != null) {
            scanSelectedFile(data.getData());
        }
    }

    private ScrollView buildUi() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(36));
        root.setBackgroundColor(Color.rgb(247, 249, 252));
        scroll.addView(root);

        root.addView(text("LANERIQ Anti Scam", 30, true));
        TextView subtitle = text("Privacy-First Guardian + Anti-Scam Protection • 0.3.0-protection.1", 15, false);
        subtitle.setTextColor(Color.DKGRAY);
        root.addView(subtitle);

        TextView truth = text(
                "Truth Gate: protection status, website checks and app/file checks only claim what current evidence can support.",
                13,
                true);
        truth.setTextColor(Color.rgb(150, 85, 0));
        truth.setPadding(0, dp(12), 0, dp(18));
        root.addView(truth);

        status = card("Protection state\nLoading local Guardian evidence…");
        status.setTextIsSelectable(true);
        root.addView(status);

        Button start = button("Enable Always-On Guardian");
        start.setOnClickListener(v -> startGuardian());
        root.addView(start, matchWrap(dp(12)));

        Button stop = button("Pause Guardian");
        stop.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(96, 105, 120)));
        stop.setOnClickListener(v -> stopGuardian());
        root.addView(stop, matchWrap(dp(12)));

        Button refresh = button("Refresh Protection Evidence");
        refresh.setOnClickListener(v -> refreshStatus());
        root.addView(refresh, matchWrap(dp(20)));

        root.addView(text("Protection Tools", 22, true));

        Button web = button("Check Suspicious Website");
        web.setOnClickListener(v -> showWebsiteCheck());
        root.addView(web, matchWrap(dp(12)));

        Button file = button("Scan Selected App / APK / File");
        file.setOnClickListener(v -> pickSecurityFile());
        root.addView(file, matchWrap(dp(12)));

        Button remote = button("Remote-Control Safety Check");
        remote.setOnClickListener(v -> runRemoteControlSafetyCheck());
        root.addView(remote, matchWrap(dp(12)));

        Button privacy = button("Privacy Center");
        privacy.setOnClickListener(v -> showPrivacyCenter());
        root.addView(privacy, matchWrap(dp(18)));

        protectionTools = card(
                "Protection tools ready\n" +
                "• Website check: local phishing/risk heuristics\n" +
                "• App/APK/file check: local SHA-256 fingerprint\n" +
                "• Remote-control check: local technical risk signals\n" +
                "• Privacy Center: local-first data policy\n\n" +
                "A low-risk result is not a guarantee that a site or app is safe.");
        protectionTools.setTextSize(13);
        protectionTools.setTextIsSelectable(true);
        root.addView(protectionTools);

        TextView note = card(
                "Current protection scope\n" +
                "• Guardian lifecycle + explicit user opt-in\n" +
                "• Lease epoch/session/heartbeat truth evidence\n" +
                "• Restart circuit breaker + boot/package restore\n" +
                "• Developer Options / ADB / Accessibility risk snapshots\n" +
                "• App install/update awareness\n" +
                "• Safe Web local risk checks\n" +
                "• User-selected APK/file SHA-256 fingerprinting\n" +
                "• Bounded structured local event evidence\n" +
                "• Power-save / thermal-aware cadence\n" +
                "• Privacy-first minimal cloud contract\n\n" +
                "This test build does not claim CLEAN, virus-free, BANKING_SAFE, guaranteed theft prevention, guaranteed remote-control prevention, or unrestricted system-wide malware scanning.");
        note.setTextSize(13);
        root.addView(note);

        eventLog = card("Local bounded event log\n[]");
        eventLog.setTextSize(11);
        eventLog.setTextIsSelectable(true);
        root.addView(eventLog);
        return scroll;
    }

    private void showWebsiteCheck() {
        final EditText input = new EditText(this);
        input.setHint("https://example.com");
        input.setSingleLine(true);
        input.setPadding(dp(16), dp(12), dp(16), dp(12));

        new AlertDialog.Builder(this)
                .setTitle("Check suspicious website")
                .setMessage("LANERIQ checks the URL locally first. This test build does not upload your browsing history.")
                .setView(input)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Check", (dialog, which) -> {
                    SafeWebEvaluator.Result result = SafeWebEvaluator.evaluate(input.getText().toString());
                    String label;
                    switch (result.decision) {
                        case BLOCK:
                            label = "BLOCK — do not open this destination";
                            break;
                        case WARN:
                            label = "WARNING — review before continuing";
                            break;
                        default:
                            label = "CAUTION — no high-risk local signal found";
                            break;
                    }
                    protectionTools.setText(
                            "Website risk check\n" + label +
                            "\nRisk score: " + result.score + "/100" +
                            "\nReason: " + result.reason +
                            "\n\nLow observed risk is not proof that a website is safe. Known-threat reputation and DNS/VPN blocking are separate evidence layers.");
                    new LocalEventStore(this).recordOnce(
                            "manual_web_check",
                            result.decision.name(),
                            5_000L);
                })
                .show();
    }

    private void pickSecurityFile() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        try {
            startActivityForResult(intent, REQUEST_PICK_SECURITY_FILE);
            protectionTools.setText("Opening the system file picker…\nSelect an APK or another file you want LANERIQ to fingerprint locally.");
        } catch (Exception e) {
            protectionTools.setText("File picker unavailable on this device state.");
        }
    }

    private void scanSelectedFile(Uri uri) {
        protectionTools.setText("Scanning selected file locally…");
        new Thread(() -> {
            try {
                String sha256 = SelectedFileHasher.sha256(getContentResolver(), uri);
                new LocalEventStore(this).recordOnce("selected_file_hash", sha256, 30_000L);
                runOnUiThread(() -> protectionTools.setText(
                        "Selected app / APK / file check\n" +
                        "SHA-256: " + sha256 +
                        "\n\nThe file was fingerprinted locally. A hash alone does not prove the file is clean or malicious. " +
                        "A malware verdict requires trusted reputation/scanner evidence."));
            } catch (Exception e) {
                runOnUiThread(() -> protectionTools.setText(
                        "Selected file check failed\nLANERIQ could not read this file from the system picker."));
            }
        }, "laneriq-file-hash").start();
    }

    private void runRemoteControlSafetyCheck() {
        DeviceRiskSnapshot risk = DeviceRiskSnapshot.capture(getContentResolver());
        String action = risk.signalCount >= 2
                ? "Elevated technical risk signals found. Review Accessibility/Developer/ADB settings before banking or payment activity."
                : risk.signalCount == 1
                ? "One technical risk signal needs review."
                : "No elevated Developer/ADB/Accessibility signal found in this check.";

        protectionTools.setText(
                "Remote-control safety check\n" +
                "Risk level: " + risk.riskLevel +
                "\nSignals: " + risk.summary +
                "\n\n" + action +
                "\n\nLANERIQ did not inspect your messages, photos, microphone audio or screen contents. " +
                "This check cannot guarantee that remote control is impossible.");

        if (risk.signalCount >= 2) {
            new AlertDialog.Builder(this)
                    .setTitle("Review high-risk device settings")
                    .setMessage("LANERIQ found multiple technical risk signals. Open Accessibility settings now and review any service you do not recognize.")
                    .setNegativeButton("Later", null)
                    .setPositiveButton("Open settings", (dialog, which) -> {
                        try {
                            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
                        } catch (Exception ignored) {
                            toast("Unable to open Accessibility settings");
                        }
                    })
                    .show();
        }
    }

    private void showPrivacyCenter() {
        new AlertDialog.Builder(this)
                .setTitle("Privacy First")
                .setMessage(
                        "LANERIQ Anti Scam is designed local-first.\n\n" +
                        "Default policy:\n" +
                        "• No raw private message upload\n" +
                        "• No password/cookie/auth-token collection\n" +
                        "• No contact list upload by default\n" +
                        "• No photo/video/microphone monitoring\n" +
                        "• No full browsing-history upload\n" +
                        "• No cross-user mobile compute\n" +
                        "• Security cloud receives only minimized threat fingerprints/technical risk features when that layer is enabled\n\n" +
                        "The Guardian monitors local technical security state, not your private content.")
                .setPositiveButton("OK", null)
                .show();
    }

    private void startGuardian() {
        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        store.setUserOptedIn(true);
        Intent i = new Intent(this, GuardianService.class)
                .setAction(GuardianService.ACTION_START)
                .putExtra(GuardianService.EXTRA_START_REASON, "user-start");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(i);
            else startService(i);
            toast("Guardian start requested");
        } catch (Exception e) {
            store.serviceStopped("start-failed");
            toast("Guardian could not start on this device state");
        }
        status.postDelayed(this::refreshStatus, 750L);
    }

    private void stopGuardian() {
        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        store.setUserOptedIn(false);
        Intent i = new Intent(this, GuardianService.class).setAction(GuardianService.ACTION_STOP);
        try {
            startService(i);
        } catch (Exception ignored) {
            store.serviceStopped("pause-fallback");
        }
        toast("Guardian paused");
        status.postDelayed(this::refreshStatus, 300L);
    }

    private void refreshStatus() {
        ProtectionLeaseStore.Lease lease = new ProtectionLeaseStore(this).read();
        ResourceGovernor governor = new ResourceGovernor(this);
        GuardianHealth.State health = GuardianHealth.evaluate(
                lease.state,
                lease.localRiskLevel,
                governor.shouldReduceBackgroundWork(),
                lease.recentRestartAttempts);

        String headline;
        if (lease.mayClaimGuardianActive() && GuardianHealth.mayClaimGuardianActive(health)) {
            headline = health == GuardianHealth.State.REVIEW_REQUIRED
                    ? "GUARDIAN ACTIVE — REVIEW REQUIRED"
                    : "GUARDIAN ACTIVE";
        } else {
            switch (lease.state) {
                case DEGRADED_OFFLINE:
                    headline = "PROTECTION DEGRADED — GUARDIAN OFFLINE";
                    break;
                case DEGRADED_STALE:
                    headline = "PROTECTION DEGRADED — LEASE STALE";
                    break;
                case PAUSED:
                    headline = "GUARDIAN PAUSED";
                    break;
                case ACTIVE:
                    headline = "PROTECTION DEGRADED — HEALTH GATE BLOCKED ACTIVE CLAIM";
                    break;
                default:
                    headline = "PROTECTION STATE UNKNOWN";
            }
        }

        String heartbeat = lease.lastHeartbeatMs > 0
                ? DateFormat.getDateTimeInstance().format(new Date(lease.lastHeartbeatMs))
                : "none";
        String expiry = lease.expiresAtMs > 0
                ? DateFormat.getDateTimeInstance().format(new Date(lease.expiresAtMs))
                : "none";

        LocalEventStore events = new LocalEventStore(this);
        status.setText(
                "Protection state\n" + headline +
                "\n\nHealth gate: " + health.name() +
                "\nLocal risk: " + lease.localRiskLevel +
                "\nActive engines: " + lease.activeEngineSet +
                "\nLease epoch: " + lease.epoch +
                "\nHeartbeat sequence: " + lease.heartbeatSequence +
                "\nLease remaining: " + (lease.remainingMs / 1000L) + "s" +
                "\nLast heartbeat: " + heartbeat +
                "\nLease expires: " + expiry +
                "\nLast stop reason: " + (lease.lastStopReason.isEmpty() ? "none" : lease.lastStopReason) +
                "\nAutomatic restore attempts: " + lease.recentRestartAttempts +
                "\nLocal evidence events: " + events.count() +
                "\nPolicy: " + lease.policyVersion +
                "\nReputation snapshot: " + lease.reputationSnapshotVersion +
                "\n\nA stale, missing, sessionless or health-gated lease never displays Guardian Active.");

        eventLog.setText("Local bounded event log\n" + events.readLog());
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7001);
        }
    }

    private Button button(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTextColor(Color.WHITE);
        b.setMinHeight(dp(54));
        b.setGravity(Gravity.CENTER);
        b.setEnabled(true);
        b.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(20, 104, 215)));
        return b;
    }

    private TextView text(String s, int size, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(size);
        t.setTextColor(Color.rgb(20, 27, 38));
        if (bold) t.setTypeface(null, android.graphics.Typeface.BOLD);
        return t;
    }

    private TextView card(String s) {
        TextView t = text(s, 15, false);
        t.setPadding(dp(16), dp(16), dp(16), dp(16));
        t.setBackgroundColor(Color.WHITE);
        t.setGravity(Gravity.START);
        t.setLayoutParams(matchWrap(dp(16)));
        return t;
    }

    private LinearLayout.LayoutParams matchWrap(int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.bottomMargin = bottom;
        return p;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_SHORT).show();
    }
}
