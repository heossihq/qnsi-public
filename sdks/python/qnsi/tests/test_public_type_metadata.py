"""Exercise the SDK's advertised type metadata, including lazy annotation functions."""

import importlib
import inspect
import pkgutil
from typing import get_type_hints

import qnsi


def test_public_and_internal_type_metadata_is_resolvable():
    seen = set()

    def check(value):
        if value in seen:
            return
        seen.add(value)
        assert isinstance(get_type_hints(value), dict)
        annotate = getattr(value, "__annotate__", None)
        if annotate is not None:
            assert isinstance(annotate(1), dict)

    for entry in pkgutil.walk_packages(qnsi.__path__, qnsi.__name__ + "."):
        module = importlib.import_module(entry.name)
        for value in vars(module).values():
            if getattr(value, "__module__", "").startswith("qnsi"):
                if inspect.isfunction(value):
                    check(value)
                elif inspect.isclass(value):
                    check(value)
                    for member in vars(value).values():
                        if isinstance(member, (staticmethod, classmethod)):
                            member = member.__func__
                        elif isinstance(member, property):
                            member = member.fget
                        if inspect.isfunction(member):
                            check(member)
