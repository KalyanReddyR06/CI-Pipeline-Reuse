"""
Phase A tests: dependency analyzer behaviour.

Covers:
  - undeclared dependency (hidden coupling)
  - declared / validated dependency
  - no dependency (resource with no producer)
"""

import pytest

from app.analyzer import analyze_pipeline
from app.demo_data import make_demo_pipeline_fixed, make_demo_pipeline_undeclared
from app.models import (
    DependencyStatus,
    Pipeline,
    PipelineStep,
    Severity,
)


def test_undeclared_dependency_detected():
    """
    Test accesses build/app.jar produced by Build but declares nothing.
    Analyzer must report UNDECLARED_DEPENDENCY_DETECTED.
    """
    pipeline = make_demo_pipeline_undeclared()
    report = analyze_pipeline(pipeline)

    assert report.has_undeclared is True
    assert report.summary == "UNDECLARED DEPENDENCY DETECTED"

    undeclared = [
        f for f in report.findings if f.status == DependencyStatus.UNDECLARED
    ]
    assert len(undeclared) >= 1

    test_finding = next(
        f
        for f in undeclared
        if f.dependent_step == "Test" and f.resource == "build/app.jar"
    )
    assert test_finding.source_step == "Build"
    assert test_finding.severity == Severity.ERROR
    assert "UNDECLARED DEPENDENCY DETECTED" in test_finding.explanation
    assert "Build" in test_finding.explanation
    assert "Test" in test_finding.explanation


def test_declared_dependency_validated():
    """
    After Test declares Build, the Build→Test edge must be DEPENDENCY_VALIDATED.
    """
    pipeline = make_demo_pipeline_fixed()
    report = analyze_pipeline(pipeline)

    validated = [
        f
        for f in report.findings
        if f.status == DependencyStatus.VALIDATED
        and f.dependent_step == "Test"
        and f.resource == "build/app.jar"
    ]
    assert len(validated) == 1
    finding = validated[0]
    assert finding.source_step == "Build"
    assert finding.severity == Severity.INFO
    assert "DEPENDENCY VALIDATED" in finding.explanation

    # Demo fixed pipeline also declares Build on Deploy for the jar access
    assert report.has_undeclared is False
    assert report.summary == "DEPENDENCY VALIDATED"


def test_no_dependency_when_resource_has_no_producer():
    """
    Accessing an artifact no step produces yields NO_DEPENDENCY (info).
    """
    pipeline = Pipeline(
        name="Solo Access",
        description="Step reads an external resource with no producer",
        steps=[
            PipelineStep(
                name="Lint",
                description="Lint sources from an external cache",
                outputs=[],
                accesses=["cache/vendor.tgz"],
                declared_dependencies=[],
                order=0,
            )
        ],
    )
    report = analyze_pipeline(pipeline)

    assert report.has_undeclared is False
    assert len(report.findings) == 1
    finding = report.findings[0]
    assert finding.status == DependencyStatus.NO_DEPENDENCY
    assert finding.source_step is None
    assert finding.dependent_step == "Lint"
    assert finding.resource == "cache/vendor.tgz"
    assert finding.severity == Severity.INFO


def test_no_cross_step_dependency_for_self_access():
    """A step accessing its own output is not a cross-step dependency."""
    pipeline = Pipeline(
        name="Self Access",
        steps=[
            PipelineStep(
                name="Package",
                outputs=["dist/app.zip"],
                accesses=["dist/app.zip"],
                declared_dependencies=[],
                order=0,
            )
        ],
    )
    report = analyze_pipeline(pipeline)
    assert report.has_undeclared is False
    assert report.findings[0].status == DependencyStatus.NO_DEPENDENCY
    assert report.findings[0].source_step == "Package"


def test_path_normalization_matches_producers():
    """Paths with ./ or backslashes still match producers."""
    pipeline = Pipeline(
        name="Path Norm",
        steps=[
            PipelineStep(
                name="Build",
                outputs=["build/app.jar"],
                order=0,
            ),
            PipelineStep(
                name="Test",
                accesses=["./build\\app.jar"],
                declared_dependencies=[],
                order=1,
            ),
        ],
    )
    report = analyze_pipeline(pipeline)
    undeclared = [f for f in report.findings if f.status == DependencyStatus.UNDECLARED]
    assert len(undeclared) == 1
    assert undeclared[0].resource == "build/app.jar"
    assert undeclared[0].source_step == "Build"


def test_missing_declared_step_name_warns():
    """Declaring a dependency on a non-existent step name yields a warning finding."""
    pipeline = Pipeline(
        name="Bad Decl",
        steps=[
            PipelineStep(
                name="Test",
                accesses=[],
                declared_dependencies=["GhostStep"],
                order=0,
            )
        ],
    )
    report = analyze_pipeline(pipeline)
    assert any(
        f.severity == Severity.WARNING and f.source_step == "GhostStep"
        for f in report.findings
    )


@pytest.mark.parametrize(
    "declared,expected_status",
    [
        ([], DependencyStatus.UNDECLARED),
        (["Build"], DependencyStatus.VALIDATED),
    ],
)
def test_parametrized_build_to_test(declared, expected_status):
    """Compact check: empty vs declared Build dependency."""
    pipeline = Pipeline(
        name="Param",
        steps=[
            PipelineStep(name="Build", outputs=["build/app.jar"], order=0),
            PipelineStep(
                name="Test",
                accesses=["build/app.jar"],
                declared_dependencies=declared,
                order=1,
            ),
        ],
    )
    report = analyze_pipeline(pipeline)
    matching = [
        f
        for f in report.findings
        if f.dependent_step == "Test" and f.resource == "build/app.jar"
    ]
    assert len(matching) == 1
    assert matching[0].status == expected_status


def test_multiple_dependencies_declared_and_undeclared():
    """
    Step Package consumes artifacts from two different steps (Compile and Assets).
    Initially declares only Compile -> 1 Validated, 1 Undeclared.
    After declaring Assets -> both Validated.
    """
    # 1. Partial declaration
    pipeline = Pipeline(
        name="Multi-Dependency Pipeline",
        steps=[
            PipelineStep(name="Compile", outputs=["bin/app.exe"], order=0),
            PipelineStep(name="Assets", outputs=["dist/bundle.css"], order=1),
            PipelineStep(
                name="Package",
                accesses=["bin/app.exe", "dist/bundle.css"],
                declared_dependencies=["Compile"],  # missing Assets!
                order=2,
            ),
        ],
    )
    report = analyze_pipeline(pipeline)
    assert report.has_undeclared is True
    assert report.undeclared_count == 1
    assert report.validated_count == 1

    by_resource = {f.resource: f for f in report.findings}
    assert by_resource["bin/app.exe"].status == DependencyStatus.VALIDATED
    assert by_resource["bin/app.exe"].source_step == "Compile"
    assert by_resource["dist/bundle.css"].status == DependencyStatus.UNDECLARED
    assert by_resource["dist/bundle.css"].source_step == "Assets"

    # 2. Complete declaration
    pipeline.steps[2].declared_dependencies = ["Compile", "Assets"]
    fixed_report = analyze_pipeline(pipeline)
    assert fixed_report.has_undeclared is False
    assert fixed_report.undeclared_count == 0
    assert fixed_report.validated_count == 2
    for f in fixed_report.findings:
        assert f.status == DependencyStatus.VALIDATED
