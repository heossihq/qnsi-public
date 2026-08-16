package com.heossi.qnsi.crypto

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Exercises the REAL Bouncy Castle ML-KEM / ML-DSA primitives (no mocks).
 * Key sizes are asserted against the FIPS 203 / FIPS 204 tables, so a swapped
 * or simulated implementation cannot pass.
 */
class QnsiDevicePqcTest {
    @Test
    fun `kem round trip all algorithms with FIPS 203 sizes`() {
        for (algorithm in QnsiDevicePqc.KemAlgorithm.entries) {
            val pair = QnsiDevicePqc.generateKemKeyPair(algorithm)
            assertEquals("bouncycastle", pair.provider)
            assertEquals(algorithm.label, pair.algorithm)
            val expectedPub = if (algorithm == QnsiDevicePqc.KemAlgorithm.ML_KEM_768) 1184 else 1568
            assertEquals(expectedPub, pair.publicKey.size, "${algorithm.label} encapsulation key size")

            val encap = QnsiDevicePqc.encapsulate(algorithm, pair.publicKey)
            val expectedCt = if (algorithm == QnsiDevicePqc.KemAlgorithm.ML_KEM_768) 1088 else 1568
            assertEquals(expectedCt, encap.ciphertext.size, "${algorithm.label} ciphertext size")
            assertEquals(32, encap.sharedSecret.size)

            val recovered = QnsiDevicePqc.decapsulate(algorithm, pair.privateKey, encap.ciphertext)
            assertContentEquals(encap.sharedSecret, recovered, "${algorithm.label} shared secrets must match")
        }
    }

    @Test
    fun `kem implicit rejection on tampered ciphertext`() {
        val pair = QnsiDevicePqc.generateKemKeyPair(QnsiDevicePqc.KemAlgorithm.ML_KEM_768)
        val encap = QnsiDevicePqc.encapsulate(QnsiDevicePqc.KemAlgorithm.ML_KEM_768, pair.publicKey)
        val tampered = encap.ciphertext.copyOf()
        tampered[0] = (tampered[0].toInt() xor 0xFF).toByte()
        // FIPS 203 implicit rejection: a tampered ciphertext decapsulates to a
        // DIFFERENT secret, never the negotiated one.
        val rejected = QnsiDevicePqc.decapsulate(QnsiDevicePqc.KemAlgorithm.ML_KEM_768, pair.privateKey, tampered)
        assertFalse(rejected.contentEquals(encap.sharedSecret))
    }

    @Test
    fun `signature round trip all algorithms with FIPS 204 sizes and tamper rejection`() {
        val message = "qnsi jvm sdk device pqc".toByteArray()
        for (algorithm in QnsiDevicePqc.SignatureAlgorithm.entries) {
            val pair = QnsiDevicePqc.generateSigningKeyPair(algorithm)
            val expectedPub = if (algorithm == QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65) 1952 else 2592
            assertEquals(expectedPub, pair.publicKey.size, "${algorithm.label} public key size")

            val signature = QnsiDevicePqc.sign(algorithm, pair.privateKey, message)
            val expectedSig = if (algorithm == QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65) 3309 else 4627
            assertEquals(expectedSig, signature.size, "${algorithm.label} signature size")
            assertTrue(
                QnsiDevicePqc.verify(algorithm, pair.publicKey, message, signature),
                "${algorithm.label} genuine signature must verify",
            )

            val tamperedMessage = message.copyOf()
            tamperedMessage[0] = (tamperedMessage[0].toInt() xor 0x01).toByte()
            assertFalse(
                QnsiDevicePqc.verify(algorithm, pair.publicKey, tamperedMessage, signature),
                "${algorithm.label} tampered message must NOT verify",
            )

            val tamperedSignature = signature.copyOf()
            tamperedSignature[10] = (tamperedSignature[10].toInt() xor 0xFF).toByte()
            assertFalse(
                QnsiDevicePqc.verify(algorithm, pair.publicKey, message, tamperedSignature),
                "${algorithm.label} tampered signature must NOT verify",
            )
        }
    }

    @Test
    fun `private key bytes reconstruct the same signing identity`() {
        val pair = QnsiDevicePqc.generateSigningKeyPair(QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65)
        val message = "determinism check".toByteArray()
        // Signing with the serialized-then-reconstructed private key must produce a
        // signature valid under the ORIGINAL public key.
        val signature = QnsiDevicePqc.sign(
            QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65,
            pair.privateKey.copyOf(),
            message,
        )
        assertTrue(
            QnsiDevicePqc.verify(QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65, pair.publicKey, message, signature),
        )
    }
}
