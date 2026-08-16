rootProject.name = "qnsi"
// Optional on-device PQC module (Bouncy Castle ML-KEM / ML-DSA), published as
// com.heossi:qnsi-crypto so the core transport artifact keeps OkHttp as its only
// runtime dependency.
include(":crypto")
