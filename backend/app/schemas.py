"""
API request/response schemas built on Phase A Pydantic models.

Phase A models (Pipeline, PipelineStep, AnalysisReport) stay unchanged for
the analyzer. These schemas add database IDs for the REST API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models import AnalysisReport, ExecutionStatus, StepBase


class PipelineCreate(BaseModel):
    """Body for creating a pipeline (optionally with nested steps)."""

    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    steps: list["StepCreate"] = Field(default_factory=list)


class PipelineUpdate(BaseModel):
    """Body for updating pipeline metadata (not steps)."""

    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None


class StepCreate(StepBase):
    """Body for adding a step to a pipeline."""

    order: int = Field(default=0, ge=0)


class StepUpdate(BaseModel):
    """Body for partially updating a step."""

    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    inputs: Optional[list[str]] = None
    outputs: Optional[list[str]] = None
    command: Optional[str] = None
    declared_dependencies: Optional[list[str]] = None
    accesses: Optional[list[str]] = None
    order: Optional[int] = Field(default=None, ge=0)


class StepRead(StepBase):
    """Step as returned by the API (includes DB id)."""

    id: int
    order: int
    pipeline_id: int

    model_config = {"from_attributes": True}


class PipelineRead(BaseModel):
    """Pipeline as returned by the API (includes nested steps)."""

    id: int
    name: str
    description: str
    steps: list[StepRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PipelineSummary(BaseModel):
    """Lightweight pipeline listing without full step payloads."""

    id: int
    name: str
    description: str
    step_count: int = 0

    model_config = {"from_attributes": True}


class StepExecutionRead(BaseModel):
    """Per-step result within an execution."""

    id: int
    step_id: Optional[int] = None
    step_name: str
    order: int
    status: ExecutionStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    message: str = ""

    model_config = {"from_attributes": True}


class ExecutionLogRead(BaseModel):
    """One log line from an execution."""

    id: int
    execution_id: int
    step_name: Optional[str] = None
    level: str
    message: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ExecutionRead(BaseModel):
    """Full execution record with step results (logs fetched separately)."""

    id: int
    pipeline_id: int
    status: ExecutionStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    artifacts: list[str] = Field(default_factory=list)
    step_executions: list[StepExecutionRead] = Field(default_factory=list)
    failure_reason: Optional[str] = Field(
        default=None,
        description="Detailed failure message when execution fails",
    )

    model_config = {"from_attributes": True}


class ExecutionSummary(BaseModel):
    """Compact execution row for history lists."""

    id: int
    pipeline_id: int
    status: ExecutionStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


PipelineCreate.model_rebuild()

__all__ = [
    "PipelineCreate",
    "PipelineUpdate",
    "PipelineRead",
    "PipelineSummary",
    "StepCreate",
    "StepUpdate",
    "StepRead",
    "AnalysisReport",
    "ExecutionRead",
    "ExecutionSummary",
    "ExecutionLogRead",
    "StepExecutionRead",
]
