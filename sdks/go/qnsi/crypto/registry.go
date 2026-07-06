// Package crypto provides local PQC primitives via liboqs-go 0.12.0.
//
// The algorithm names exposed here are the canonical QNSP names that
// match @heossi/qnsp-cryptography (TypeScript) and qnsp.crypto (Python). Internally
// they are mapped to the liboqs-go enabled-algorithm strings for the
// installed liboqs version.
//
// Building requires the liboqs C library at link time. See the README at
// https://github.com/heossi/qnsp-public/blob/main/sdks/go/qnsp/README.md
// for installation instructions.
package crypto

// kemCandidates is the canonical-name → ordered-list-of-liboqs-candidate-names
// mapping. The first candidate that liboqs-go reports as enabled is used.
//
// The mapping mirrors the equivalent structure in the @heossi/qnsp-cryptography
// liboqs provider and qnsp.crypto._registry, so an algorithm string that
// works in TypeScript or Python also works here.
var kemCandidates = map[string][]string{
	"ML-KEM-512":  {"ML-KEM-512"},
	"ML-KEM-768":  {"ML-KEM-768"},
	"ML-KEM-1024": {"ML-KEM-1024"},

	"Kyber512":  {"Kyber512"},
	"Kyber768":  {"Kyber768"},
	"Kyber1024": {"Kyber1024"},

	// HQC omitted — disabled upstream (liboqs OQS_ENABLE_KEM_HQC=OFF; CVE-2025-48946).

	"BIKE-L1": {"BIKE-L1"},
	"BIKE-L3": {"BIKE-L3"},
	"BIKE-L5": {"BIKE-L5"},

	"FrodoKEM-640-AES":    {"FrodoKEM-640-AES"},
	"FrodoKEM-640-SHAKE":  {"FrodoKEM-640-SHAKE"},
	"FrodoKEM-976-AES":    {"FrodoKEM-976-AES"},
	"FrodoKEM-976-SHAKE":  {"FrodoKEM-976-SHAKE"},
	"FrodoKEM-1344-AES":   {"FrodoKEM-1344-AES"},
	"FrodoKEM-1344-SHAKE": {"FrodoKEM-1344-SHAKE"},

	"sntrup761": {"sntrup761"},

	"Classic-McEliece-348864":   {"Classic-McEliece-348864"},
	"Classic-McEliece-348864f":  {"Classic-McEliece-348864f"},
	"Classic-McEliece-460896":   {"Classic-McEliece-460896"},
	"Classic-McEliece-460896f":  {"Classic-McEliece-460896f"},
	"Classic-McEliece-6688128":  {"Classic-McEliece-6688128"},
	"Classic-McEliece-6688128f": {"Classic-McEliece-6688128f"},
	"Classic-McEliece-6960119":  {"Classic-McEliece-6960119"},
	"Classic-McEliece-6960119f": {"Classic-McEliece-6960119f"},
	"Classic-McEliece-8192128":  {"Classic-McEliece-8192128"},
	"Classic-McEliece-8192128f": {"Classic-McEliece-8192128f"},
}

// sigCandidates mirrors kemCandidates for signature schemes.
//
// SLH-DSA names use the underscore-uppercase form that liboqs accepts; the
// public QNSP-canonical names use the hyphenated form, and both work as
// inputs.
var sigCandidates = map[string][]string{
	"ML-DSA-44": {"ML-DSA-44"},
	"ML-DSA-65": {"ML-DSA-65"},
	"ML-DSA-87": {"ML-DSA-87"},

	"Dilithium2": {"Dilithium2"},
	"Dilithium3": {"Dilithium3"},
	"Dilithium5": {"Dilithium5"},

	"Falcon-512":     {"Falcon-512"},
	"Falcon-1024":    {"Falcon-1024"},
	"Falcon-padded-512":  {"Falcon-padded-512"},
	"Falcon-padded-1024": {"Falcon-padded-1024"},

	"SLH-DSA-SHA2-128f": {"SLH-DSA-SHA2-128f-simple", "SPHINCS+-SHA2-128f-simple"},
	"SLH-DSA-SHA2-128s": {"SLH-DSA-SHA2-128s-simple", "SPHINCS+-SHA2-128s-simple"},
	"SLH-DSA-SHA2-192f": {"SLH-DSA-SHA2-192f-simple", "SPHINCS+-SHA2-192f-simple"},
	"SLH-DSA-SHA2-192s": {"SLH-DSA-SHA2-192s-simple", "SPHINCS+-SHA2-192s-simple"},
	"SLH-DSA-SHA2-256f": {"SLH-DSA-SHA2-256f-simple", "SPHINCS+-SHA2-256f-simple"},
	"SLH-DSA-SHA2-256s": {"SLH-DSA-SHA2-256s-simple", "SPHINCS+-SHA2-256s-simple"},

	"SLH-DSA-SHAKE-128f": {"SLH-DSA-SHAKE-128f-simple", "SPHINCS+-SHAKE-128f-simple"},
	"SLH-DSA-SHAKE-128s": {"SLH-DSA-SHAKE-128s-simple", "SPHINCS+-SHAKE-128s-simple"},
	"SLH-DSA-SHAKE-192f": {"SLH-DSA-SHAKE-192f-simple", "SPHINCS+-SHAKE-192f-simple"},
	"SLH-DSA-SHAKE-192s": {"SLH-DSA-SHAKE-192s-simple", "SPHINCS+-SHAKE-192s-simple"},
	"SLH-DSA-SHAKE-256f": {"SLH-DSA-SHAKE-256f-simple", "SPHINCS+-SHAKE-256f-simple"},
	"SLH-DSA-SHAKE-256s": {"SLH-DSA-SHAKE-256s-simple", "SPHINCS+-SHAKE-256s-simple"},

	"MAYO-1": {"MAYO-1"},
	"MAYO-2": {"MAYO-2"},
	"MAYO-3": {"MAYO-3"},
	"MAYO-5": {"MAYO-5"},

	"cross-rsdp-128-balanced":  {"cross-rsdp-128-balanced"},
	"cross-rsdp-128-fast":      {"cross-rsdp-128-fast"},
	"cross-rsdp-128-small":     {"cross-rsdp-128-small"},
	"cross-rsdp-192-balanced":  {"cross-rsdp-192-balanced"},
	"cross-rsdp-192-fast":      {"cross-rsdp-192-fast"},
	"cross-rsdp-192-small":     {"cross-rsdp-192-small"},
	"cross-rsdp-256-balanced":  {"cross-rsdp-256-balanced"},
	"cross-rsdp-256-fast":      {"cross-rsdp-256-fast"},
	"cross-rsdp-256-small":     {"cross-rsdp-256-small"},
	"cross-rsdpg-128-balanced": {"cross-rsdpg-128-balanced"},
	"cross-rsdpg-128-fast":     {"cross-rsdpg-128-fast"},
	"cross-rsdpg-128-small":    {"cross-rsdpg-128-small"},
	"cross-rsdpg-192-balanced": {"cross-rsdpg-192-balanced"},
	"cross-rsdpg-192-fast":     {"cross-rsdpg-192-fast"},
	"cross-rsdpg-192-small":    {"cross-rsdpg-192-small"},
	"cross-rsdpg-256-balanced": {"cross-rsdpg-256-balanced"},
	"cross-rsdpg-256-fast":     {"cross-rsdpg-256-fast"},
	"cross-rsdpg-256-small":    {"cross-rsdpg-256-small"},
}

// SupportedKEMs returns the canonical QNSP KEM names this binding knows
// about. Whether each is *enabled* in the linked liboqs build depends on
// how liboqs was configured at compile time — call IsKEMEnabled to check.
func SupportedKEMs() []string {
	out := make([]string, 0, len(kemCandidates))
	for k := range kemCandidates {
		out = append(out, k)
	}
	return out
}

// SupportedSignatures returns the canonical QNSP signature names this
// binding knows about.
func SupportedSignatures() []string {
	out := make([]string, 0, len(sigCandidates))
	for k := range sigCandidates {
		out = append(out, k)
	}
	return out
}
