import XCTest
@testable import QNSI

/// Exercises the REAL CryptoKit ML-KEM / ML-DSA primitives (no mocks). On an OS
/// below the iOS 26 / macOS 26 floor the module must fail CLOSED, which is also
/// asserted here via `isAvailable` gating.
final class DevicePqcTests: XCTestCase {
    func testKemRoundTripAllAlgorithms() throws {
        guard QnsiDevicePqc.isAvailable else {
            // Fail-closed contract on old OS: every op must throw devicePqc.
            XCTAssertThrowsError(try QnsiDevicePqc.generateKemKeyPair(.mlKem768))
            return
        }
        for algorithm in QnsiDevicePqc.KemAlgorithm.allCases {
            let pair = try QnsiDevicePqc.generateKemKeyPair(algorithm)
            XCTAssertEqual(pair.provider, "cryptokit")
            XCTAssertEqual(pair.algorithm, algorithm.rawValue)
            // FIPS 203 encapsulation key sizes: 1184 (ML-KEM-768), 1568 (ML-KEM-1024).
            let expectedSize = algorithm == .mlKem768 ? 1184 : 1568
            XCTAssertEqual(pair.publicKey.count, expectedSize)

            let encap = try QnsiDevicePqc.encapsulate(algorithm, publicKey: pair.publicKey)
            XCTAssertEqual(encap.sharedSecret.count, 32)
            let recovered = try QnsiDevicePqc.decapsulate(
                algorithm, privateSeed: pair.privateSeed, ciphertext: encap.ciphertext
            )
            XCTAssertEqual(recovered, encap.sharedSecret, "\(algorithm.rawValue) shared secrets must match")
        }
    }

    func testKemImplicitRejectionOnTamperedCiphertext() throws {
        guard QnsiDevicePqc.isAvailable else { return }
        let pair = try QnsiDevicePqc.generateKemKeyPair(.mlKem768)
        let encap = try QnsiDevicePqc.encapsulate(.mlKem768, publicKey: pair.publicKey)
        var tampered = encap.ciphertext
        tampered[0] ^= 0xFF
        // FIPS 203 implicit rejection: decapsulation of a tampered ciphertext
        // yields a DIFFERENT secret, never the negotiated one.
        let rejected = try QnsiDevicePqc.decapsulate(
            .mlKem768, privateSeed: pair.privateSeed, ciphertext: tampered
        )
        XCTAssertNotEqual(rejected, encap.sharedSecret)
    }

    func testSignatureRoundTripAllAlgorithms() throws {
        guard QnsiDevicePqc.isAvailable else {
            XCTAssertThrowsError(try QnsiDevicePqc.generateSigningKeyPair(.mlDsa65))
            return
        }
        let message = Data("qnsi swift sdk device pqc".utf8)
        for algorithm in QnsiDevicePqc.SignatureAlgorithm.allCases {
            let pair = try QnsiDevicePqc.generateSigningKeyPair(algorithm)
            // FIPS 204 public key sizes: 1952 (ML-DSA-65), 2592 (ML-DSA-87).
            let expectedSize = algorithm == .mlDsa65 ? 1952 : 2592
            XCTAssertEqual(pair.publicKey.count, expectedSize)

            let signature = try QnsiDevicePqc.sign(algorithm, privateSeed: pair.privateSeed, message: message)
            XCTAssertTrue(
                try QnsiDevicePqc.verify(
                    algorithm, publicKey: pair.publicKey, message: message, signature: signature
                ),
                "\(algorithm.rawValue) genuine signature must verify"
            )

            var tamperedMessage = message
            tamperedMessage[0] ^= 0x01
            XCTAssertFalse(
                try QnsiDevicePqc.verify(
                    algorithm, publicKey: pair.publicKey, message: tamperedMessage, signature: signature
                ),
                "\(algorithm.rawValue) tampered message must NOT verify"
            )

            var tamperedSignature = signature
            tamperedSignature[10] ^= 0xFF
            XCTAssertFalse(
                try QnsiDevicePqc.verify(
                    algorithm, publicKey: pair.publicKey, message: message, signature: tamperedSignature
                ),
                "\(algorithm.rawValue) tampered signature must NOT verify"
            )
        }
    }

    func testSeedReconstructionIsDeterministic() throws {
        guard QnsiDevicePqc.isAvailable else { return }
        let pair = try QnsiDevicePqc.generateSigningKeyPair(.mlDsa65)
        let message = Data("determinism check".utf8)
        // A signature made from the reconstructed key must verify under the
        // ORIGINAL public key, proving the seed reconstructs the same key pair.
        let signature = try QnsiDevicePqc.sign(.mlDsa65, privateSeed: pair.privateSeed, message: message)
        XCTAssertTrue(
            try QnsiDevicePqc.verify(.mlDsa65, publicKey: pair.publicKey, message: message, signature: signature)
        )
    }
}
