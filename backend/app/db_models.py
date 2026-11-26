"""
SQLAlchemy ORM models for pipelines and steps.

List fields (inputs, outputs, dependencies, accesses) are stored as JSON
in SQLite for the local storage engine.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PipelineRecord(Base):
    """Persisted pipeline (table: pipelines)."""

    __tablename__ = "pipelines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    steps: Mapped[list["PipelineStepRecord"]] = relationship(
        "PipelineStepRecord",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="PipelineStepRecord.order",
    )


class PipelineStepRecord(Base):
    """Persisted pipeline step (table: pipeline_steps)."""

    __tablename__ = "pipeline_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pipeline_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    inputs: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    outputs: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    command: Mapped[str] = mapped_column(Text, default="", nullable=False)
    declared_dependencies: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False
    )
    accesses: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    pipeline: Mapped["PipelineRecord"] = relationship(
        "PipelineRecord", back_populates="steps"
    )


class ExecutionRecord(Base):
    """One run of a pipeline (table: executions)."""

    __tablename__ = "executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pipeline_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Simulated artifacts produced during this run (paths as strings).
    artifacts: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    pipeline: Mapped["PipelineRecord"] = relationship("PipelineRecord")
    step_executions: Mapped[list["StepExecutionRecord"]] = relationship(
        "StepExecutionRecord",
        back_populates="execution",
        cascade="all, delete-orphan",
        order_by="StepExecutionRecord.order",
    )
    logs: Mapped[list["ExecutionLogRecord"]] = relationship(
        "ExecutionLogRecord",
        back_populates="execution",
        cascade="all, delete-orphan",
        order_by="ExecutionLogRecord.id",
    )

    @property
    def failure_reason(self) -> str | None:
        """Dynamic root cause extracted from the failed step execution."""
        if self.status != "FAILED":
            return None
        for se in self.step_executions or []:
            if se.status == "FAILED" and se.message:
                return se.message
        return None


class StepExecutionRecord(Base):
    """Per-step result within a pipeline execution (table: step_executions)."""

    __tablename__ = "step_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    execution_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("executions.id", ondelete="CASCADE"), nullable=False
    )
    step_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    step_name: Mapped[str] = mapped_column(String(200), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)

    execution: Mapped["ExecutionRecord"] = relationship(
        "ExecutionRecord", back_populates="step_executions"
    )


class ExecutionLogRecord(Base):
    """Timestamped log line for an execution (table: execution_logs)."""

    __tablename__ = "execution_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    execution_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("executions.id", ondelete="CASCADE"), nullable=False
    )
    step_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    level: Mapped[str] = mapped_column(String(16), default="info", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    execution: Mapped["ExecutionRecord"] = relationship(
        "ExecutionRecord", back_populates="logs"
    )
