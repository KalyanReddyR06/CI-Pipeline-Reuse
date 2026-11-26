"""
Pydantic models for CI pipeline step reuse and dependency analysis.

These models describe pipeline steps, declared dependencies, and analysis results.
They are the shared contract between the analyzer, API, and tests.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DependencyStatus(str, Enum):
    """Outcome of comparing declared vs actual artifact usage."""

    VALIDATED = "DEPENDENCY_VALIDATED"
    UNDECLARED = "UNDECLARED_DEPENDENCY_DETECTED"
    NO_DEPENDENCY = "NO_DEPENDENCY"


class Severity(str, Enum):
    """How serious an analysis finding is."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class ExecutionStatus(str, Enum):
    """Lifecycle status for pipeline and step executions."""

    QUEUED = "QUEUED"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class StepBase(BaseModel):
    """Reusable pipeline step with explicit I/O and declared dependencies."""

    name: str = Field(..., min_length=1, description="Unique step name within a pipeline")
    description: str = Field(default="", description="Human-readable purpose of the step")
    inputs: list[str] = Field(default_factory=list, description="Named input parameters")
    outputs: list[str] = Field(
        default_factory=list,
        description="Artifacts this step produces (e.g. build/app.jar)",
    )
    command: str = Field(default="", description="Command simulated during execution")
    declared_dependencies: list[str] = Field(
        default_factory=list,
        description="Names of steps this step explicitly depends on",
    )
    accesses: list[str] = Field(
        default_factory=list,
        description="Resources/artifacts this step reads or uses",
    )


class PipelineStep(StepBase):
    """A step as it appears inside a pipeline (order matters for execution)."""

    order: int = Field(..., ge=0, description="Execution order within the pipeline")


class Pipeline(BaseModel):
    """Ordered collection of reusable steps."""

    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    steps: list[PipelineStep] = Field(default_factory=list)


class DependencyFinding(BaseModel):
    """
    One result from comparing declared dependencies with actual artifact usage.

    Example undeclared case:
      source_step=Build, dependent_step=Test, resource=build/app.jar
      status=UNDECLARED_DEPENDENCY_DETECTED
    """

    source_step: Optional[str] = Field(
        default=None,
        description="Step that produces the resource (None if resource has no producer)",
    )
    dependent_step: str = Field(..., description="Step that accesses the resource")
    resource: str = Field(..., description="Artifact or resource path involved")
    status: DependencyStatus
    severity: Severity
    explanation: str

    # Helper aliases for direct readability in Phase D
    consumer_step: Optional[str] = Field(
        default=None,
        description="Alias for dependent_step",
    )
    producer_step: Optional[str] = Field(
        default=None,
        description="Alias for source_step",
    )
    artifact: Optional[str] = Field(
        default=None,
        description="Alias for resource",
    )
    declared: bool = Field(
        default=False,
        description="Whether the producer was explicitly declared as a dependency",
    )
    declared_dependency: Optional[str] = Field(
        default=None,
        description="Name of the declared dependency matching the producer, if any",
    )


class AnalysisReport(BaseModel):
    """Full dependency analysis for a pipeline."""

    pipeline_name: str
    findings: list[DependencyFinding] = Field(default_factory=list)
    has_undeclared: bool = False
    summary: str = ""
    undeclared_count: int = Field(default=0, description="Total undeclared hidden couplings")
    validated_count: int = Field(default=0, description="Total validated dependencies")
    no_dependency_count: int = Field(default=0, description="Total independent accesses")
