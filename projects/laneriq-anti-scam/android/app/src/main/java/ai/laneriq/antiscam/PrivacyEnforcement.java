package ai.laneriq.antiscam;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public final class PrivacyEnforcement {
    private static final Set<String> ALLOWED_DEFAULT_FIELDS = new HashSet<>(Arrays.asList(
            "event_type",
            "risk_level",
            "threat_fingerprint",
            "domain_hash",
            "file_hash",
            "policy_version",
            "engine_version",
            "region",
            "pseudonymous_installation_id",
            "occurred_at_bucket"
    ));

    private static final Set<String> FORBIDDEN_DEFAULT_FIELDS = new HashSet<>(Arrays.asList(
            "password",
            "cookie",
            "auth_token",
            "private_key",
            "clipboard",
            "raw_message",
            "full_browsing_history",
            "contact_list",
            "photo",
            "video",
            "microphone_audio",
            "screen_content"
    ));

    private PrivacyEnforcement() {}

    public static boolean mayUploadByDefault(String field) {
        if (field == null) return false;
        String normalized = field.trim().toLowerCase();
        if (FORBIDDEN_DEFAULT_FIELDS.contains(normalized)) return false;
        return ALLOWED_DEFAULT_FIELDS.contains(normalized);
    }

    public static boolean requiresSeparateExplicitConsent(String field) {
        if (field == null) return true;
        String normalized = field.trim().toLowerCase();
        return !ALLOWED_DEFAULT_FIELDS.contains(normalized);
    }

    public static boolean isAlwaysForbiddenForThreatTelemetry(String field) {
        if (field == null) return true;
        return FORBIDDEN_DEFAULT_FIELDS.contains(field.trim().toLowerCase());
    }
}
