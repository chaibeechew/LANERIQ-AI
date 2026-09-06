package ai.laneriq.antiscam;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

public final class SafeWebEvaluator {
    public enum Decision { ALLOW_WITH_CAUTION, WARN, BLOCK }

    public static final class Result {
        public final Decision decision;
        public final int score;
        public final String reason;

        Result(Decision decision, int score, String reason) {
            this.decision = decision;
            this.score = score;
            this.reason = reason;
        }
    }

    private static final Pattern IPV4 = Pattern.compile("^(?:\\d{1,3}\\.){3}\\d{1,3}$");
    private static final String[] PHISHING_WORDS = new String[] {
            "verify", "verification", "wallet", "bank", "secure-login", "account-update",
            "unlock", "suspend", "refund", "payment", "invoice", "support", "crypto", "seed"
    };

    private SafeWebEvaluator() {}

    public static Result evaluate(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return new Result(Decision.WARN, 50, "No URL provided");
        }

        String candidate = raw.trim();
        if (!candidate.contains("://")) candidate = "https://" + candidate;
        URI uri;
        try {
            uri = new URI(candidate);
        } catch (Exception e) {
            return new Result(Decision.BLOCK, 100, "Malformed destination");
        }

        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.US);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.US);
        String full = candidate.toLowerCase(Locale.US);
        if (!("http".equals(scheme) || "https".equals(scheme)) || host.isEmpty()) {
            return new Result(Decision.BLOCK, 100, "Unsupported or malformed web destination");
        }

        int score = 0;
        StringBuilder reasons = new StringBuilder();
        if (!"https".equals(scheme)) score = add(score, 20, reasons, "not HTTPS");
        if (IPV4.matcher(host).matches()) score = add(score, 30, reasons, "raw IP host");
        if (host.contains("xn--")) score = add(score, 25, reasons, "punycode domain");
        if (host.length() > 45) score = add(score, 12, reasons, "very long host");
        if (host.chars().filter(ch -> ch == '-').count() >= 4) score = add(score, 15, reasons, "many hyphens");
        if (full.contains("@")) score = add(score, 25, reasons, "credential-like URL syntax");
        if (full.contains("redirect=") || full.contains("url=http")) score = add(score, 12, reasons, "redirect parameter");
        for (String word : PHISHING_WORDS) {
            if (host.contains(word) || path.contains(word)) {
                score = add(score, 8, reasons, "phishing-style wording");
                break;
            }
        }

        score = Math.min(100, score);
        if (score >= 65) return new Result(Decision.BLOCK, score, reasons.length() == 0 ? "high local risk" : reasons.toString());
        if (score >= 30) return new Result(Decision.WARN, score, reasons.length() == 0 ? "review required" : reasons.toString());
        return new Result(Decision.ALLOW_WITH_CAUTION, score,
                "No high-risk signal found in this local check. This is not proof the site is safe.");
    }

    private static int add(int score, int delta, StringBuilder reasons, String reason) {
        if (reasons.length() > 0) reasons.append(" • ");
        reasons.append(reason);
        return score + delta;
    }
}
