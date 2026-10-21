package crypto

import "testing"

func TestRegistryPrefersLiboqs016Names(t *testing.T) {
	if got := kemCandidates["HQC-128"][0]; got != "HQC-1" {
		t.Fatalf("HQC-128 first candidate = %q, want HQC-1", got)
	}
	if got := kemCandidates["HQC-192"][0]; got != "HQC-3" {
		t.Fatalf("HQC-192 first candidate = %q, want HQC-3", got)
	}
	if got := kemCandidates["HQC-256"][0]; got != "HQC-5" {
		t.Fatalf("HQC-256 first candidate = %q, want HQC-5", got)
	}
	if got := sigCandidates["SLH-DSA-SHAKE-128f"][0]; got != "SLH_DSA_PURE_SHAKE_128F" {
		t.Fatalf("SLH-DSA-SHAKE-128f first candidate = %q, want SLH_DSA_PURE_SHAKE_128F", got)
	}
}
