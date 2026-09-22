# SPDX-License-Identifier: AGPL-3.0-only
"""Format authored Markdown documents while preserving literal content."""

import argparse
import json
import os
import re
import subprocess
import sys
import sysconfig
import tomllib
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
CONFIG = PACKAGE_ROOT / ".snapperrc.toml"
EXECUTABLE = Path(sysconfig.get_path("scripts")) / (
    "snapper-fmt.exe" if os.name == "nt" else "snapper-fmt"
)

DOCUMENT_SELECTOR = Path(__file__).with_name("select_documents.mjs")


def authored_document_paths(package_root: Path) -> list[Path]:
    """Select root/docs Markdown using Prettier's current ignore rules."""
    candidates = sorted(
        path
        for path in [
            *package_root.glob("*.md"),
            *(package_root / "docs").rglob("*.md"),
        ]
        if path.is_file() and not path.is_symlink()
    )
    if not candidates:
        return []
    result = subprocess.run(
        ["node", str(DOCUMENT_SELECTOR), str(package_root.resolve())],
        input=json.dumps([str(path.resolve()) for path in candidates]),
        cwd=package_root,
        capture_output=True,
        text=True,
        encoding="utf8",
        check=True,
    )
    return sorted(Path(path) for path in json.loads(result.stdout))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    with CONFIG.open("rb") as config:
        tomllib.load(config)
    documents = authored_document_paths(PACKAGE_ROOT)
    if not documents:
        print("No authored Markdown documents selected.")
        return 0
    if args.check:
        return check_documents(documents)
    result = subprocess.run(
        [
            str(EXECUTABLE),
            "--native",
            "--config",
            str(CONFIG),
            "--in-place",
            *map(str, documents),
        ],
        cwd=PACKAGE_ROOT,
        check=False,
    )
    return result.returncode


def check_documents(paths: list[Path]) -> int:
    """Enforce native formatting findings even when its render backstop preserves input."""
    result = subprocess.run(
        [
            str(EXECUTABLE),
            "--native",
            "--config",
            str(CONFIG),
            "--check",
            "--output-format",
            "json",
            *map(str, paths),
        ],
        cwd=PACKAGE_ROOT,
        capture_output=True,
        text=True,
        encoding="utf8",
        check=False,
    )
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")
    findings = json.loads(result.stdout)
    # Exit 1 can represent only an indentation disagreement with Prettier.
    # Prettier owns Markdown layout; Snapper owns sentence boundaries.
    failed = result.returncode not in (0, 1) or (
        result.returncode != 0 and not findings
    )
    for document in findings:
        original = Path(document["file"]).read_text(encoding="utf8")
        if document["would_reformat"]:
            formatted = subprocess.run(
                [
                    str(EXECUTABLE),
                    "--native",
                    "--config",
                    str(CONFIG),
                    document["file"],
                ],
                cwd=PACKAGE_ROOT,
                capture_output=True,
                text=True,
                encoding="utf8",
                check=False,
            )
            if formatted.returncode != 0 or [
                line.lstrip(" \t") for line in formatted.stdout.splitlines()
            ] != [line.lstrip(" \t") for line in original.splitlines()]:
                failed = True
                print(f"Would reformat: {document['file']}")
                if formatted.stderr:
                    print(formatted.stderr, file=sys.stderr, end="")
        for diagnostic in document["diagnostics"]:
            # Native 0.11.2 counts quoted numbering as a sentence. Check the
            # complete item without its quote prefix; genuine fused prose
            # must still fail, including in nested blockquotes.
            line = original.splitlines()[diagnostic["line"] - 1]
            # Scan once instead of using nested regex quantifiers, which can
            # backtrack exponentially on alternating whitespace/quote markers.
            item_start = 0
            quoted = False
            while item_start < len(line):
                character = line[item_start]
                if character == ">":
                    quoted = True
                elif character not in " \t":
                    break
                item_start += 1
            item_content = line[item_start:]
            if (
                diagnostic["kind"] == "fused"
                and quoted
                and re.match(r"^\d+[.)]\s+", item_content)
            ):
                item = subprocess.run(
                    [
                        str(EXECUTABLE),
                        "--native",
                        "--config",
                        str(CONFIG),
                        "--check",
                        "--output-format",
                        "json",
                        "--stdin-filepath",
                        document["file"],
                    ],
                    input=item_content + "\n",
                    cwd=PACKAGE_ROOT,
                    capture_output=True,
                    text=True,
                    encoding="utf8",
                    check=False,
                )
                reports = json.loads(item.stdout)
                if (
                    item.returncode == 0
                    and isinstance(reports, list)
                    and all(
                        finding["kind"] == "long"
                        for report in reports
                        for finding in report["diagnostics"]
                    )
                ):
                    continue
            # Snapper 0.11.2 sometimes treats adjacent Markdown list items as
            # one wrapped sentence. A new item is a structural boundary, not
            # a continuation; would_reformat and all other diagnostics still
            # apply, including wrapped lines within an item or a blockquote.
            if diagnostic["kind"] == "wrap" and re.match(
                r"^\s*(?:[-+*]|\d+[.)])\s+", diagnostic["excerpt"]
            ):
                continue
            if diagnostic["kind"] != "long":
                failed = True
                print(
                    f"{document['file']}:{diagnostic['line']}: {diagnostic['kind']}: {diagnostic['excerpt']}"
                )
    if not failed:
        print(f"Semantic line formatting checked: {len(paths)} authored documents.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
