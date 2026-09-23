# SPDX-License-Identifier: AGPL-3.0-only
"""Qualify sentence formatting, literal preservation and document selection."""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from format_docs import (
    CONFIG,
    EXECUTABLE,
    authored_document_paths,
    check_documents,
    main,
)


class NativeProseFormattingTests(unittest.TestCase):
    def test_selected_documents_do_not_check_unchanged_malformed_prose(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            (root / "docs").mkdir()
            good = root / "docs" / "selected [1].md"
            bad = root / "docs" / "unchanged.md"
            good.write_text("A sentence.\n", encoding="utf8")
            bad.write_text("First sentence. Another sentence.\n", encoding="utf8")
            selected = authored_document_paths(root, ["docs/selected [1].md"])
            self.assertEqual(selected, [good])
            self.assertEqual(check_documents(selected), 0)
            self.assertEqual(check_documents([bad]), 1)
            self.assertEqual(authored_document_paths(root, []), [])
            with self.assertRaises(ValueError):
                authored_document_paths(root, ["../outside.md"])

    def test_long_quote_prefix_does_not_backtrack(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary) / "guide.md"
            document.write_text(
                ">" + "\t>" * 40 + " First sentence. Another sentence.\n",
                encoding="utf8",
            )
            # Isolate the checker from Snapper and bound the regression: the
            # former regex takes exponential time on this non-numbered prefix.
            program = """
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, sys.argv[1])
from format_docs import check_documents
document = Path(sys.argv[2])
report = [{"file": str(document), "would_reformat": False,
           "diagnostics": [{"kind": "fused", "line": 1, "excerpt": "quoted prose"}]}]
with patch("format_docs.subprocess.run", return_value=SimpleNamespace(
    stdout=json.dumps(report), stderr="", returncode=0)):
    assert check_documents([document]) == 1
"""
            result = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-c",
                    program,
                    str(Path(__file__).parent),
                    str(document),
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_quoted_numbered_lists_do_not_hide_real_fused_sentences(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary) / "guide.md"
            for source in (
                "> 1. First item.\n> 2. Second item.\n",
                "> > 1. First item.\n> > 2. Second item.\n",
                "> > > 1. First item.\n> > > 2. Second item.\n",
            ):
                with self.subTest(source=source):
                    document.write_text(source, encoding="utf8")
                    self.assertEqual(check_documents([document]), 0)
                    self.assertEqual(document.read_text(encoding="utf8"), source)
            for prefix in (">", "> >", "> > >"):
                with self.subTest(prefix=prefix):
                    source = f"{prefix} 1. First sentence. Another sentence.\n"
                    document.write_text(source, encoding="utf8")
                    self.assertEqual(check_documents([document]), 1)
                    self.assertEqual(document.read_text(encoding="utf8"), source)

    def test_complete_formatter_chain_preserves_examples_and_converges(self):
        root = CONFIG.parent
        example = "```markdown\nLabel  \nValue\n```\n"
        code = "```javascript\nconst value={a:1}; // Keep. Both.\n```\n"
        source = (
            "First sentence. Second sentence.\n\n"
            "<!-- prettier-ignore -->\n\n"
            + example
            + "\n"
            + code
            + "\nFirst line.  \nSecond line.\n\n"
            "| Key | Value |\n| --- | --- |\n| `a \\| b` | **text** |\n\n"
            "- [ ] First sentence. Second sentence.\n"
        )
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary).resolve() / "guide.md"
            document.write_text(source, encoding="utf8")
            prettier = [
                "node",
                str(root / "node_modules/prettier/bin/prettier.cjs"),
                "--config",
                str(root / ".prettierrc.json"),
            ]
            snapper = [str(EXECUTABLE), "--native", "--config", str(CONFIG)]

            def run(command):
                result = subprocess.run(
                    command,
                    cwd=root,
                    capture_output=True,
                    text=True,
                    encoding="utf8",
                    timeout=30,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            previous = None
            for attempt in range(2):
                run([*prettier, "--write", str(document)])
                run([*snapper, "--in-place", str(document)])
                run([*prettier, "--write", str(document)])
                output = document.read_text(encoding="utf8")
                self.assertIn(example, output)
                self.assertIn(code, output)
                self.assertIn("First sentence.\nSecond sentence.", output)
                self.assertIn("First line.  \nSecond line.", output)
                self.assertIn("`a \\| b`", output)
                self.assertIn("- [ ] First sentence.", output)
                run([*prettier, "--check", str(document)])
                self.assertEqual(check_documents([document]), 0)
                self.assertEqual(document.read_text(encoding="utf8"), output)
                if attempt:
                    self.assertEqual(output, previous)
                previous = output

    def format(self, source: str) -> str:
        result = subprocess.run(
            [str(EXECUTABLE), "--native", "--config", str(CONFIG)],
            input=source,
            capture_output=True,
            check=False,
            text=True,
            encoding="utf8",
            timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def test_sentence_boundaries_and_literal_content(self):
        cases = [
            (
                "First sentence. Second sentence.\n",
                "First sentence.\nSecond sentence.\n",
            ),
            (
                "Use e.g. Node tooling. Check it.\n",
                "Use e.g. Node tooling.\nCheck it.\n",
            ),
            ("Use version 12.0.2. Check it.\n", "Use version 12.0.2.\nCheck it.\n"),
            ("Use `npm test`. Check it.\n", "Use `npm test`.\nCheck it.\n"),
            ("Run this. `npm test` checks it.\n", "Run this.\n`npm test` checks it.\n"),
            (
                "Run this. [Testing](testing.md) explains it.\n",
                "Run this.\n[Testing](testing.md) explains it.\n",
            ),
            (
                "**First sentence.** Next sentence.\n",
                "**First sentence.**\nNext sentence.\n",
            ),
            (
                "Use **checked source**. Check output.\n",
                "Use **checked source**.\nCheck output.\n",
            ),
            (
                "```bbcode\n[b]First.[/b] Next.\n```\n",
                "```bbcode\n[b]First.[/b] Next.\n```\n",
            ),
            ("Keep\u00a0this. Next sentence.\n", "Keep\u00a0this.\nNext sentence.\n"),
            (
                "First line.\\\nSecond line. Third sentence.\n",
                "First line.\\\nSecond line.\nThird sentence.\n",
            ),
            ('Say "Done." Then check it.\n', 'Say "Done."\nThen check it.\n'),
            (
                "First paragraph.\n\nSecond paragraph.\n",
                "First paragraph.\n\nSecond paragraph.\n",
            ),
            (
                "> First sentence. Second sentence.\n",
                "> First sentence.\n> Second sentence.\n",
            ),
            (
                "- First sentence. Second sentence.\n",
                "- First sentence.\n  Second sentence.\n",
            ),
        ]
        for source, expected in cases:
            with self.subTest(source=source):
                self.assertEqual(self.format(source), expected)
                self.assertEqual(self.format(expected), expected)

    def test_tables_code_and_hard_breaks_are_preserved(self):
        source = (
            "| First sentence. Second sentence. | Value |\n"
            "| --- | --- |\n"
            "| `a \\| b` | **text** |\n\n"
            "```javascript\n// First sentence. Second sentence.\nconst x = 1;\n```\n\n"
            "First line.  \nSecond line.\n"
        )
        self.assertEqual(self.format(source), source)

    def test_native_check_rejects_without_writing_then_accepts_formatted_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary).resolve() / "guide.md"
            original = b"First sentence. Second sentence.\n"
            document.write_bytes(original)
            command = [str(EXECUTABLE), "--native", "--config", str(CONFIG)]
            failed = subprocess.run(
                [*command, "--check", str(document)],
                capture_output=True,
                check=False,
                timeout=10,
            )
            self.assertEqual(failed.returncode, 1)
            self.assertEqual(document.read_bytes(), original)
            written = subprocess.run(
                [*command, "--in-place", str(document)],
                capture_output=True,
                check=False,
                timeout=10,
            )
            self.assertEqual(written.returncode, 0, written.stderr)
            self.assertEqual(
                document.read_bytes(), b"First sentence.\nSecond sentence.\n"
            )
            passed = subprocess.run(
                [*command, "--check", str(document)],
                capture_output=True,
                check=False,
                timeout=10,
            )
            self.assertEqual(passed.returncode, 0, passed.stderr)

    def test_authored_documents_are_selected_but_archives_and_policy_are_not(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            included = [
                "README.md",
                "SECURITY.md",
                "docs/testing.md",
                "docs/decisions/design.md",
                "docs/designs/design.md",
                "docs/designs/CommonJS-to-ESM/change-dossier.md",
                "docs/designs/CommonJS-to-ESM/implementation-plan.md",
                "docs/reference/index.md",
                "docs/migration/source-record.md",
                "docs/plans/original.md",
                "docs/plans/nested/evidence.md",
                "docs/plans/2026-09-08-webvowl-sdlc-adoption.md",
                "docs/plans/2026-09-11-sdlc-wp8-adoption.md",
            ]
            excluded = [
                "AGENTS.md",
                "test/fixtures/README.md",
                "node_modules/vendor/README.md",
                ".agents/skills/example/SKILL.md",
                ".venv/README.md",
                ".github/pull_request_template.md",
                "docs/reviews/external-review.md",
                "docs/reviews/nested/dossier.md",
                "docs/owlapi-js/README.md",
                "docs/owlapi-js/conformance/upstream/LICENSE.md",
                "docs/sdlc/README.md",
                "docs/evaluations/recorded-result.md",
            ]
            for name in [*included, *excluded]:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("First. Second.\n", encoding="utf8")
            (root / ".prettierignore").write_bytes(
                (CONFIG.parent / ".prettierignore").read_bytes()
            )
            self.assertEqual(
                authored_document_paths(root), sorted(root / name for name in included)
            )

    def test_check_prints_findings_without_writing_reports_or_documents(self):
        import io

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            document = root / "README.md"
            original = "First non\u2011ASCII sentence. Second sentence.\n".encode(
                "utf-8"
            )
            document.write_bytes(original)
            output = io.BytesIO()
            console = io.TextIOWrapper(output, encoding="cp1252")
            with (
                patch("format_docs.PACKAGE_ROOT", root),
                patch("sys.argv", ["format_docs.py", "--check"]),
                patch("sys.stdout", console),
            ):
                self.assertEqual(main(), 1)
                console.flush()
                self.assertIn("non\u2011ASCII", output.getvalue().decode("utf-8"))
            self.assertEqual(document.read_bytes(), original)
            self.assertEqual(list(root.iterdir()), [document])

    def test_selection_uses_current_prettier_and_git_ignore_rules(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            documents = [
                "README.md",
                "docs/guide.md",
                "docs/generated/report.md",
                "docs/drafts/hidden.md",
                "docs/drafts/keep.md",
                "docs/private.md",
            ]
            for name in documents:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("One sentence.\n", encoding="utf8")
            (root / ".gitignore").write_text("/docs/generated/\n", encoding="utf8")
            ignore = root / ".prettierignore"
            ignore.write_text(
                "docs/drafts/*.md\n!docs/drafts/keep.md\ndocs/private.md\n",
                encoding="utf8",
            )
            self.assertEqual(
                authored_document_paths(root),
                sorted(
                    root / name
                    for name in ("README.md", "docs/guide.md", "docs/drafts/keep.md")
                ),
            )
            ignore.write_text("docs/guide.md\n", encoding="utf8")
            self.assertEqual(
                authored_document_paths(root),
                sorted(
                    root / name
                    for name in (
                        "README.md",
                        "docs/drafts/hidden.md",
                        "docs/drafts/keep.md",
                        "docs/private.md",
                    )
                ),
            )

    def test_no_authored_documents_does_not_invoke_stdin_mode(self):
        with tempfile.TemporaryDirectory() as temporary:
            for mode in ("--check", "--write"):
                with (
                    patch("format_docs.PACKAGE_ROOT", Path(temporary).resolve()),
                    patch("sys.argv", ["format_docs.py", mode]),
                    patch("format_docs.subprocess.run") as run,
                ):
                    self.assertEqual(main(), 0)
                    run.assert_not_called()

    def test_native_render_backstop_cannot_hide_unformatted_sentences(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary).resolve() / "guide.md"
            source = ".NET mods retain their own licence. Check the converter.\n"
            document.write_text(source, encoding="utf8")
            self.assertEqual(
                self.format(source), source, "exercise the native preservation backstop"
            )
            self.assertEqual(check_documents([document]), 1)
            self.assertEqual(document.read_text(encoding="utf8"), source)

    def test_long_sentence_is_allowed_without_a_fixed_column_limit(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary).resolve() / "guide.md"
            source = (
                "Keep this sentence, "
                + "with meaningful prose " * 12
                + "on one source line.\n"
            )
            document.write_text(source, encoding="utf8")
            self.assertEqual(self.format(source), source)
            self.assertEqual(check_documents([document]), 0)

    def test_separate_list_items_are_not_sentence_continuations(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary) / "guide.md"
            for source in (
                "- first item; and\n- second item.\n",
                "1. first item; and\n2. second item.\n",
                "- `first/path`\n- every `second/path`\n",
            ):
                with self.subTest(source=source):
                    document.write_text(source, encoding="utf8")
                    self.assertEqual(check_documents([document]), 0)
                    self.assertEqual(document.read_text(encoding="utf8"), source)

    def test_wrapped_blockquote_still_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary) / "guide.md"
            source = "> A single sentence\n> continues here.\n"
            document.write_text(source, encoding="utf8")
            self.assertEqual(check_documents([document]), 1)
            self.assertEqual(document.read_text(encoding="utf8"), source)

    def test_prettier_task_list_indentation_is_accepted(self):
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary) / "guide.md"
            source = "- [ ] First sentence.\n      Second sentence.\n"
            document.write_text(source, encoding="utf8")
            self.assertEqual(check_documents([document]), 0)
            self.assertEqual(document.read_text(encoding="utf8"), source)


if __name__ == "__main__":
    unittest.main()
