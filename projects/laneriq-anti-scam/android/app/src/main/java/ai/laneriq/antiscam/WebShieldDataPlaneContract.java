package ai.laneriq.antiscam;

/**
 * L1 fail-closed production boundary.
 *
 * The Android VPN control-plane may exist before the packet/data-plane is safe
 * to ship. This contract deliberately keeps system-wide blocking disabled
 * until the real forwarding/filter engine is implemented and verified on real
 * devices. Do not flip this to true to satisfy a UI or CI check.
 */
public final class WebShieldDataPlaneContract {
    private WebShieldDataPlaneContract() {}

    public static boolean isProductionDataPlaneReady() {
        return false;
    }

    public static String reason() {
        return "network data-plane not yet externally verified";
    }
}
