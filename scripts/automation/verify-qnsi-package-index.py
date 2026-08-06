#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


USER_AGENT = "QNSI-public-package-verifier/1.0"


def _get_json(url: str) -> dict:
	request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
	with urllib.request.urlopen(request, timeout=20) as response:
		return json.load(response)


def _get_text(url: str) -> str:
	request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
	with urllib.request.urlopen(request, timeout=20) as response:
		return response.read().decode("utf-8")


def _registry_version(artifact: dict) -> str:
	ecosystem = artifact["ecosystem"]
	name = artifact["name"]
	if ecosystem == "npm":
		encoded = urllib.parse.quote(name, safe="")
		return _get_json(f"https://registry.npmjs.org/{encoded}/latest")["version"]
	if ecosystem == "PyPI":
		return _get_json(f"https://pypi.org/pypi/{name}/json")["info"]["version"]
	if ecosystem == "crates.io":
		return _get_json(f"https://crates.io/api/v1/crates/{name}")["crate"]["max_version"]
	if ecosystem == "Maven Central":
		group, artifact_id = name.split(":", maxsplit=1)
		group_path = group.replace(".", "/")
		metadata = _get_text(
			f"https://repo1.maven.org/maven2/{group_path}/{artifact_id}/maven-metadata.xml",
		)
		root = ET.fromstring(metadata)
		release = root.findtext("./versioning/release")
		if release is None:
			raise RuntimeError(f"Maven release version is missing for {name}")
		return release
	if ecosystem == "Go modules":
		tag = f'sdks/go/qnsi/v{artifact["version"]}'
		result = subprocess.run(
			["git", "ls-remote", "--tags", "https://github.com/heossihq/qnsi-public.git", tag],
			check=False,
			capture_output=True,
			text=True,
		)
		if result.returncode != 0 or not result.stdout.strip():
			raise RuntimeError(f"Go module tag is missing: {tag}")
		return artifact["version"]
	raise RuntimeError(f"Unsupported ecosystem: {ecosystem}")


def main(argv: list[str]) -> int:
	parser = argparse.ArgumentParser(
		description="Verify every QNSI package-index version against its canonical registry.",
	)
	parser.add_argument("index", nargs="?", default="PACKAGE-INDEX.json")
	args = parser.parse_args(argv)

	index_path = Path(args.index)
	index = json.loads(index_path.read_text(encoding="utf-8"))
	artifacts = index.get("artifacts")
	if not isinstance(artifacts, list) or not artifacts:
		raise RuntimeError(f"No artifacts found in {index_path}")

	verified: list[str] = []
	for artifact in artifacts:
		expected = artifact["version"]
		actual = _registry_version(artifact)
		if actual != expected:
			raise RuntimeError(
				f'{artifact["ecosystem"]} {artifact["name"]}: index={expected}, registry={actual}',
			)
		verified.append(f'{artifact["ecosystem"]} {artifact["name"]}@{actual}')

	for item in verified:
		print(f"verified: {item}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main(sys.argv[1:]))
