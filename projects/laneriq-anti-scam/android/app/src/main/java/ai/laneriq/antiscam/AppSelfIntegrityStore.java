package ai.laneriq.antiscam;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import java.security.MessageDigest;

/**
 * Lightweight package signing-continuity probe.
 *
 * Test builds use a first-seen continuity baseline. Production should additionally
 * compare against a release signer digest supplied by trusted build/release metadata.
 * This is not a root/OS-compromise guarantee.
 */
public final class AppSelfIntegrityStore {
    private static final String PREFS = "laneriq_app_self_integrity";
    private static final String K_SIGNER_SHA256 = "pinned_signer_sha256";

    public static final class Result {
        public final SignerContinuityPolicy.State state;
        public final boolean continuityAcceptable;
        public final boolean unexpectedSignerChange;
        public final String currentSignerSha256;
        public final String reason;

        Result(SignerContinuityPolicy.State state,
               boolean continuityAcceptable,
               boolean unexpectedSignerChange,
               String currentSignerSha256,
               String reason) {
            this.state = state;
            this.continuityAcceptable = continuityAcceptable;
            this.unexpectedSignerChange = unexpectedSignerChange;
            this.currentSignerSha256 = currentSignerSha256;
            this.reason = reason;
        }
    }

    private final Context context;
    private final SharedPreferences prefs;

    public AppSelfIntegrityStore(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public Result probe() {
        String current;
        try {
            current = currentSignerSha256(context);
        } catch (Exception e) {
            current = "";
        }
        String pinned = prefs.getString(K_SIGNER_SHA256, "");
        SignerContinuityPolicy.Decision decision = SignerContinuityPolicy.evaluate(pinned, current);
        if (decision.shouldPinBaseline && !current.isEmpty()) {
            prefs.edit().putString(K_SIGNER_SHA256, current).apply();
        }
        return new Result(
                decision.state,
                decision.continuityAcceptable,
                decision.unexpectedSignerChange,
                current,
                decision.reason);
    }

    static String currentSignerSha256(Context context) throws Exception {
        PackageManager pm = context.getPackageManager();
        String packageName = context.getPackageName();
        Signature[] signatures;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
            if (info.signingInfo == null) return "";
            signatures = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
        } else {
            @SuppressWarnings("deprecation")
            PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
            @SuppressWarnings("deprecation")
            Signature[] legacy = info.signatures;
            signatures = legacy;
        }

        if (signatures == null || signatures.length == 0 || signatures[0] == null) return "";
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(signatures[0].toByteArray());
        StringBuilder out = new StringBuilder(hash.length * 2);
        for (byte b : hash) out.append(String.format("%02x", b & 0xff));
        return out.toString();
    }
}
