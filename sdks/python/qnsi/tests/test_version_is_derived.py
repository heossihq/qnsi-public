"""REGRESSION GUARD: one package, one version.

On 2026-07-14 the published Python SDK carried THREE different versions at once:

    pyproject.toml           0.4.1   <- what pip actually installs
    __init__.py __version__  0.4.0   <- what a user sees
    _activation SDK_VERSION  0.3.0   <- what we report to OUR OWN backend on every activate

Proven from a clean-room install of the freshly published 0.4.1:

    pip show qnsi   ->  Version: 0.4.1
    qnsi.__version__ -> 0.4.0

Every Python activation had therefore been telling billing-service `sdkVersion: "0.3.0"`.
Our own adoption telemetry - which SDK versions are in the field - was wrong, and nothing
could catch it, because a hand-typed number agrees with nothing by construction. It is the
same disease as the hand-typed product facts on the marketing site: many copies of one fact,
and no gate proving they agree.

Both are now DERIVED from importlib.metadata, so they cannot drift. This asserts it.
"""

from __future__ import annotations

from importlib.metadata import version

import qnsi
from qnsi._activation import SDK_VERSION


def test_dunder_version_is_the_installed_version() -> None:
    """`qnsi.__version__` must be what pip actually installed - not a stale literal."""
    assert qnsi.__version__ == version("qnsi")


def test_activation_reports_the_installed_version() -> None:
    """The version we send to our OWN backend must be the real one.

    It said "0.3.0" while the package was 0.4.1.
    """
    assert SDK_VERSION == version("qnsi")


def test_all_three_agree() -> None:
    assert qnsi.__version__ == SDK_VERSION == version("qnsi")
