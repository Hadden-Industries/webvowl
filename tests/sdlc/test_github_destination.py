"""GitHub operations bind to origin even when gh might infer an upstream fork."""
import argparse
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "util"))
import bootstrap_github_sdlc as bootstrap
import sdlc

ORIGIN = "https://github.com/Hadden-Industries/webvowl.git"

class GitHubDestinationTests(unittest.TestCase):
    def test_labels_use_the_explicit_origin(self):
        with patch.object(sys, "argv", ["bootstrap_github_sdlc.py"]), patch.object(bootstrap, "derive_repo_from_script", return_value=Path("fixture")), patch.object(bootstrap, "require_command", return_value="gh"), patch.object(bootstrap, "git_output", return_value=ORIGIN, create=True), patch.object(bootstrap, "run") as run:
            self.assertEqual(bootstrap.main(), 0)
        self.assertEqual(run.call_count, 14)
        for call in run.call_args_list:
            argv = call.args[0]
            self.assertIn("--repo", argv)
            self.assertEqual(argv[argv.index("--repo") + 1], ORIGIN)

    def test_issue_snapshot_reads_issue_and_identity_from_the_same_origin(self):
        issue = {"number": 2, "title": "Accepted fixture", "url": "https://github.com/Hadden-Industries/webvowl/issues/2", "body": "AC-001: Fixture", "labels": []}
        args = argparse.Namespace(issue=2, version=1, accepted_at="2026-09-08T00:00:00Z", accepted_by="fixture", approval_reference="fixture decision")
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            with patch.object(sdlc, "require_command", return_value="gh"), patch.object(sdlc, "git_output_bytes", return_value=ORIGIN.encode()), patch.object(sdlc, "validate_document"), patch.object(sdlc, "run", side_effect=[SimpleNamespace(stdout=json.dumps(issue)), SimpleNamespace(stdout='{"nameWithOwner":"Hadden-Industries/webvowl"}')]) as run:
                sdlc.capture_issue_baseline(repo, args)
            issue_args = run.call_args_list[0].args[0]
            self.assertIn("--repo", issue_args)
            self.assertEqual(issue_args[issue_args.index("--repo") + 1], ORIGIN)
            self.assertEqual(run.call_args_list[1].args[0][:4], ["gh", "repo", "view", ORIGIN])
