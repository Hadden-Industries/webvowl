"""Tests for this repository's stable Python runtime policy."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "util"))
try:
    import _commands as runtime
finally:
    sys.path.pop(0)


class PythonMinimumTests(unittest.TestCase):
    target = tuple(
        int(part)
        for part in (Path(__file__).resolve().parents[1] / ".python-version")
        .read_text(encoding="utf-8")
        .strip()
        .split(".")
    )

    def test_rejects_previous_python_minor(self) -> None:
        with (
            mock.patch.object(
                runtime.sys, "version_info", (self.target[0], self.target[1] - 1, 99)
            ),
            self.assertRaisesRegex(runtime.SetupError, "Stable Python"),
        ):
            runtime.require_python_version()

    def test_accepts_minimum_and_newer_python(self) -> None:
        for version in (self.target, (*self.target[:2], self.target[2] + 1)):
            with (
                self.subTest(version=version),
                mock.patch.object(runtime.sys, "version_info", version),
            ):
                runtime.require_python_version()

    def test_reads_changed_patch_minimum_from_repository_version_file(self) -> None:
        class Prerelease(tuple):
            releaselevel = "candidate"

        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            (repo / ".python-version").write_text("3.16.2\n", encoding="utf-8")
            with mock.patch.object(
                runtime, "__file__", str(repo / "util" / "_commands.py")
            ):
                for version in ((3, 16, 0), (3, 16, 1), Prerelease((3, 16, 2))):
                    with (
                        self.subTest(version=version),
                        mock.patch.object(runtime.sys, "version_info", version),
                        self.assertRaisesRegex(runtime.SetupError, "Python 3.16.2"),
                    ):
                        runtime.require_python_version()
                with mock.patch.object(runtime.sys, "version_info", (3, 16, 2)):
                    runtime.require_python_version()


if __name__ == "__main__":
    unittest.main()
