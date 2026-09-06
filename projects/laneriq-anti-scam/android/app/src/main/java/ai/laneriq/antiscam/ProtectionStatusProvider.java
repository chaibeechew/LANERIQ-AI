package ai.laneriq.antiscam;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;

/**
 * Read-only, signature-permission-protected companion status surface for other
 * LANERIQ apps. It deliberately exposes only minimal protection state and no
 * raw local event log, stable installation identifier, URLs, package history,
 * or private user content.
 */
public final class ProtectionStatusProvider extends ContentProvider {
    public static final String PATH_STATUS = "status";
    private static final String MIME = "vnd.android.cursor.item/vnd.laneriq.antiscam.protection-status";

    private static final String[] COLUMNS = new String[] {
            "schema_version",
            "state",
            "claimable_active",
            "same_boot_session",
            "user_opted_in",
            "lease_expires_at_ms",
            "heartbeat_sequence",
            "local_risk_level",
            "active_engine_set",
            "policy_version",
            "emergency_level",
            "emergency_expires_at_ms",
            "system_web_shield_state",
            "integrity_state",
            "unexpected_protection_loss",
            "freeze_sensitive_laneriq_actions",
            "self_integrity_state",
            "self_integrity_continuity_acceptable",
            "alert_delivery_state",
            "alert_delivery_available",
            "last_stop_reason"
    };

    @Override public boolean onCreate() {
        return true;
    }

    @Override public Cursor query(
            Uri uri,
            String[] projection,
            String selection,
            String[] selectionArgs,
            String sortOrder) {
        if (uri == null || !PATH_STATUS.equals(uri.getLastPathSegment())) {
            throw new IllegalArgumentException("Unsupported protection status path");
        }
        if (getContext() == null) {
            throw new IllegalStateException("Provider context unavailable");
        }

        ProtectionLeaseStore.Lease lease = new ProtectionLeaseStore(getContext()).read();
        EmergencyModeStore.State emergency = new EmergencyModeStore(getContext()).read();
        GuardianIntegrityPolicy.Decision integrity = GuardianIntegrityPolicy.evaluate(lease);
        AppSelfIntegrityStore.Result selfIntegrity = new AppSelfIntegrityStore(getContext()).probe();
        AlertDeliveryIntegrity.Decision alertDelivery = AlertDeliveryIntegrity.capture(getContext());
        NetworkProtectionCapability.State network = NetworkProtectionCapability.evaluate(
                new NetworkProtectionCapability.Evidence(
                        false,
                        lease.userOptedIn,
                        false,
                        false,
                        false,
                        true));

        boolean claimable = lease.mayClaimGuardianActive()
                && integrity.mayClaimProtected
                && selfIntegrity.continuityAcceptable;
        boolean freezeSensitive = integrity.freezeSensitiveLaneriqActions
                || selfIntegrity.unexpectedSignerChange
                || emergency.level == EmergencyModeStore.Level.URGENT;

        MatrixCursor cursor = new MatrixCursor(COLUMNS, 1);
        cursor.addRow(new Object[] {
                6,
                lease.state.name(),
                claimable ? 1 : 0,
                lease.sameBootSession ? 1 : 0,
                lease.userOptedIn ? 1 : 0,
                lease.expiresAtMs,
                lease.heartbeatSequence,
                lease.localRiskLevel,
                lease.activeEngineSet,
                lease.policyVersion,
                emergency.level.name(),
                emergency.active ? emergency.expiresAtMs : 0L,
                network.name(),
                integrity.state.name(),
                integrity.unexpectedProtectionLoss ? 1 : 0,
                freezeSensitive ? 1 : 0,
                selfIntegrity.state.name(),
                selfIntegrity.continuityAcceptable ? 1 : 0,
                alertDelivery.state.name(),
                alertDelivery.mayClaimUserAlertsAvailable ? 1 : 0,
                lease.lastStopReason == null ? "" : lease.lastStopReason
        });
        return cursor;
    }

    @Override public String getType(Uri uri) {
        if (uri != null && PATH_STATUS.equals(uri.getLastPathSegment())) return MIME;
        return null;
    }

    @Override public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Protection status provider is read-only");
    }

    @Override public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Protection status provider is read-only");
    }

    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Protection status provider is read-only");
    }
}
