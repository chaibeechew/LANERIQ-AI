package ai.laneriq.antiscam;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
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

import java.net.URI;
import java.text.DateFormat;
import java.util.Date;

public class MainActivity extends Activity {
    private static final int REQUEST_PICK_SECURITY_FILE = 7101;
    private static final int REQUEST_CONFIRM_PAUSE_CREDENTIAL = 7102;

    private TextView status;
    private TextView protectionTools;
    private TextView eventLog;
    private boolean recoveryAttemptedThisLaunch = false;
    private boolean pendingCredentialPause = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(buildUi());
        requestNotificationPermissionIfNeeded();
        refreshStatus();
        status.postDelayed(this::attemptGuardianRecoveryOnUserOpen, 250L);
    }

    @Override protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_PICK_SECURITY_FILE && resultCode == RESULT_OK && data != null && data.getData() != null) {
            scanSelectedFile(data.getData());
            return;
        }
        if (requestCode == REQUEST_CONFIRM_PAUSE_CREDENTIAL) {
            boolean wasPending = pendingCredentialPause;
            pendingCredentialPause = false;
            if (wasPending && resultCode == RESULT_OK) {
                new LocalEventStore(this).recordOnce(
                        "guardian_pause_device_credential_verified",
                        "system-credential-confirmed",
                        10_000L);
                showFinalPauseConfirmation(true);
            } else if (wasPending) {
                new LocalEventStore(this).recordOnce(
                        "guardian_pause_device_credential_cancelled",
                        "not-confirmed",
                        10_000L);
                toast("Guardian remains active");
            }
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
        TextView subtitle = text("Privacy-First Guardian + Anti-Scam Protection • 0.3.0-protection.4", 15, false);
        subtitle.setTextColor(Color.DKGRAY);
        root.addView(subtitle);

        TextView truth = text(
                "Truth Gate: protection, integrity, website and app/file results only claim what current evidence can support.",
                13,
                true);
        truth.setTextColor(Color.rgb(150, 85, 0));
        truth.setPadding(0, dp(12), 0, dp(18));
        root.addView(truth);

        status = card("Protection state\nLoading local Guardian evidence…");
        status.setTextIsSelectable(true);
        root.addView(status);

        Button start = button("Enable / Restore Always-On Guardian");
        start.setOnClickListener(v -> startGuardian());
        root.addView(start, matchWrap(dp(12)));

        Button stop = button("Pause Guardian");
        stop.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(96, 105, 120)));
        stop.setOnClickListener(v -> requestPauseGuardian());
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
                "• Website check: local heuristics + privacy-safe reputation cache\n" +
                "• App/APK/file check: SHA-256 + APK package/signer/permission evidence\n" +
                "• Remote-control check: local technical risk + sensitive-action freeze policy\n" +
                "• Anti-tamper: unexpected Guardian loss + signer continuity + alert-delivery truth\n" +
                "• Hardened Pause: no one-tap notification stop; elevated-risk pause requires Android device credential\n" +
                "• Privacy Center: local-first data enforcement\n\n" +
                "A low-risk result is not a guarantee that a site or app is safe.");
        protectionTools.setTextSize(13);
        protectionTools.setTextIsSelectable(true);
        root.addView(protectionTools);

        TextView note = card(
                "Current protection scope\n" +
                "• Guardian lifecycle + explicit user opt-in\n" +
                "• Lease epoch/session/heartbeat Dead-Man evidence\n" +
                "• Expected user stop vs unexpected protection-loss classification\n" +
                "• Restart circuit breaker + boot/package/user-reopen restore\n" +
                "• App signer-continuity self-integrity baseline\n" +
                "• Notification/alert-delivery integrity state\n" +
                "• Risk-aware Guardian Pause + device-credential step-up\n" +
                "• Developer Options / ADB / Accessibility risk snapshots\n" +
                "• App install/update awareness\n" +
                "• Safe Web local risk + offline reputation policy\n" +
                "• User-selected APK signer/permission/capability inspection\n" +
                "• Sensitive banking/payment action fail-closed policy\n" +
                "• Bounded structured local event evidence\n" +
                "• Power-save / thermal-aware cadence\n" +
                "• Privacy-first minimal cloud/witness contract\n\n" +
                "A true Android Force Stop can prevent ordinary background components from restarting until the package is allowed to run again. " +
                "System-wide Web Shield remains MANUAL_CHECK_ONLY until a real platform-compliant network filter is established. " +
                "This test build does not claim hacker-proof, impossible-to-stop, CLEAN, virus-free, BANKING_SAFE, guaranteed theft prevention, guaranteed remote-control prevention, or unrestricted system-wide malware scanning.");
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
                .setMessage("LANERIQ checks the destination locally first. This test build does not upload your browsing history.")
                .setView(input)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Check", (dialog, which) -> {
                    String raw = input.getText().toString();
                    SafeWebEvaluator.Result local = SafeWebEvaluator.evaluate(raw);
                    String host = extractHost(raw);
                    LocalThreatReputationStore.Verdict cached = LocalThreatReputationStore.Verdict.UNKNOWN;
                    if (!host.isEmpty()) {
                        try {
                            cached = new LocalThreatReputationStore(this).lookupDomain(host).verdict;
                        } catch (Exception ignored) {
                            cached = LocalThreatReputationStore.Verdict.UNKNOWN;
                        }
                    }
                    WebShieldPolicy.Decision shield = WebShieldPolicy.decide(local, mapReputation(cached));
                    String label;
                    switch (shield.action) {
                        case BLOCK:
                            label = "BLOCK — do not open this destination";
                            break;
                        case INTERSTITIAL:
                            label = "WARNING — stop and review before continuing";
                            break;
                        default:
                            label = "CAUTION — no blocking evidence found";
                            break;
                    }
                    protectionTools.setText(
                            "Website risk check\n" + label +
                            "\nLocal risk score: " + local.score + "/100" +
                            "\nCached reputation: " + cached.name() +
                            "\nDecision reason: " + shield.reason +
                            "\n\nUnknown or low observed risk is not proof that a website is safe. " +
                            "System-wide blocking remains unavailable until the network-protection Truth Gate has real tunnel/filter evidence.");
                    String fingerprint = host.isEmpty() ? shield.action.name() : ThreatIndicator.domainHash(host);
                    new LocalEventStore(this).recordOnce("manual_web_check", fingerprint, 5_000L);
                })
                .show();
    }

    private void pickSecurityFile() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        try {
            startActivityForResult(intent, REQUEST_PICK_SECURITY_FILE);
            protectionTools.setText("Opening the system file picker…\nSelect an APK or another file you want LANERIQ to inspect locally.");
        } catch (Exception e) {
            protectionTools.setText("File picker unavailable on this device state.");
        }
    }

    private void scanSelectedFile(Uri uri) {
        protectionTools.setText("Inspecting selected file locally…");
        new Thread(() -> {
            try {
                String sha256 = SelectedFileHasher.sha256(getContentResolver(), uri);
                new LocalEventStore(this).recordOnce("selected_file_hash", sha256, 30_000L);
                LocalThreatReputationStore.Entry reputation =
                        new LocalThreatReputationStore(this).lookupFileHash(sha256);

                try {
                    SelectedApkInspector.Result apk = SelectedApkInspector.inspect(this, uri);
                    AppRiskVerdict.Result risk = AppRiskVerdict.evaluate(new AppRiskVerdict.Evidence(
                            apk.signerSha256.isEmpty(),
                            false,
                            apk.dangerousPermissionCount,
                            apk.remoteControlCapabilitySignal));
                    String signer = apk.signerSha256.isEmpty() ? "unavailable" : apk.signerSha256.get(0);
                    runOnUiThread(() -> protectionTools.setText(
                            "Selected APK assessment\n" +
                            "Package: " + apk.packageName +
                            "\nVersion: " + apk.versionName + " (" + apk.versionCode + ")" +
                            "\nSHA-256: " + sha256 +
                            "\nSigner SHA-256: " + signer +
                            "\nDangerous permissions: " + apk.dangerousPermissionCount +
                            "\nAccessibility service declared: " + apk.accessibilityServiceDeclared +
                            "\nDevice admin declared: " + apk.deviceAdminServiceDeclared +
                            "\nOverlay permission requested: " + apk.overlayPermissionRequested +
                            "\nCached reputation: " + reputation.verdict.name() +
                            "\n\nVerdict: " + risk.verdict.name() +
                            "\nRisk score: " + risk.riskScore + "/100" +
                            "\nReason: " + risk.reason +
                            "\n\nCurrent local metadata/capability evidence cannot emit a MALICIOUS or virus verdict. " +
                            "A strong malware conclusion requires the future verified signed-evidence adapter."));
                } catch (Exception notApkOrUnreadable) {
                    runOnUiThread(() -> protectionTools.setText(
                            "Selected file assessment\n" +
                            "SHA-256: " + sha256 +
                            "\nCached reputation: " + reputation.verdict.name() +
                            "\n\nThe file was fingerprinted locally. It was not parsed as an APK package. " +
                            "A hash alone does not prove the file is clean or malicious."));
                }
            } catch (Exception e) {
                runOnUiThread(() -> protectionTools.setText(
                        "Selected file check failed\nLANERIQ could not read this file from the system picker."));
            }
        }, "laneriq-file-security-inspection").start();
    }

    private void runRemoteControlSafetyCheck() {
        DeviceRiskSnapshot risk = DeviceRiskSnapshot.capture(getContentResolver());
        ProtectionLeaseStore.Lease lease = new ProtectionLeaseStore(this).read();
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(lease);
        SensitiveActionGate.Decision bankingGate = SensitiveActionGate.evaluate(
                SensitiveActionGate.Context.BANKING,
                new SensitiveActionGate.Signals(
                        false,
                        false,
                        risk.signalCount,
                        false,
                        lease.mayClaimGuardianActive() && integrity.mayClaimProtected,
                        integrity.unexpectedProtectionLoss));
        EmergencyProtection.Plan emergency = EmergencyProtection.from(bankingGate, risk.signalCount);

        String action = risk.signalCount >= 2
                ? "Elevated technical risk signals found. Review Accessibility/Developer/ADB settings before banking or payment activity."
                : risk.signalCount == 1
                ? "One technical risk signal needs review."
                : integrity.unexpectedProtectionLoss
                ? "Guardian protection was lost unexpectedly. Restore protection before banking or payment activity."
                : "No elevated Developer/ADB/Accessibility signal found in this check.";

        protectionTools.setText(
                "Remote-control safety check\n" +
                "Risk level: " + risk.riskLevel +
                "\nSignals: " + risk.summary +
                "\nGuardian integrity: " + integrity.state.name() +
                "\nBanking/payment gate: " + bankingGate.action.name() +
                "\nEmergency level: " + emergency.level.name() +
                "\n\n" + action +
                "\n\nLANERIQ did not inspect your messages, photos, microphone audio or screen contents. " +
                "This check cannot guarantee that remote control is impossible.");

        if (bankingGate.action == SensitiveActionGate.Action.FREEZE) {
            new AlertDialog.Builder(this)
                    .setTitle("Sensitive action protection")
                    .setMessage("LANERIQ would freeze its own banking/payment-sensitive flow under these signals. " +
                            "Do not approve transfers or password recovery while protection integrity or remote-control risk remains unresolved. " +
                            "Review Accessibility services and restore Guardian protection first.")
                    .setNegativeButton("Later", null)
                    .setPositiveButton("Open settings", (dialog, which) -> openAccessibilitySettings())
                    .show();
        } else if (risk.signalCount >= 1) {
            new AlertDialog.Builder(this)
                    .setTitle("Review device settings")
                    .setMessage("LANERIQ found a technical risk signal. Review Accessibility settings and any remote-support app you did not intentionally authorize.")
                    .setNegativeButton("Later", null)
                    .setPositiveButton("Open settings", (dialog, which) -> openAccessibilitySettings())
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
                        "• No password/cookie/auth-token/private-key collection\n" +
                        "• No contact list upload by default\n" +
                        "• No photo/video/microphone monitoring\n" +
                        "• No full browsing-history upload\n" +
                        "• No hidden screen-content monitoring\n" +
                        "• No cross-user mobile compute\n" +
                        "• Domain reputation keys are stored as hashes\n" +
                        "• Guardian Witness shares only minimal protection state\n" +
                        "• Default cloud telemetry is restricted to allowlisted technical threat fields\n\n" +
                        "The Guardian monitors local technical security state, not your private content.")
                .setPositiveButton("OK", null)
                .show();
    }

    private void openAccessibilitySettings() {
        try {
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        } catch (Exception ignored) {
            toast("Unable to open Accessibility settings");
        }
    }

    private String extractHost(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "";
        String value = raw.trim();
        if (!value.contains("://")) value = "https://" + value;
        try {
            String host = new URI(value).getHost();
            return host == null ? "" : host;
        } catch (Exception ignored) {
            return "";
        }
    }

    private WebShieldPolicy.Reputation mapReputation(LocalThreatReputationStore.Verdict verdict) {
        if (verdict == null) return WebShieldPolicy.Reputation.UNKNOWN;
        switch (verdict) {
            case KNOWN_MALICIOUS:
                return WebShieldPolicy.Reputation.KNOWN_MALICIOUS;
            case HIGH_RISK:
                return WebShieldPolicy.Reputation.HIGH_RISK;
            case KNOWN_BENIGN:
                return WebShieldPolicy.Reputation.KNOWN_BENIGN;
            default:
                return WebShieldPolicy.Reputation.UNKNOWN;
        }
    }

    private void startGuardian() {
        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        store.resetAutomaticRestartCircuit();
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

    private void attemptGuardianRecoveryOnUserOpen() {
        if (recoveryAttemptedThisLaunch) return;
        recoveryAttemptedThisLaunch = true;

        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        ProtectionLeaseStore.Lease lease = store.read();
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(lease);
        GuardianRecoveryPolicy.Decision recovery = GuardianRecoveryPolicy.evaluate(
                integrity,
                lease.userOptedIn,
                lease.recentRestartAttempts);

        if (!recovery.mayAttemptServiceStart) {
            if (recovery.action == GuardianRecoveryPolicy.Action.REQUIRE_EXPLICIT_REVIEW) {
                new LocalEventStore(this).recordOnce(
                        "guardian_user_reopen_recovery_blocked",
                        recovery.reason,
                        60_000L);
            }
            return;
        }

        if (!store.allowAutomaticRestart(System.currentTimeMillis())) {
            store.serviceStopped("user-reopen-recovery-circuit-open");
            new LocalEventStore(this).recordOnce(
                    "guardian_user_reopen_recovery_blocked",
                    "restart-circuit-open",
                    60_000L);
            refreshStatus();
            return;
        }

        Intent i = new Intent(this, GuardianService.class)
                .setAction(GuardianService.ACTION_RESTORE)
                .putExtra(GuardianService.EXTRA_START_REASON, "user-reopen-recovery");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(i);
            else startService(i);
            new LocalEventStore(this).recordOnce(
                    "guardian_user_reopen_recovery",
                    integrity.state.name(),
                    30_000L);
            toast("Restoring Guardian protection");
        } catch (Exception e) {
            store.serviceStopped("user-reopen-restore-failed");
            new LocalEventStore(this).recordOnce(
                    "guardian_user_reopen_recovery_failed",
                    e.getClass().getSimpleName(),
                    60_000L);
        }
        status.postDelayed(this::refreshStatus, 850L);
    }

    private void requestPauseGuardian() {
        DeviceRiskSnapshot risk = DeviceRiskSnapshot.capture(getContentResolver());
        ProtectionLeaseStore.Lease lease = new ProtectionLeaseStore(this).read();
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(lease);
        EmergencyModeStore.State emergency = new EmergencyModeStore(this).read();
        AppSelfIntegrityStore.Result selfIntegrity = new AppSelfIntegrityStore(this).probe();
        GuardianPausePolicy.Decision pause = GuardianPausePolicy.evaluate(
                risk.signalCount,
                emergency.level,
                integrity.unexpectedProtectionLoss,
                selfIntegrity.unexpectedSignerChange);

        if (pause.action == GuardianPausePolicy.Action.BLOCK_DURING_URGENT_RISK) {
            new LocalEventStore(this).recordOnce(
                    "guardian_pause_blocked",
                    pause.reason,
                    30_000L);
            new AlertDialog.Builder(this)
                    .setTitle("Guardian pause blocked during urgent risk")
                    .setMessage("LANERIQ found urgent remote-control or integrity risk. Ordinary Pause is disabled so a remote operator cannot easily remove protection. " +
                            "Review device settings and end any remote-support or screen-sharing session first. This does not prove a hacker is present.")
                    .setNegativeButton("Close", null)
                    .setPositiveButton("Review Accessibility", (dialog, which) -> openAccessibilitySettings())
                    .show();
            return;
        }

        if (pause.action == GuardianPausePolicy.Action.REQUIRE_HIGH_FRICTION_REVIEW) {
            new AlertDialog.Builder(this)
                    .setTitle("Device credential required")
                    .setMessage("Protection integrity or a device-risk signal needs attention. To reduce the chance that a remote operator pauses Guardian, Android device credential confirmation is required before continuing.")
                    .setNegativeButton("Keep Guardian On", null)
                    .setPositiveButton("Verify Device Owner", (dialog, which) -> requestDeviceCredentialForPause())
                    .show();
            return;
        }

        showFinalPauseConfirmation(false);
    }

    private void requestDeviceCredentialForPause() {
        KeyguardManager manager = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (manager == null || !manager.isDeviceSecure()) {
            new LocalEventStore(this).recordOnce(
                    "guardian_pause_device_credential_unavailable",
                    "secure-lock-not-configured",
                    60_000L);
            new AlertDialog.Builder(this)
                    .setTitle("Guardian remains active")
                    .setMessage("A secure Android screen lock is not available for elevated-risk Pause authorization. LANERIQ will fail closed and keep Guardian running. Resolve the risk condition or configure a secure screen lock before trying again.")
                    .setPositiveButton("OK", null)
                    .show();
            return;
        }

        Intent credential = manager.createConfirmDeviceCredentialIntent(
                "Confirm Guardian Pause",
                "Verify the device credential before pausing Anti Scam during an elevated-risk state.");
        if (credential == null) {
            new LocalEventStore(this).recordOnce(
                    "guardian_pause_device_credential_unavailable",
                    "credential-intent-unavailable",
                    60_000L);
            toast("Guardian remains active");
            return;
        }

        pendingCredentialPause = true;
        try {
            startActivityForResult(credential, REQUEST_CONFIRM_PAUSE_CREDENTIAL);
        } catch (Exception e) {
            pendingCredentialPause = false;
            new LocalEventStore(this).recordOnce(
                    "guardian_pause_device_credential_failed",
                    e.getClass().getSimpleName(),
                    60_000L);
            toast("Guardian remains active");
        }
    }

    private void showFinalPauseConfirmation(boolean highFriction) {
        String message = highFriction
                ? "Device credential verified. Final confirmation: pause Always-On Guardian despite the current review state? LANERIQ will remove the Protected claim until Guardian is restored."
                : "Pause Always-On Guardian? LANERIQ will stop claiming active device protection until you enable it again.";
        new AlertDialog.Builder(this)
                .setTitle("Confirm Guardian Pause")
                .setMessage(message)
                .setNegativeButton("Keep Guardian On", null)
                .setPositiveButton("Pause Guardian", (dialog, which) -> stopGuardianConfirmed())
                .show();
    }

    private void stopGuardianConfirmed() {
        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        store.setUserOptedIn(false);
        Intent i = new Intent(this, GuardianService.class).setAction(GuardianService.ACTION_STOP);
        try {
            startService(i);
        } catch (Exception ignored) {
            store.serviceStopped("pause-fallback");
        }
        new LocalEventStore(this).recordOnce("guardian_pause_confirmed", "in-app-confirmed", 5_000L);
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
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(lease);
        AppSelfIntegrityStore.Result selfIntegrity = new AppSelfIntegrityStore(this).probe();
        AlertDeliveryIntegrity.Decision alertDelivery = AlertDeliveryIntegrity.capture(this);
        EmergencyModeStore.State emergency = new EmergencyModeStore(this).read();

        NetworkProtectionCapability.Evidence networkEvidence = new NetworkProtectionCapability.Evidence(
                false,
                lease.userOptedIn,
                false,
                false,
                false,
                true);
        NetworkProtectionCapability.State networkState = NetworkProtectionCapability.evaluate(networkEvidence);

        boolean mayClaimActive = lease.mayClaimGuardianActive()
                && GuardianHealth.mayClaimGuardianActive(health)
                && integrity.mayClaimProtected
                && selfIntegrity.continuityAcceptable;

        String headline;
        if (selfIntegrity.unexpectedSignerChange) {
            headline = "PROTECTION INTEGRITY ALERT — APP SIGNER MISMATCH";
        } else if (integrity.state == GuardianIntegrityPolicy.State.RESTORE_THROTTLED) {
            headline = "PROTECTION LOST — AUTOMATIC RESTORE THROTTLED";
        } else if (integrity.unexpectedProtectionLoss) {
            headline = "PROTECTION LOST UNEXPECTEDLY — RESTORE BEFORE PAYMENTS";
        } else if (mayClaimActive) {
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
                case DEGRADED_CLOCK:
                    headline = "PROTECTION DEGRADED — CLOCK EVIDENCE INVALID";
                    break;
                case PAUSED:
                    headline = "GUARDIAN PAUSED";
                    break;
                case ACTIVE:
                    headline = "PROTECTION DEGRADED — INTEGRITY GATE BLOCKED ACTIVE CLAIM";
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
                "\n\nGuardian integrity: " + integrity.state.name() +
                "\nSelf integrity: " + selfIntegrity.state.name() +
                "\nAlert delivery: " + alertDelivery.state.name() +
                "\nEmergency level: " + emergency.level.name() +
                "\nHealth gate: " + health.name() +
                "\nLocal risk: " + lease.localRiskLevel +
                "\nActive engines: " + lease.activeEngineSet +
                "\nSystem-wide Web Shield: " + networkState.name() +
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
                "\n\nProtected requires fresh same-boot Guardian proof plus intact self-integrity. " +
                "A missing heartbeat never proves a hacker caused the loss, but it always removes the Protected claim. " +
                "System-wide Web Shield cannot display Active without real network-filter evidence.");

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
