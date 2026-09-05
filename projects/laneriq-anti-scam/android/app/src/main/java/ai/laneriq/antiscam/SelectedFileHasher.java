package ai.laneriq.antiscam;

import android.content.ContentResolver;
import android.net.Uri;

import java.io.InputStream;
import java.security.MessageDigest;

public final class SelectedFileHasher {
    private SelectedFileHasher() {}

    public static String sha256(ContentResolver resolver, Uri uri) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) throw new IllegalArgumentException("Unable to open selected file");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        StringBuilder out = new StringBuilder(64);
        for (byte b : digest.digest()) out.append(String.format("%02x", b & 0xff));
        return out.toString();
    }
}
