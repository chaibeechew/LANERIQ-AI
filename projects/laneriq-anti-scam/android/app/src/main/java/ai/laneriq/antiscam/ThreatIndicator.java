package ai.laneriq.antiscam;

import java.net.IDN;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.regex.Pattern;

public final class ThreatIndicator {
    private static final Pattern SHA256 = Pattern.compile("^[0-9a-f]{64}$");

    private ThreatIndicator() {}

    public static String domainHash(String domain) {
        if (domain == null) throw new IllegalArgumentException("domain required");
        String normalized = domain.trim().toLowerCase(Locale.US);
        if (normalized.endsWith(".")) normalized = normalized.substring(0, normalized.length() - 1);
        if (normalized.isEmpty() || normalized.contains("/") || normalized.contains("://")) {
            throw new IllegalArgumentException("host/domain only; raw URL is not accepted");
        }
        normalized = IDN.toASCII(normalized, IDN.USE_STD3_ASCII_RULES).toLowerCase(Locale.US);
        return sha256("domain-v1:" + normalized);
    }

    public static String canonicalFileHash(String sha256) {
        if (sha256 == null) throw new IllegalArgumentException("file hash required");
        String normalized = sha256.trim().toLowerCase(Locale.US);
        if (!SHA256.matcher(normalized).matches()) throw new IllegalArgumentException("invalid SHA-256");
        return normalized;
    }

    public static boolean looksLikeSha256(String value) {
        return value != null && SHA256.matcher(value.trim().toLowerCase(Locale.US)).matches();
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format(Locale.US, "%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
