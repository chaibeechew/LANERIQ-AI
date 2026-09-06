package ai.laneriq.antiscam;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageManager;
import android.os.Build;

/** Tracks only the installer/source package name continuity. */
public final class InstallSourceIntegrityStore {
    private static final String PREFS = "laneriq_install_source_integrity";
    private static final String K_SOURCE = "pinned_install_source";

    public static final class Result {
        public final InstallSourceContinuityPolicy.State state;
        public final boolean continuityAcceptable;
        public final boolean unexpectedChange;
        public final String currentSource;
        public final String reason;

        Result(InstallSourceContinuityPolicy.Decision d, String currentSource) {
            this.state = d.state;
            this.continuityAcceptable = d.continuityAcceptable;
            this.unexpectedChange = d.unexpectedChange;
            this.currentSource = currentSource == null ? "" : currentSource;
            this.reason = d.reason;
        }
    }

    private final Context context;
    private final SharedPreferences prefs;

    public InstallSourceIntegrityStore(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public Result probe() {
        String current = currentSource(context);
        String pinned = prefs.getString(K_SOURCE, "");
        InstallSourceContinuityPolicy.Decision d = InstallSourceContinuityPolicy.evaluate(pinned, current);
        if (d.shouldPinBaseline && !current.isEmpty()) prefs.edit().putString(K_SOURCE, current).apply();
        return new Result(d, current);
    }

    static String currentSource(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                InstallSourceInfo info = pm.getInstallSourceInfo(context.getPackageName());
                String source = info.getInstallingPackageName();
                if (source == null || source.trim().isEmpty()) source = info.getInitiatingPackageName();
                return source == null ? "unknown-source" : source.trim();
            }
            @SuppressWarnings("deprecation")
            String source = pm.getInstallerPackageName(context.getPackageName());
            return source == null || source.trim().isEmpty() ? "unknown-source" : source.trim();
        } catch (Exception e) {
            return "";
        }
    }
}
