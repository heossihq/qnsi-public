"""QNSI - official Python SDK for the Quantum-Native Security Infrastructure.

Mirrors the surface of the ``@heossihq/qnsi-*`` TypeScript SDK family for the Python
ecosystem. Same wire contracts, same algorithm names, same FIPS 203/204/205
posture - pick whichever language fits your stack and the byte-for-byte
outputs round-trip.

Quick start::

    from qnsi import QnsiClient

    qnsp = QnsiClient(api_key=os.environ["QNSP_API_KEY"])

    # Vault
    secret = qnsp.vault.create_secret(
        name="openai-key",
        payload_b64=base64.b64encode(b"sk-...").decode(),
    )

    # KMS
    key = qnsp.kms.create_key(algorithm="ml-dsa-65", purpose="signing")
    sig = qnsp.kms.sign(key["keyId"], data=b"hello")

    # Audit
    qnsp.audit.log_event(event_type="model.inference", payload={"modelId": "gpt-4o"})

Local PQC primitives (requires ``qnsi[crypto]``)::

    from qnsi.crypto import MlKem, MlDsa

    kem = MlKem("ML-KEM-768")
    pk, sk = kem.keygen()
    enc = kem.encapsulate(pk)
    assert kem.decapsulate(enc.ciphertext, sk) == enc.shared_secret

Webhook verification::

    from qnsi import parse_qnsi_webhook, QnsiWebhookError

    event = parse_qnsi_webhook(
        body=raw_body,
        signature_header=request.headers["x-qnsp-signature"],
        timestamp_header=request.headers["x-qnsp-timestamp"],
        secret=os.environ["QNSP_WEBHOOK_SECRET"],
    )

Free signup at https://cloud.qnsi.heossi.com/auth - no credit card.
"""

from qnsi._client import QnsiClient
from qnsi._errors import (
    QnsiApiError,
    QnsiAuthError,
    QnsiError,
    QnsiNetworkError,
    QnsiWebhookError,
)
from qnsi.access import AccessClient
from qnsi.ai import AIClient
from qnsi.audit import AuditClient
from qnsi.auth import AuthClient
from qnsi.billing import BillingClient
from qnsi.crypto_inventory import CryptoInventoryClient
from qnsi.kms import KmsClient
from qnsi.search import SearchClient
from qnsi.storage import StorageClient
from qnsi.tenant import TenantClient
from qnsi.vault import VaultClient
from qnsi.webhooks import (
    QnsiWebhookEvent,
    parse_qnsi_webhook,
    verify_qnsi_webhook_signature,
)

# DERIVED, never hand-typed. This literal said "0.4.0" while pip installed 0.4.1 and the
# activation handshake reported "0.3.0" - three versions in one package. See
# _activation._package_version for the full story.
from qnsi._activation import SDK_VERSION as __version__  # noqa: E402

# --- Deprecated pre-rebrand aliases (product is QNSI; use the Qnsi* names) ---
QnspClient = QnsiClient
QnspError = QnsiError
QnspApiError = QnsiApiError
QnspAuthError = QnsiAuthError
QnspNetworkError = QnsiNetworkError
QnspWebhookError = QnsiWebhookError
QnspWebhookEvent = QnsiWebhookEvent
parse_qnsp_webhook = parse_qnsi_webhook
verify_qnsp_webhook_signature = verify_qnsi_webhook_signature

__all__ = [
    "AccessClient",
    "AIClient",
    "AuditClient",
    "AuthClient",
    "BillingClient",
    "CryptoInventoryClient",
    "KmsClient",
    "QnsiApiError",
    "QnsiAuthError",
    "QnsiClient",
    "QnsiError",
    "QnsiNetworkError",
    "QnsiWebhookError",
    "QnsiWebhookEvent",
    "SearchClient",
    "StorageClient",
    "TenantClient",
    "VaultClient",
    "parse_qnsi_webhook",
    "verify_qnsi_webhook_signature",
    # Deprecated pre-rebrand aliases
    "QnspClient",
    "QnspError",
    "QnspApiError",
    "QnspAuthError",
    "QnspNetworkError",
    "QnspWebhookError",
    "QnspWebhookEvent",
    "parse_qnsp_webhook",
    "verify_qnsp_webhook_signature",
]
