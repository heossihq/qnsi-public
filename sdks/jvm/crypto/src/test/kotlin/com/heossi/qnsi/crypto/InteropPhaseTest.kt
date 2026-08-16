package com.heossi.qnsi.crypto

import java.io.File
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertTrue
import org.junit.jupiter.api.Assumptions.assumeTrue

/**
 * Bouncy Castle side of scripts/verify/mobile-pqc-interop.mjs (the three-way
 * CryptoKit / Bouncy Castle / @noble-post-quantum interop proof). Gated on
 * INTEROP_DIR + INTEROP_PHASE so a normal `./gradlew test` skips it; the
 * orchestrator invokes:
 *
 *   INTEROP_DIR=<dir> INTEROP_PHASE=gen    ./gradlew :crypto:test --tests '*InteropPhaseTest*'
 *   INTEROP_DIR=<dir> INTEROP_PHASE=finish ./gradlew :crypto:test --tests '*InteropPhaseTest*'
 *
 * JSON handling is deliberately dependency-free (simple flat objects only).
 */
class InteropPhaseTest {
    private val dir = System.getenv("INTEROP_DIR")
    private val phase = System.getenv("INTEROP_PHASE")

    private fun b64(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)

    private fun unb64(map: Map<String, String>, key: String): ByteArray =
        Base64.getDecoder().decode(requireNotNull(map[key]) { "missing field $key" })

    /** Parse a flat JSON object of string/boolean values (all this harness needs). */
    private fun parseFlatJson(text: String): Map<String, String> {
        val result = mutableMapOf<String, String>()
        val regex = Regex("\"([^\"]+)\"\\s*:\\s*(\"([^\"]*)\"|true|false)")
        for (match in regex.findAll(text)) {
            result[match.groupValues[1]] = match.groupValues[3].ifEmpty { match.groupValues[2] }
        }
        return result
    }

    private fun writeFlatJson(map: Map<String, Any>, file: File) {
        val body = map.entries.joinToString(",") { (k, v) ->
            when (v) {
                is Boolean -> "\"$k\":$v"
                else -> "\"$k\":\"$v\""
            }
        }
        file.writeText("{$body}")
    }

    @Test
    fun `interop phase gen`() {
        assumeTrue(dir != null && phase == "gen", "INTEROP_DIR/INTEROP_PHASE=gen not set - skipping")
        val vectors = parseFlatJson(File(dir!!, "vectors.json").readText())
        val message = unb64(vectors, "message")

        // 1. Bouncy Castle verifies noble's ML-DSA-65 signature.
        val nobleSigValid = QnsiDevicePqc.verify(
            QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65,
            unb64(vectors, "nobleDsaPub"),
            message,
            unb64(vectors, "nobleDsaSig"),
        )

        // 2. Bouncy Castle signs the same message with its own key.
        val dsaPair = QnsiDevicePqc.generateSigningKeyPair(QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65)
        val bcSig = QnsiDevicePqc.sign(QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65, dsaPair.privateKey, message)

        // 3. Bouncy Castle encapsulates to noble's ML-KEM-768 public key.
        val encap = QnsiDevicePqc.encapsulate(QnsiDevicePqc.KemAlgorithm.ML_KEM_768, unb64(vectors, "nobleKemPub"))

        // 4. Bouncy Castle's own ML-KEM key for the reverse direction. The private
        // key must survive to the finish phase, so it is written to the work dir
        // (throwaway test key material only).
        val kemPair = QnsiDevicePqc.generateKemKeyPair(QnsiDevicePqc.KemAlgorithm.ML_KEM_768)

        writeFlatJson(
            mapOf(
                "nobleDsaSigValidInBc" to nobleSigValid,
                "bcDsaPub" to b64(dsaPair.publicKey),
                "bcDsaSig" to b64(bcSig),
                "bcToNobleCiphertext" to b64(encap.ciphertext),
                "bcToNobleSharedSecret" to b64(encap.sharedSecret),
                "bcKemPub" to b64(kemPair.publicKey),
                "bcKemPriv" to b64(kemPair.privateKey),
            ),
            File(dir, "bc-gen.json"),
        )
        assertTrue(nobleSigValid, "noble's ML-DSA-65 signature must verify in Bouncy Castle")
    }

    @Test
    fun `interop phase finish`() {
        assumeTrue(dir != null && phase == "finish", "INTEROP_DIR/INTEROP_PHASE=finish not set - skipping")
        val gen = parseFlatJson(File(dir!!, "bc-gen.json").readText())
        val mid = parseFlatJson(File(dir, "noble-mid.json").readText())
        val secret = QnsiDevicePqc.decapsulate(
            QnsiDevicePqc.KemAlgorithm.ML_KEM_768,
            unb64(gen, "bcKemPriv"),
            unb64(mid, "nobleToBcCiphertext"),
        )
        writeFlatJson(mapOf("bcDecapsulatedSecret" to b64(secret)), File(dir, "bc-finish.json"))
    }
}
