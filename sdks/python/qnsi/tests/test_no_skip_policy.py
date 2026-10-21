"""The release-suite gate must reject intentionally incomplete child fixtures."""

import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize("outcome", ["skip", "xfail", "xpass"])
def test_incomplete_child_suite_is_rejected(tmp_path, outcome):
    bodies = {
        "skip": "pytest.skip('gate fixture')",
        "xfail": "assert False",
        "xpass": "assert True",
    }
    marker = "@pytest.mark.xfail\n" if outcome != "skip" else ""
    fixture = tmp_path / "test_incomplete_fixture.py"
    fixture.write_text(
        f"import pytest\n{marker}def test_fixture():\n    {bodies[outcome]}\n", encoding="utf-8"
    )
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(Path(__file__).parent)
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-p",
            "conftest",
            "--confcutdir",
            str(tmp_path),
            str(fixture),
        ],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "skipped or expected-failure tests are forbidden" in result.stdout
