"""Actual platform containment probes for the affected Jest adapter.

The existing Python matrix runs these on Windows and Linux with selected Python.
Program source is static; all runtime paths are passed as argv data.
"""

# SPDX-License-Identifier: AGPL-3.0-only
import ctypes
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")
CHILD_SOURCE = """
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const [mode, marker] = process.argv.slice(2);
if (mode === 'nested') {
  const child = spawn(process.execPath, [import.meta.filename, 'hang', marker], {
    detached: true, stdio: 'ignore'
  });
  child.unref();
  setTimeout(() => process.exit(0), 500);
} else if (mode === 'hang') {
  writeFileSync(marker, JSON.stringify({pid:process.pid}));
  setInterval(() => {}, 1000);
} else if (mode === 'flood') {
  while (true) process.stdout.write('x'.repeat(65536));
} else if (mode === 'fail') {
  process.exitCode = 7;
} else {
  console.log('complete');
}
"""


@unittest.skipUnless(
    NODE and sys.platform in ("win32", "linux"),
    "Node and a supported native platform required",
)
class JestProcessTests(unittest.TestCase):
    def test_identity_readback_loss_never_crosses_execution_gate(self):
        """Inject only an OS identity readback failure, never a successful containment result."""
        spec = importlib.util.spec_from_file_location(
            "jest_process_probe", ROOT / "util/jest-process.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="webvowl-identity-loss-") as temporary:
            root = Path(temporary)
            marker = root / "executed"
            argv = [
                NODE,
                "-e",
                "require('node:fs').writeFileSync(process.argv[1],'unsafe')",
                str(marker),
            ]
            pipes = [os.pipe(), os.pipe()]
            try:
                if sys.platform == "win32":
                    calls = 0
                    original = module.WindowsJestJob.check

                    def lose_identity(result):
                        nonlocal calls
                        calls += 1
                        if calls == 4:
                            raise OSError("Injected GetProcessTimes identity loss")
                        original(result)

                    with (
                        patch.object(
                            module.WindowsJestJob, "check", side_effect=lose_identity
                        ),
                        self.assertRaisesRegex(OSError, "identity loss"),
                    ):
                        module.WindowsJestJob(argv, str(root), pipes[0][1], pipes[1][1])
                else:
                    with (
                        patch.object(
                            module.os,
                            "pidfd_open",
                            side_effect=OSError("Injected pidfd identity loss"),
                        ),
                        self.assertRaisesRegex(OSError, "identity loss"),
                    ):
                        module.LinuxJestChildren(
                            argv, str(root), pipes[0][1], pipes[1][1]
                        )
                self.assertFalse(marker.exists(), "Unowned source must never execute")
            finally:
                for pipe in pipes:
                    for descriptor in pipe:
                        os.close(descriptor)

    def test_cleanup_does_not_terminate_an_unrelated_same_image_process(self):
        with subprocess.Popen(
            [NODE, "-e", "setInterval(()=>{},1000)"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ) as unrelated:
            try:
                self.invoke("nested", timeout=2500)
                self.assertIsNone(
                    unrelated.poll(),
                    "Cleanup must target ownership, not image names or unrelated PIDs",
                )
            finally:
                unrelated.terminate()
                unrelated.wait(timeout=5)

    def test_real_jest_esm_results_inside_native_containment(self):
        """The unchanged Python CI matrix supplies actual Windows/Linux Jest proof."""
        jest = ROOT / "node_modules/jest/bin/jest.js"
        self.assertTrue(jest.is_file(), "Locked root dependencies must be installed")
        with tempfile.TemporaryDirectory(prefix="webvowl-native-jest-") as temporary:
            root = Path(temporary)
            test_file = root / "native.test.mjs"
            test_file.write_text(
                "test('duplicate',()=>expect(1).toBe(1));"
                "test('duplicate',()=>expect(2).toBe(2));"
                "test.skip('skip',()=>{});test.todo('todo');",
                encoding="utf-8",
            )
            destination = root / "result"
            config = {
                "rootDir": str(root),
                "testEnvironment": "node",
                "transform": {},
                "maxWorkers": 2,
            }
            request = {
                "argv": [
                    NODE,
                    "--experimental-vm-modules",
                    str(jest),
                    "--config",
                    json.dumps(config),
                    "--runTestsByPath",
                    str(test_file),
                    "--json",
                    "--outputFile",
                    str(destination / "jest.json"),
                ],
                "root": str(root),
                "destination": str(destination),
                "timeoutMs": 30000,
                "byteLimit": 1048576,
                "cancelPath": str(root / "cancel"),
            }
            result = subprocess.run(
                [sys.executable, "-I", "-B", str(ROOT / "util/jest-process.py")],
                input=json.dumps(request),
                capture_output=True,
                encoding="utf-8",
                timeout=40,
                check=False,
                env={**os.environ, "NODE_OPTIONS": "", "NODE_PATH": ""},
            )
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            facts = json.loads(result.stdout)
            self.assertTrue(facts["quiescent"], facts)
            self.assertIsNone(facts["reason"], facts)
            self.assertEqual(facts["exitCode"], 0, facts)
            native = json.loads((destination / "jest.json").read_text(encoding="utf-8"))
            self.assertTrue(native["success"])
            self.assertEqual(
                [row["status"] for row in native["testResults"][0]["assertionResults"]],
                ["passed", "passed", "pending", "todo"],
            )

    def invoke(self, mode, *, timeout=1000, byte_limit=1048576, cancel=False):
        temporary = tempfile.TemporaryDirectory(prefix="webvowl-process-contract-")
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        program = root / "child.mjs"
        program.write_text(CHILD_SOURCE, encoding="utf-8")
        marker = root / "marker 'ș' (1)+.json"
        cancel_path = root / "cancel"
        if cancel:
            cancel_path.write_text("cancel", encoding="utf-8")
        request = {
            "argv": [NODE, str(program), mode, str(marker)],
            "root": str(root),
            "destination": str(root / "result"),
            "timeoutMs": timeout,
            "byteLimit": byte_limit,
            "cancelPath": str(cancel_path),
        }
        result = subprocess.run(
            [sys.executable, "-I", "-B", str(ROOT / "util/jest-process.py")],
            input=json.dumps(request),
            capture_output=True,
            encoding="utf-8",
            timeout=timeout / 1000 + 12,
            check=False,
            env={**os.environ, "NODE_OPTIONS": "", "NODE_PATH": ""},
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        facts = json.loads(result.stdout)
        self.assertTrue(facts["quiescent"], facts)
        self.assertIn("creationTime", facts["rootIdentity"])
        return root, marker, facts

    def test_success_and_native_failure(self):
        root, _marker, facts = self.invoke("complete")
        self.assertEqual(facts["exitCode"], 0)
        self.assertIsNone(facts["reason"])
        self.assertIn("complete", (root / "result/stdout.txt").read_text())
        _root, _marker, failed = self.invoke("fail")
        self.assertEqual(failed["exitCode"], 7)

    def test_deadline_owns_detached_descendant_after_parent_exit(self):
        _root, marker, facts = self.invoke("nested", timeout=2500)
        self.assertEqual(facts["reason"], "deadline")
        self.assertTrue(marker.exists(), facts)
        pid = json.loads(marker.read_text())["pid"]
        if sys.platform == "linux":
            self.assertFalse(Path(f"/proc/{pid}").exists())
        else:
            native = ctypes.WinDLL("kernel32", use_last_error=True)
            native.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
            native.OpenProcess.restype = ctypes.c_void_p
            handle = native.OpenProcess(0x100000, False, pid)
            if handle:
                native.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
                native.WaitForSingleObject.restype = ctypes.c_ulong
                native.CloseHandle.argtypes = [ctypes.c_void_p]
                try:
                    self.assertEqual(native.WaitForSingleObject(handle, 0), 0)
                finally:
                    native.CloseHandle(handle)

    def test_output_excess_is_bounded_failure(self):
        root, _marker, facts = self.invoke("flood", timeout=3000, byte_limit=131072)
        self.assertEqual(facts["reason"], "output-limit")
        captured = sum(
            (root / "result" / name).stat().st_size
            for name in ("stdout.txt", "stderr.txt")
        )
        self.assertLessEqual(captured, 131072)

    def test_cancellation_preserves_incomplete_status(self):
        _root, _marker, facts = self.invoke("hang", cancel=True)
        self.assertEqual(facts["reason"], "cancelled")


if __name__ == "__main__":
    unittest.main()
