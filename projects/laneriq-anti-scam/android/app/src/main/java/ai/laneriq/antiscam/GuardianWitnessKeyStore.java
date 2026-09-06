package ai.laneriq.antiscam;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Locale;

/**
 * Same-device Witness signing key backed by Android Keystore.
 *
 * The private key is non-exportable through this API. This materially improves
 * origin proof against ordinary app-level spoofing, but it is not a guarantee
 * against root/system compromise or a broken TEE/OS.
 */
public final class GuardianWitnessKeyStore {
    private static final String STORE = "AndroidKeyStore";
    private static final String ALIAS = "laneriq_guardian_witness_p256_v1";

    public static final class SignedProof {
        public final String keyIdSha256;
        public final String publicKeyBase64;
        public final String signatureBase64;
        public final String canonicalPayload;

        SignedProof(String keyIdSha256,
                    String publicKeyBase64,
                    String signatureBase64,
                    String canonicalPayload) {
            this.keyIdSha256 = keyIdSha256;
            this.publicKeyBase64 = publicKeyBase64;
            this.signatureBase64 = signatureBase64;
            this.canonicalPayload = canonicalPayload;
        }
    }

    private GuardianWitnessKeyStore() {}

    public static SignedProof sign(WitnessProofPayload payload) throws Exception {
        if (payload == null) throw new IllegalArgumentException("payload required");
        KeyStore keyStore = KeyStore.getInstance(STORE);
        keyStore.load(null);
        ensureKey(keyStore);

        PrivateKey privateKey = (PrivateKey) keyStore.getKey(ALIAS, null);
        java.security.cert.Certificate cert = keyStore.getCertificate(ALIAS);
        if (privateKey == null || cert == null) throw new IllegalStateException("witness key unavailable");
        PublicKey publicKey = cert.getPublicKey();

        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(privateKey);
        signer.update(payload.canonicalBytes());
        byte[] signature = signer.sign();
        byte[] publicBytes = publicKey.getEncoded();

        return new SignedProof(
                sha256Hex(publicBytes),
                Base64.encodeToString(publicBytes, Base64.NO_WRAP),
                Base64.encodeToString(signature, Base64.NO_WRAP),
                payload.canonical());
    }

    private static void ensureKey(KeyStore keyStore) throws Exception {
        if (keyStore.containsAlias(ALIAS)) return;
        KeyPairGenerator generator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,
                STORE);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build();
        generator.initialize(spec);
        generator.generateKeyPair();
    }

    static String sha256Hex(byte[] bytes) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(bytes == null ? new byte[0] : bytes);
        StringBuilder out = new StringBuilder(hash.length * 2);
        for (byte b : hash) out.append(String.format(Locale.US, "%02x", b & 0xff));
        return out.toString();
    }
}
