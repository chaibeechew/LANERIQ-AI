package ai.laneriq.antiscam;

import android.content.ContentResolver;
import android.provider.Settings;

public final class DeviceRiskSnapshot {
    public final boolean developerOptionsEnabled;
    public final boolean adbEnabled;
    public final boolean accessibilityEnabled;
    public final int signalCount;
    public final String riskLevel;
    public final String fingerprint;
    public final String summary;

    private DeviceRiskSnapshot(
            boolean developerOptionsEnabled,
            boolean adbEnabled,
            boolean accessibilityEnabled,
            int signalCount,
            String riskLevel,
            String fingerprint,
            String summary) {
        this.developerOptionsEnabled = developerOptionsEnabled;
        this.adbEnabled = adbEnabled;
        this.accessibilityEnabled = accessibilityEnabled;
        this.signalCount = signalCount;
        this.riskLevel = riskLevel;
        this.fingerprint = fingerprint;
        this.summary = summary;
    }

    public static DeviceRiskSnapshot capture(ContentResolver resolver) {
        boolean developer = Settings.Global.getInt(
                resolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1;
        boolean adb = Settings.Global.getInt(
                resolver, Settings.Global.ADB_ENABLED, 0) == 1;
        boolean accessibility = Settings.Secure.getInt(
                resolver, Settings.Secure.ACCESSIBILITY_ENABLED, 0) == 1;
        return fromSignals(developer, adb, accessibility);
    }

    public static DeviceRiskSnapshot fromSignals(boolean developer, boolean adb, boolean accessibility) {
        int count = 0;
        StringBuilder signals = new StringBuilder();
        if (developer) {
            count++;
            signals.append("Developer options enabled");
        }
        if (adb) {
            if (signals.length() > 0) signals.append(" • ");
            count++;
            signals.append("ADB enabled");
        }
        if (accessibility) {
            if (signals.length() > 0) signals.append(" • ");
            count++;
            signals.append("Accessibility enabled — review active services");
        }

        String level = count >= 2 ? "elevated" : count == 1 ? "review" : "low-local-signal";
        String summary = count == 0
                ? "no elevated local signals"
                : signals.toString();
        return new DeviceRiskSnapshot(
                developer,
                adb,
                accessibility,
                count,
                level,
                developer + ":" + adb + ":" + accessibility,
                summary);
    }
}
