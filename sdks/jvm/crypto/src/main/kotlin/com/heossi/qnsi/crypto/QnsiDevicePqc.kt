package com.heossi.qnsi.crypto

import java.security.SecureRandom
import org.bouncycastle.crypto.AsymmetricCipherKeyPair
import org.bouncycastle.pqc.crypto.mldsa.MLDSAKeyGenerationParameters
import org.bouncycastle.pqc.crypto.mldsa.MLDSAKeyPairGenerator
import org.bouncycastle.pqc.crypto.mldsa.MLDSAParameters
import org.bouncycastle.pqc.crypto.mldsa.MLDSAPrivateKeyParameters
import org.bouncycastle.pqc.crypto.mldsa.MLDSAPublicKeyParameters
import org.bouncycastle.pqc.crypto.mldsa.MLDSASigner
import org.bouncycastle.pqc.crypto.mlkem.MLKEMExtractor
import org.bouncycastle.pqc.crypto.mlkem.MLKEMGenerator
import org.bouncycastle.pqc.crypto.mlkem.MLKEMKeyGenerationParameters
import org.bouncycastle.pqc.crypto.mlkem.MLKEMKeyPairGenerator
import org.bouncycastle.pqc.crypto.mlkem.MLKEMParameters
import org.bouncycastle.pqc.crypto.mlkem.MLKEMPrivateKeyParameters
import org.bouncycastle.pqc.crypto.mlkem.MLKEMPublicKeyParameters

/**
 * On-device post-quantum cryptography for JVM and Android, backed by Bouncy
 * Castle's lightweight API.
 *
 * Every operation here executes the REAL NIST-standardized primitive:
 * ML-KEM-768 / ML-KEM-1024 (FIPS 203) key encapsulation and ML-DSA-65 /
 * ML-DSA-87 (FIPS 204) signatures. There is no simulation, no classical
 * substitute, and no silent fallback anywhere on this path; a failed operation
 * throws (fail closed), matching the QNSI platform invariant that failure of
 * PQC never silently becomes classical.
 *
 * Key material uses the raw NIST wire encodings, interoperable with Apple
 * CryptoKit (Swift SDK), liboqs, and `@noble/post-quantum` on the QNSI
 * platform. Runs identically on any JVM and on Android API 21+ with no
 * dependence on the Android 17 Keystore floor. Results are labelled with
 * [PROVIDER] so audit trails record which implementation executed the
 * primitive.
 */
public object QnsiDevicePqc {
    /** The provider label attached to every operation performed by this module. */
    public const val PROVIDER: String = "bouncycastle"

    /** NIST FIPS 203 ML-KEM parameter sets supported on-device. */
    public enum class KemAlgorithm(public val label: String) {
        ML_KEM_768("ml-kem-768"),
        ML_KEM_1024("ml-kem-1024"),
    }

    /** NIST FIPS 204 ML-DSA parameter sets supported on-device. */
    public enum class SignatureAlgorithm(public val label: String) {
        ML_DSA_65("ml-dsa-65"),
        ML_DSA_87("ml-dsa-87"),
    }

    /**
     * A generated key pair. `publicKey` is the raw NIST encoding; `privateKey`
     * is Bouncy Castle's encoded private key for the parameter set.
     */
    public class KeyPair internal constructor(
        public val algorithm: String,
        public val provider: String,
        public val publicKey: ByteArray,
        public val privateKey: ByteArray,
    )

    /** The result of an ML-KEM encapsulation. */
    public class Encapsulation internal constructor(
        public val algorithm: String,
        public val provider: String,
        public val ciphertext: ByteArray,
        public val sharedSecret: ByteArray,
    )

    private val random = SecureRandom()

    private fun kemParams(algorithm: KemAlgorithm): MLKEMParameters = when (algorithm) {
        KemAlgorithm.ML_KEM_768 -> MLKEMParameters.ml_kem_768
        KemAlgorithm.ML_KEM_1024 -> MLKEMParameters.ml_kem_1024
    }

    private fun dsaParams(algorithm: SignatureAlgorithm): MLDSAParameters = when (algorithm) {
        SignatureAlgorithm.ML_DSA_65 -> MLDSAParameters.ml_dsa_65
        SignatureAlgorithm.ML_DSA_87 -> MLDSAParameters.ml_dsa_87
    }

    // -- ML-KEM (FIPS 203) --------------------------------------------------

    /** Generate an ML-KEM key pair on-device. */
    @JvmStatic
    public fun generateKemKeyPair(algorithm: KemAlgorithm): KeyPair {
        val generator = MLKEMKeyPairGenerator()
        generator.init(MLKEMKeyGenerationParameters(random, kemParams(algorithm)))
        val pair: AsymmetricCipherKeyPair = generator.generateKeyPair()
        val publicKey = pair.public as MLKEMPublicKeyParameters
        val privateKey = pair.private as MLKEMPrivateKeyParameters
        return KeyPair(algorithm.label, PROVIDER, publicKey.encoded, privateKey.encoded)
    }

    /** Encapsulate to a raw ML-KEM public key, producing a ciphertext and shared secret. */
    @JvmStatic
    public fun encapsulate(algorithm: KemAlgorithm, publicKey: ByteArray): Encapsulation {
        val params = MLKEMPublicKeyParameters(kemParams(algorithm), publicKey)
        val generator = MLKEMGenerator(random)
        val result = generator.generateEncapsulated(params)
        return Encapsulation(algorithm.label, PROVIDER, result.encapsulation, result.secret)
    }

    /** Decapsulate an ML-KEM ciphertext with the private key, recovering the shared secret. */
    @JvmStatic
    public fun decapsulate(algorithm: KemAlgorithm, privateKey: ByteArray, ciphertext: ByteArray): ByteArray {
        val params = MLKEMPrivateKeyParameters(kemParams(algorithm), privateKey)
        return MLKEMExtractor(params).extractSecret(ciphertext)
    }

    // -- ML-DSA (FIPS 204) --------------------------------------------------

    /** Generate an ML-DSA key pair on-device. */
    @JvmStatic
    public fun generateSigningKeyPair(algorithm: SignatureAlgorithm): KeyPair {
        val generator = MLDSAKeyPairGenerator()
        generator.init(MLDSAKeyGenerationParameters(random, dsaParams(algorithm)))
        val pair = generator.generateKeyPair()
        val publicKey = pair.public as MLDSAPublicKeyParameters
        val privateKey = pair.private as MLDSAPrivateKeyParameters
        return KeyPair(algorithm.label, PROVIDER, publicKey.encoded, privateKey.encoded)
    }

    /** Sign a message with an ML-DSA private key. */
    @JvmStatic
    public fun sign(algorithm: SignatureAlgorithm, privateKey: ByteArray, message: ByteArray): ByteArray {
        val signer = MLDSASigner()
        signer.init(true, MLDSAPrivateKeyParameters(dsaParams(algorithm), privateKey))
        signer.update(message, 0, message.size)
        return signer.generateSignature()
    }

    /** Verify an ML-DSA signature against a raw public key. */
    @JvmStatic
    public fun verify(
        algorithm: SignatureAlgorithm,
        publicKey: ByteArray,
        message: ByteArray,
        signature: ByteArray,
    ): Boolean {
        val verifier = MLDSASigner()
        verifier.init(false, MLDSAPublicKeyParameters(dsaParams(algorithm), publicKey))
        verifier.update(message, 0, message.size)
        return verifier.verifySignature(signature)
    }
}
