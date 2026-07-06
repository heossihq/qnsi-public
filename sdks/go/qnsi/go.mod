module github.com/heossihq/qnsi-public/sdks/go/qnsi

go 1.22

// liboqs-go does not publish semver tags; the upstream guidance is to
// use `go get github.com/open-quantum-safe/liboqs-go@latest`. The
// pseudo-version pinned here corresponds to the upstream main branch
// snapshot that tracks liboqs C library 0.12.0.
require github.com/open-quantum-safe/liboqs-go v0.0.0-20260310140033-75451133b94a
