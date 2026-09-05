package ai.laneriq.antiscam;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.PermissionInfo;
import android.content.pm.ServiceInfo;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public final class SelectedApkInspector {
    private static final long MAX_APK_BYTES = 256L * 1024L * 1024L;

    public static final class Result {
        public final String packageName;
        public final String versionName;
        public final long versionCode;
        public final List<String> signerSha256;
        public final int dangerousPermissionCount;
        public final List<String> dangerousPermissions;
        public final boolean accessibilityServiceDeclared;
        public final boolean deviceAdminServiceDeclared;
        public final boolean overlayPermissionRequested;
        public final boolean remoteControlCapabilitySignal;

        Result(String packageName,
               String versionName,
               long versionCode,
               List<String> signerSha256,
               int dangerousPermissionCount,
               List<String> dangerousPermissions,
               boolean accessibilityServiceDeclared,
               boolean deviceAdminServiceDeclared,
               boolean overlayPermissionRequested) {
            this.packageName = packageName;
            this.versionName = versionName;
            this.versionCode = versionCode;
            this.signerSha256 = Collections.unmodifiableList(new ArrayList<>(signerSha256));
            this.dangerousPermissionCount = dangerousPermissionCount;
            this.dangerousPermissions = Collections.unmodifiableList(new ArrayList<>(dangerousPermissions));
            this.accessibilityServiceDeclared = accessibilityServiceDeclared;
            this.deviceAdminServiceDeclared = deviceAdminServiceDeclared;
            this.overlayPermissionRequested = overlayPermissionRequested;
            this.remoteControlCapabilitySignal = accessibilityServiceDeclared
                    || deviceAdminServiceDeclared
                    || overlayPermissionRequested;
        }
    }

    private SelectedApkInspector() {}

    public static Result inspect(Context context, Uri uri) throws Exception {
        if (context == null || uri == null) throw new IllegalArgumentException("context/uri required");
        File temp = File.createTempFile("laneriq-selected-", ".apk", context.getCacheDir());
        try {
            copyBounded(context, uri, temp);
            PackageManager pm = context.getPackageManager();
            int flags = PackageManager.GET_PERMISSIONS | PackageManager.GET_SERVICES;
            if (Build.VERSION.SDK_INT >= 28) flags |= PackageManager.GET_SIGNING_CERTIFICATES;
            else flags |= PackageManager.GET_SIGNATURES;

            PackageInfo info = pm.getPackageArchiveInfo(temp.getAbsolutePath(), flags);
            if (info == null || info.packageName == null) throw new IllegalArgumentException("not a readable APK package");

            List<String> signers = signerDigests(info);
            List<String> dangerous = dangerousPermissions(pm, info.requestedPermissions);
            boolean accessibility = false;
            boolean deviceAdmin = false;
            if (info.services != null) {
                for (ServiceInfo service : info.services) {
                    if (service == null || service.permission == null) continue;
                    if (Manifest.permission.BIND_ACCESSIBILITY_SERVICE.equals(service.permission)) accessibility = true;
                    if (Manifest.permission.BIND_DEVICE_ADMIN.equals(service.permission)) deviceAdmin = true;
                }
            }
            boolean overlay = contains(info.requestedPermissions, Manifest.permission.SYSTEM_ALERT_WINDOW);
            long versionCode = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            return new Result(
                    info.packageName,
                    info.versionName == null ? "unknown" : info.versionName,
                    versionCode,
                    signers,
                    dangerous.size(),
                    dangerous,
                    accessibility,
                    deviceAdmin,
                    overlay);
        } finally {
            //noinspection ResultOfMethodCallIgnored
            temp.delete();
        }
    }

    private static void copyBounded(Context context, Uri uri, File target) throws Exception {
        long total = 0L;
        try (InputStream in = context.getContentResolver().openInputStream(uri);
             FileOutputStream out = new FileOutputStream(target)) {
            if (in == null) throw new IllegalArgumentException("selected file cannot be opened");
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > MAX_APK_BYTES) throw new IllegalArgumentException("APK exceeds local inspection size limit");
                out.write(buffer, 0, read);
            }
        }
    }

    private static List<String> signerDigests(PackageInfo info) throws Exception {
        List<String> out = new ArrayList<>();
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= 28 && info.signingInfo != null) {
            signatures = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
        } else {
            //noinspection deprecation
            signatures = info.signatures;
        }
        if (signatures == null) return out;
        for (Signature signature : signatures) {
            if (signature == null) continue;
            out.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        }
        return out;
    }

    private static List<String> dangerousPermissions(PackageManager pm, String[] requested) {
        List<String> out = new ArrayList<>();
        if (requested == null) return out;
        for (String permission : requested) {
            if (permission == null) continue;
            try {
                PermissionInfo pi = pm.getPermissionInfo(permission, 0);
                int base = pi.protectionLevel & PermissionInfo.PROTECTION_MASK_BASE;
                if (base == PermissionInfo.PROTECTION_DANGEROUS) out.add(permission);
            } catch (Exception ignored) {
                // Unknown/custom permission is not automatically classified as dangerous.
            }
        }
        return out;
    }

    private static boolean contains(String[] values, String target) {
        if (values == null || target == null) return false;
        for (String value : values) if (target.equals(value)) return true;
        return false;
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b & 0xff));
        return sb.toString();
    }
}
