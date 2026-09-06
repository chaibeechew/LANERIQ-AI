package ai.laneriq.antiscam;

import java.nio.charset.StandardCharsets;

/**
 * Canonical, privacy-minimal payload signed for same-device LANERIQ Witnesses.
 * It intentionally contains no URL, file/app history, event log, raw device ID,
 * messages, contacts, credentials or private content.
 */
public final class WitnessProofPayload {
    public static final int SCHEMA_VERSION = 1;

    public final String packageName;
    public final long leaseEpoch;
    public final long heartbeatSequence;
    public final long leaseExpiresAtMs;
    public final String integrityState;
    public final String emergencyLevel;
    public final String alertDeliveryState;
    public final String policyVersion;
    public final long observedAtMs;

    public WitnessProofPayload(String packageName,
                               long leaseEpoch,
                               long heartbeatSequence,
                               long leaseExpiresAtMs,
                               String integrityState,
                               String emergencyLevel,
                               String alertDeliveryState,
                               String policyVersion,
                               long observedAtMs) {
        this.packageName = safeToken(packageName);
        this.leaseEpoch = Math.max(0L, leaseEpoch);
        this.heartbeatSequence = Math.max(0L, heartbeatSequence);
        this.leaseExpiresAtMs = Math.max(0L, leaseExpiresAtMs);
        this.integrityState = safeToken(integrityState);
        this.emergencyLevel = safeToken(emergencyLevel);
        this.alertDeliveryState = safeToken(alertDeliveryState);
        this.policyVersion = safeToken(policyVersion);
        this.observedAtMs = Math.max(0L, observedAtMs);
    }

    public String canonical() {
        return "schema=" + SCHEMA_VERSION + "\n"
                + "package=" + packageName + "\n"
                + "epoch=" + leaseEpoch + "\n"
                + "sequence=" + heartbeatSequence + "\n"
                + "expires=" + leaseExpiresAtMs + "\n"
                + "integrity=" + integrityState + "\n"
                + "emergency=" + emergencyLevel + "\n"
                + "alerts=" + alertDeliveryState + "\n"
                + "policy=" + policyVersion + "\n"
                + "observed=" + observedAtMs + "\n";
    }

    public byte[] canonicalBytes() {
        return canonical().getBytes(StandardCharsets.UTF_8);
    }

    private static String safeToken(String value) {
        if (value == null) return "unknown";
        String v = value.trim();
        if (v.isEmpty()) return "unknown";
        return v.replace('\n', '_').replace('\r', '_').replace('=', '_');
    }
}
