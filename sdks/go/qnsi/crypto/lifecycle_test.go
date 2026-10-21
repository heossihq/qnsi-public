package crypto

import (
	"bytes"
	"sync"
	"testing"

	"github.com/open-quantum-safe/liboqs-go/oqs"
)

func TestNativeKEMLifecycle(t *testing.T) {
	for _, algorithm := range []string{"ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"} {
		t.Run(algorithm, func(t *testing.T) {
			kem, err := NewKem(algorithm)
			if err != nil {
				t.Fatal(err)
			}
			defer kem.Close()
			if kem.Algorithm() != algorithm || kem.LibOQSName() == "" {
				t.Fatal("incorrect algorithm identity")
			}
			keys, err := kem.Keygen()
			if err != nil {
				t.Fatal(err)
			}
			original := append([]byte(nil), keys.SecretKey...)
			if _, err := kem.Keygen(); err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(keys.SecretKey, original) {
				t.Fatal("regeneration destroyed exported key")
			}
			for i := 0; i < 2; i++ {
				enc, err := kem.Encapsulate(keys.PublicKey)
				if err != nil {
					t.Fatal(err)
				}
				secret, err := kem.Decapsulate(enc.Ciphertext, keys.SecretKey)
				if err != nil {
					t.Fatal(err)
				}
				if !bytes.Equal(secret, enc.SharedSecret) {
					t.Fatal("shared secrets disagree")
				}
				if !bytes.Equal(keys.SecretKey, original) {
					t.Fatal("decapsulation destroyed caller key")
				}
				enc.Ciphertext[0] ^= 1
				changed, err := kem.Decapsulate(enc.Ciphertext, keys.SecretKey)
				if err == nil && bytes.Equal(changed, enc.SharedSecret) {
					t.Fatal("tampered ciphertext recovered original secret")
				}
			}
			if _, err := kem.Encapsulate(nil); err == nil {
				t.Fatal("accepted invalid public key")
			}
			if _, err := kem.Decapsulate(nil, keys.SecretKey); err == nil {
				t.Fatal("accepted invalid ciphertext")
			}
			enc, err := kem.Encapsulate(keys.PublicKey)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := kem.Decapsulate(enc.Ciphertext, nil); err == nil {
				t.Fatal("accepted invalid secret key")
			}
			kem.Close()
			kem.Close()
			if _, err := kem.Keygen(); err == nil {
				t.Fatal("keygen after close")
			}
			if _, err := kem.Encapsulate(keys.PublicKey); err == nil {
				t.Fatal("encapsulation after close")
			}
			if _, err := kem.Decapsulate(enc.Ciphertext, keys.SecretKey); err == nil {
				t.Fatal("decapsulation after close")
			}
		})
	}
}

func TestNativeSignatureLifecycle(t *testing.T) {
	for _, algorithm := range []string{"ML-DSA-44", "ML-DSA-65", "ML-DSA-87"} {
		t.Run(algorithm, func(t *testing.T) {
			sig, err := NewSig(algorithm)
			if err != nil {
				t.Fatal(err)
			}
			defer sig.Close()
			if sig.Algorithm() != algorithm || sig.LibOQSName() == "" {
				t.Fatal("incorrect algorithm identity")
			}
			keys, err := sig.Keygen()
			if err != nil {
				t.Fatal(err)
			}
			original := append([]byte(nil), keys.SecretKey...)
			if _, err := sig.Keygen(); err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(keys.SecretKey, original) {
				t.Fatal("regeneration destroyed exported key")
			}
			for _, message := range [][]byte{[]byte("QNSI custody test"), nil} {
				signature, err := sig.Sign(message, keys.SecretKey)
				if err != nil {
					t.Fatal(err)
				}
				if !bytes.Equal(keys.SecretKey, original) {
					t.Fatal("signing destroyed caller key")
				}
				valid, err := sig.Verify(message, signature, keys.PublicKey)
				if err != nil || !valid {
					t.Fatalf("verification failed: %v", err)
				}
				if valid, err := sig.Verify([]byte("changed"), signature, keys.PublicKey); err == nil && valid {
					t.Fatal("accepted changed message")
				}
				signature[0] ^= 1
				if valid, err := sig.Verify(message, signature, keys.PublicKey); err == nil && valid {
					t.Fatal("accepted changed signature")
				}
			}
			if _, err := sig.Sign([]byte("message"), nil); err == nil {
				t.Fatal("accepted invalid secret key")
			}
			if _, err := sig.Verify(nil, nil, nil); err == nil {
				t.Fatal("accepted invalid public key")
			}
			sig.Close()
			sig.Close()
			if _, err := sig.Keygen(); err == nil {
				t.Fatal("keygen after close")
			}
			if _, err := sig.Sign(nil, keys.SecretKey); err == nil {
				t.Fatal("signing after close")
			}
			if _, err := sig.Verify(nil, nil, keys.PublicKey); err == nil {
				t.Fatal("verification after close")
			}
		})
	}
}

func TestUnknownNativeAlgorithmsFailClosed(t *testing.T) {
	if _, err := NewKem("not-an-algorithm"); err == nil {
		t.Fatal("accepted unknown KEM")
	}
	if _, err := NewSig("not-an-algorithm"); err == nil {
		t.Fatal("accepted unknown signature")
	}
}

func TestNativeCatalogAvailability(t *testing.T) {
	if version := oqs.LiboqsVersion(); version != "0.16.0" {
		t.Fatalf("native version = %q, require 0.16.0", version)
	}
	for _, algorithm := range SupportedKEMs() {
		enabled := false
		for _, candidate := range kemCandidates[algorithm] {
			enabled = enabled || oqs.IsKEMEnabled(candidate)
		}
		kem, err := NewKem(algorithm)
		if !enabled {
			if err == nil {
				kem.Close()
				t.Fatalf("unavailable KEM %s accepted", algorithm)
			}
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		if kem.Algorithm() != algorithm {
			t.Fatal("canonical KEM identity changed")
		}
		kem.Close()
	}
	for _, algorithm := range SupportedSignatures() {
		enabled := false
		for _, candidate := range sigCandidates[algorithm] {
			enabled = enabled || oqs.IsSigEnabled(candidate)
		}
		sig, err := NewSig(algorithm)
		if !enabled {
			if err == nil {
				sig.Close()
				t.Fatalf("unavailable signature %s accepted", algorithm)
			}
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		if sig.Algorithm() != algorithm {
			t.Fatal("canonical signature identity changed")
		}
		sig.Close()
	}
}

func TestConcurrentNativeUseAndClose(t *testing.T) {
	kem, err := NewKem("ML-KEM-768")
	if err != nil {
		t.Fatal(err)
	}
	defer kem.Close()
	keys, err := kem.Keygen()
	if err != nil {
		t.Fatal(err)
	}
	enc, err := kem.Encapsulate(keys.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	sig, err := NewSig("ML-DSA-65")
	if err != nil {
		t.Fatal(err)
	}
	defer sig.Close()
	signingKeys, err := sig.Keygen()
	if err != nil {
		t.Fatal(err)
	}
	var group sync.WaitGroup
	for i := 0; i < 16; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			if shared, err := kem.Decapsulate(enc.Ciphertext, keys.SecretKey); err != nil || !bytes.Equal(shared, enc.SharedSecret) {
				t.Errorf("concurrent decapsulation failed: %v", err)
			}
			if signature, err := sig.Sign([]byte("concurrent"), signingKeys.SecretKey); err != nil {
				t.Error(err)
			} else if valid, err := sig.Verify([]byte("concurrent"), signature, signingKeys.PublicKey); err != nil || !valid {
				t.Errorf("concurrent verification failed: %v", err)
			}
		}()
	}
	group.Wait()
	for i := 0; i < 16; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			// An operation racing Close may succeed first or reject a closed
			// context; it must never access freed native memory.
			_, _ = kem.Decapsulate(enc.Ciphertext, keys.SecretKey)
			_, _ = sig.Sign(nil, signingKeys.SecretKey)
			kem.Close()
			sig.Close()
		}()
	}
	group.Wait()
	if _, err := kem.Keygen(); err == nil {
		t.Fatal("concurrent close did not close KEM")
	}
	if _, err := sig.Keygen(); err == nil {
		t.Fatal("concurrent close did not close signature")
	}
}
