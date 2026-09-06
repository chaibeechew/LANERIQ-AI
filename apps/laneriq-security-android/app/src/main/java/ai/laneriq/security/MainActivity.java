package ai.laneriq.security;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.IDN;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int PICK_FILE = 4101;
    private static final int NOTIFICATION_PERMISSION = 5101;
    private static final String TRUTH_URL = "https://laneriq-malware-defense.vercel.app/api/truth-status";

    private ScrollView scroll;
    private TextView status;
    private EditText urlInput;
    private Button guardianButton;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(buildUi());
        if (GuardianService.isEnabled(this)) {
            startGuardian(false);
        }
        refreshTruth(false);
    }

    private View buildUi() {
        scroll = new ScrollView(this);
        scroll.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(36));
        root.setBackgroundColor(Color.rgb(247,249,252));
        scroll.addView(root);

        TextView title = text("LANERIQ Anti Scam", 30, true);
        root.addView(title);

        TextView subtitle = text("Always-On Scam & Threat Protection • Android Test", 15, false);
        subtitle.setTextColor(Color.DKGRAY);
        root.addView(subtitle);

        TextView truth = text("Truth Gate: protection signals are evidence-based — no unsupported CLEAN claim", 13, true);
        truth.setTextColor(Color.rgb(150,85,0));
        truth.setPadding(0, dp(12), 0, dp(18));
        root.addView(truth);

        status = card("Protection status\nChecking Production Truth…");
        status.setTextIsSelectable(true);
        root.addView(status);

        guardianButton = button(GuardianService.isEnabled(this)
                ? "Always-On Guardian: ON — Tap to Stop"
                : "Enable Always-On Guardian");
        applyGuardianButtonState();
        guardianButton.setOnClickListener(v -> toggleGuardian());
        root.addView(guardianButton, matchWrap(dp(14)));

        TextView guardianHint = text("Guardian stays active after you leave the app, restores after reboot, and watches available device-risk signals plus new app installs/updates. It does not treat a black screen alone as proof of malware.", 13, false);
        guardianHint.setTextColor(Color.rgb(60,75,95));
        guardianHint.setPadding(dp(4), 0, dp(4), dp(18));
        root.addView(guardianHint);

        urlInput = new EditText(this);
        urlInput.setHint("Paste a link, e.g. https://bank.example");
        urlInput.setSingleLine(true);
        urlInput.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(urlInput, matchWrap(dp(12)));

        Button link = button("Check Link / Phishing Risk");
        link.setOnClickListener(v -> {
            toast("Checking link…");
            checkLink();
        });
        root.addView(link, matchWrap(dp(12)));

        Button file = button("Scan File / APK Fingerprint");
        file.setOnClickListener(v -> {
            toast("Opening file picker…");
            pickFile();
        });
        root.addView(file, matchWrap(dp(12)));

        Button banking = button("Banking Safety Check");
        banking.setOnClickListener(v -> {
            toast("Running banking safety check…");
            bankingSafety();
        });
        root.addView(banking, matchWrap(dp(12)));

        Button refresh = button("Refresh 15-Layer Protection Status");
        refresh.setOnClickListener(v -> {
            toast("Refreshing protection status…");
            refreshTruth(true);
        });
        root.addView(refresh, matchWrap(dp(18)));

        TextView hint = text("Tap any action above. LANERIQ will immediately show progress and automatically move the result card into view.", 13, false);
        hint.setTextColor(Color.rgb(60,75,95));
        hint.setPadding(dp(4), 0, dp(4), dp(18));
        root.addView(hint);

        TextView note = card("15-layer scope\nSafeLink • Phishing/QR • APK Pre-Install • Sideload • Permissions • Runtime Behavior • Screen/Remote Control • Banking Session • Transaction Risk • Emergency Response • Device Integrity • SIM Takeover • OTP/Notification • Network/DNS/Wi-Fi • Trusted Banking Identity\n\nAlways-On Guardian test layer\nForeground protection service • boot restore • new app install/update events • Developer/ADB/Accessibility risk signals\n\nLANERIQ Anti Scam does not claim guaranteed theft prevention or full malware CLEAN verification without sufficient scanner evidence. Android does not expose every other app's screen or remote-control state to a normal security app, so black-screen incidents require multi-signal correlation rather than a single-screen heuristic.");
        note.setTextSize(13);
        root.addView(note);
        return scroll;
    }

    private void toggleGuardian() {
        if (GuardianService.isEnabled(this)) {
            stopGuardian();
        } else {
            startGuardian(true);
        }
    }

    private void startGuardian(boolean focusResult) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION);
        }

        try {
            Intent service = new Intent(this, GuardianService.class).setAction(GuardianService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(service);
            } else {
                startService(service);
            }
            getSharedPreferences(GuardianService.PREFS, MODE_PRIVATE)
                    .edit().putBoolean(GuardianService.PREF_ENABLED, true).apply();
            applyGuardianButtonState();
            showStatus("Always-On Guardian\nACTIVE\nLANERIQ will remain active after you leave the app and will restore after reboot.\n\nCurrent guardian signals: Developer options • ADB • Accessibility enabled state • new app install/update events.\n\nThese are risk signals, not automatic proof of malware.", focusResult);
            toast("Always-On Guardian enabled");
        } catch (Exception e) {
            getSharedPreferences(GuardianService.PREFS, MODE_PRIVATE)
                    .edit().putBoolean(GuardianService.PREF_ENABLED, false).apply();
            applyGuardianButtonState();
            showStatus("Always-On Guardian\nFAILED TO START\nAndroid did not allow the foreground protection service to start. Protection is not marked active.", true);
        }
    }

    private void stopGuardian() {
        try {
            Intent stop = new Intent(this, GuardianService.class).setAction(GuardianService.ACTION_STOP);
            startService(stop);
        } catch (Exception ignored) {
        }
        getSharedPreferences(GuardianService.PREFS, MODE_PRIVATE)
                .edit().putBoolean(GuardianService.PREF_ENABLED, false).apply();
        applyGuardianButtonState();
        showStatus("Always-On Guardian\nOFF\nBackground Guardian monitoring is disabled. Manual Link, File, Banking and Protection checks remain available.", true);
        toast("Always-On Guardian stopped");
    }

    private void applyGuardianButtonState() {
        if (guardianButton == null) return;
        boolean on = GuardianService.isEnabled(this);
        guardianButton.setText(on ? "Always-On Guardian: ON — Tap to Stop" : "Enable Always-On Guardian");
        guardianButton.setBackgroundTintList(ColorStateList.valueOf(on
                ? Color.rgb(12,145,105)
                : Color.rgb(20,104,215)));
    }

    private void checkLink() {
        String raw = urlInput.getText().toString().trim();
        if (raw.isEmpty()) {
            showStatus("SafeLink\nINPUT REQUIRED\nPaste or type a link first, then tap Check Link / Phishing Risk.", true);
            return;
        }

        showStatus("SafeLink\nCHECKING\nAnalyzing local phishing and URL risk signals…", true);
        try {
            Uri uri = Uri.parse(raw.contains("://") ? raw : "https://" + raw);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            int risk = 0;
            StringBuilder reasons = new StringBuilder();
            if (!"https".equals(scheme)) { risk += 35; reasons.append("• Not HTTPS\n"); }
            if (host.isEmpty()) { risk += 60; reasons.append("• Invalid/missing hostname\n"); }
            if (host.startsWith("xn--") || host.contains(".xn--")) { risk += 25; reasons.append("• Punycode/homograph risk\n"); }
            if (host.matches(".*(^|\\.)\\d{1,3}(\\.\\d{1,3}){3}$")) { risk += 30; reasons.append("• IP-address link\n"); }
            String ascii = host.isEmpty() ? "" : IDN.toASCII(host);
            if (ascii.contains("login-") || ascii.contains("secure-") || ascii.contains("verify-") || ascii.contains("wallet-") || ascii.contains("banking-")) { risk += 20; reasons.append("• Credential-lure naming pattern\n"); }
            if (raw.length() > 180) { risk += 15; reasons.append("• Unusually long URL\n"); }
            String verdict = risk >= 50 ? "HIGH RISK — DO NOT OPEN" : risk >= 25 ? "CAUTION — VERIFY BEFORE OPENING" : "LOW LOCAL HEURISTIC RISK — CLOUD VERIFICATION STILL REQUIRED";
            showStatus("SafeLink result\n" + verdict + "\nRisk score: " + Math.min(risk,100) + "/100\n" + (reasons.length()==0 ? "• No local red flags found\n" : reasons) + "\nLANERIQ never treats local heuristics alone as proof of CLEAN.", true);
        } catch (Exception e) {
            showStatus("SafeLink result\nINVALID / UNVERIFIED LINK\nDo not open it until verified.", true);
        }
    }

    private void pickFile() {
        showStatus("File scan\nOPENING FILE PICKER\nChoose a file or APK. LANERIQ will compute its local SHA-256 fingerprint.", true);
        try {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.setType("*/*");
            i.addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(i, PICK_FILE);
        } catch (Exception e) {
            showStatus("File scan\nUNAVAILABLE\nUnable to open the Android file picker on this device.", true);
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILE) return;

        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            showStatus("File scan\nCANCELLED\nNo file was selected.", true);
            return;
        }

        Uri uri = data.getData();
        showStatus("File scan\nSCANNING\nComputing local SHA-256 fingerprint…", true);
        new Thread(() -> {
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                if (in == null) throw new IllegalStateException("No readable stream");
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] buf = new byte[8192]; int n; long size = 0;
                while ((n = in.read(buf)) > 0) { md.update(buf,0,n); size += n; }
                StringBuilder hex = new StringBuilder();
                for (byte b: md.digest()) hex.append(String.format("%02x", b));
                String name = uri.getLastPathSegment() == null ? "selected file" : uri.getLastPathSegment();
                boolean apk = name.toLowerCase(Locale.ROOT).contains(".apk");
                String verdict = apk ? "APK / SIDELOAD — QUARANTINE UNTIL CLOUD + MULTI-SCANNER VERIFICATION" : "FINGERPRINTED — CLOUD VERIFICATION REQUIRED";
                String output = "File scan\n" + verdict + "\nSize: " + size + " bytes\nSHA-256:\n" + hex + "\n\nRaw file content is not stored by default in LANERIQ Security Intelligence Cloud.";
                runOnUiThread(() -> showStatus(output, true));
            } catch (Exception e) {
                runOnUiThread(() -> showStatus("File scan\nFAILED CLOSED\nUnable to fingerprint selected file. No CLEAN claim issued.", true));
            }
        }).start();
    }

    private void bankingSafety() {
        showStatus("Banking Safety\nCHECKING\nReviewing available local device safety signals…", true);
        boolean developer = Settings.Global.getInt(getContentResolver(), Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1;
        boolean adb = Settings.Global.getInt(getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1;
        boolean accessibility = Settings.Secure.getInt(getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED, 0) == 1;
        String state = (developer || adb || accessibility) ? "BANKING CAUTION — REVIEW DEVICE SIGNALS" : "BANKING STATUS REQUIRES FULL DEVICE EVIDENCE";
        StringBuilder signals = new StringBuilder();
        signals.append(developer ? "• Developer options are enabled\n" : "• No local developer-mode signal detected\n");
        signals.append(adb ? "• ADB is enabled\n" : "• ADB is not enabled\n");
        signals.append(accessibility ? "• Accessibility is enabled — review active services\n" : "• Accessibility is not enabled\n");
        showStatus("Banking Safety\n" + state + "\n" + signals + "• LANERIQ will not declare BANKING_SAFE without sufficient device, network, app identity, permission and threat evidence.\n\nIf you just installed an unknown APK, saw a black screen/overlay, granted Accessibility, screen-sharing or notification access, stop banking activity and review the device before continuing.", true);
    }

    private void refreshTruth(boolean focusResult) {
        showStatus("Protection status\nCHECKING\nContacting LANERIQ Production Truth…", focusResult);
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(TRUTH_URL).openConnection();
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                c.setRequestMethod("GET");
                int code = c.getResponseCode();
                String body;
                try (InputStream in = code >= 200 && code < 400 ? c.getInputStream() : c.getErrorStream()) {
                    body = in == null ? "" : new String(in.readAllBytes());
                }
                boolean fifteen = body.contains("\"financialScamDefenseLayerCount\":15") || body.contains("\"layerCount\":15");
                boolean intel = body.contains("\"privacyPreserving\":true") && body.contains("SECURITY-INTELLIGENCE-CLOUD");
                boolean noGuarantee = body.contains("\"guaranteedTheftPreventionClaimAllowed\":false");
                boolean rawFalse = body.contains("\"rawMalwareBinaryStoredByDefault\":false");
                String out = "Production Protection\nHTTP " + code + "\n15-layer Financial Scam Defense: " + yes(fifteen) + "\nSecurity Intelligence Cloud: " + yes(intel) + "\nPrivacy-preserving threat learning: " + yes(rawFalse) + "\n100% theft-prevention guarantee claimed: " + (noGuarantee ? "NO (correct Truth Gate)" : "UNVERIFIED") + "\nAlways-On Guardian enabled: " + (GuardianService.isEnabled(this) ? "YES" : "NO") + "\n\nCurrent scanner-provider CLEAN evidence remains governed by Production Truth Gate.";
                runOnUiThread(() -> showStatus(out, focusResult));
            } catch (Exception e) {
                runOnUiThread(() -> showStatus("Protection status\nFAIL CLOSED\nProduction Truth endpoint unavailable. Do not assume CLEAN or BANKING_SAFE.\nAlways-On Guardian enabled: " + (GuardianService.isEnabled(this) ? "YES" : "NO"), focusResult));
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    private void showStatus(String message, boolean focus) {
        status.setText(message);
        if (focus) {
            status.post(() -> scroll.smoothScrollTo(0, Math.max(0, status.getTop() - dp(12))));
        }
    }

    private String yes(boolean v) { return v ? "VERIFIED" : "EVIDENCE REQUIRED"; }

    private Button button(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTextColor(Color.WHITE);
        b.setMinHeight(dp(54));
        b.setGravity(Gravity.CENTER);
        b.setClickable(true);
        b.setEnabled(true);
        b.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(20,104,215)));
        return b;
    }

    private TextView text(String s, int size, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(size);
        t.setTextColor(Color.rgb(20,27,38));
        if (bold) t.setTypeface(null, android.graphics.Typeface.BOLD);
        return t;
    }

    private TextView card(String s) {
        TextView t = text(s,15,false);
        t.setPadding(dp(16),dp(16),dp(16),dp(16));
        t.setBackgroundColor(Color.WHITE);
        t.setGravity(Gravity.START);
        LinearLayout.LayoutParams p = matchWrap(dp(16));
        t.setLayoutParams(p);
        return t;
    }

    private LinearLayout.LayoutParams matchWrap(int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2);
        p.bottomMargin = bottom;
        return p;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
    private void toast(String s) { Toast.makeText(this,s,Toast.LENGTH_SHORT).show(); }
}
