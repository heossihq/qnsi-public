package crypto

import (
	"errors"
	"fmt"
	"sync"

	"github.com/open-quantum-safe/liboqs-go/oqs"
)

// SigKeyPair is the result of signature keygen.
type SigKeyPair struct {
	PublicKey []byte
	SecretKey []byte
}

// Sig is a wrapper around liboqs-go's *oqs.Signature that exposes the
// canonical QNSP API surface (Keygen / Sign / Verify).
// Methods serialize native access with Close. Do not copy a Sig value.
type Sig struct {
	mu          sync.Mutex
	algName     string
	internalAlg string
	sig         oqs.Signature
	initialized bool
}

// NewSig constructs a signature scheme for the given canonical QNSP
// algorithm name. The caller must Close the returned Sig when finished.
func NewSig(algorithm string) (*Sig, error) {
	candidates, ok := sigCandidates[algorithm]
	if !ok {
		return nil, fmt.Errorf("qnsp/crypto: unknown signature algorithm %q (call SupportedSignatures to enumerate)", algorithm)
	}
	for _, candidate := range candidates {
		if oqs.IsSigEnabled(candidate) {
			s := &Sig{algName: algorithm, internalAlg: candidate}
			if err := s.sig.Init(candidate, nil); err != nil {
				return nil, fmt.Errorf("qnsp/crypto: liboqs init failed for %q: %w", candidate, err)
			}
			s.initialized = true
			return s, nil
		}
	}
	return nil, fmt.Errorf("qnsp/crypto: signature %q not enabled in this liboqs build (tried %v)", algorithm, candidates)
}

// Algorithm returns the canonical QNSP algorithm name.
func (s *Sig) Algorithm() string { return s.algName }

// LibOQSName returns the underlying liboqs candidate name.
func (s *Sig) LibOQSName() string { return s.internalAlg }

// Keygen produces a public/secret key pair.
func (s *Sig) Keygen() (SigKeyPair, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.initialized {
		return SigKeyPair{}, errors.New("qnsp/crypto: Sig not initialized")
	}
	if previous := s.sig.ExportSecretKey(); len(previous) > 0 {
		oqs.MemCleanse(previous)
	}
	pk, err := s.sig.GenerateKeyPair()
	if err != nil {
		return SigKeyPair{}, fmt.Errorf("qnsp/crypto: keygen: %w", err)
	}
	sk := s.sig.ExportSecretKey()
	return SigKeyPair{PublicKey: pk, SecretKey: append([]byte(nil), sk...)}, nil
}

// Sign signs `message` using the supplied secret key. The signature is
// returned as raw bytes.
func (s *Sig) Sign(message, secretKey []byte) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.initialized {
		return nil, errors.New("qnsp/crypto: Sig not initialized")
	}
	var fresh oqs.Signature
	if err := fresh.Init(s.internalAlg, append([]byte(nil), secretKey...)); err != nil {
		return nil, fmt.Errorf("qnsp/crypto: rebind sig for sign: %w", err)
	}
	defer fresh.Clean()
	sig, err := fresh.Sign(message)
	if err != nil {
		return nil, fmt.Errorf("qnsp/crypto: sign: %w", err)
	}
	return sig, nil
}

// Verify checks a signature.
func (s *Sig) Verify(message, signature, publicKey []byte) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.initialized {
		return false, errors.New("qnsp/crypto: Sig not initialized")
	}
	ok, err := s.sig.Verify(message, signature, publicKey)
	if err != nil {
		return false, fmt.Errorf("qnsp/crypto: verify: %w", err)
	}
	return ok, nil
}

// Close releases the underlying liboqs resources.
func (s *Sig) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.initialized {
		s.sig.Clean()
		s.initialized = false
	}
}
