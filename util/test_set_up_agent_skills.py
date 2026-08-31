from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import set_up_agent_skills as subject


EXPECTED_OPENAI_YAML = """interface:
  display_name: "Brooks Review"
  short_description: "Maintainability and design-decay review"
  default_prompt: >
    Use $brooks-review as a separate maintainability-focused review of the
    scope I explicitly provide.

policy:
  allow_implicit_invocation: false
"""


class BrooksReviewInvocationPolicyTests(unittest.TestCase):
    def _apply_policy(
        self,
        repo: Path,
        skills: dict[str, dict[str, str]],
        agents: tuple[str, ...],
    ) -> None:
        subject.configure_brooks_review_invocation_policy(repo, skills, agents)

    def create_installed_skill(self, repo: Path, root: Path) -> Path:
        skill_dir = repo / root / "brooks-review"
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md").write_text(
            "---\nname: brooks-review\ndescription: Review code.\n---\n",
            encoding="utf-8",
            newline="\n",
        )
        return skill_dir

    def test_matching_locked_source_writes_exact_policy_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            codex_skill = self.create_installed_skill(
                repo, Path(".agents") / "skills"
            )
            claude_skill = self.create_installed_skill(
                repo, Path(".claude") / "skills"
            )
            existing_metadata = claude_skill / "agents" / "openai.yaml"
            existing_metadata.parent.mkdir()
            existing_metadata.write_text(
                "policy:\n  allow_implicit_invocation: true\n",
                encoding="utf-8",
                newline="\n",
            )

            self._apply_policy(
                repo,
                {
                    "brooks-review": {
                        "source": "hyhmrright/brooks-lint",
                        "sourceType": "github",
                        "computedHash": "test-hash",
                    }
                },
                ("codex", "antigravity", "claude-code"),
            )

            expected = EXPECTED_OPENAI_YAML.encode("utf-8")
            self.assertEqual(
                (codex_skill / "agents" / "openai.yaml").read_bytes(),
                expected,
            )
            self.assertEqual(existing_metadata.read_bytes(), expected)

    def test_same_named_skill_from_another_source_is_untouched(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            skill_dir = self.create_installed_skill(
                repo, Path(".agents") / "skills"
            )
            metadata = skill_dir / "agents" / "openai.yaml"
            metadata.parent.mkdir()
            original = b"policy:\n  allow_implicit_invocation: true\n"
            metadata.write_bytes(original)

            self._apply_policy(
                repo,
                {
                    "brooks-review": {
                        "source": "another-owner/brooks-lint",
                        "sourceType": "github",
                        "computedHash": "test-hash",
                    }
                },
                ("codex",),
            )

            self.assertEqual(metadata.read_bytes(), original)

    def test_absent_skill_does_not_modify_stray_installation(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            skill_dir = self.create_installed_skill(
                repo, Path(".agents") / "skills"
            )
            metadata = skill_dir / "agents" / "openai.yaml"

            self._apply_policy(repo, {}, ("codex",))

            self.assertFalse(metadata.exists())


if __name__ == "__main__":
    unittest.main()
