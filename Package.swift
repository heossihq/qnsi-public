// swift-tools-version: 5.9
// Root SwiftPM manifest so the QNSI Swift SDK is consumable straight from the
// public mirror URL (SPM requires Package.swift at the repository root):
//
//   .package(url: "https://github.com/heossihq/qnsi-public.git", exact: "0.1.0")
//
// The SDK source of truth lives under sdks/swift/ (which also carries its own
// standalone manifest for local development and tests).
import PackageDescription

let package = Package(
    name: "qnsi-swift",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        .library(name: "QNSI", targets: ["QNSI"]),
    ],
    targets: [
        .target(
            name: "QNSI",
            path: "sdks/swift/Sources/QNSI"
        ),
        .testTarget(
            name: "QNSITests",
            dependencies: ["QNSI"],
            path: "sdks/swift/Tests/QNSITests"
        ),
    ]
)
