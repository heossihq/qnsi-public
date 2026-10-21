"""QNSI - official Python SDK for the Quantum-Native Security Infrastructure.

Python service conveniences, a manifest operation catalog and optional native
cryptography. Cross-language wire parity and production assurance require
separate verification; importing this module does not establish either.

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
    pair = kem.keygen()
    enc = kem.encapsulate(pair.public_key)
    assert kem.decapsulate(enc.ciphertext, pair.secret_key) == enc.shared_secret

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

# DERIVED, never hand-typed. This literal said "0.4.0" while pip installed 0.4.1 and the
# activation handshake reported "0.3.0" - three versions in one package. See
# _activation._package_version for the full story.
from qnsi._activation import SDK_VERSION
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

__version__ = SDK_VERSION

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
    "AIClient",
    "AccessClient",
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
    "QnspApiError",
    "QnspAuthError",
    # Deprecated pre-rebrand aliases
    "QnspClient",
    "QnspError",
    "QnspNetworkError",
    "QnspWebhookError",
    "QnspWebhookEvent",
    "SearchClient",
    "StorageClient",
    "TenantClient",
    "VaultClient",
    "__version__",
    "parse_qnsi_webhook",
    "parse_qnsp_webhook",
    "verify_qnsi_webhook_signature",
    "verify_qnsp_webhook_signature",
]
