#!/usr/bin/env python3
"""PROVABLE end-to-end verification for the `qnsp` Python SDK against PRODUCTION.

(.claude/rules/provable-evidence-mandate.md — the proof IS the deliverable.)

Runs the REAL developer journey with NO mocks, mirroring the npm harness
(scripts/verify/sdk-qnsp-e2e.mjs):

  1. signup (free)          -> POST https://cloud.qnsi.heossi.com/api/signup/initiate
  2. SDK activate           -> POST /billing/v1/sdk/activate (first KMS call triggers it)
  3. kms.create_key         -> real PQC signing key (dilithium-3 = ML-DSA-65)
  4. kms.sign / kms.verify  -> sign bytes + verify the signature
  5. cleanup                -> login + schedule-deletion of the test tenant

Uses the LOCAL SOURCE (sdks/python/qnsi/src) so it proves the code in this repo,
pre-publish. Exit 0 = all PASS; exit 1 = any FAIL. Re-runnable by anyone:

  python3 sdks/python/qnsi/verify/kms_e2e.py
"""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

# Import the LOCAL SDK source (pre-publish proof).
_SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(_SRC))

import httpx  # noqa: E402  (the SDK's own dependency)

from qnsi import QnsiClient  # noqa: E402

CLOUD = os.environ.get("QNSP_E2E_CLOUD", "https://cloud.qnsi.heossi.com")
API = os.environ.get("QNSP_E2E_API", "https://api.qnsi.heossi.com")

_passed = 0
_failed = 0


def ok(name: str, detail: str = "") -> None:
    global _passed
    _passed += 1
    print(f"  PASS  {name}" + (f" — {detail}" if detail else ""))


def bad(name: str, detail: str = "") -> None:
    global _failed
    _failed += 1
    print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    print(f"\nQNSP Python SDK e2e verification (PRODUCTION) — {API}\n")
    rand = secrets.token_hex(4)
    email = f"qnsp-py-e2e-{rand}@example.com"
    password = "E2eTestPass123!"

    # 1. signup
    with httpx.Client(timeout=30.0) as h:
        res = h.post(
            f"{CLOUD}/api/signup/initiate",
            json={
                "firstName": "E2E", "lastName": "PySDK",
                "organizationName": f"PySDK E2E {rand}",
                "email": email, "country": "Singapore", "countryCode": "sgp",
                "password": password, "plan": "free",
                "metadata": {"tp": {"primaryGoal": "ai-inference"}},
            },
        )
        signup = res.json() if res.content else {}
        if res.status_code == 200 and signup.get("directProvisioned") and isinstance(signup.get("firstApiKey"), str):
            ok("signup (free, card-free)", f"tenant={signup.get('tenantSlug')} key={signup['firstApiKey'][:16]}…")
        else:
            bad("signup", f"HTTP {res.status_code} {str(signup)[:160]}")
            return finish()

    api_key = signup["firstApiKey"]
    tenant_id = signup.get("tenantId")
    client = QnsiClient(api_key=api_key)

    # 2. activate (implicit on first call) + 3. create_key
    key_id = None
    try:
        key = client.kms.create_key(algorithm="dilithium-3")
        key_id = key.get("keyId") or key.get("id")
        if key_id:
            ok("kms.create_key (ML-DSA-65 / dilithium-3)", f"keyId={key_id}")
        else:
            bad("kms.create_key", str(key)[:220])
    except Exception as e:  # noqa: BLE001
        bad("kms.create_key", repr(e))

    # 4. sign + verify
    if key_id:
        data = f"py-e2e-sign-{rand}".encode()
        signature = None
        try:
            signature = client.kms.sign(key_id, data)
            if signature:
                ok("kms.sign", f"{len(signature)} sig bytes")
            else:
                bad("kms.sign", "empty signature")
        except Exception as e:  # noqa: BLE001
            bad("kms.sign", repr(e))
        if signature:
            try:
                valid = client.kms.verify(key_id, data, signature)
                ok("kms.verify", "signature valid=true") if valid is True else bad("kms.verify", f"valid={valid}")
            except Exception as e:  # noqa: BLE001
                bad("kms.verify", repr(e))

    # 5. cleanup (best-effort; not a test)
    try:
        with httpx.Client(timeout=30.0) as h:
            lr = h.post(
                f"{API}/edge/auth/login",
                json={"tenantId": tenant_id, "email": email, "password": password},
                headers={"user-agent": "qnsp-py-e2e/1.0"},
            )
            lj = lr.json() if lr.content else {}
            token = lj.get("accessToken")
            if token:
                dr = h.post(
                    f"{API}/proxy/tenant/v1/tenants/{tenant_id}/schedule-deletion",
                    headers={"authorization": f"Bearer {token}", "x-qnsp-tenant-id": tenant_id},
                    json={},
                )
                print(f"  cleanup: schedule-deletion HTTP {dr.status_code} (test tenant {signup.get('tenantSlug')})")
            else:
                print(f"  cleanup: login returned no token; test tenant {signup.get('tenantSlug')} left for purge")
    except Exception as e:  # noqa: BLE001
        print(f"  cleanup: {e!r} (test tenant {signup.get('tenantSlug')})")

    return finish()


def finish() -> int:
    print(f"\n{_passed} passed, {_failed} failed\n")
    return 0 if _failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
