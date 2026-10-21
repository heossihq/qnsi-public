"""Skipped or expected-failure tests cannot satisfy the SDK acceptance suite."""

import importlib.util
import json
import os
import sys
import threading
from pathlib import Path

import httpx
import pytest
from test_services import _activation_payload

from qnsi import QnsiClient

FUNCTION_CALLS = set()
FUNCTION_KEYS = {}
SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src" / "qnsi"
GATE_SPEC = importlib.util.spec_from_file_location(
    "qnsi_function_gate",
    Path(__file__).resolve().parents[4] / "scripts" / "verify" / "python-sdk-coverage.py",
)
assert GATE_SPEC and GATE_SPEC.loader
FUNCTION_GATE = importlib.util.module_from_spec(GATE_SPEC)
GATE_SPEC.loader.exec_module(FUNCTION_GATE)


def record_function_call(frame, event, arg):
    if event != "call":
        return
    code = frame.f_code
    if not code.co_filename.startswith(str(SOURCE_ROOT) + os.sep):
        return
    key = FUNCTION_KEYS.get(code)
    if key is None:
        key = FUNCTION_GATE.function_key(SOURCE_ROOT, code)
        FUNCTION_KEYS[code] = key
    FUNCTION_CALLS.add(key)


def pytest_sessionstart(session):
    if os.environ.get("QNSI_FUNCTION_COVERAGE_FILE"):
        sys.setprofile(record_function_call)
        threading.setprofile(record_function_call)


@pytest.fixture
def client_and_requests():
    recorded = []
    response = {"body": {"result": "accepted"}}

    def handler(request):
        if request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(200, json=_activation_payload())
        recorded.append(request)
        return httpx.Response(200, json=response["body"])

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
    ):
        yield client, recorded, response


def pytest_sessionfinish(session, exitstatus):
    if os.environ.get("QNSI_FUNCTION_COVERAGE_FILE"):
        sys.setprofile(None)
        threading.setprofile(None)
        Path(os.environ["QNSI_FUNCTION_COVERAGE_FILE"]).write_text(
            json.dumps(sorted(FUNCTION_CALLS)), encoding="utf-8"
        )
    reporter = session.config.pluginmanager.get_plugin("terminalreporter")
    if reporter is None:
        session.exitstatus = pytest.ExitCode.TESTS_FAILED
        return
    incomplete = {
        name: len(reporter.stats.get(name, [])) for name in ("skipped", "xfailed", "xpassed")
    }
    if any(incomplete.values()):
        reporter.write_line(f"FAIL: skipped or expected-failure tests are forbidden: {incomplete}")
        session.exitstatus = pytest.ExitCode.TESTS_FAILED
