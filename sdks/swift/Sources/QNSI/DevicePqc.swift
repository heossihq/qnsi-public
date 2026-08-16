import Foundation
import CryptoKit

/// On-device post-quantum cryptography backed by Apple CryptoKit.
///
/// Every operation here executes the REAL NIST-standardized primitive via the
/// operating system's CryptoKit implementation (Apple corecrypto underneath):
/// ML-KEM-768 / ML-KEM-1024 (FIPS 203) key encapsulation and ML-DSA-65 / ML-DSA-87
/// (FIPS 204) signatures. There is no simulation, no classical substitute, and no
/// silent fallback anywhere on this path: below the OS floor (iOS 26 / macOS 26)
/// every call throws `QnsiError.devicePqc` (fail closed), matching the QNSI
/// platform invariant that failure of PQC never silently becomes classical.
///
/// Results are labelled with `provider == "cryptokit"` so audit trails record
/// which implementation executed the primitive.
public enum QnsiDevicePqc {
    /// The provider label attached to every operation performed by this module.
    public static let provider = "cryptokit"

    /// NIST FIPS 203 ML-KEM parameter sets supported on-device.
    public enum KemAlgorithm: String, Sendable, CaseIterable {
        case mlKem768 = "ml-kem-768"
        case mlKem1024 = "ml-kem-1024"
    }

    /// NIST FIPS 204 ML-DSA parameter sets supported on-device.
    public enum SignatureAlgorithm: String, Sendable, CaseIterable {
        case mlDsa65 = "ml-dsa-65"
        case mlDsa87 = "ml-dsa-87"
    }

    /// A generated key pair. Key material is raw bytes in the NIST wire encoding
    /// (interoperable with liboqs and @noble/post-quantum on the QNSI platform).
    public struct KeyPair: Sendable {
        public let algorithm: String
        public let provider: String
        public let publicKey: Data
        /// For ML-KEM and ML-DSA this is the seed representation, from which
        /// CryptoKit reconstructs the full private key deterministically.
        public let privateSeed: Data
    }

    /// The result of an ML-KEM encapsulation.
    public struct Encapsulation: Sendable {
        public let algorithm: String
        public let provider: String
        public let ciphertext: Data
        public let sharedSecret: Data
    }

    /// Whether CryptoKit PQC is available on this OS (iOS 26+ / macOS 26+).
    public static var isAvailable: Bool {
        if #available(iOS 26.0, macOS 26.0, watchOS 26.0, tvOS 26.0, *) {
            return true
        }
        return false
    }

    private static func requireAvailable() throws {
        guard isAvailable else {
            throw QnsiError.devicePqc(
                message: "CryptoKit PQC requires iOS 26 / macOS 26 or later; failing closed (no classical fallback)"
            )
        }
    }

    // MARK: ML-KEM (FIPS 203)

    /// Generate an ML-KEM key pair on-device.
    public static func generateKemKeyPair(_ algorithm: KemAlgorithm) throws -> KeyPair {
        try requireAvailable()
        if #available(iOS 26.0, macOS 26.0, watchOS 26.0, tvOS 26.0, *) {
            switch algorithm {
            case .mlKem768:
                let key = try MLKEM768.PrivateKey()
                return KeyPair(
                    algorithm: algorithm.rawValue, provider: provider,
                    publicKey: key.publicKey.rawRepresentation, privateSeed: key.seedRepresentation
                )
            case .mlKem1024:
                let key = try MLKEM1024.PrivateKey()
                return KeyPair(
                    algorithm: algorithm.rawValue, provider: provider,
                    publicKey: key.publicKey.rawRepresentation, privateSeed: key.seedRepresentation
                )
            }
        }
        throw QnsiError.devicePqc(message: "unreachable: availability checked")
    }

    /// Encapsulate to a raw ML-KEM public key, producing a ciphertext and shared secret.
    public static func encapsulate(_ algorithm: KemAlgorithm, publicKey: Data) throws -> Encapsulation {
        try requireAvailable()
        if #available(iOS 26.0, macOS 26.0, watchOS 26.0, tvOS 26.0, *) {
            switch algorithm {
            case .mlKem768:
                let key = try MLKEM768.PublicKey(rawRepresentation: publicKey)
                let result = try key.encapsulate()
                return Encapsulation(
                    algorithm: algorithm.rawValue, provider: provider,
                    ciphertext: result.encapsulated,
                    sharedSecret: result.sharedSecret.withUnsafeBytes { Data($0) }
                )
            case .mlKem1024:
                let key = try MLKEM1024.PublicKey(rawRepresentation: publicKey)
                let result = try key.encapsulate()
                return Encapsulation(
                    algorithm: algorithm.rawValue, provider: provider,
                    ciphertext: result.encapsulated,
                    sharedSecret: result.sharedSecret.withUnsafeBytes { Data($0) }
                )
            }
        }
        throw QnsiError.devicePqc(message: "unreachable: availability checked")
    }

    /// Decapsulate an ML-KEM ciphertext with the private seed, recovering the shared secret.
    public static func decapsulate(_ algorithm: KemAlgorithm, privateSeed: Data, ciphertext: Data) throws -> Data {
        try requireAvailable()
        if #available(iOS 26.0, macOS 26.0, watchOS 26.0, tvOS 26.0, *) {
            switch algorithm {
            case .mlKem768:
                let key = try MLKEM768.PrivateKey(seedRepresentation: privateSeed, publicKey: nil)
                let secret = try key.decapsulate(ciphertext)
                return secret.withUnsafeBytes { Data($0) }
            case .mlKem1024:
                let key = try MLKEM1024.PrivateKey(seedRepresentation: privateSeed, publicKey: nil)
                let secret = try key.decapsulate(ciphertext)
                return secret.withUnsafeBytes { Data($0) }
            }
        }
        throw QnsiError.devicePqc(message: "unreachable: availability checked")
    }

    // MARK: ML-DSA (FIPS 204)

    /// Generate an ML-DSA key pair on-device.
    public static func generateSigningKeyPair(_ algorithm: SignatureAlgorithm) throws -> KeyPair {
        try requireAvailable()
        if #available(iOS 26.0, macOS 26.0, watchOS 26.0, tvOS 26.0, *) {
            switch algorithm {
            case .mlDsa65:
                let key = try MLDSA65.PrivateKey()
                return KeyPair(
                    algorithm: algorithm.rawValue, provider: provider,
                    publicKey: key.publicKey.rawRepresentation, privateSeed: key.seedRepresentation
                )
            case .mlDsa87:
                let key = try MLDSA87.PrivateKey()
                return KeyPair(
                    algorithm: algorithm.rawValue, provider: provider,
                    publicKey: key.publicKey.rawRepresentation, privateSeed: key.seedRepresentation
                )
            }
        }
        throw QnsiError.devicePqc(message: "unreachable: availability checked")
    }

    /// Sign a message with an ML-DSA private seed.
    public static func sign(_ algorithm: SignatureAlgorithm, privateSeed: Data, message: Data) throws -> Data {
        try requireAvailable()
        if #available(iOS 26.0, macOS 26.0, watchOS 26.0, tvOS 26.0, *) {
            switch algorithm {
            case .mlDsa65:
                let key = try MLDSA65.PrivateKey(seedRepresentation: privateSeed, publicKey: nil)
                return try key.signature(for: message)
            case .mlDsa87:
                let key = try MLDSA87.PrivateKey(seedRepresentation: privateSeed, publicKey: nil)
                return try key.signature(for: message)
            }
        }
        throw QnsiError.devicePqc(message: "unreachable: availability checked")
    }

    /// Verify an ML-DSA signature against a raw public key.
    public static func verify(
        _ algorithm: SignatureAlgorithm,
        publicKey: Data,
        message: Data,
        signature: Data
    ) throws -> Bool {
        try requireAvailable()
        if #available(iOS 26.0, macOS 26.0, watchOS 26.0, tvOS 26.0, *) {
            switch algorithm {
            case .mlDsa65:
                let key = try MLDSA65.PublicKey(rawRepresentation: publicKey)
                return key.isValidSignature(signature, for: message)
            case .mlDsa87:
                let key = try MLDSA87.PublicKey(rawRepresentation: publicKey)
                return key.isValidSignature(signature, for: message)
            }
        }
        throw QnsiError.devicePqc(message: "unreachable: availability checked")
    }
}
