"""Inspect the selected Codex runtime through its native diagnostic interfaces."""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import subprocess

from _commands import SetupError, require_command


def _native_command(executable: str, arguments: list[str], repo: Path, *,
                    allowed_codes=(0,), identity=None):
    try:
        result = subprocess.run(
            [executable, *arguments], cwd=repo, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            encoding="utf-8", errors="replace", timeout=30, check=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise SetupError(f"Codex {identity or executable} {' '.join(arguments)} could not complete: {exc}") from exc
    if result.returncode not in allowed_codes:
        raise SetupError(
            f"Codex {identity or executable} {' '.join(arguments)} failed with exit code {result.returncode}. "
            "Check the selected installation with its native CLI."
        )
    return result


def _text(value, description):
    if not isinstance(value, str) or not value.strip():
        raise SetupError(f"Native Codex report is missing {description}.")
    return value


def _check(checks, name):
    check = checks.get(name)
    if (not isinstance(check, dict)
            or check.get("status") not in ("ok", "warning", "fail")
            or not isinstance(check.get("details"), dict)):
        raise SetupError(f"Native Codex report has an unsupported {name} check.")
    _text(check.get("summary"), f"{name} summary")
    return check


def inspect_codex_runtime(repo: Path, executable: str | None = None) -> dict:
    """Return scoped prerequisites, preserving native health and acceptance limits.

    Native doctor owns installation/version/update diagnostics; features list owns
    feature recognition and effective state. Neither interface establishes hook trust.
    """
    if executable is None:
        launcher = require_command("codex")
    else:
        candidate = Path(executable)
        if not candidate.is_absolute() or not candidate.is_file():
            raise SetupError("--codex-executable must name an existing absolute executable path.")
        launcher = str(candidate.resolve())

    version_output = _native_command(launcher, ["--version"], repo).stdout.strip()
    if not version_output.startswith("codex-cli ") or len(version_output.splitlines()) != 1:
        raise SetupError(f"Selected launcher {launcher} did not identify a Codex CLI version.")
    launcher_version = _text(version_output.removeprefix("codex-cli ").strip(), "launcher version")
    diagnostic = _native_command(launcher, ["doctor", "--json"], repo, allowed_codes=(0, 1),
                                 identity=f"{launcher_version} at {launcher}")
    try:
        doctor = json.loads(diagnostic.stdout)
    except (TypeError, ValueError) as exc:
        raise SetupError("Native Codex doctor did not return a JSON diagnostic report.") from exc
    if (not isinstance(doctor, dict) or type(doctor.get("schemaVersion")) is not int
            or doctor["schemaVersion"] != 1
            or not isinstance(doctor.get("checks"), dict)
            or doctor.get("overallStatus") not in ("ok", "warning", "fail")):
        raise SetupError("Unsupported native Codex doctor report; review its current contract.")
    checks = doctor["checks"]
    required_names = ("installation", "runtime.provenance", "config.load")
    prerequisites = {name: _check(checks, name) for name in required_names}
    updates = _check(checks, "updates.status")
    provenance = prerequisites["runtime.provenance"]["details"]
    version = _text(doctor.get("codexVersion"), "Codex version")
    if provenance.get("version") != version or launcher_version != version:
        raise SetupError("Native Codex version identities disagree.")
    native = Path(_text(provenance.get("current executable"), "runtime executable"))
    installed = Path(_text(prerequisites["installation"]["details"].get("current executable"),
                           "installation executable"))
    if (not native.is_absolute() or not native.is_file() or not installed.is_absolute()
            or native.resolve() != installed.resolve()):
        raise SetupError("Native Codex executable identities are missing or inconsistent.")
    install_method = _text(provenance.get("install method"), "installation method")

    # Bind capability inspection to the actual binary identified by doctor,
    # rather than resolving PATH a second time or guessing an app bundle path.
    native_path = str(native.resolve())
    feature_result = _native_command(native_path, ["features", "list"], repo)
    hook_rows = [line.split() for line in feature_result.stdout.splitlines()
                 if line.split()[:1] == ["hooks"]]
    if len(hook_rows) > 1 or (hook_rows and (
            len(hook_rows[0]) < 3 or hook_rows[0][-1] not in ("true", "false"))):
        raise SetupError("Native Codex features list has an ambiguous hooks record.")
    hooks = ({"stage": " ".join(hook_rows[0][1:-1]), "enabled": hook_rows[0][-1] == "true"}
             if hook_rows else {"stage": "unavailable", "enabled": False})
    failures = [name for name, check in prerequisites.items() if check["status"] != "ok"]
    if hooks != {"stage": "stable", "enabled": True}:
        failures.append("hooks must be reported as stable and enabled")
    other_findings = [
        {"id": name, "status": check.get("status")}
        for name, check in checks.items()
        if name not in (*required_names, "updates.status")
        and isinstance(check, dict) and check.get("status") != "ok"
    ]
    return {
        "schemaVersion": 1,
        "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "scope": "codex-runtime-prerequisites",
        "ready": not failures,
        "failures": failures,
        "launcher": launcher,
        "runtime": {"executable": native_path, "version": version, "installMethod": install_method},
        "requiredFeatures": {"hooks": hooks},
        "doctor": {
            "exitCode": diagnostic.returncode, "overallStatus": doctor["overallStatus"],
            "prerequisites": {name: {"status": check["status"], "summary": check["summary"]}
                              for name, check in prerequisites.items()},
            "otherFindings": other_findings,
        },
        "updates": {"status": updates["status"], "summary": updates["summary"],
                    "details": {key: updates["details"][key] for key in (
                        "latest version", "latest version status", "check for update on startup",
                        "update action") if key in updates["details"]}},
        "hookAcceptance": "not-assessed",
    }
