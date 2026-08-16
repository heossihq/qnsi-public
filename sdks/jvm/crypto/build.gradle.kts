plugins {
    kotlin("jvm")
    `maven-publish`
    signing
}

group = "com.heossi"
version = "0.1.0"

repositories {
    mavenCentral()
}

kotlin {
    explicitApi()
    // Java 8 bytecode so the artifact runs on Android API 21+ as well as any
    // modern JVM (same floor as the core com.heossi:qnsi transport artifact).
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8)
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_1_8
    targetCompatibility = JavaVersion.VERSION_1_8
    withSourcesJar()
    withJavadocJar()
}

dependencies {
    // Bouncy Castle's lightweight (non-JCA) API: real FIPS 203 ML-KEM and
    // FIPS 204 ML-DSA implementations in pure Java, running identically on any
    // JVM and on Android API 21+ (no dependence on the OS Keystore floor).
    // The lightweight API is used instead of JCA so raw NIST wire encodings are
    // first-class (interoperable with CryptoKit, liboqs, @noble/post-quantum).
    api("org.bouncycastle:bcprov-jdk18on:1.80")

    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
}

tasks.test {
    useJUnitPlatform()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            artifactId = "qnsi-crypto"
            from(components["java"])
            pom {
                name.set("QNSI Device PQC (JVM / Android)")
                description.set(
                    "On-device post-quantum cryptography (ML-KEM, ML-DSA) for the QNSI JVM / Android SDK.",
                )
                url.set("https://qnsi.heossi.com")
                licenses {
                    license {
                        name.set("Apache-2.0")
                        url.set("https://www.apache.org/licenses/LICENSE-2.0")
                    }
                }
                developers {
                    developer {
                        id.set("heossi")
                        name.set("HEOSSI (PTE.) LTD")
                        url.set("https://heossi.com")
                    }
                }
                scm {
                    url.set("https://github.com/heossihq/qnsi-public")
                    connection.set("scm:git:https://github.com/heossihq/qnsi-public.git")
                    developerConnection.set("scm:git:ssh://git@github.com/heossihq/qnsi-public.git")
                }
            }
        }
    }
}

signing {
    val signingKey = (findProperty("signingKey") as String?) ?: System.getenv("SIGNING_KEY")
    val signingPassword = (findProperty("signingPassword") as String?) ?: System.getenv("SIGNING_PASSWORD")
    isRequired = signingKey != null
    if (signingKey != null) {
        useInMemoryPgpKeys(signingKey, signingPassword)
        sign(publishing.publications["maven"])
    }
}
