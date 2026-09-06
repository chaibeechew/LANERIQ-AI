import Foundation
import CryptoKit

struct LinkAssessment {
    let verdict: String
    let score: Int
    let reasons: [String]
}

enum SecurityEngine {
    static func assess(link rawInput: String) -> LinkAssessment {
        let raw = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = raw.contains("://") ? raw : "https://\(raw)"
        guard let components = URLComponents(string: normalized),
              let hostValue = components.host?.lowercased(),
              !hostValue.isEmpty else {
            return LinkAssessment(
                verdict: "INVALID / UNVERIFIED LINK",
                score: 100,
                reasons: ["Invalid or missing hostname"]
            )
        }

        let scheme = components.scheme?.lowercased() ?? ""
        let host = hostValue
        var score = 0
        var reasons: [String] = []

        if scheme != "https" {
            score += 35
            reasons.append("Connection is not HTTPS")
        }

        if host.hasPrefix("xn--") || host.contains(".xn--") {
            score += 25
            reasons.append("Punycode / look-alike domain risk")
        }

        let ipv4Pattern = #"^(?:\d{1,3}\.){3}\d{1,3}$"#
        if host.range(of: ipv4Pattern, options: .regularExpression) != nil {
            score += 30
            reasons.append("Direct IP-address link")
        }

        let lureFragments = ["login-", "secure-", "verify-", "wallet-", "banking-"]
        if lureFragments.contains(where: { host.contains($0) }) {
            score += 20
            reasons.append("Credential-lure naming pattern")
        }

        if raw.count > 180 {
            score += 15
            reasons.append("Unusually long URL")
        }

        let bounded = min(score, 100)
        let verdict: String
        if bounded >= 50 {
            verdict = "HIGH RISK — DO NOT OPEN"
        } else if bounded >= 25 {
            verdict = "CAUTION — VERIFY BEFORE OPENING"
        } else {
            verdict = "LOW LOCAL HEURISTIC RISK — CLOUD VERIFICATION STILL REQUIRED"
        }

        if reasons.isEmpty {
            reasons.append("No local heuristic red flags found")
        }
        return LinkAssessment(verdict: verdict, score: bounded, reasons: reasons)
    }

    static func sha256(of url: URL) throws -> (hash: String, size: Int64) {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        var hasher = SHA256()
        var total: Int64 = 0

        while true {
            let data = try handle.read(upToCount: 1024 * 1024) ?? Data()
            if data.isEmpty { break }
            hasher.update(data: data)
            total += Int64(data.count)
        }

        let digest = hasher.finalize()
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return (hex, total)
    }
}
