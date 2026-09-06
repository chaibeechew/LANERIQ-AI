package ai.laneriq.antiscam;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * DNS-only internal-test data plane.
 *
 * It routes only LANERIQ's virtual DNS addresses into the TUN. Normal IP
 * traffic is not routed through this engine. This can stop known-malicious
 * domains for apps using Android's configured DNS path, but it is NOT proof of
 * blocking direct-IP traffic, app-owned DoH/DoT, every IPv6 extension-header
 * case or a full system-wide firewall.
 */
public final class WebShieldDnsDataPlane implements AutoCloseable {
    private static final String DNS4_LOCAL = "10.111.222.1";
    private static final String DNS4_VIRTUAL = "10.111.222.2";
    private static final String DNS6_LOCAL = "fd66:6c61:6e65::1";
    private static final String DNS6_VIRTUAL = "fd66:6c61:6e65::2";

    private static final class UpstreamDnsEndpoint {
        final Network network;
        final InetAddress address;

        UpstreamDnsEndpoint(Network network, InetAddress address) {
            this.network = network;
            this.address = address;
        }
    }

    private final VpnService service;
    private final WebShieldStateStore stateStore;
    private final LocalEventStore eventStore;
    private final LocalThreatReputationStore reputationStore;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private ParcelFileDescriptor tun;
    private Thread worker;

    public WebShieldDnsDataPlane(VpnService service) {
        if (service == null) throw new IllegalArgumentException("VpnService required");
        this.service = service;
        this.stateStore = new WebShieldStateStore(service);
        this.eventStore = new LocalEventStore(service);
        this.reputationStore = new LocalThreatReputationStore(service);
    }

    public boolean startInternalTest() {
        if (!BuildConfig.DEBUG) throw new SecurityException("Internal DNS Shield data plane is debug-only until L1 release evidence passes");
        if (running.get()) return true;
        if (VpnService.prepare(service) != null) return false;
        if (currentUpstreamDnsServers().isEmpty()) {
            stateStore.markTunnel(false, false, false, "no-physical-upstream-dns");
            return false;
        }

        VpnService.Builder builder = service.new Builder()
                .setSession("LANERIQ Anti Scam • Internal DNS Shield")
                .setMtu(1500)
                .setBlocking(true)
                .addAddress(DNS4_LOCAL, 24)
                .addRoute(DNS4_VIRTUAL, 32)
                .addDnsServer(DNS4_VIRTUAL);
        try {
            builder.addAddress(DNS6_LOCAL, 64)
                    .addRoute(DNS6_VIRTUAL, 128)
                    .addDnsServer(DNS6_VIRTUAL);
        } catch (Exception ipv6Unavailable) {
            eventStore.recordOnce("web_shield_ipv6_setup_degraded", ipv6Unavailable.getClass().getSimpleName(), 60_000L);
        }

        tun = builder.establish();
        if (tun == null) {
            stateStore.markTunnel(false, false, false, "vpn-establish-returned-null");
            return false;
        }

        running.set(true);
        stateStore.markTunnel(true, true, false, "internal-dns-shield-test-active-unverified-policy");
        worker = new Thread(this::runLoop, "laneriq-web-shield-dns");
        worker.setDaemon(true);
        worker.start();
        return true;
    }

    public boolean isRunning() {
        return running.get();
    }

    private void runLoop() {
        byte[] packet = new byte[16_384];
        try (FileInputStream in = new FileInputStream(tun.getFileDescriptor());
             FileOutputStream out = new FileOutputStream(tun.getFileDescriptor())) {
            while (running.get()) {
                int length = in.read(packet);
                if (length <= 0) continue;
                DnsPacketCodec.ParsedPacket request = DnsPacketCodec.parseUdpDns(packet, length);
                if (request == null) continue;

                String domain = DnsPacketCodec.firstQuestionName(request.dnsPayload);
                if (domain.isEmpty()) continue;
                String fingerprint;
                try { fingerprint = ThreatIndicator.domainHash(domain); }
                catch (Exception ignored) { fingerprint = "invalid-domain"; }

                LocalThreatReputationStore.Entry reputation;
                try { reputation = reputationStore.lookupDomain(domain); }
                catch (Exception e) { reputation = null; }

                boolean signedKnownMalicious = reputation != null
                        && reputation.verdict == LocalThreatReputationStore.Verdict.KNOWN_MALICIOUS
                        && reputation.verifiedStrongEvidence;

                byte[] dnsResponse;
                if (signedKnownMalicious) {
                    dnsResponse = DnsPacketCodec.buildNxDomain(request.dnsPayload);
                    eventStore.recordOnce("web_shield_dns_block", fingerprint, 30_000L);
                } else {
                    SafeWebEvaluator.Result heuristic = SafeWebEvaluator.evaluate("https://" + domain);
                    if (heuristic.score >= 70) {
                        eventStore.recordOnce("web_shield_dns_heuristic_review", fingerprint, 60_000L);
                    }
                    dnsResponse = queryUpstream(request.dnsPayload);
                }

                if (dnsResponse == null) {
                    stateStore.markTunnel(true, false, false, "upstream-dns-unavailable");
                    eventStore.recordOnce("web_shield_dns_upstream_unavailable", fingerprint, 60_000L);
                    continue;
                }
                byte[] responsePacket = DnsPacketCodec.buildUdpResponse(request, dnsResponse);
                if (responsePacket != null) {
                    out.write(responsePacket);
                    out.flush();
                    stateStore.markTunnel(true, true, false, "internal-dns-shield-test-active-unverified-policy");
                }
            }
        } catch (Exception e) {
            if (running.get()) {
                eventStore.recordOnce("web_shield_dns_engine_failure", e.getClass().getSimpleName(), 60_000L);
                stateStore.markTunnel(false, false, false, "dns-engine-failure");
            }
        } finally {
            running.set(false);
        }
    }

    private byte[] queryUpstream(byte[] dnsQuery) {
        for (UpstreamDnsEndpoint endpoint : currentUpstreamDnsServers()) {
            try (DatagramSocket socket = new DatagramSocket()) {
                if (!service.protect(socket)) continue;
                endpoint.network.bindSocket(socket);
                service.setUnderlyingNetworks(new Network[]{endpoint.network});
                socket.connect(endpoint.address, 53);
                socket.setSoTimeout(2500);
                socket.send(new DatagramPacket(dnsQuery, dnsQuery.length));
                byte[] buffer = new byte[8192];
                DatagramPacket response = new DatagramPacket(buffer, buffer.length);
                socket.receive(response);
                if (response.getLength() < 12) continue;
                if (!sameDnsTransaction(dnsQuery, response.getData(), response.getOffset(), response.getLength())) continue;
                byte[] result = new byte[response.getLength()];
                System.arraycopy(response.getData(), response.getOffset(), result, 0, response.getLength());
                return result;
            } catch (SocketTimeoutException timeout) {
                // Try the next physical network DNS server.
            } catch (Exception ignored) {
                // Try the next server; if all fail, caller marks engine degraded.
            }
        }
        return null;
    }

    private boolean sameDnsTransaction(byte[] query, byte[] response, int offset, int length) {
        return query != null
                && query.length >= 2
                && response != null
                && length >= 2
                && offset >= 0
                && offset + 1 < response.length
                && query[0] == response[offset]
                && query[1] == response[offset + 1];
    }

    private List<UpstreamDnsEndpoint> currentUpstreamDnsServers() {
        ArrayList<UpstreamDnsEndpoint> result = new ArrayList<>();
        ConnectivityManager cm = (ConnectivityManager) service.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return result;

        Network preferred = cm.getActiveNetwork();
        if (preferred != null) collectNetworkDns(cm, preferred, result);
        for (Network network : cm.getAllNetworks()) {
            if (network == null || network.equals(preferred)) continue;
            collectNetworkDns(cm, network, result);
        }
        return result;
    }

    private void collectNetworkDns(ConnectivityManager cm,
                                   Network network,
                                   List<UpstreamDnsEndpoint> result) {
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        if (caps == null
                || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return;
        LinkProperties links = cm.getLinkProperties(network);
        if (links == null) return;
        for (InetAddress dns : links.getDnsServers()) {
            if (dns == null || containsEndpoint(result, network, dns)) continue;
            result.add(new UpstreamDnsEndpoint(network, dns));
        }
    }

    private boolean containsEndpoint(List<UpstreamDnsEndpoint> endpoints,
                                     Network network,
                                     InetAddress address) {
        for (UpstreamDnsEndpoint endpoint : endpoints) {
            if (endpoint.network.equals(network) && endpoint.address.equals(address)) return true;
        }
        return false;
    }

    @Override public void close() {
        running.set(false);
        if (tun != null) {
            try { tun.close(); } catch (Exception ignored) {}
            tun = null;
        }
        if (worker != null) {
            worker.interrupt();
            worker = null;
        }
        try { service.setUnderlyingNetworks(null); } catch (Exception ignored) {}
        stateStore.markStopped("dns-data-plane-stopped");
    }
}
