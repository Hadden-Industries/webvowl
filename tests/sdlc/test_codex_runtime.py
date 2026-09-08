"""Native diagnostic contracts; Codex subprocesses are the external test boundary."""
from __future__ import annotations

import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "util"))
import set_up_sdlc as setup


class CodexRuntimePreflightTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="webvowl-codex-runtime-")
        self.addCleanup(self.directory.cleanup)
        self.repo = Path(self.directory.name).resolve()
        self.native = self.repo / "codex native.exe"
        self.native.write_bytes(b"external process boundary fixture")
        self.launcher = self.native
        # Minimal projection of the observed 0.153.4 schemaVersion=1 report.
        # Expected capability decisions below are independent literal requirements.
        self.doctor = {
            "schemaVersion": 1, "codexVersion": "0.153.4", "overallStatus": "ok",
            "checks": {
                "installation": {"status": "ok", "summary": "installation looks consistent",
                    "details": {"current executable": str(self.native), "managed by npm": "true"}},
                "runtime.provenance": {"status": "ok", "summary": "running npm",
                    "details": {"current executable": str(self.native), "version": "0.153.4",
                                "install method": "npm"}},
                "config.load": {"status": "ok", "summary": "config loaded", "details": {}},
                "updates.status": {"status": "ok", "summary": "current",
                    "details": {"latest version": "0.153.4", "check for update on startup": "true"}},
            },
        }
        self.features = "hooks stable true\nmulti_agent stable false\n"
        self.version = "0.153.4"
        self.doctor_exit_code = 0
        self.commands = []

    def external_command(self, argv, **options):
        self.commands.append((argv, options))
        expected = self.native if argv[1:] == ["features", "list"] else self.launcher
        self.assertEqual(Path(argv[0]).resolve(), expected)
        if argv[1:] == ["--version"]:
            return subprocess.CompletedProcess(argv, 0, f"codex-cli {self.version}\n", "")
        if argv[1:] == ["doctor", "--json"]:
            return subprocess.CompletedProcess(argv, self.doctor_exit_code, json.dumps(self.doctor), "")
        if argv[1:] == ["features", "list"]:
            return subprocess.CompletedProcess(argv, 0, self.features, "")
        self.fail(f"Unexpected process command (including any install/trust mutation): {argv}")

    def invoke(self, extra=(), *, runtime=True, documents=()):
        output, errors = io.StringIO(), io.StringIO()
        with (
            patch.object(sys, "argv", ["set_up_sdlc.py", "--check", *(
                ["--runtime", "--codex-executable", str(self.native)] if runtime else []), *extra]),
            patch.object(setup, "derive_repo_from_script", return_value=self.repo),
            patch.object(setup, "render_sdlc_configuration", return_value=list(documents)),
            patch.object(setup, "publish_repository_configuration_documents") as publish,
            patch("subprocess.run", side_effect=self.external_command),
            contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors),
        ):
            code = setup.main()
        publish.assert_not_called()
        return code, output.getvalue(), errors.getvalue()

    def report(self, output):
        return json.loads(output[output.index("{"):])

    def test_runtime_check_rejects_disabled_hooks_without_changing_configuration(self):
        self.features = "hooks stable false\n"
        marker = self.repo / "operator-owned-config.toml"
        marker.write_text("preserve exactly\n", encoding="utf-8")
        code, output, errors = self.invoke()
        self.assertEqual(code, 1)
        report = self.report(output)
        self.assertFalse(report["ready"])
        self.assertEqual(report["requiredFeatures"]["hooks"], {"stage": "stable", "enabled": False})
        self.assertEqual(report["hookAcceptance"], "not-assessed")
        self.assertEqual(marker.read_text(encoding="utf-8"), "preserve exactly\n")
        self.assertEqual(errors, "")


    def test_unsupported_old_cli_reports_its_version_and_selected_path(self):
        self.version = "0.149.1"
        self.doctor_exit_code = 2
        code, output, errors = self.invoke()
        self.assertEqual(code, 1)
        self.assertIn("0.149.1", errors)
        self.assertIn(str(self.native), errors)
        self.assertNotIn('"ready": true', output)

    def test_capable_runtime_passes_without_assuming_optional_agents_or_hook_trust(self):
        code, output, errors = self.invoke()
        self.assertEqual(code, 0)
        report = self.report(output)
        self.assertTrue(report["ready"])
        self.assertEqual(report["runtime"]["executable"], str(self.native))
        self.assertEqual(report["runtime"]["version"], "0.153.4")
        self.assertEqual(report["hookAcceptance"], "not-assessed")
        self.assertEqual(report["requiredFeatures"], {"hooks": {"stage": "stable", "enabled": True}})
        self.assertEqual(errors, "")
        for _, options in self.commands:
            self.assertEqual(options["cwd"], self.repo)
            self.assertLessEqual(options["timeout"], 30)
            self.assertFalse(options.get("shell", False))

    def test_noninteractive_terminal_failure_is_preserved_outside_the_runtime_gate(self):
        self.doctor["overallStatus"] = "fail"
        self.doctor_exit_code = 1
        self.doctor["checks"]["terminal.env"] = {
            "status": "fail", "summary": "TERM=dumb", "details": {"TERM": "dumb"}}
        self.doctor["checks"]["auth.credentials"] = {
            "status": "ok", "summary": "private diagnostic metadata",
            "details": {"private-marker": "do-not-emit"}}
        code, output, _ = self.invoke()
        self.assertEqual(code, 0)
        report = self.report(output)
        self.assertEqual(report["doctor"]["overallStatus"], "fail")
        self.assertEqual(report["doctor"]["exitCode"], 1)
        self.assertEqual(report["doctor"]["otherFindings"], [{"id": "terminal.env", "status": "fail"}])
        self.assertNotIn("do-not-emit", output)

    def test_missing_or_unstable_hooks_cannot_pass(self):
        for feature_text in ("multi_agent stable true\n", "hooks under development true\n",
                             "hooks removed true\n"):
            with self.subTest(feature_text=feature_text):
                self.features = feature_text
                code, output, _ = self.invoke()
                self.assertEqual(code, 1)
                self.assertFalse(self.report(output)["ready"])

    def test_native_installation_or_config_findings_block_prerequisites(self):
        for name in ("installation", "runtime.provenance", "config.load"):
            with self.subTest(check=name):
                self.doctor["checks"][name]["status"] = "warning"
                code, output, _ = self.invoke()
                self.assertEqual(code, 1)
                self.assertIn(name, self.report(output)["failures"])
                self.doctor["checks"][name]["status"] = "ok"

    def test_native_update_warning_is_visible_without_inventing_version_comparison(self):
        self.doctor["checks"]["updates.status"] = {
            "status": "warning", "summary": "A newer release is available",
            "details": {"latest version": "0.154.0", "update action": "npm install -g @openai/codex"}}
        code, output, _ = self.invoke()
        self.assertEqual(code, 0)
        self.assertEqual(self.report(output)["updates"], self.doctor["checks"]["updates.status"])

    def test_unknown_doctor_contract_and_inconsistent_identity_fail_closed(self):
        self.doctor["schemaVersion"] = 2
        code, _, errors = self.invoke()
        self.assertEqual(code, 1)
        self.assertIn("Unsupported native", errors)
        self.doctor["schemaVersion"] = 1
        self.doctor["checks"]["runtime.provenance"]["details"]["version"] = "0.152.0"
        code, _, errors = self.invoke()
        self.assertEqual(code, 1)
        self.assertIn("identities disagree", errors)

    def test_ordinary_configuration_check_does_not_require_codex(self):
        code, output, errors = self.invoke(runtime=False)
        self.assertEqual(code, 0)
        self.assertIn("configuration is current", output)
        self.assertEqual(self.commands, [])
        self.assertEqual(errors, "")

    def test_unknown_or_duplicate_feature_output_is_not_a_pass(self):
        for feature_text in ("hooks stable maybe\n", "hooks stable true\nhooks stable false\n"):
            with self.subTest(feature_text=feature_text):
                self.features = feature_text
                code, _, errors = self.invoke()
                self.assertEqual(code, 1)
                self.assertIn("ambiguous hooks", errors)

    def test_timeout_is_a_bounded_failure(self):
        self.external_command = lambda argv, **options: (_ for _ in ()).throw(
            subprocess.TimeoutExpired(argv, options["timeout"]))
        code, _, errors = self.invoke()
        self.assertEqual(code, 1)
        self.assertIn("could not complete", errors)

    def test_path_launcher_cannot_redirect_the_later_capability_probe(self):
        from _codex_runtime import inspect_codex_runtime
        self.launcher = self.repo / "codex launcher.cmd"
        self.launcher.write_bytes(b"npm-owned external launcher fixture")
        with patch("shutil.which", return_value=str(self.launcher)), patch(
                "subprocess.run", side_effect=self.external_command):
            report = inspect_codex_runtime(self.repo)
        self.assertTrue(report["ready"])
        self.assertEqual(report["launcher"], str(self.launcher))
        self.assertEqual([argv[0] for argv, _ in self.commands],
                         [str(self.launcher), str(self.launcher), str(self.native)])

    def test_stale_generated_configuration_stops_before_native_processes(self):
        document = setup.RenderedRepositoryConfigurationDocument(
            self.repo / ".codex/hooks.json", "current", b"stale")
        code, _, errors = self.invoke(documents=[document])
        self.assertEqual(code, 1)
        self.assertIn("configuration differs", errors)
        self.assertEqual(self.commands, [])

    def test_runtime_flag_cannot_enter_the_configuration_write_route(self):
        with patch.object(sys, "argv", ["set_up_sdlc.py", "--runtime"]), patch.object(
                setup, "publish_repository_configuration_documents") as publish, patch(
                "subprocess.run") as run, contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as raised:
                setup.main()
        self.assertEqual(raised.exception.code, 2)
        publish.assert_not_called()
        run.assert_not_called()


    def test_executable_flag_requires_runtime_even_when_the_value_is_empty(self):
        for executable in ("", str(self.native)):
            with self.subTest(executable=executable):
                with self.assertRaises(SystemExit) as raised:
                    self.invoke(extra=("--codex-executable", executable), runtime=False)
                self.assertEqual(raised.exception.code, 2)
                self.assertEqual(self.commands, [])


if __name__ == "__main__":
    unittest.main()
