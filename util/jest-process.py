"""Bound one Jest invocation using Windows jobs or a Linux child subreaper.

Only handles owned by this invocation are terminated. No image-name or PID-tree
kill is used. This adapter is separate from HISEW's verification supervisor.
"""

# SPDX-License-Identifier: AGPL-3.0-only
import ctypes
import json
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path


class WindowsJestJob:
    """Assign the native suspended process before any Jest code can execute."""

    def __init__(self, argv, cwd, stdout, stderr):
        import msvcrt  # pylint: disable=import-outside-toplevel
        from ctypes import wintypes as types

        self.native = ctypes.WinDLL("kernel32", use_last_error=True)

        class Startup(ctypes.Structure):
            _fields_ = [
                ("size", types.DWORD),
                ("reserved", types.LPWSTR),
                ("desktop", types.LPWSTR),
                ("title", types.LPWSTR),
                ("x", types.DWORD),
                ("y", types.DWORD),
                ("xsize", types.DWORD),
                ("ysize", types.DWORD),
                ("xchars", types.DWORD),
                ("ychars", types.DWORD),
                ("fill", types.DWORD),
                ("flags", types.DWORD),
                ("show", types.WORD),
                ("reserved_size", types.WORD),
                ("reserved_bytes", ctypes.c_void_p),
                ("stdin", types.HANDLE),
                ("stdout", types.HANDLE),
                ("stderr", types.HANDLE),
            ]

        class Process(ctypes.Structure):
            _fields_ = [
                ("process", types.HANDLE),
                ("thread", types.HANDLE),
                ("pid", types.DWORD),
                ("thread_id", types.DWORD),
            ]

        class Limits(ctypes.Structure):
            _fields_ = [
                ("per_process", ctypes.c_int64),
                ("per_job", ctypes.c_int64),
                ("flags", types.DWORD),
                ("minimum", ctypes.c_size_t),
                ("maximum", ctypes.c_size_t),
                ("active", types.DWORD),
                ("affinity", ctypes.c_size_t),
                ("priority", types.DWORD),
                ("scheduling", types.DWORD),
            ]

        class Extended(ctypes.Structure):
            _fields_ = [
                ("basic", Limits),
                ("io", ctypes.c_uint64 * 6),
                ("process_memory", ctypes.c_size_t),
                ("job_memory", ctypes.c_size_t),
                ("peak_process", ctypes.c_size_t),
                ("peak_job", ctypes.c_size_t),
            ]

        class Accounting(ctypes.Structure):
            _fields_ = [
                ("times", ctypes.c_int64 * 4),
                ("faults", types.DWORD),
                ("total", types.DWORD),
                ("active", types.DWORD),
                ("terminated", types.DWORD),
            ]

        signatures = {
            "CreateJobObjectW": ([ctypes.c_void_p, types.LPCWSTR], types.HANDLE),
            "SetInformationJobObject": (
                [types.HANDLE, ctypes.c_int, ctypes.c_void_p, types.DWORD],
                types.BOOL,
            ),
            "QueryInformationJobObject": (
                [
                    types.HANDLE,
                    ctypes.c_int,
                    ctypes.c_void_p,
                    types.DWORD,
                    ctypes.c_void_p,
                ],
                types.BOOL,
            ),
            "AssignProcessToJobObject": ([types.HANDLE, types.HANDLE], types.BOOL),
            "CreateProcessW": (
                [
                    types.LPCWSTR,
                    types.LPWSTR,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    types.BOOL,
                    types.DWORD,
                    ctypes.c_void_p,
                    types.LPCWSTR,
                    ctypes.POINTER(Startup),
                    ctypes.POINTER(Process),
                ],
                types.BOOL,
            ),
            "ResumeThread": ([types.HANDLE], types.DWORD),
            "TerminateJobObject": ([types.HANDLE, types.UINT], types.BOOL),
            "TerminateProcess": ([types.HANDLE, types.UINT], types.BOOL),
            "GetExitCodeProcess": (
                [types.HANDLE, ctypes.POINTER(types.DWORD)],
                types.BOOL,
            ),
            "GetProcessTimes": (
                [
                    types.HANDLE,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                ],
                types.BOOL,
            ),
            "CloseHandle": ([types.HANDLE], types.BOOL),
        }
        for name, (arguments, returns) in signatures.items():
            function = getattr(self.native, name)
            function.argtypes, function.restype = arguments, returns
        self.accounting_type = Accounting
        self.job = self.native.CreateJobObjectW(None, None)
        if not self.job:
            raise ctypes.WinError(ctypes.get_last_error())
        self.process = Process()
        extended = Extended()
        extended.basic.flags = (
            0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; no breakaway.
        )
        startup = Startup()
        startup.size = ctypes.sizeof(startup)
        startup.flags = 0x101  # STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW
        startup.stdout = msvcrt.get_osfhandle(stdout)
        startup.stderr = msvcrt.get_osfhandle(stderr)
        os.set_handle_inheritable(startup.stdout, True)
        os.set_handle_inheritable(startup.stderr, True)
        try:
            self.check(
                self.native.SetInformationJobObject(
                    self.job, 9, ctypes.byref(extended), ctypes.sizeof(extended)
                )
            )
            command = ctypes.create_unicode_buffer(subprocess.list2cmdline(argv))
            self.check(
                self.native.CreateProcessW(
                    argv[0],
                    command,
                    None,
                    None,
                    True,
                    0x08000004,
                    None,
                    cwd,
                    ctypes.byref(startup),
                    ctypes.byref(self.process),
                )
            )
            self.check(
                self.native.AssignProcessToJobObject(self.job, self.process.process)
            )
            times = [ctypes.c_uint64() for _ in range(4)]
            self.check(
                self.native.GetProcessTimes(
                    self.process.process, *(ctypes.byref(value) for value in times)
                )
            )
            self.identity = {
                "pid": self.process.pid,
                "creationTime": str(times[0].value),
                "ownership": "native-job-handle",
            }
            if self.native.ResumeThread(self.process.thread) == 0xFFFFFFFF:
                self.check(False)
            self.native.CloseHandle(self.process.thread)
            self.process.thread = None
        except BaseException:
            if self.process.process:
                self.native.TerminateProcess(self.process.process, 2)
            self.close()
            raise

    @staticmethod
    def check(result):
        if not result:
            raise ctypes.WinError(ctypes.get_last_error())

    def poll(self):
        accounting = self.accounting_type()
        self.check(
            self.native.QueryInformationJobObject(
                self.job, 1, ctypes.byref(accounting), ctypes.sizeof(accounting), None
            )
        )
        if accounting.active:
            return None
        exit_code = ctypes.c_ulong()
        self.check(
            self.native.GetExitCodeProcess(
                self.process.process, ctypes.byref(exit_code)
            )
        )
        return exit_code.value

    def terminate(self):
        self.check(self.native.TerminateJobObject(self.job, 2))

    def close(self):
        for handle in (self.process.thread, self.process.process, self.job):
            if handle:
                self.native.CloseHandle(handle)


class LinuxJestChildren:
    """A private subreaper keeps detached descendants owned until waitpid says ECHILD."""

    def __init__(self, argv, cwd, stdout, stderr):
        native = ctypes.CDLL(None, use_errno=True)
        if native.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
            raise OSError(ctypes.get_errno(), "Cannot establish child subreaper")
        gate_read, gate_write = os.pipe()
        self.pid = os.fork()
        if self.pid == 0:
            try:
                os.close(gate_write)
                if os.read(gate_read, 1) != b"G":
                    os._exit(2)
                os.close(gate_read)
                os.setsid()
                os.chdir(cwd)
                os.dup2(stdout, 1)
                os.dup2(stderr, 2)
                os.execve(argv[0], argv, os.environ)
            except Exception:  # noqa: BLE001 - a forked child must exit rather than resume its parent loop.
                os._exit(2)
        os.close(gate_read)
        self.exit_code = None
        self.root_handle = None
        try:
            self.root_handle = os.pidfd_open(self.pid)
            stat = Path(f"/proc/{self.pid}/stat").read_text().rsplit(")", 1)[1].split()
            self.identity = {
                "pid": self.pid,
                "creationTime": stat[19],
                "ownership": "pidfd-and-child-subreaper",
            }
        except BaseException:
            # The child has not crossed its execution gate. EOF makes it exit without exec.
            os.close(gate_write)
            os.waitpid(self.pid, 0)
            if self.root_handle is not None:
                os.close(self.root_handle)
            raise
        os.write(gate_write, b"G")
        os.close(gate_write)

    def poll(self):
        while True:
            try:
                pid, status = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                return self.exit_code if self.exit_code is not None else 2
            if pid == 0:
                return None
            if pid == self.pid:
                self.exit_code = os.waitstatus_to_exitcode(status)

    def terminate(self):
        # Only direct, unreaped children can be opened here: their PID cannot be reused.
        entries = list(Path("/proc").iterdir())
        if len(entries) > 65536:
            raise RuntimeError("Process census budget exceeded")
        for entry in entries:
            if not entry.name.isdecimal():
                continue
            try:
                fields = (entry / "stat").read_text().rsplit(")", 1)[1].split()
                if int(fields[1]) != os.getpid():
                    continue
                handle = os.pidfd_open(int(entry.name))
                try:
                    signal.pidfd_send_signal(handle, signal.SIGKILL)
                finally:
                    os.close(handle)
            except ProcessLookupError:
                continue
            except FileNotFoundError:
                continue

    def close(self):
        os.close(self.root_handle)


def run(request):
    """Capture bounded raw streams and report actual native termination facts."""
    started = time.monotonic()
    destination = Path(request["destination"])
    destination.mkdir()
    pipes = [os.pipe(), os.pipe()]
    budget = request["byteLimit"]
    captured = 0
    lock = threading.Lock()
    exceeded = threading.Event()
    errors = []

    def capture(descriptor, name):
        nonlocal captured
        try:
            with (destination / name).open("xb") as output:
                while chunk := os.read(descriptor, 65536):
                    with lock:
                        allowed = max(0, budget - captured)
                        captured += len(chunk)
                        output.write(chunk[:allowed])
                        if captured > budget:
                            exceeded.set()
        except OSError as error:
            errors.append(str(error))
            exceeded.set()
        finally:
            os.close(descriptor)

    readers = [
        threading.Thread(target=capture, args=(pipe[0], name), daemon=True)
        for pipe, name in zip(pipes, ("stdout.txt", "stderr.txt"))
    ]
    owner = None
    reason = None
    exit_code = None
    quiescent = False
    cancelled = False

    def cancel(_number, _frame):
        nonlocal cancelled
        cancelled = True

    signal.signal(signal.SIGINT, cancel)
    signal.signal(signal.SIGTERM, cancel)
    try:
        if sys.platform == "win32":
            owner = WindowsJestJob(
                request["argv"], request["root"], pipes[0][1], pipes[1][1]
            )
        elif sys.platform == "linux":
            owner = LinuxJestChildren(
                request["argv"], request["root"], pipes[0][1], pipes[1][1]
            )
        else:
            raise RuntimeError("Platform containment is not supported")
        for pipe in pipes:
            os.close(pipe[1])
        for reader in readers:
            reader.start()
        deadline = started + request["timeoutMs"] / 1000
        while exit_code is None:
            exit_code = owner.poll()
            result_path = destination / "jest.json"
            result_bytes = result_path.stat().st_size if result_path.exists() else 0
            if exceeded.is_set() or captured + result_bytes > budget:
                reason = "output-limit"
            elif cancelled or Path(request["cancelPath"]).exists():
                reason = "cancelled"
            elif time.monotonic() >= deadline:
                reason = "deadline"
            if reason:
                cleanup_deadline = time.monotonic() + 5
                while owner.poll() is None and time.monotonic() < cleanup_deadline:
                    owner.terminate()
                    time.sleep(0.01)
                exit_code = owner.poll()
                quiescent = exit_code is not None
                break
            if exit_code is not None:
                quiescent = True
                break
            time.sleep(0.01)
        for reader in readers:
            reader.join(timeout=1)
        if any(reader.is_alive() for reader in readers) or errors:
            reason = reason or "stream-capture-incomplete"
            quiescent = False
        return {
            "exitCode": exit_code,
            "reason": reason,
            "quiescent": quiescent,
            "rootIdentity": owner.identity,
            "capturedBytes": captured,
            "elapsedMs": (time.monotonic() - started) * 1000,
            "errors": errors,
        }
    finally:
        if owner:
            if not quiescent:
                owner.terminate()
            owner.close()


if __name__ == "__main__":
    try:
        data = json.loads(sys.stdin.buffer.read(1024 * 1024 + 1))
        result = run(data)
        print(json.dumps(result), flush=True)
        sys.exit(0 if result["quiescent"] else 2)
    except Exception as failure:  # noqa: BLE001 - CLI boundary retains every failure as incomplete evidence.
        print(
            json.dumps(
                {
                    "reason": "containment-incomplete",
                    "error": str(failure),
                    "quiescent": False,
                }
            ),
            flush=True,
        )
        sys.exit(2)
