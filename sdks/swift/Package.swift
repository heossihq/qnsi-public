// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "qnsi-swift",
    platforms: [
        // Transport core (URLSession async/await) needs iOS 15 / macOS 12.
        // Device PQC (CryptoKit ML-KEM / ML-DSA) is additionally availability-gated
        // to iOS 26 / macOS 26 at the API level and fails closed below that floor.
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        .library(name: "QNSI", targets: ["QNSI"]),
    ],
    targets: [
        .target(
            name: "QNSI",
            path: "Sources/QNSI"
        ),
        .testTarget(
            name: "QNSITests",
            dependencies: ["QNSI"],
            path: "Tests/QNSITests"
        ),
    ]
)
