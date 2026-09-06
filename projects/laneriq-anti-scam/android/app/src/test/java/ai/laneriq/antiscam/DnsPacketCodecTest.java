package ai.laneriq.antiscam;

import org.junit.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.Assert.*;

public class DnsPacketCodecTest {
    private static byte[] dnsQuery(String host) {
        byte[] labels = encodeLabels(host);
        byte[] dns = new byte[12 + labels.length + 4];
        dns[0] = 0x12;
        dns[1] = 0x34;
        dns[2] = 0x01; // RD
        dns[5] = 0x01; // QDCOUNT=1
        System.arraycopy(labels, 0, dns, 12, labels.length);
        int q = 12 + labels.length;
        dns[q] = 0x00; dns[q + 1] = 0x01; // A
        dns[q + 2] = 0x00; dns[q + 3] = 0x01; // IN
        return dns;
    }

    private static byte[] encodeLabels(String host) {
        String[] labels = host.split("\\.");
        int size = 1;
        for (String label : labels) size += 1 + label.length();
        byte[] out = new byte[size];
        int cursor = 0;
        for (String label : labels) {
            byte[] bytes = label.getBytes(StandardCharsets.US_ASCII);
            out[cursor++] = (byte) bytes.length;
            System.arraycopy(bytes, 0, out, cursor, bytes.length);
            cursor += bytes.length;
        }
        out[cursor] = 0;
        return out;
    }

    @Test public void extractsFirstDnsQuestionName() {
        assertEquals("login.example.com", DnsPacketCodec.firstQuestionName(dnsQuery("Login.Example.COM")));
    }

    @Test public void nxdomainPreservesTransactionAndQuestion() {
        byte[] query = dnsQuery("bad.example");
        byte[] response = DnsPacketCodec.buildNxDomain(query);
        assertNotNull(response);
        assertEquals(query[0], response[0]);
        assertEquals(query[1], response[1]);
        assertTrue((response[2] & 0x80) != 0);
        assertEquals(3, response[3] & 0x0f);
        assertEquals("bad.example", DnsPacketCodec.firstQuestionName(response));
    }

    @Test public void parsesIpv4UdpDnsAndBuildsReturnPacket() {
        byte[] dns = dnsQuery("example.com");
        byte[] packet = ipv4Query(dns);
        DnsPacketCodec.ParsedPacket parsed = DnsPacketCodec.parseUdpDns(packet, packet.length);
        assertNotNull(parsed);
        assertFalse(parsed.ipv6);
        assertEquals(53000, parsed.sourcePort);
        assertEquals(53, parsed.destinationPort);
        assertEquals("example.com", DnsPacketCodec.firstQuestionName(parsed.dnsPayload));

        byte[] answer = DnsPacketCodec.buildNxDomain(parsed.dnsPayload);
        byte[] response = DnsPacketCodec.buildUdpResponse(parsed, answer);
        assertNotNull(response);
        assertEquals(4, (response[0] >>> 4) & 0x0f);
        assertArrayEquals(new byte[]{10, 111, (byte) 222, 2}, slice(response, 12, 16));
        assertArrayEquals(new byte[]{10, 111, (byte) 222, 1}, slice(response, 16, 20));
        assertEquals(53, u16(response, 20));
        assertEquals(53000, u16(response, 22));
    }

    @Test public void parsesIpv6UdpDnsAndWritesMandatoryUdpChecksum() {
        byte[] dns = dnsQuery("example.org");
        byte[] packet = ipv6Query(dns);
        DnsPacketCodec.ParsedPacket parsed = DnsPacketCodec.parseUdpDns(packet, packet.length);
        assertNotNull(parsed);
        assertTrue(parsed.ipv6);
        assertEquals("example.org", DnsPacketCodec.firstQuestionName(parsed.dnsPayload));

        byte[] response = DnsPacketCodec.buildUdpResponse(parsed, DnsPacketCodec.buildNxDomain(parsed.dnsPayload));
        assertNotNull(response);
        assertEquals(6, (response[0] >>> 4) & 0x0f);
        assertNotEquals(0, u16(response, 46));
    }

    @Test public void rejectsCompressedOrMalformedQuestionName() {
        byte[] dns = dnsQuery("example.com");
        dns[12] = (byte) 0xc0;
        assertEquals("", DnsPacketCodec.firstQuestionName(dns));
    }

    private static byte[] ipv4Query(byte[] dns) {
        int udpLength = 8 + dns.length;
        byte[] packet = new byte[20 + udpLength];
        packet[0] = 0x45;
        writeU16(packet, 2, packet.length);
        packet[8] = 64;
        packet[9] = 17;
        byte[] src = {10, 111, (byte) 222, 1};
        byte[] dst = {10, 111, (byte) 222, 2};
        System.arraycopy(src, 0, packet, 12, 4);
        System.arraycopy(dst, 0, packet, 16, 4);
        writeU16(packet, 20, 53000);
        writeU16(packet, 22, 53);
        writeU16(packet, 24, udpLength);
        System.arraycopy(dns, 0, packet, 28, dns.length);
        return packet;
    }

    private static byte[] ipv6Query(byte[] dns) {
        int udpLength = 8 + dns.length;
        byte[] packet = new byte[40 + udpLength];
        packet[0] = 0x60;
        writeU16(packet, 4, udpLength);
        packet[6] = 17;
        packet[7] = 64;
        byte[] src = hex("fd666c616e6500000000000000000001");
        byte[] dst = hex("fd666c616e6500000000000000000002");
        System.arraycopy(src, 0, packet, 8, 16);
        System.arraycopy(dst, 0, packet, 24, 16);
        writeU16(packet, 40, 53001);
        writeU16(packet, 42, 53);
        writeU16(packet, 44, udpLength);
        System.arraycopy(dns, 0, packet, 48, dns.length);
        return packet;
    }

    private static byte[] hex(String value) {
        byte[] out = new byte[value.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        return out;
    }

    private static void writeU16(byte[] bytes, int offset, int value) {
        bytes[offset] = (byte) ((value >>> 8) & 0xff);
        bytes[offset + 1] = (byte) (value & 0xff);
    }

    private static int u16(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
    }

    private static byte[] slice(byte[] bytes, int start, int end) {
        byte[] out = new byte[end - start];
        System.arraycopy(bytes, start, out, 0, out.length);
        return out;
    }
}
