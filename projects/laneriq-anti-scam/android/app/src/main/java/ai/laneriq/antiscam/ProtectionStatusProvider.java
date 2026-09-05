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
            "lease_expires_at_ms",
            "heartbeat_sequence",
            "local_risk_level",
            "active_engine_set",
            "policy_version",
            "emergency_level",
            "emergency_expires_at_ms",
            "system_web_shield_state"
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
        NetworkProtectionCapability.State network = NetworkProtectionCapability.evaluate(
                new NetworkProtectionCapability.Evidence(
                        false,
                        lease.userOptedIn,
                        false,
                        false,
                        false,
                        true));

        MatrixCursor cursor = new MatrixCursor(COLUMNS, 1);
        cursor.addRow(new Object[] {
                3,
                lease.state.name(),
                lease.mayClaimGuardianActive() ? 1 : 0,
                lease.sameBootSession ? 1 : 0,
                lease.expiresAtMs,
                lease.heartbeatSequence,
                lease.localRiskLevel,
                lease.activeEngineSet,
                lease.policyVersion,
                emergency.level.name(),
                emergency.active ? emergency.expiresAtMs : 0L,
                network.name()
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
