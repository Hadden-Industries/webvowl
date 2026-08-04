from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
WEBVOWL_ROOT = SCRIPT_DIR.parent
GITHUB_ROOT = WEBVOWL_ROOT.parent

DEFAULT_JAR = (
    GITHUB_ROOT
    / "VisualDataWeb"
    / "OWL2VOWL"
    / "target"
    / "OWL2VOWL-0.3.7-shaded.jar"
)

DEFAULT_INPUTS = [
    GITHUB_ROOT
    / "VisualDataWeb"
    / "OWL2VOWL"
    / "ontologies"
    / "ontovibe"
    / "BenchmarkOntology.ttl",
    GITHUB_ROOT
    / "VisualDataWeb"
    / "OWL2VOWL"
    / "ontologies"
    / "ontovibe"
    / "ontovibe_cardinalities.ttl",
]

DEFAULT_OUTPUT_DIRECTORY = (
    WEBVOWL_ROOT
    / "src"
    / "owl2vowl"
    / "test"
    / "fixtures"
    / "input"
)


def resolve_path(path: Path) -> Path:
    """Resolve relative paths from this script's directory."""
    path = path.expanduser()

    if not path.is_absolute():
        path = SCRIPT_DIR / path

    return path.resolve()


def find_java() -> str:
    """Find Java using JAVA_HOME first, then the system PATH."""
    java_home = os.environ.get("JAVA_HOME")

    if java_home:
        executable = "java.exe" if os.name == "nt" else "java"
        candidate = Path(java_home) / "bin" / executable

        if candidate.is_file():
            return str(candidate)

    java = shutil.which("java")

    if java:
        return java

    raise RuntimeError(
        "Java was not found. Install Java or configure JAVA_HOME/PATH."
    )


def output_path_for(input_path: Path, output_directory: Path) -> Path:
    """
    Derive the output filename from the complete input filename.

    Examples:
        BenchmarkOntology.ttl
        -> BenchmarkOntology.ttl.java.json

        ontovibe_cardinalities.ttl
        -> ontovibe_cardinalities.ttl.java.json
    """
    return output_directory / f"{input_path.name}.java.json"


def validate_json(path: Path) -> None:
    """Confirm that OWL2VOWL produced valid JSON."""
    try:
        with path.open("r", encoding="utf-8-sig") as file:
            json.load(file)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"OWL2VOWL produced an invalid JSON file: {path}\n{error}"
        ) from error


def convert_ontology(
    *,
    java: str,
    jar_path: Path,
    input_path: Path,
    output_path: Path,
    show_owl2vowl_output: bool,
) -> bool:
    """Convert one ontology file and validate the generated JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        java,
        "--add-opens",
        "java.base/java.lang=ALL-UNNAMED",
        "-jar",
        str(jar_path),
        "-file",
        str(input_path),
        "-output",
        str(output_path),
    ]

    result = subprocess.run(
        command,
        cwd=SCRIPT_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )

    if result.returncode != 0:
        print(
            f"OWL2VOWL conversion failed for:\n{input_path}",
            file=sys.stderr,
        )

        if result.stdout:
            print("\nStandard output:", file=sys.stderr)
            print(result.stdout, file=sys.stderr)

        if result.stderr:
            print("\nStandard error:", file=sys.stderr)
            print(result.stderr, file=sys.stderr)

        return False

    if show_owl2vowl_output:
        if result.stdout:
            print(result.stdout, end="")

        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)

    if not output_path.is_file():
        print(
            f"OWL2VOWL completed but did not create:\n{output_path}",
            file=sys.stderr,
        )
        return False

    try:
        validate_json(output_path)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return False

    print(f"Generated valid JSON:\n{output_path}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate WebVOWL JSON fixtures using OWL2VOWL."
    )

    parser.add_argument(
        "--jar",
        type=Path,
        default=DEFAULT_JAR,
        help=f"OWL2VOWL JAR path. Default: {DEFAULT_JAR}",
    )
    parser.add_argument(
        "--input",
        dest="input_paths",
        type=Path,
        nargs="+",
        default=DEFAULT_INPUTS,
        help=(
            "One or more ontology input paths. "
            "Defaults to BenchmarkOntology.ttl and "
            "ontovibe_cardinalities.ttl."
        ),
    )
    parser.add_argument(
        "--output-directory",
        type=Path,
        default=DEFAULT_OUTPUT_DIRECTORY,
        help=(
            "Directory for generated JSON files. "
            f"Default: {DEFAULT_OUTPUT_DIRECTORY}"
        ),
    )
    parser.add_argument(
        "--show-owl2vowl-output",
        action="store_true",
        help="Show OWL2VOWL progress output.",
    )

    arguments = parser.parse_args()

    jar_path = resolve_path(arguments.jar)
    input_paths = [
        resolve_path(input_path)
        for input_path in arguments.input_paths
    ]
    output_directory = resolve_path(arguments.output_directory)

    if not jar_path.is_file():
        print(f"OWL2VOWL JAR not found:\n{jar_path}", file=sys.stderr)
        return 1

    missing_inputs = [
        input_path
        for input_path in input_paths
        if not input_path.is_file()
    ]

    if missing_inputs:
        print("The following ontology files were not found:", file=sys.stderr)

        for input_path in missing_inputs:
            print(f"  {input_path}", file=sys.stderr)

        return 1

    try:
        java = find_java()
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1

    all_succeeded = True

    for input_path in input_paths:
        output_path = output_path_for(
            input_path,
            output_directory,
        )

        succeeded = convert_ontology(
            java=java,
            jar_path=jar_path,
            input_path=input_path,
            output_path=output_path,
            show_owl2vowl_output=arguments.show_owl2vowl_output,
        )

        if not succeeded:
            all_succeeded = False

    return 0 if all_succeeded else 1


if __name__ == "__main__":
    raise SystemExit(main())
