package ai.laneriq.antiscam;

import java.util.Collections;
import java.util.Map;

/**
 * Public verification keys for signed Android threat-reputation evidence.
 *
 * Public keys are not secrets, but trust in them is release-sensitive. Production
 * releases must pin reviewed source ids -> X.509 SubjectPublicKeyInfo public keys
 * here (or generate an equivalent immutable build-time source) and attach release
 * evidence for the key provenance/rotation procedure.
 *
 * The default map is intentionally empty. Therefore no remote feed can manufacture
 * a strong KNOWN_MALICIOUS verdict until a real feed key is deliberately pinned.
 */
public final class TrustedThreatFeedKeys {
    private TrustedThreatFeedKeys() {}

    public static Map<String, String> pinnedX509Base64BySource() {
        return Collections.emptyMap();
    }
}
