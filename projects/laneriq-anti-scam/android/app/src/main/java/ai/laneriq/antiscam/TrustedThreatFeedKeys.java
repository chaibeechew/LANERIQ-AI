package ai.laneriq.antiscam;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Public verification keys for signed Android threat-reputation evidence.
 *
 * Public keys are not secrets, but trust in them is release-sensitive. Production
 * releases must pin reviewed source ids -> X.509 SubjectPublicKeyInfo public keys
 * here (or generate an equivalent immutable build-time source) and attach release
 * evidence for the key provenance/rotation procedure.
 *
 * Production remains intentionally empty until a real reviewed feed is onboarded.
 * Debug builds may add exactly one internal-test key so real-device blocking can be
 * proven with cryptographic evidence instead of forged SharedPreferences state.
 */
public final class TrustedThreatFeedKeys {
    public static final String INTERNAL_TEST_SOURCE_ID = "laneriq-internal-test-feed";

    private TrustedThreatFeedKeys() {}

    public static Map<String, String> pinnedX509Base64BySource() {
        if (!BuildConfig.DEBUG) return Collections.emptyMap();
        String debugKey = BuildConfig.INTERNAL_TEST_THREAT_KEY_X509_B64;
        if (debugKey == null || debugKey.trim().isEmpty()) return Collections.emptyMap();
        HashMap<String, String> keys = new HashMap<>();
        keys.put(INTERNAL_TEST_SOURCE_ID, debugKey.trim());
        return Collections.unmodifiableMap(keys);
    }
}
