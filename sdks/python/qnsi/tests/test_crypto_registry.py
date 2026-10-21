from qnsi.crypto import _registry as registry


def test_registry_prefers_liboqs_016_names() -> None:
    assert registry.KEM_ALGORITHMS["HQC-128"][0] == "HQC-1"
    assert registry.KEM_ALGORITHMS["HQC-192"][0] == "HQC-3"
    assert registry.KEM_ALGORITHMS["HQC-256"][0] == "HQC-5"
    assert registry.SIGNATURE_ALGORITHMS["SLH-DSA-SHAKE-128f"][0] == "SLH_DSA_PURE_SHAKE_128F"
