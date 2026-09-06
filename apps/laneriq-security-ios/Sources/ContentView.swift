import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class SecurityViewModel: ObservableObject {
    @Published var statusTitle = "Protection status"
    @Published var statusBody = "Checking LANERIQ Production Truth…"
    @Published var statusLevel = "CHECKING"

    private let truthURL = URL(string: "https://laneriq-malware-defense.vercel.app/api/truth-status")!

    func assess(link: String) {
        guard !link.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            statusTitle = "SafeLink"
            statusLevel = "INPUT REQUIRED"
            statusBody = "Paste or type a link first."
            return
        }

        let result = SecurityEngine.assess(link: link)
        statusTitle = "SafeLink result"
        statusLevel = result.score >= 50 ? "HIGH RISK" : result.score >= 25 ? "CAUTION" : "LOW LOCAL RISK"
        let reasons = result.reasons.map { "• \($0)" }.joined(separator: "\n")
        statusBody = "\(result.verdict)\nRisk score: \(result.score)/100\n\(reasons)\n\nLocal heuristics alone never prove a link is safe."
    }

    func scan(file url: URL) async {
        statusTitle = "File scan"
        statusLevel = "SCANNING"
        statusBody = "Computing local SHA-256 fingerprint…"

        let scoped = url.startAccessingSecurityScopedResource()
        defer {
            if scoped { url.stopAccessingSecurityScopedResource() }
        }

        do {
            let result = try await Task.detached(priority: .userInitiated) {
                try SecurityEngine.sha256(of: url)
            }.value

            statusTitle = "File scan"
            statusLevel = "UNVERIFIED"
            statusBody = "Fingerprint complete\nSize: \(result.size) bytes\nSHA-256:\n\(result.hash)\n\nThe selected file was fingerprinted locally. LANERIQ does not issue a CLEAN verdict without sufficient scanner evidence."
        } catch {
            statusTitle = "File scan"
            statusLevel = "FAIL CLOSED"
            statusBody = "Unable to fingerprint the selected file. No CLEAN claim was issued."
        }
    }

    func bankingSafety() {
        statusTitle = "Banking Safety"
        statusLevel = "GUIDED CHECK"
        statusBody = "Before banking:\n• Do not continue after installing an unknown profile or app.\n• End unexpected screen-sharing or remote-support sessions.\n• Verify the bank app identity and destination account independently.\n• Treat unexpected OTP, password-reset, SIM or notification prompts as suspicious.\n\niOS does not expose unrestricted system-wide malware scanning to normal App Store apps, so LANERIQ will not claim BANKING_SAFE without sufficient evidence."
    }

    func refreshTruth() async {
        statusTitle = "Protection status"
        statusLevel = "CHECKING"
        statusBody = "Checking LANERIQ Production Truth…"

        do {
            var request = URLRequest(url: truthURL)
            request.timeoutInterval = 8
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
            let body = String(data: data, encoding: .utf8) ?? ""

            let fifteen = body.contains("\"financialScamDefenseLayerCount\":15") || body.contains("\"layerCount\":15")
            let privacy = body.contains("\"rawMalwareBinaryStoredByDefault\":false")
            let noGuarantee = body.contains("\"guaranteedTheftPreventionClaimAllowed\":false")

            statusTitle = "Production Protection"
            statusLevel = http.statusCode >= 200 && http.statusCode < 300 ? "CONNECTED" : "EVIDENCE REQUIRED"
            statusBody = "HTTP \(http.statusCode)\n15-layer Financial Scam Defense: \(fifteen ? "VERIFIED" : "EVIDENCE REQUIRED")\nPrivacy-preserving malware handling: \(privacy ? "VERIFIED" : "EVIDENCE REQUIRED")\n100% theft-prevention guarantee claimed: \(noGuarantee ? "NO — correct Truth Gate" : "UNVERIFIED")\n\nScanner-provider CLEAN evidence remains governed by Production Truth."
        } catch {
            statusTitle = "Protection status"
            statusLevel = "FAIL CLOSED"
            statusBody = "Production Truth is unavailable. LANERIQ will not assume CLEAN or BANKING_SAFE."
        }
    }
}

struct ContentView: View {
    @StateObject private var model = SecurityViewModel()
    @State private var linkText = ""
    @State private var showingFileImporter = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    truthGate
                    statusCard
                    safeLinkCard
                    actionGrid
                    scopeCard
                }
                .padding(20)
            }
            .background(
                LinearGradient(
                    colors: [Color(.systemBackground), Color(.secondarySystemBackground)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .navigationBarHidden(true)
        }
        .task { await model.refreshTruth() }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [.item],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                Task { await model.scan(file: url) }
            case .failure:
                model.statusTitle = "File scan"
                model.statusLevel = "CANCELLED"
                model.statusBody = "No file was selected."
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("LANERIQ Anti Scam")
                .font(.system(size: 34, weight: .bold, design: .rounded))
            Text("iOS Beta • Anti-Scam, Phishing & Malware Defense")
                .foregroundStyle(.secondary)
            Text("v0.1.0")
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
        }
    }

    private var truthGate: some View {
        Label("Truth Gate: no sufficient scanner evidence = no CLEAN claim", systemImage: "shield.lefthalf.filled")
            .font(.footnote.weight(.semibold))
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(model.statusTitle)
                    .font(.title3.bold())
                Spacer()
                Text(model.statusLevel)
                    .font(.caption.bold())
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(.thinMaterial, in: Capsule())
            }
            Text(model.statusBody)
                .font(.subheadline)
                .textSelection(.enabled)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
    }

    private var safeLinkCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("SafeLink")
                .font(.headline)
            TextField("Paste a link, e.g. https://bank.example", text: $linkText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .textFieldStyle(.roundedBorder)
            Button {
                model.assess(link: linkText)
            } label: {
                Label("Check Link / Phishing Risk", systemImage: "link.badge.plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
    }

    private var actionGrid: some View {
        VStack(spacing: 12) {
            Button {
                showingFileImporter = true
            } label: {
                actionLabel("Scan File Fingerprint", icon: "doc.badge.magnifyingglass")
            }
            .buttonStyle(.bordered)

            Button {
                model.bankingSafety()
            } label: {
                actionLabel("Banking Safety Check", icon: "building.columns.fill")
            }
            .buttonStyle(.bordered)

            Button {
                Task { await model.refreshTruth() }
            } label: {
                actionLabel("Refresh Protection Status", icon: "arrow.clockwise.shield")
            }
            .buttonStyle(.bordered)
        }
    }

    private func actionLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .frame(maxWidth: .infinity, minHeight: 42)
    }

    private var scopeCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("LANERIQ Anti Scam iOS Beta scope")
                .font(.headline)
            Text("SafeLink • phishing-risk heuristics • user-selected file fingerprinting • Production Truth • banking-safety guidance • privacy-first fail-closed decisions")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Divider()
            Text("This beta does not claim unrestricted background file scanning, guaranteed theft prevention, or a CLEAN verdict without verified evidence.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
    }
}
