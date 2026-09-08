import contextlib

import io


import os

import stat



import tempfile

import unittest

from pathlib import Path
from unittest import mock
import _configuration_transaction  # noqa: E402

def require_setup_callable(test_case: unittest.TestCase, name: str):
    """Fail as an assertion when a wished-for setup seam is still absent."""
    value = getattr(_configuration_transaction, name, None)
    test_case.assertTrue(callable(value), f"Missing setup function: {name}")
    return value

def rendered_repository_configuration_document(
    destination_path: Path,
    rendered_contents: str,
    observed_destination_bytes: bytes | None,
):
    """Construct the installer's byte-guarded host-document value object."""
    document_type = getattr(
        _configuration_transaction,
        "RenderedRepositoryConfigurationDocument",
        None,
    )

    if document_type is None:
        raise AssertionError("Missing RenderedRepositoryConfigurationDocument")

    return document_type(
        destination_path=destination_path,
        rendered_contents=rendered_contents,
        observed_destination_bytes=observed_destination_bytes,
    )

class RepositoryConfigurationLockTests(unittest.TestCase):
    def test_second_setup_process_cannot_acquire_the_repository_lock(self):
        acquire_setup_lock = require_setup_callable(
            self,
            "acquire_repository_setup_lock",
        )

        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)

            with acquire_setup_lock(repository_root):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "another repository-local setup is already running",
                ):
                    with acquire_setup_lock(repository_root):
                        self.fail("the second setup lock must not be acquired")

            # The persistent lock file is harmless generated state; releasing
            # the OS-level lock, rather than deleting a racy sentinel, makes a
            # crash self-recovering.
            with acquire_setup_lock(repository_root):
                pass

class TransactionalHostConfigurationPublicationTests(unittest.TestCase):
    def test_edit_after_rendering_aborts_without_overwriting_user_content(self):
        publish_documents = require_setup_callable(
            self,
            "publish_repository_configuration_documents",
        )

        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)
            configuration_path = repository_root / ".codex" / "config.toml"
            configuration_path.parent.mkdir()
            other_path = repository_root / ".codex" / "hooks.json"
            rendered_documents = [
                rendered_repository_configuration_document(
                    configuration_path, 'approval_policy = "on-request"\n', None
                ),
                rendered_repository_configuration_document(other_path, '{}\n', None),
            ]
            concurrent_user_contents = 'model = "user-selected-model"\n'
            configuration_path.write_text(
                concurrent_user_contents,
                encoding="utf-8",
            )

            with mock.patch.object(
                _configuration_transaction,
                "is_ignored",
                return_value=True,
            ), self.assertRaisesRegex(
                _configuration_transaction.SetupError,
                "changed after.*rendered|rendered.*changed",
            ):
                publish_documents(repository_root, rendered_documents)

            self.assertEqual(
                configuration_path.read_text(encoding="utf-8"),
                concurrent_user_contents,
            )
            self.assertFalse(other_path.exists())

    def test_existing_destination_remains_present_until_atomic_replacement(self):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "configuration.json"
            staged_replacement = root / ".configuration.json.staged.tmp"
            destination.write_bytes(b"original")
            staged_replacement.write_bytes(b"replacement")
            real_replace = os.replace

            def observe_continuous_destination(source, target):
                source_path = Path(source)
                target_path = Path(target)

                self.assertNotEqual(
                    source_path,
                    destination,
                    "the live destination must not be renamed away",
                )

                if target_path == destination:
                    self.assertTrue(destination.exists())
                    self.assertEqual(destination.read_bytes(), b"original")

                return real_replace(source, target)

            with mock.patch.object(
                _configuration_transaction.os,
                "replace",
                side_effect=observe_continuous_destination,
            ):
                activated_paths = activate_replacements(
                    root,
                    [(destination, staged_replacement)]
                )

            self.assertEqual(activated_paths, [destination])
            self.assertEqual(destination.read_bytes(), b"replacement")

    def test_native_replacement_retains_the_exact_displaced_file(self):
        replace_existing_file = require_setup_callable(
            self,
            "_replace_existing_file_and_retain_displaced_file",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "configuration.json"
            staged_replacement = root / ".configuration.json.staged.tmp"
            displaced_file = root / ".configuration.json.activation.backup"
            destination.write_bytes(b"live before replacement")
            staged_replacement.write_bytes(b"managed replacement")
            displaced_file.write_bytes(b"")

            replace_existing_file(
                destination,
                staged_replacement,
                displaced_file,
            )

            self.assertEqual(destination.read_bytes(), b"managed replacement")
            self.assertEqual(displaced_file.read_bytes(), b"live before replacement")
            self.assertFalse(staged_replacement.exists())

    def test_edit_at_guarded_replacement_boundary_is_restored_from_displaced_file(
        self,
    ):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )
        replace_existing_file = require_setup_callable(
            self,
            "_replace_existing_file_and_retain_displaced_file",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "configuration.json"
            staged_replacement = root / ".configuration.json.staged.tmp"
            destination.write_bytes(b"render-time observation")
            staged_replacement.write_bytes(b"managed replacement")
            concurrent_user_contents = b"edit at the replacement boundary"

            def replace_after_concurrent_edit(
                destination_path,
                staged_replacement_path,
                displaced_file_path,
            ):
                # Model a save in the former check/replace window. The native
                # primitive must retain these exact bytes rather than discard
                # them when it publishes the staged replacement.
                destination_path.write_bytes(concurrent_user_contents)
                replace_existing_file(
                    destination_path,
                    staged_replacement_path,
                    displaced_file_path,
                )

            with mock.patch.object(
                _configuration_transaction,
                "_replace_existing_file_and_retain_displaced_file",
                side_effect=replace_after_concurrent_edit,
            ), mock.patch.object(
                _configuration_transaction,
                "is_ignored",
                return_value=True,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    r"displaced.*rendered|rendered.*displaced",
                ):
                    activate_replacements(
                        root,
                        [(destination, staged_replacement)],
                        expected_destination_bytes_by_path={
                            destination: b"render-time observation"
                        },
                        sensitive_configuration_destination_paths={
                            destination
                        },
                    )

            self.assertEqual(destination.read_bytes(), concurrent_user_contents)
            self.assertEqual(
                [path for path in root.iterdir() if path.is_file()],
                [destination],
            )

    def test_missing_guarded_destination_is_published_without_overwriting_a_race(
        self,
    ):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "configuration.json"
            staged_replacement = root / ".configuration.json.staged.tmp"
            staged_replacement.write_bytes(b"managed replacement")
            concurrent_user_contents = b"created at the publication boundary"
            real_link = os.link

            def create_destination_then_link(source, target, **options):
                destination.write_bytes(concurrent_user_contents)
                return real_link(source, target, **options)

            with mock.patch.object(
                _configuration_transaction.os,
                "link",
                side_effect=create_destination_then_link,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    r"changed after.*rendered|rendered.*changed",
                ):
                    activate_replacements(
                        root,
                        [(destination, staged_replacement)],
                        expected_destination_bytes_by_path={destination: None},
                    )

            self.assertEqual(destination.read_bytes(), concurrent_user_contents)
            self.assertFalse(staged_replacement.exists())

    def test_rollback_preserves_a_concurrent_edit_to_an_activated_destination(self):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)
            first_destination = repository_root / "first.json"
            second_destination = repository_root / "second.json"
            first_staged_replacement = repository_root / "first.staged.tmp"
            second_staged_replacement = repository_root / "second.staged.tmp"
            first_destination.write_bytes(b"first original")
            second_destination.write_bytes(b"second original")
            first_staged_replacement.write_bytes(b"first managed")
            second_staged_replacement.write_bytes(b"second managed")
            concurrent_user_contents = b"first edited after activation"
            real_replace = os.replace

            def edit_first_destination_then_fail_second(source, destination):
                source_path = Path(source)
                destination_path = Path(destination)

                if (
                    source_path == second_staged_replacement
                    and destination_path == second_destination
                ):
                    first_destination.write_bytes(concurrent_user_contents)
                    raise PermissionError("simulated later activation failure")

                return real_replace(source, destination)

            with mock.patch.object(
                _configuration_transaction.os,
                "replace",
                side_effect=edit_first_destination_then_fail_second,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "preserved concurrent destination change",
                ):
                    activate_replacements(
                        repository_root,
                        [
                            (first_destination, first_staged_replacement),
                            (second_destination, second_staged_replacement),
                        ],
                    )

            self.assertEqual(
                first_destination.read_bytes(),
                concurrent_user_contents,
            )
            self.assertEqual(second_destination.read_bytes(), b"second original")
            recovery_backups = list(
                repository_root.glob(".*.activation.backup")
            )
            self.assertEqual(len(recovery_backups), 1)
            self.assertEqual(recovery_backups[0].read_bytes(), b"first original")

    def test_host_document_staging_requires_exact_git_ignore_coverage(self):
        stage_document = require_setup_callable(
            self,
            "_stage_repository_configuration_document",
        )

        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)
            destination = repository_root / ".agents" / "mcp_config.json"
            destination.parent.mkdir(parents=True)
            credential_bearing_contents = '{"token":"sensitive"}\n'

            with mock.patch.object(
                _configuration_transaction,
                "is_ignored",
                return_value=False,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "transaction artifact.*not ignored|not ignored.*transaction artifact",
                ):
                    stage_document(
                        repository_root,
                        destination,
                        credential_bearing_contents,
                    )

            remaining_files = [
                path for path in repository_root.rglob("*") if path.is_file()
            ]
            self.assertEqual(remaining_files, [])

    def test_host_document_backup_requires_exact_git_ignore_coverage(self):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)
            destination = repository_root / ".agents" / "mcp_config.json"
            staged_replacement = repository_root / "staged-configuration.json"
            destination.parent.mkdir(parents=True)
            destination.write_bytes(b"credential-bearing original")
            staged_replacement.write_bytes(b"managed replacement")

            with mock.patch.object(
                _configuration_transaction,
                "is_ignored",
                return_value=False,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "transaction artifact.*not ignored|not ignored.*transaction artifact",
                ):
                    activate_replacements(
                        repository_root,
                        [(destination, staged_replacement)],
                        sensitive_configuration_destination_paths={
                            destination
                        },
                    )

            self.assertEqual(
                destination.read_bytes(),
                b"credential-bearing original",
            )
            self.assertFalse(staged_replacement.exists())
            self.assertEqual(
                [
                    path
                    for path in destination.parent.iterdir()
                    if path != destination
                ],
                [],
            )

    def test_edit_during_earlier_activation_is_not_overwritten(self):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            program_path = root / "program.mjs"
            staged_program_path = root / ".program.mjs.staged.tmp"
            configuration_path = root / "configuration.json"
            staged_configuration_path = root / ".configuration.json.staged.tmp"
            program_path.write_bytes(b"old program")
            staged_program_path.write_bytes(b"new program")
            configuration_path.write_bytes(b"original configuration")
            staged_configuration_path.write_bytes(b"managed configuration")
            concurrent_user_contents = b"user edit during activation"
            real_replace = os.replace

            def edit_configuration_after_program_replacement(source, destination):
                replacement_result = real_replace(source, destination)

                if (
                    Path(source) == staged_program_path
                    and Path(destination) == program_path
                ):
                    configuration_path.write_bytes(concurrent_user_contents)

                return replacement_result

            with mock.patch.object(
                _configuration_transaction.os,
                "replace",
                side_effect=edit_configuration_after_program_replacement,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "changed after.*rendered|rendered.*changed",
                ):
                    activate_replacements(
                        root,
                        [
                            (program_path, staged_program_path),
                            (
                                configuration_path,
                                staged_configuration_path,
                            ),
                        ],
                        expected_destination_bytes_by_path={
                            configuration_path: b"original configuration"
                        },
                    )

            self.assertEqual(program_path.read_bytes(), b"old program")
            self.assertEqual(
                configuration_path.read_bytes(),
                concurrent_user_contents,
            )

    def test_later_replacement_failure_restores_every_original_document(self):
        publish_documents = require_setup_callable(
            self,
            "publish_repository_configuration_documents",
        )
        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)
            first_path = repository_root / ".mcp.json"
            second_path = repository_root / ".codex" / "config.toml"
            first_path.parent.mkdir(parents=True, exist_ok=True)
            second_path.parent.mkdir(parents=True)
            first_path.write_text("first-original\n", encoding="utf-8")
            second_path.write_text("second-original\n", encoding="utf-8")
            first_observed_bytes = first_path.read_bytes()
            second_observed_bytes = second_path.read_bytes()
            replace_existing_file = (
                _configuration_transaction._replace_existing_file_and_retain_displaced_file
            )
            destination_replacements = 0

            def fail_second_destination_replacement(
                destination,
                staged_replacement,
                displaced_file,
            ):
                nonlocal destination_replacements
                destination_replacements += 1

                if destination_replacements == 2:
                    raise PermissionError("simulated locked configuration")

                return replace_existing_file(
                    destination,
                    staged_replacement,
                    displaced_file,
                )

            with mock.patch.object(
                _configuration_transaction,
                "_replace_existing_file_and_retain_displaced_file",
                side_effect=fail_second_destination_replacement,
            ), mock.patch.object(
                _configuration_transaction,
                "is_ignored",
                return_value=True,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "simulated locked configuration",
                ):
                    publish_documents(
                        repository_root,
                        [
                            rendered_repository_configuration_document(
                                first_path,
                                "first-new\n",
                                first_observed_bytes,
                            ),
                            rendered_repository_configuration_document(
                                second_path,
                                "second-new\n",
                                second_observed_bytes,
                            ),
                        ]
                    )

            self.assertEqual(
                first_path.read_text(encoding="utf-8"),
                "first-original\n",
            )
            self.assertEqual(
                second_path.read_text(encoding="utf-8"),
                "second-original\n",
            )
            remnants = [
                path
                for path in repository_root.rglob("*")
                if path.is_file() and path not in {first_path, second_path}
            ]
            self.assertEqual(remnants, [])

    def test_partial_staging_failure_removes_every_temporary_document(self):
        publish_documents = require_setup_callable(
            self,
            "publish_repository_configuration_documents",
        )
        stage_document = require_setup_callable(
            self,
            "_stage_repository_configuration_document",
        )

        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)
            first_path = repository_root / ".mcp.json"
            second_path = repository_root / ".codex" / "config.toml"
            staging_attempt_count = 0

            def fail_second_staging_attempt(
                staging_repository_root,
                path,
                contents,
            ):
                nonlocal staging_attempt_count
                staging_attempt_count += 1

                if staging_attempt_count == 2:
                    raise OSError("simulated staging failure")

                return stage_document(
                    staging_repository_root,
                    path,
                    contents,
                )

            with mock.patch.object(
                _configuration_transaction,
                "_stage_repository_configuration_document",
                side_effect=fail_second_staging_attempt,
            ), mock.patch.object(
                _configuration_transaction,
                "is_ignored",
                return_value=True,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "simulated staging failure",
                ):
                    publish_documents(
                        repository_root,
                        [
                            rendered_repository_configuration_document(
                                first_path,
                                "first-new\n",
                                None,
                            ),
                            rendered_repository_configuration_document(
                                second_path,
                                "second-new\n",
                                None,
                            ),
                        ]
                    )

            self.assertFalse(first_path.exists())
            self.assertFalse(second_path.exists())
            self.assertEqual(
                [path for path in repository_root.rglob("*") if path.is_file()],
                [],
            )

    def test_failed_rollback_preserves_the_only_recovery_copy(self):
        publish_documents = require_setup_callable(
            self,
            "publish_repository_configuration_documents",
        )

        with tempfile.TemporaryDirectory() as scratch:
            repository_root = Path(scratch)
            first_configuration_path = repository_root / "first.json"
            second_configuration_path = repository_root / "second.json"
            first_configuration_path.write_text("first-original\n", encoding="utf-8")
            second_configuration_path.write_text(
                "second-original\n",
                encoding="utf-8",
            )
            first_observed_bytes = first_configuration_path.read_bytes()
            second_observed_bytes = second_configuration_path.read_bytes()
            real_replace = os.replace
            replace_existing_file = (
                _configuration_transaction._replace_existing_file_and_retain_displaced_file
            )

            def fail_second_activation(
                destination,
                staged_replacement,
                displaced_file,
            ):
                if Path(destination) == second_configuration_path:
                    raise PermissionError("simulated activation failure")

                return replace_existing_file(
                    destination,
                    staged_replacement,
                    displaced_file,
                )

            def fail_rollback(source, destination):
                source_path = Path(source)
                destination_path = Path(destination)

                if (
                    destination_path == first_configuration_path
                    and source_path.name.endswith(".activation.backup")
                ):
                    raise PermissionError("simulated rollback failure")

                return real_replace(source, destination)

            with mock.patch.object(
                _configuration_transaction,
                "_replace_existing_file_and_retain_displaced_file",
                side_effect=fail_second_activation,
            ), mock.patch.object(
                _configuration_transaction.os,
                "replace",
                side_effect=fail_rollback,
            ), mock.patch.object(
                _configuration_transaction,
                "is_ignored",
                return_value=True,
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "preserved recovery backup",
                ):
                    publish_documents(
                        repository_root,
                        [
                            rendered_repository_configuration_document(
                                first_configuration_path,
                                "first-replacement\n",
                                first_observed_bytes,
                            ),
                            rendered_repository_configuration_document(
                                second_configuration_path,
                                "second-replacement\n",
                                second_observed_bytes,
                            ),
                        ]
                    )

            recovery_backups = list(
                repository_root.glob(".*.activation.backup")
            )
            self.assertEqual(len(recovery_backups), 1)
            self.assertEqual(
                recovery_backups[0].read_text(encoding="utf-8"),
                "first-original\n",
            )
            self.assertEqual(
                first_configuration_path.read_text(encoding="utf-8"),
                "first-replacement\n",
            )
            self.assertEqual(
                second_configuration_path.read_text(encoding="utf-8"),
                "second-original\n",
            )

    def test_superseded_backup_cleanup_denial_is_nonfatal_and_reported(
        self,
    ):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "github-mcp-server.exe"
            temporary_path = root / ".github-mcp-server.exe.staged.tmp"
            destination.write_bytes(b"running executable")
            temporary_path.write_bytes(b"replacement executable")
            real_unlink = Path.unlink
            cleanup_denied_backup_paths: list[Path] = []

            def reject_locked_backup_cleanup(path, *, missing_ok=False):
                if (
                    path.name.endswith(".backup")
                    and path.exists()
                    and path.read_bytes() == b"running executable"
                ):
                    cleanup_denied_backup_paths.append(path)
                    raise PermissionError("simulated scanner retention")

                return real_unlink(path, missing_ok=missing_ok)

            standard_error = io.StringIO()
            with mock.patch.object(
                Path,
                "unlink",
                autospec=True,
                side_effect=reject_locked_backup_cleanup,
            ), contextlib.redirect_stderr(standard_error):
                activated_paths = activate_replacements(
                    root,
                    [(destination, temporary_path)]
                )

            self.assertEqual(activated_paths, [destination])
            self.assertEqual(destination.read_bytes(), b"replacement executable")
            self.assertEqual(len(cleanup_denied_backup_paths), 1)
            self.assertEqual(
                cleanup_denied_backup_paths[0].read_bytes(),
                b"running executable",
            )
            self.assertIn(
                str(cleanup_denied_backup_paths[0]),
                standard_error.getvalue(),
            )
            self.assertIn("superseded backup", standard_error.getvalue())

    @unittest.skipUnless(os.name == "posix", "POSIX execution permissions required")
    def test_matching_bytes_with_repaired_execution_permissions_are_activated(self):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "github-mcp-server"
            temporary_path = root / ".github-mcp-server.staged.tmp"
            destination.write_bytes(b"identical executable")
            temporary_path.write_bytes(b"identical executable")
            destination.chmod(0o600)
            temporary_path.chmod(0o700)

            activated_paths = activate_replacements(
                root,
                [(destination, temporary_path)]
            )

            self.assertEqual(activated_paths, [destination])
            self.assertTrue(destination.stat().st_mode & stat.S_IXUSR)

    def test_preparation_failure_removes_every_staged_replacement(self):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "destination"
            destination.write_bytes(b"original")
            first_temporary_path = root / "first.tmp"
            second_temporary_path = root / "second.tmp"
            first_temporary_path.write_bytes(b"first")
            second_temporary_path.write_bytes(b"second")

            with mock.patch.object(
                _configuration_transaction,
                "_files_have_identical_bytes",
                side_effect=OSError("simulated preparation failure"),
            ):
                with self.assertRaisesRegex(
                    _configuration_transaction.SetupError,
                    "simulated preparation failure",
                ):
                    activate_replacements(
                        root,
                        [
                            (destination, first_temporary_path),
                            (root / "second-destination", second_temporary_path),
                        ]
                    )

            self.assertEqual(destination.read_bytes(), b"original")
            self.assertFalse(first_temporary_path.exists())
            self.assertFalse(second_temporary_path.exists())

    def test_duplicate_destination_is_rejected_before_any_activation(self):
        activate_replacements = require_setup_callable(
            self,
            "_activate_staged_file_replacements",
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            destination = root / "destination"
            destination.write_bytes(b"original")
            first_temporary_path = root / "first.tmp"
            second_temporary_path = root / "second.tmp"
            first_temporary_path.write_bytes(b"first")
            second_temporary_path.write_bytes(b"second")

            with self.assertRaisesRegex(
                _configuration_transaction.SetupError,
                "duplicate replacement destination",
            ):
                activate_replacements(
                    root,
                    [
                        (destination, first_temporary_path),
                        (destination, second_temporary_path),
                    ]
                )

            self.assertEqual(destination.read_bytes(), b"original")
            self.assertFalse(first_temporary_path.exists())
            self.assertFalse(second_temporary_path.exists())
