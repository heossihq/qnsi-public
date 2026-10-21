"""Local native primitive checks, not production transport or release evidence."""

import oqs
import pytest

from qnsi.crypto import Falcon, MlDsa, MlKem, SlhDsa
from qnsi.crypto._registry import (
    KEM_ALGORITHMS,
    SIGNATURE_ALGORITHMS,
    is_supported_kem,
    is_supported_signature,
    resolve_kem_candidates,
    resolve_signature_candidates,
)


def test_native_runtime_version_matches_binding():
    assert oqs.oqs_version() == "0.16.0"


@pytest.mark.parametrize("algorithm", list(KEM_ALGORITHMS))
def test_native_kem_roundtrip(algorithm):
    candidates = resolve_kem_candidates(algorithm)
    enabled = oqs.get_enabled_kem_mechanisms()
    assert is_supported_kem(algorithm)
    if not any(candidate in enabled for candidate in candidates):
        with pytest.raises(RuntimeError, match="does not expose KEM"):
            MlKem(algorithm)
        return
    with MlKem(algorithm) as kem:
        assert kem.algorithm == algorithm
        assert kem.liboqs_name in enabled
        pair = kem.keygen()
        assert len(pair.public_key) == kem.public_key_bytes > 0
        assert len(pair.secret_key) == kem.secret_key_bytes > 0
        encapsulation = kem.encapsulate(bytearray(pair.public_key))
        assert len(encapsulation.ciphertext) == kem.ciphertext_bytes > 0
        assert len(encapsulation.shared_secret) == kem.shared_secret_bytes > 0
        assert (
            kem.decapsulate(bytearray(encapsulation.ciphertext), bytearray(pair.secret_key))
            == encapsulation.shared_secret
        )
        for arguments in [("invalid", pair.secret_key), (encapsulation.ciphertext, "invalid")]:
            with pytest.raises(TypeError):
                kem.decapsulate(*arguments)
        with pytest.raises(TypeError):
            kem.encapsulate("invalid")
        with pytest.raises(ValueError):
            kem.encapsulate(b"short")
        with pytest.raises(ValueError):
            kem.decapsulate(b"short", pair.secret_key)
        with pytest.raises(ValueError):
            kem.decapsulate(encapsulation.ciphertext, b"short")
    kem.close()
    kem.__del__()
    for operation in [
        kem.keygen,
        lambda: kem.encapsulate(pair.public_key),
        lambda: kem.decapsulate(encapsulation.ciphertext, pair.secret_key),
    ]:
        with pytest.raises(RuntimeError, match="closed"):
            operation()


@pytest.mark.parametrize("algorithm", list(SIGNATURE_ALGORITHMS))
def test_native_signature_roundtrip(algorithm):
    candidates = resolve_signature_candidates(algorithm)
    enabled = oqs.get_enabled_sig_mechanisms()
    assert is_supported_signature(algorithm)
    wrapper = (
        SlhDsa
        if algorithm.startswith("SLH")
        else Falcon
        if algorithm.startswith("Falcon")
        else MlDsa
    )
    if not any(candidate in enabled for candidate in candidates):
        with pytest.raises(RuntimeError, match="does not expose signature"):
            wrapper(algorithm)
        return
    with wrapper(algorithm) as signature:
        assert signature.algorithm == algorithm
        assert signature.liboqs_name in enabled
        pair = signature.keygen()
        assert len(pair.public_key) == signature.public_key_bytes > 0
        assert len(pair.secret_key) == signature.secret_key_bytes > 0
        value = signature.sign(bytearray(b"QNSI native test"), bytearray(pair.secret_key))
        assert 0 < len(value) <= signature.signature_max_bytes
        assert signature.verify(
            bytearray(b"QNSI native test"), bytearray(value), bytearray(pair.public_key)
        )
        assert not signature.verify(b"tampered", value, pair.public_key)
        with oqs.Signature(signature.liboqs_name) as independent:
            assert independent.verify(b"QNSI native test", value, pair.public_key)
        for arguments in [("invalid", pair.secret_key), (b"message", "invalid")]:
            with pytest.raises(TypeError):
                signature.sign(*arguments)
        for arguments in [
            ("invalid", value, pair.public_key),
            (b"message", "invalid", pair.public_key),
            (b"message", value, "invalid"),
        ]:
            with pytest.raises(TypeError):
                signature.verify(*arguments)
        with pytest.raises(ValueError):
            signature.sign(b"message", b"short")
        with pytest.raises(ValueError):
            signature.verify(b"message", value, b"short")
        for invalid in [b"", b"x" * (signature.signature_max_bytes + 1)]:
            with pytest.raises(ValueError):
                signature.verify(b"message", invalid, pair.public_key)
    signature.close()
    signature.__del__()
    for operation in [
        signature.keygen,
        lambda: signature.sign(b"message", pair.secret_key),
        lambda: signature.verify(b"message", value, pair.public_key),
    ]:
        with pytest.raises(RuntimeError, match="closed"):
            operation()


def test_unknown_algorithms_fail_before_native_operation():
    assert not is_supported_kem("unknown")
    assert not is_supported_signature("unknown")
    with pytest.raises(ValueError, match="Unknown KEM"):
        MlKem("unknown")
    with pytest.raises(ValueError, match="Unknown signature"):
        MlDsa("unknown")
