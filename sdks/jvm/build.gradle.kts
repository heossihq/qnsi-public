plugins {
    kotlin("jvm") version "2.0.21"
    kotlin("plugin.serialization") version "2.0.21"
    id("org.jetbrains.kotlinx.binary-compatibility-validator") version "0.16.3"
    `maven-publish`
    signing
}

group = "com.heossi"
version = "0.4.0"

repositories {
    mavenCentral()
}

dependencies {
    // OkHttp is the only runtime transport dependency. It is the de-facto HTTP
    // client on BOTH the JVM and Android (Android 5.0 / API 21+), which is what
    // lets this single artifact serve Spring backends and native Android.
    api("com.squareup.okhttp3:okhttp:4.12.0")
    // kotlinx.serialization: compile-time, no reflection -> R8/ProGuard-clean on
    // Android and a smaller supply-chain surface than Jackson.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}

kotlin {
    // Public API surface is locked: every public declaration needs explicit
    // visibility + return type (catches accidental API leaks before publish).
    explicitApi()
    // Target Java 8 bytecode so the artifact runs on Android API 21+ as well as
    // any modern JVM. Uses the running JDK (no toolchain auto-download required).
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

tasks.test {
    useJUnitPlatform()
}

// --- Phase 4: Maven Central (Sonatype) publishing + GPG signing ---
// Group `com.heossi` (verifiable via heossi.com DNS), artifact `com.heossi:qnsi`.
// Sonatype credentials + signing keys are wired in Phase 4; this block is inert
// for local builds (no signing task is required to `build` or `test`).
publishing {
    publications {
        create<MavenPublication>("maven") {
            artifactId = "qnsi"
            from(components["java"])
            pom {
                name.set("QNSI JVM SDK")
                description.set(
                    "Official JVM / Android SDK for the Quantum-Native Security Infrastructure (QNSI).",
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

// GPG signing - required for Maven Central, but only engaged when a signing key
// is supplied (CI / release). Local builds and `publishToMavenLocal` need no key.
signing {
    val signingKey = (findProperty("signingKey") as String?) ?: System.getenv("SIGNING_KEY")
    val signingPassword = (findProperty("signingPassword") as String?) ?: System.getenv("SIGNING_PASSWORD")
    isRequired = signingKey != null
    if (signingKey != null) {
        useInMemoryPgpKeys(signingKey, signingPassword)
        sign(publishing.publications["maven"])
    }
}
