"""Transactional publication of repository configuration with guarded rollback.

Extracted from the proven SDLC setup owner; no MCP installer is included.
"""


from __future__ import annotations
import hashlib
import json
import os
import platform
import shutil
import stat
import sys
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator
from _commands import SetupError
from _repository import is_ignored, tracked_paths_under


REPOSITORY_ROOTED_NODE_ENTRY_POINT_BOOTSTRAP_SOURCE = (
    'import { execFileSync } from "node:child_process";'
    'import { resolve } from "node:path";'
    'import { pathToFileURL } from "node:url";'
    "const repositoryRootPath = execFileSync("
    '"git",["rev-parse","--show-toplevel"],'
    '{encoding:"utf8",windowsHide:true}'
    r').replace(/\r?\n$/u,"");'
    "const [repositoryRelativeEntryPointPath,...entryPointArguments]="
    "process.argv.slice(1);"
    "const entryPointPath=resolve("
    "repositoryRootPath,repositoryRelativeEntryPointPath);"
    "process.chdir(repositoryRootPath);"
    "process.argv=[process.execPath,entryPointPath,...entryPointArguments];"
    "await import(pathToFileURL(entryPointPath).href);"
)


GENERATED_SETUP_ROOT = Path(".agent-tools")


REPOSITORY_SETUP_LOCK_PATH = (
    GENERATED_SETUP_ROOT / ".repository-setup.lock"
)


POSIX_FILE_EXECUTION_PERMISSION_MASK = stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH


WINDOWS_DIRECTORY_JUNCTION_REPARSE_TAG = getattr(
    stat,
    "IO_REPARSE_TAG_MOUNT_POINT",
    0xA0000003,
)


REPOSITORY_TRANSACTION_FILE_NAME_COMPONENT = "repository-setup"


REPOSITORY_STAGED_FILE_SUFFIX = ".staged.tmp"


REPOSITORY_ACTIVATION_BACKUP_FILE_SUFFIX = ".activation.backup"


LINUX_AT_FDCWD = -100


LINUX_RENAME_EXCHANGE = 0x00000002


DARWIN_RENAME_SWAP = 0x00000002


WINDOWS_REPLACE_FILE_WITH_DEFAULT_FLAGS = 0


@dataclass(frozen=True)
class RenderedRepositoryConfigurationDocument:
    """One validated rendering and the destination state it was based on.

    `observed_destination_bytes` is `None` only when the destination did not
    exist. Retaining the byte-exact observation lets activation reject a user or
    user edit made while setup was preparing replacement files.
    """

    destination_path: Path
    rendered_contents: str
    observed_destination_bytes: bytes | None


@dataclass(frozen=True)
class RegularFileContentAndPermissionState:
    """Content and permission state used to recognize our published bytes."""

    byte_length: int
    content_sha256: str
    file_permission_bits: int


@dataclass(frozen=True)
class ActivatedFileReplacement:
    """One published destination and the state needed for a safe rollback."""

    destination_path: Path
    rollback_backup_path: Path | None
    published_destination_state: RegularFileContentAndPermissionState


def ensure_generated_setup_root_is_safe(repo: Path) -> None:
    """Require generated setup artifacts to be ignored and entirely untracked.

    Setup replaces files beneath `.agent-tools`. Git, rather than a pathname
    assumption, is the authority for whether that root is disposable generated
    state in the current checkout.
    """
    generated_root = GENERATED_SETUP_ROOT.as_posix()
    tracked = tracked_paths_under(repo, generated_root)

    if tracked:
        listing = "\n".join(f"  - {path}" for path in tracked)
        raise SetupError(
            f"The repository tracks files beneath {generated_root}; refusing "
            f"to replace generated setup artifacts:\n{listing}"
        )

    generated_setup_root = repo / GENERATED_SETUP_ROOT

    if _path_is_symbolic_link_or_junction(generated_setup_root):
        raise SetupError(
            f"The generated setup root {generated_root} must be a "
            "real directory, not a symbolic link or junction."
        )

    if (
        generated_setup_root.exists()
        and not generated_setup_root.is_dir()
    ):
        raise SetupError(
            f"The generated setup root {generated_root} must be a "
            "directory when it exists."
        )

    if generated_setup_root.is_dir():
        for current_directory, directory_names, file_names in os.walk(
            generated_setup_root,
            followlinks=False,
        ):
            current_path = Path(current_directory)

            for entry_name in [*directory_names, *file_names]:
                entry_path = current_path / entry_name

                if _path_is_symbolic_link_or_junction(entry_path):
                    relative_entry_path = entry_path.relative_to(repo).as_posix()
                    raise SetupError(
                        "Generated setup paths must not contain "
                        "symbolic links or junctions: "
                        f"{relative_entry_path}."
                    )

    ignore_probe = (
        GENERATED_SETUP_ROOT
        / ".repository_setup_ignore_probe"
    ).as_posix()

    if not is_ignored(repo, ignore_probe):
        raise SetupError(
            f"The generated setup root {generated_root} is not "
            "ignored by Git. Add an exact ignore rule before running setup."
        )


def _path_is_symbolic_link_or_junction(path: Path) -> bool:
    """Recognize both POSIX-style links and Windows directory junctions."""
    if path.is_symlink():
        return True

    if os.name != "nt":
        return False

    try:
        return (
            path.lstat().st_reparse_tag
            == WINDOWS_DIRECTORY_JUNCTION_REPARSE_TAG
        )
    except FileNotFoundError:
        return False


def ensure_repository_configuration_destinations_are_safe(
    repo: Path,
    relative_paths: Iterable[Path],
) -> None:
    """Reject configuration destinations that escape through link/file seams."""
    repository_root = repo.resolve()

    for relative_path in relative_paths:
        if relative_path.is_absolute() or ".." in relative_path.parts:
            raise SetupError(
                "repository configuration destinations must be repository-relative: "
                f"{relative_path}."
            )

        destination = repo

        for part_index, part in enumerate(relative_path.parts):
            destination /= part
            is_destination = part_index == len(relative_path.parts) - 1

            if _path_is_symbolic_link_or_junction(destination):
                raise SetupError(
                    "repository configuration destinations must not traverse a "
                    f"symbolic link or junction: {relative_path.as_posix()}."
                )

            if destination.exists():
                if not is_destination and not destination.is_dir():
                    raise SetupError(
                        "Every repository configuration parent must be a real "
                        f"directory: {destination.relative_to(repo).as_posix()}."
                    )

                if is_destination and not destination.is_file():
                    raise SetupError(
                        "An existing repository configuration destination must be "
                        f"a regular file: {relative_path.as_posix()}."
                    )

        try:
            destination.resolve(strict=False).relative_to(repository_root)
        except ValueError as exc:
            raise SetupError(
                "repository configuration destination resolves outside the "
                f"repository: {relative_path.as_posix()}."
            ) from exc


@contextmanager
def acquire_repository_setup_lock(repo: Path) -> Iterator[None]:
    """Hold one crash-recovering, process-scoped setup lock for this checkout."""
    lock_path = repo / REPOSITORY_SETUP_LOCK_PATH
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock_file = lock_path.open("a+b")
    lock_acquired = False

    try:
        # Windows byte-range locks require the selected range to exist. The
        # persistent byte is not a stale-lock sentinel: the kernel releases the
        # actual lock automatically when this handle or process closes.
        lock_file.seek(0, os.SEEK_END)

        if lock_file.tell() == 0:
            lock_file.write(b"\0")
            lock_file.flush()
            os.fsync(lock_file.fileno())

        lock_file.seek(0)

        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(
                    lock_file.fileno(),
                    fcntl.LOCK_EX | fcntl.LOCK_NB,
                )
        except OSError as exc:
            raise SetupError(
                "Cannot acquire the setup lock because another repository-local "
                f"setup is already running for {repo}. Wait for it to finish "
                "before retrying."
            ) from exc

        lock_acquired = True
        yield
    finally:
        if lock_acquired:
            try:
                lock_file.seek(0)

                if os.name == "nt":
                    import msvcrt

                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            finally:
                lock_file.close()
        else:
            lock_file.close()


def _parse_json_without_duplicate_object_members(
    serialized_document: str | bytes,
    *,
    description: str,
) -> object:
    """Parse standards-conforming JSON without object-member ambiguity."""

    def reject_duplicate_object_members(
        pairs: list[tuple[str, object]],
    ) -> dict[str, object]:
        parsed_object: dict[str, object] = {}

        for member_name, member_value in pairs:
            if member_name in parsed_object:
                raise SetupError(
                    f"{description} contains the duplicate JSON object member "
                    f"{member_name!r}."
                )

            parsed_object[member_name] = member_value

        return parsed_object

    def reject_non_standard_json_constant(constant_name: str) -> object:
        # Python deliberately accepts these JavaScript spellings by default,
        # even though RFC 8259 JSON does not. repositorys commonly use strict
        # parsers, so retaining one would publish a document they cannot read.
        raise SetupError(
            f"{description} contains the non-standard JSON constant "
            f"{constant_name!r}."
        )

    return json.loads(
        serialized_document,
        object_pairs_hook=reject_duplicate_object_members,
        parse_constant=reject_non_standard_json_constant,
    )


def _repository_transaction_file_prefix(path: Path) -> str:
    """Name a hidden sibling transaction artifact after its destination."""
    destination_file_name = path.name.lstrip(".")

    if not destination_file_name:
        raise SetupError(
            f"Repository setup cannot derive a transaction file name for: {path}."
        )

    return (
        f".{destination_file_name}."
        f"{REPOSITORY_TRANSACTION_FILE_NAME_COMPONENT}."
    )


def _require_repository_transaction_artifact_is_git_ignored(
    repository_root: Path,
    transaction_artifact_path: Path,
) -> None:
    """Require Git to ignore the exact transaction artifact before it gets data."""
    try:
        relative_transaction_artifact_path = transaction_artifact_path.resolve(
            strict=False
        ).relative_to(repository_root.resolve())
    except ValueError as exc:
        raise SetupError(
            "Configuration transaction artifacts must remain inside the repository: "
            f"{transaction_artifact_path}."
        ) from exc

    relative_transaction_artifact_path_text = (
        relative_transaction_artifact_path.as_posix()
    )

    if not is_ignored(
        repository_root,
        relative_transaction_artifact_path_text,
    ):
        raise SetupError(
            "Configuration transaction artifact is not ignored by Git: "
            f"{relative_transaction_artifact_path_text}. Add an exact ignore "
            "rule before staging credential-capable host configuration data."
        )


def _stage_repository_configuration_document(
    repository_root: Path,
    path: Path,
    contents: str,
) -> Path:
    """Write and synchronize one Git-ignored replacement beside its destination."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            prefix=_repository_transaction_file_prefix(path),
            suffix=REPOSITORY_STAGED_FILE_SUFFIX,
            dir=path.parent,
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)
            # The file is still empty here. Validate the exact randomized path
            # before any merged host document (which may retain user secrets)
            # can reach a Git-visible transaction artifact.
            _require_repository_transaction_artifact_is_git_ignored(
                repository_root,
                temporary_path,
            )
            handle.write(contents)
            handle.flush()
            os.fsync(handle.fileno())

        return temporary_path
    except BaseException:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

        raise


def _create_activation_backup_copy(
    repository_root: Path,
    path: Path,
    *,
    require_git_ignore_coverage: bool,
) -> Path:
    """Create and synchronize a sibling rollback copy without moving `path`."""
    backup_path: Path | None = None

    try:
        source_permission_bits = stat.S_IMODE(path.stat().st_mode)

        with path.open("rb") as source, tempfile.NamedTemporaryFile(
            mode="wb",
            prefix=_repository_transaction_file_prefix(path),
            suffix=REPOSITORY_ACTIVATION_BACKUP_FILE_SUFFIX,
            dir=path.parent,
            delete=False,
        ) as backup:
            backup_path = Path(backup.name)

            if require_git_ignore_coverage:
                # Validate the exact empty artifact before copying a host
                # document that may contain credentials retained by the merge.
                _require_repository_transaction_artifact_is_git_ignored(
                    repository_root,
                    backup_path,
                )

            shutil.copyfileobj(source, backup)
            backup.flush()
            os.fsync(backup.fileno())

        backup_path.chmod(source_permission_bits)
        return backup_path
    except BaseException:
        if backup_path is not None:
            backup_path.unlink(missing_ok=True)

        raise


def _create_empty_activation_displaced_file_path(
    repository_root: Path,
    path: Path,
    *,
    require_git_ignore_coverage: bool,
) -> Path:
    """Reserve the sibling path that will receive an atomically displaced file.

    The path starts as an empty regular file. On Windows, `ReplaceFileW` writes
    the replaced file to it; on Linux and macOS, the staged file is moved to
    this name before the kernel exchanges it with the live destination.
    """
    displaced_file_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            prefix=_repository_transaction_file_prefix(path),
            suffix=REPOSITORY_ACTIVATION_BACKUP_FILE_SUFFIX,
            dir=path.parent,
            delete=False,
        ) as displaced_file:
            displaced_file_path = Path(displaced_file.name)

            if require_git_ignore_coverage:
                # Validate the still-empty randomized path before it can
                # receive a complete host document with retained credentials.
                _require_repository_transaction_artifact_is_git_ignored(
                    repository_root,
                    displaced_file_path,
                )

            displaced_file.flush()
            os.fsync(displaced_file.fileno())

        return displaced_file_path
    except BaseException:
        if displaced_file_path is not None:
            displaced_file_path.unlink(missing_ok=True)

        raise


def _exchange_existing_file_paths(
    first_path: Path,
    second_path: Path,
    *,
    operating_system_name: str,
) -> None:
    """Ask the host kernel to atomically exchange two existing file names."""
    import ctypes

    first_path_bytes = os.fsencode(first_path.resolve())
    second_path_bytes = os.fsencode(second_path.resolve())
    system_library = ctypes.CDLL(None, use_errno=True)

    if operating_system_name == "Linux":
        try:
            rename_at_2 = system_library.renameat2
        except AttributeError as exc:
            raise SetupError(
                "This Linux runtime does not expose renameat2, which is required "
                "to preserve a concurrently edited repository configuration."
            ) from exc

        rename_at_2.argtypes = [
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_uint,
        ]
        rename_at_2.restype = ctypes.c_int
        result = rename_at_2(
            LINUX_AT_FDCWD,
            first_path_bytes,
            LINUX_AT_FDCWD,
            second_path_bytes,
            LINUX_RENAME_EXCHANGE,
        )
    elif operating_system_name == "Darwin":
        try:
            rename_extended = system_library.renamex_np
        except AttributeError as exc:
            raise SetupError(
                "This macOS runtime does not expose renamex_np, which is required "
                "to preserve a concurrently edited repository configuration."
            ) from exc

        rename_extended.argtypes = [
            ctypes.c_char_p,
            ctypes.c_char_p,
            ctypes.c_uint,
        ]
        rename_extended.restype = ctypes.c_int
        result = rename_extended(
            first_path_bytes,
            second_path_bytes,
            DARWIN_RENAME_SWAP,
        )
    else:
        raise SetupError(
            "Atomic repository-configuration replacement is supported only on "
            f"Windows, Linux, and macOS; reported operating system: "
            f"{operating_system_name or '(empty)'}."
        )

    if result != 0:
        error_number = ctypes.get_errno()
        raise OSError(
            error_number,
            os.strerror(error_number),
            f"{first_path} <-> {second_path}",
        )


def _replace_existing_file_and_retain_displaced_file(
    destination_path: Path,
    staged_replacement_path: Path,
    displaced_file_path: Path,
) -> None:
    """Atomically publish a file while retaining the exact displaced live file.

    All paths are siblings, so every native operation remains on one volume.
    The caller validates `displaced_file_path` before it commits the wider
    transaction; this is the compare step that an unconditional `os.replace`
    cannot provide.
    """
    operating_system_name = platform.system()

    if operating_system_name == "Windows":
        import ctypes

        replace_file = ctypes.WinDLL("kernel32", use_last_error=True).ReplaceFileW
        replace_file.argtypes = [
            ctypes.c_wchar_p,
            ctypes.c_wchar_p,
            ctypes.c_wchar_p,
            ctypes.c_uint32,
            ctypes.c_void_p,
            ctypes.c_void_p,
        ]
        replace_file.restype = ctypes.c_int
        replacement_succeeded = replace_file(
            str(destination_path.resolve()),
            str(staged_replacement_path.resolve()),
            str(displaced_file_path.resolve()),
            WINDOWS_REPLACE_FILE_WITH_DEFAULT_FLAGS,
            None,
            None,
        )

        if not replacement_succeeded:
            raise ctypes.WinError(ctypes.get_last_error())

        return

    if operating_system_name not in {"Linux", "Darwin"}:
        raise SetupError(
            "Atomic repository-configuration replacement is supported only on "
            f"Windows, Linux, and macOS; reported operating system: "
            f"{operating_system_name or '(empty)'}."
        )

    # Put the staged bytes at the stable rollback name before the exchange.
    # This move affects no live path. After the single kernel operation,
    # `destination_path` names the replacement and `displaced_file_path` names
    # the exact file that occupied the destination at that instant.
    os.replace(staged_replacement_path, displaced_file_path)
    _exchange_existing_file_paths(
        displaced_file_path,
        destination_path,
        operating_system_name=operating_system_name,
    )


def _files_have_identical_bytes(left: Path, right: Path) -> bool:
    if left.stat().st_size != right.stat().st_size:
        return False

    with left.open("rb") as left_handle, right.open("rb") as right_handle:
        while True:
            left_chunk = left_handle.read(1024 * 1024)
            right_chunk = right_handle.read(1024 * 1024)

            if left_chunk != right_chunk:
                return False

            if not left_chunk:
                return True


def _files_have_identical_execution_permission_bits(
    left: Path,
    right: Path,
) -> bool:
    """Compare POSIX execution bits; other staged-file metadata is incidental."""
    return (
        left.stat().st_mode & POSIX_FILE_EXECUTION_PERMISSION_MASK
    ) == (right.stat().st_mode & POSIX_FILE_EXECUTION_PERMISSION_MASK)


def _read_optional_file_bytes(path: Path) -> bytes | None:
    """Return exact bytes, using `None` exclusively for an absent path."""
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return None


def _read_optional_regular_file_content_and_permission_state(
    path: Path,
) -> RegularFileContentAndPermissionState | None:
    """Read rollback-guard state without treating a special path as a file."""
    try:
        path_status = path.lstat()
    except FileNotFoundError:
        return None

    if _path_is_symbolic_link_or_junction(path) or not stat.S_ISREG(
        path_status.st_mode
    ):
        raise OSError(f"Rollback destination is not a regular file: {path}.")

    return RegularFileContentAndPermissionState(
        byte_length=path_status.st_size,
        content_sha256=calculate_file_sha256(path),
        file_permission_bits=stat.S_IMODE(path_status.st_mode),
    )


def _require_expected_destination_bytes(
    destination: Path,
    expected_destination_bytes: bytes | None,
) -> None:
    """Reject an edit made after a host configuration was rendered."""
    if _read_optional_file_bytes(destination) != expected_destination_bytes:
        raise SetupError(
            "repository configuration changed after it was rendered: "
            f"{destination}. No setup files were activated; rerun setup to "
            "merge the current document."
        )


def _activate_staged_file_replacements(
    repository_root: Path,
    replacements: Iterable[tuple[Path, Path]],
    *,
    expected_destination_bytes_by_path: dict[Path, bytes | None] | None = None,
    sensitive_configuration_destination_paths: Iterable[Path] = (),
) -> list[Path]:
    """Replace live paths continuously as one rollback-capable transaction."""
    replacement_list = list(replacements)
    guarded_destination_bytes_by_path = dict(
        expected_destination_bytes_by_path or {}
    )
    sensitive_host_configuration_destination_path_set = set(
        sensitive_configuration_destination_paths
    )
    prepared_file_replacements: list[
        tuple[
            Path,
            Path,
            Path | None,
            RegularFileContentAndPermissionState,
        ]
    ] = []
    activated_file_replacements: list[ActivatedFileReplacement] = []
    replacement_destination_paths: list[Path] = []
    preserved_recovery_backup_paths: set[Path] = set()
    retained_superseded_backups: list[tuple[Path, OSError]] = []
    rollback_conflict_destination_paths: list[Path] = []
    normalized_destination_path_keys: set[str] = set()

    try:
        for destination, temporary_path in replacement_list:
            normalized_destination = os.path.normcase(
                os.path.abspath(destination)
            )

            if normalized_destination in normalized_destination_path_keys:
                raise SetupError(
                    "The Repository setup transaction contains a duplicate replacement "
                    f"destination: {destination}."
                )

            normalized_destination_path_keys.add(normalized_destination)
            replacement_destination_paths.append(destination)

            if destination in guarded_destination_bytes_by_path:
                _require_expected_destination_bytes(
                    destination,
                    guarded_destination_bytes_by_path[destination],
                )

            if (
                destination.exists()
                and _files_have_identical_bytes(destination, temporary_path)
                and _files_have_identical_execution_permission_bits(
                    destination,
                    temporary_path,
                )
            ):
                continue

            published_destination_state = (
                _read_optional_regular_file_content_and_permission_state(
                    temporary_path
                )
            )

            if published_destination_state is None:
                raise SetupError(
                    "The staged configuration replacement disappeared before activation: "
                    f"{temporary_path}."
                )

            backup_path: Path | None = None

            if destination.exists():
                require_git_ignore_coverage = (
                    destination
                    in sensitive_host_configuration_destination_path_set
                )
                backup_path = (
                    _create_empty_activation_displaced_file_path(
                        repository_root,
                        destination,
                        require_git_ignore_coverage=(
                            require_git_ignore_coverage
                        ),
                    )
                    if destination in guarded_destination_bytes_by_path
                    else _create_activation_backup_copy(
                        repository_root,
                        destination,
                        require_git_ignore_coverage=(
                            require_git_ignore_coverage
                        ),
                    )
                )
            prepared_file_replacements.append(
                (
                    destination,
                    temporary_path,
                    backup_path,
                    published_destination_state,
                )
            )

        unmatched_guarded_destination_paths = set(
            guarded_destination_bytes_by_path
        ).difference(replacement_destination_paths)

        if unmatched_guarded_destination_paths:
            listing = ", ".join(
                str(path)
                for path in sorted(unmatched_guarded_destination_paths)
            )
            raise SetupError(
                "Repository setup received observed bytes for a destination that is not "
                f"part of the activation transaction: {listing}."
            )

        unmatched_sensitive_configuration_destination_paths = (
            sensitive_host_configuration_destination_path_set.difference(
                replacement_destination_paths
            )
        )

        if unmatched_sensitive_configuration_destination_paths:
            listing = ", ".join(
                str(path)
                for path in sorted(
                    unmatched_sensitive_configuration_destination_paths
                )
            )
            raise SetupError(
                "Repository setup received a sensitive host-configuration destination "
                f"that is not part of the activation transaction: {listing}."
            )

        # Backup copies can take appreciable time for native programs. Recheck
        # every guarded configuration after preparation and immediately before
        # the first live path is replaced.
        for destination, expected_destination_bytes in (
            guarded_destination_bytes_by_path.items()
        ):
            _require_expected_destination_bytes(
                destination,
                expected_destination_bytes,
            )

        for (
            destination,
            temporary_path,
            backup_path,
            published_destination_state,
        ) in prepared_file_replacements:
            if destination in guarded_destination_bytes_by_path:
                # Program and record replacements may precede a host document.
                # Close that remaining interval by checking the document again
                # at its own replacement boundary.
                _require_expected_destination_bytes(
                    destination,
                    guarded_destination_bytes_by_path[destination],
                )

            if destination in guarded_destination_bytes_by_path:
                expected_destination_bytes = (
                    guarded_destination_bytes_by_path[destination]
                )

                if expected_destination_bytes is None:
                    try:
                        # A hard link publishes this same-directory regular file
                        # only if the still-absent destination name can be created
                        # atomically. It never overwrites a file created after the
                        # render-time observation.
                        os.link(temporary_path, destination)
                    except FileExistsError as link_error:
                        raise SetupError(
                            "repository configuration changed after it was rendered: "
                            f"{destination}. The concurrently created file was "
                            "preserved; rerun setup to merge it."
                        ) from link_error

                    activated_file_replacements.append(
                        ActivatedFileReplacement(
                            destination_path=destination,
                            rollback_backup_path=None,
                            published_destination_state=(
                                published_destination_state
                            ),
                        )
                    )
                    temporary_path.unlink()
                    continue

                if backup_path is None:
                    raise SetupError(
                        "The guarded repository configuration has no displaced-file "
                        f"path: {destination}."
                    )

                _replace_existing_file_and_retain_displaced_file(
                    destination,
                    temporary_path,
                    backup_path,
                )
                activated_file_replacements.append(
                    ActivatedFileReplacement(
                        destination_path=destination,
                        rollback_backup_path=backup_path,
                        published_destination_state=published_destination_state,
                    )
                )

                # Unlike a pre-operation copy, this path contains the exact file
                # displaced by the native replacement. A mismatch therefore
                # detects even an edit made after the final precheck but before
                # the kernel operation. The ordinary rollback path below restores
                # those bytes while the published destination is still ours.
                if backup_path.read_bytes() != expected_destination_bytes:
                    raise SetupError(
                        "The repository configuration atomically displaced during "
                        "activation differs from the document that was rendered: "
                        f"{destination}. The displaced bytes will be restored; "
                        "rerun setup to merge the current document."
                    )

                continue

            # Generated programs and records are protected by the repository-
            # scoped setup lock rather than an external host editor. Their
            # synchronized backup copy supports the wider transaction rollback;
            # replace-over-destination keeps the live path continuously present.
            os.replace(temporary_path, destination)
            activated_file_replacements.append(
                ActivatedFileReplacement(
                    destination_path=destination,
                    rollback_backup_path=backup_path,
                    published_destination_state=published_destination_state,
                )
            )

    except BaseException as exc:
        rollback_failures: list[str] = []

        for activated_replacement in reversed(activated_file_replacements):
            destination = activated_replacement.destination_path
            backup_path = activated_replacement.rollback_backup_path
            current_destination_state: (
                RegularFileContentAndPermissionState | None
            ) = None

            try:
                current_destination_state = (
                    _read_optional_regular_file_content_and_permission_state(
                        destination
                    )
                )

                if (
                    current_destination_state
                    != activated_replacement.published_destination_state
                ):
                    rollback_conflict_destination_paths.append(destination)

                    if backup_path is not None and backup_path.exists():
                        preserved_recovery_backup_paths.add(backup_path)

                    continue

                if backup_path is not None and backup_path.exists():
                    os.replace(backup_path, destination)
                else:
                    destination.unlink(missing_ok=True)
            except OSError as rollback_error:
                # A destination that can no longer be read as the exact regular
                # file we published is itself a concurrent-state conflict. Do
                # not overwrite or unlink it during an error-recovery path.
                if current_destination_state is None:
                    rollback_conflict_destination_paths.append(destination)
                else:
                    rollback_failures.append(
                        f"{destination}: {rollback_error}"
                    )

                if backup_path is not None and backup_path.exists():
                    preserved_recovery_backup_paths.add(backup_path)

        rollback_detail = (
            " Rollback also failed for: " + "; ".join(rollback_failures) + "."
            if rollback_failures
            else ""
        )
        recovery_detail = (
            " The preserved recovery backup"
            + (
                "s are: "
                if len(preserved_recovery_backup_paths) != 1
                else " is: "
            )
            + ", ".join(
                str(path) for path in sorted(preserved_recovery_backup_paths)
            )
            + "."
            if preserved_recovery_backup_paths
            else ""
        )
        rollback_conflict_detail = (
            " Rollback preserved concurrent destination changes at: "
            + ", ".join(
                str(path)
                for path in rollback_conflict_destination_paths
            )
            + "."
            if rollback_conflict_destination_paths
            else ""
        )

        if (
            not isinstance(exc, Exception)
            and not rollback_failures
            and not rollback_conflict_destination_paths
        ):
            raise

        raise SetupError(
            f"Could not activate the staged repository setup transaction: {exc}."
            f"{rollback_detail}{rollback_conflict_detail}{recovery_detail}"
        ) from exc

    finally:
        for _destination, temporary_path in replacement_list:
            temporary_path.unlink(missing_ok=True)

        for (
            _destination,
            _temporary_path,
            backup_path,
            _published_destination_state,
        ) in prepared_file_replacements:
            if (
                backup_path is not None
                and backup_path not in preserved_recovery_backup_paths
            ):
                try:
                    backup_path.unlink(missing_ok=True)
                except OSError as cleanup_error:
                    # Activation has already committed. A scanner, backup agent,
                    # or other process can transiently retain the inactive copy;
                    # deferred cleanup must not turn that success into failure.
                    retained_superseded_backups.append((backup_path, cleanup_error))

        if retained_superseded_backups:
            print(
                "Warning: retained superseded backup file(s) because the "
                "operating system denied cleanup. Restart processes that may "
                "still use them, then delete these inactive paths:",
                file=sys.stderr,
            )

            for backup_path, cleanup_error in retained_superseded_backups:
                print(
                    f"  {backup_path} ({cleanup_error})",
                    file=sys.stderr,
                )

    return replacement_destination_paths


def publish_repository_configuration_documents(
    repository_root: Path,
    rendered_documents: Iterable[RenderedRepositoryConfigurationDocument],
) -> list[Path]:
    """Publish host documents with per-file atomicity and transaction rollback."""
    documents = list(rendered_documents)
    replacements: list[tuple[Path, Path]] = []

    try:
        for document in documents:
            replacements.append(
                (
                    document.destination_path,
                    _stage_repository_configuration_document(
                        repository_root,
                        document.destination_path,
                        document.rendered_contents,
                    ),
                )
            )
    except BaseException as exc:
        for _destination, temporary_path in replacements:
            temporary_path.unlink(missing_ok=True)

        if not isinstance(exc, Exception):
            raise

        raise SetupError(
            f"Could not stage repository configuration documents: {exc}."
        ) from exc

    return _activate_staged_file_replacements(
        repository_root,
        replacements,
        expected_destination_bytes_by_path={
            document.destination_path: document.observed_destination_bytes
            for document in documents
        },
        sensitive_configuration_destination_paths={
            document.destination_path for document in documents
        },
    )


def calculate_file_sha256(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()
