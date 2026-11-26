"""
Dependency analyzer: detect undeclared (hidden) coupling between pipeline steps.

Core idea
---------
Each step may:
  - produce artifacts via `outputs`
  - consume artifacts via `accesses`
  - declare which steps it depends on via `declared_dependencies`

Hidden coupling exists when a step accesses an artifact produced by another
step but does not list that producer in `declared_dependencies`.
"""

from __future__ import annotations

from app.models import (
    AnalysisReport,
    DependencyFinding,
    DependencyStatus,
    Pipeline,
    PipelineStep,
    Severity,
)


def _normalize_path(path: str) -> str:
    """Normalize artifact paths for stable comparison."""
    return path.strip().replace("\\", "/").lstrip("./")


def _build_producer_index(steps: list[PipelineStep]) -> dict[str, str]:
    """
    Map each produced artifact path -> producing step name.

    If two steps claim the same output, the later step in order wins
    (simple prototype rule; production systems would reject duplicates).
    """
    producers: dict[str, str] = {}
    ordered = sorted(steps, key=lambda s: s.order)
    for step in ordered:
        for output in step.outputs:
            producers[_normalize_path(output)] = step.name
    return producers


def _step_by_name(steps: list[PipelineStep]) -> dict[str, PipelineStep]:
    return {step.name: step for step in steps}


def analyze_pipeline(pipeline: Pipeline) -> AnalysisReport:
    """
    Compare declared dependencies with actual artifact usage.

    Returns findings with status:
      - UNDECLARED_DEPENDENCY_DETECTED: access without declared dependency
      - DEPENDENCY_VALIDATED: access with correctly declared dependency
      - NO_DEPENDENCY: access with no known producer in this pipeline
    """
    findings: list[DependencyFinding] = []
    producers = _build_producer_index(pipeline.steps)
    steps_by_name = _step_by_name(pipeline.steps)

    ordered = sorted(pipeline.steps, key=lambda s: s.order)
    for step in ordered:
        declared = set(step.declared_dependencies)

        for resource in step.accesses:
            normalized = _normalize_path(resource)
            source_name = producers.get(normalized)

            # Resource not produced by any step in this pipeline
            if source_name is None:
                findings.append(
                    DependencyFinding(
                        source_step=None,
                        dependent_step=step.name,
                        resource=normalized,
                        status=DependencyStatus.NO_DEPENDENCY,
                        severity=Severity.INFO,
                        explanation=(
                            f"{step.name} accesses '{normalized}', but no step "
                            f"in this pipeline produces that resource."
                        ),
                        consumer_step=step.name,
                        producer_step=None,
                        artifact=normalized,
                        declared=False,
                        declared_dependency=None,
                    )
                )
                continue

            # Self-access (step reading its own output) is not a cross-step dependency
            if source_name == step.name:
                findings.append(
                    DependencyFinding(
                        source_step=source_name,
                        dependent_step=step.name,
                        resource=normalized,
                        status=DependencyStatus.NO_DEPENDENCY,
                        severity=Severity.INFO,
                        explanation=(
                            f"{step.name} accesses its own output '{normalized}'. "
                            f"No cross-step dependency required."
                        ),
                        consumer_step=step.name,
                        producer_step=source_name,
                        artifact=normalized,
                        declared=False,
                        declared_dependency=None,
                    )
                )
                continue

            # Producer exists and is a different step
            if source_name in declared:
                findings.append(
                    DependencyFinding(
                        source_step=source_name,
                        dependent_step=step.name,
                        resource=normalized,
                        status=DependencyStatus.VALIDATED,
                        severity=Severity.INFO,
                        explanation=(
                            f"DEPENDENCY VALIDATED: {step.name} depends on "
                            f"'{normalized}' produced by {source_name}, and the "
                            f"dependency was declared."
                        ),
                        consumer_step=step.name,
                        producer_step=source_name,
                        artifact=normalized,
                        declared=True,
                        declared_dependency=source_name,
                    )
                )
            else:
                findings.append(
                    DependencyFinding(
                        source_step=source_name,
                        dependent_step=step.name,
                        resource=normalized,
                        status=DependencyStatus.UNDECLARED,
                        severity=Severity.ERROR,
                        explanation=(
                            f"UNDECLARED DEPENDENCY DETECTED: {step.name} depends on "
                            f"'{normalized}' produced by {source_name}, but the "
                            f"dependency was not declared."
                        ),
                        consumer_step=step.name,
                        producer_step=source_name,
                        artifact=normalized,
                        declared=False,
                        declared_dependency=None,
                    )
                )

        # Declared dependency with no matching artifact access (optional soft check)
        for dep_name in declared:
            if dep_name not in steps_by_name:
                findings.append(
                    DependencyFinding(
                        source_step=dep_name,
                        dependent_step=step.name,
                        resource="",
                        status=DependencyStatus.NO_DEPENDENCY,
                        severity=Severity.WARNING,
                        explanation=(
                            f"{step.name} declares a dependency on '{dep_name}', "
                            f"but no step with that name exists in the pipeline."
                        ),
                        consumer_step=step.name,
                        producer_step=dep_name,
                        artifact="",
                        declared=True,
                        declared_dependency=dep_name,
                    )
                )

    has_undeclared = any(f.status == DependencyStatus.UNDECLARED for f in findings)
    if has_undeclared:
        summary = "UNDECLARED DEPENDENCY DETECTED"
    elif any(f.status == DependencyStatus.VALIDATED for f in findings):
        summary = "DEPENDENCY VALIDATED"
    else:
        summary = "NO CROSS-STEP DEPENDENCIES FOUND"

    undeclared_count = sum(1 for f in findings if f.status == DependencyStatus.UNDECLARED)
    validated_count = sum(1 for f in findings if f.status == DependencyStatus.VALIDATED)
    no_dep_count = sum(1 for f in findings if f.status == DependencyStatus.NO_DEPENDENCY)

    return AnalysisReport(
        pipeline_name=pipeline.name,
        findings=findings,
        has_undeclared=has_undeclared,
        summary=summary,
        undeclared_count=undeclared_count,
        validated_count=validated_count,
        no_dependency_count=no_dep_count,
    )
