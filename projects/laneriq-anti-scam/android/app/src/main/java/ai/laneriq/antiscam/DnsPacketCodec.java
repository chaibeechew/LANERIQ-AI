package ai.laneriq.antiscam;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

/** Minimal TUN packet codec for the DNS-only Web Shield data plane. */
public final class DnsPacketCodec {
    public static final class ParsedPacket {
        public final boolean ipv6;
        public final byte[] sourceAddress;
        public final byte[] destinationAddress;
        public final int sourcePort;
        public final int destinationPort;
        public final byte[] dnsPayload;

        ParsedPacket(boolean ipv6,
                     byte[] sourceAddress,
                     byte[] destinationAddress,
                     int sourcePort,
                     int destinationPort,
                     byte[] dnsPayload) {
            this.ipv6 = ipv6;
            this.sourceAddress = sourceAddress;
            this.destinationAddress = destinationAddress;
            this.sourcePort = sourcePort;
            this.destinationPort = destinationPort;
            this.dnsPayload = dnsPayload;
        }
    }

    private DnsPacketCodec() {}

    public static ParsedPacket parseUdpDns(byte[] packet, int length) {
        if (packet == null || length < 28 || length > packet.length) return null;
        int version = (packet[0] >>> 4) & 0x0f;
        if (version == 4) return parseIpv4(packet, length);
        if (version == 6) return parseIpv6(packet, length);
        return null;
    }

    private static ParsedPacket parseIpv4(byte[] packet, int length) {
        int ihl = (packet[0] & 0x0f) * 4;
        if (ihl < 20 || length < ihl + 8 || (packet[9] & 0xff) != 17) return null;
        int total = readU16(packet, 2);
        if (total < ihl + 8 || total > length) return null;
        int udpOffset = ihl;
        int udpLength = readU16(packet, udpOffset + 4);
        if (udpLength < 8 || udpOffset + udpLength > total) return null;
        int sourcePort = readU16(packet, udpOffset);
        int destinationPort = readU16(packet, udpOffset + 2);
        if (destinationPort != 53) return null;
        return new ParsedPacket(
                false,
                Arrays.copyOfRange(packet, 12, 16),
                Arrays.copyOfRange(packet, 16, 20),
                sourcePort,
                destinationPort,
                Arrays.copyOfRange(packet, udpOffset + 8, udpOffset + udpLength));
    }

    private static ParsedPacket parseIpv6(byte[] packet, int length) {
        if (length < 48 || (packet[6] & 0xff) != 17) return null; // no extension-header traversal in v1
        int payloadLength = readU16(packet, 4);
        if (payloadLength < 8 || 40 + payloadLength > length) return null;
        int udpOffset = 40;
        int udpLength = readU16(packet, udpOffset + 4);
        if (udpLength < 8 || udpOffset + udpLength > 40 + payloadLength) return null;
        int sourcePort = readU16(packet, udpOffset);
        int destinationPort = readU16(packet, udpOffset + 2);
        if (destinationPort != 53) return null;
        return new ParsedPacket(
                true,
                Arrays.copyOfRange(packet, 8, 24),
                Arrays.copyOfRange(packet, 24, 40),
                sourcePort,
                destinationPort,
                Arrays.copyOfRange(packet, udpOffset + 8, udpOffset + udpLength));
    }

    public static String firstQuestionName(byte[] dns) {
        if (dns == null || dns.length < 17 || readU16(dns, 4) < 1) return "";
        int cursor = 12;
        StringBuilder host = new StringBuilder();
        int labels = 0;
        while (cursor < dns.length) {
            int size = dns[cursor++] & 0xff;
            if (size == 0) break;
            if ((size & 0xc0) != 0 || size > 63 || cursor + size > dns.length || ++labels > 20) return "";
            if (host.length() > 0) host.append('.');
            for (int i = 0; i < size; i++) {
                int c = dns[cursor + i] & 0xff;
                if (c < 0x21 || c > 0x7e) return "";
            }
            host.append(new String(dns, cursor, size, StandardCharsets.US_ASCII));
            cursor += size;
            if (host.length() > 253) return "";
        }
        return host.toString().toLowerCase(Locale.US);
    }

    public static byte[] buildNxDomain(byte[] query) {
        if (query == null || query.length < 12) return null;
        byte[] response = Arrays.copyOf(query, query.length);
        response[2] = (byte) (0x80 | (query[2] & 0x79)); // response + preserve opcode/RD
        response[3] = (byte) 0x83; // RA + NXDOMAIN
        response[6] = 0; response[7] = 0; // ANCOUNT
        response[8] = 0; response[9] = 0; // NSCOUNT
        response[10] = 0; response[11] = 0; // ARCOUNT
        return response;
    }

    public static byte[] buildUdpResponse(ParsedPacket request, byte[] dnsResponse) {
        if (request == null || dnsResponse == null || dnsResponse.length < 12 || dnsResponse.length > 8192) return null;
        return request.ipv6 ? buildIpv6Response(request, dnsResponse) : buildIpv4Response(request, dnsResponse);
    }

    private static byte[] buildIpv4Response(ParsedPacket request, byte[] dns) {
        int udpLength = 8 + dns.length;
        int total = 20 + udpLength;
        byte[] out = new byte[total];
        out[0] = 0x45;
        out[1] = 0;
        writeU16(out, 2, total);
        writeU16(out, 4, 0);
        writeU16(out, 6, 0x4000);
        out[8] = 64;
        out[9] = 17;
        System.arraycopy(request.destinationAddress, 0, out, 12, 4);
        System.arraycopy(request.sourceAddress, 0, out, 16, 4);
        writeU16(out, 10, checksum(out, 0, 20));
        int udp = 20;
        writeU16(out, udp, request.destinationPort);
        writeU16(out, udp + 2, request.sourcePort);
        writeU16(out, udp + 4, udpLength);
        writeU16(out, udp + 6, 0); // UDP checksum optional for IPv4
        System.arraycopy(dns, 0, out, udp + 8, dns.length);
        return out;
    }

    private static byte[] buildIpv6Response(ParsedPacket request, byte[] dns) {
        int udpLength = 8 + dns.length;
        byte[] out = new byte[40 + udpLength];
        out[0] = 0x60;
        writeU16(out, 4, udpLength);
        out[6] = 17;
        out[7] = 64;
        System.arraycopy(request.destinationAddress, 0, out, 8, 16);
        System.arraycopy(request.sourceAddress, 0, out, 24, 16);
        int udp = 40;
        writeU16(out, udp, request.destinationPort);
        writeU16(out, udp + 2, request.sourcePort);
        writeU16(out, udp + 4, udpLength);
        writeU16(out, udp + 6, 0);
        System.arraycopy(dns, 0, out, udp + 8, dns.length);
        int checksum = udpChecksumIpv6(out, udp, udpLength);
        writeU16(out, udp + 6, checksum == 0 ? 0xffff : checksum);
        return out;
    }

    private static int udpChecksumIpv6(byte[] packet, int udpOffset, int udpLength) {
        long sum = 0;
        sum = addWords(sum, packet, 8, 16);
        sum = addWords(sum, packet, 24, 16);
        sum += (udpLength >>> 16) & 0xffff;
        sum += udpLength & 0xffff;
        sum += 17;
        sum = addWords(sum, packet, udpOffset, udpLength);
        return finalizeChecksum(sum);
    }

    private static long addWords(long sum, byte[] bytes, int offset, int length) {
        int end = offset + length;
        for (int i = offset; i + 1 < end; i += 2) {
            sum += ((bytes[i] & 0xff) << 8) | (bytes[i + 1] & 0xff);
        }
        if ((length & 1) != 0) sum += (bytes[end - 1] & 0xff) << 8;
        return sum;
    }

    private static int checksum(byte[] bytes, int offset, int length) {
        return finalizeChecksum(addWords(0, bytes, offset, length));
    }

    private static int finalizeChecksum(long sum) {
        while ((sum >>> 16) != 0) sum = (sum & 0xffff) + (sum >>> 16);
        return (int) (~sum) & 0xffff;
    }

    private static int readU16(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
    }

    private static void writeU16(byte[] bytes, int offset, int value) {
        bytes[offset] = (byte) ((value >>> 8) & 0xff);
        bytes[offset + 1] = (byte) (value & 0xff);
    }
}
