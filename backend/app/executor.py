"""
Local pipeline execution simulator.

Runs steps in order, tracks simulated artifacts in memory, and persists
execution / step / log records. Does not run real shell commands or deploy.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session, selectinload

from app.db_models import (
    ExecutionLogRecord,
    ExecutionRecord,
    PipelineRecord,
    PipelineStepRecord,
    StepExecutionRecord,
)
from app.models import ExecutionStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_path(path: str) -> str:
    return path.strip().replace("\\", "/").lstrip("./")


def _log(
    db: Session,
    execution: ExecutionRecord,
    message: str,
    *,
    step_name: str | None = None,
    level: str = "info",
) -> None:
    db.add(
        ExecutionLogRecord(
            execution_id=execution.id,
            step_name=step_name,
            level=level,
            message=message,
            created_at=_utcnow(),
        )
    )


def get_execution_or_none(db: Session, execution_id: int) -> ExecutionRecord | None:
    return (
        db.query(ExecutionRecord)
        .options(
            selectinload(ExecutionRecord.step_executions),
            selectinload(ExecutionRecord.logs),
        )
        .filter(ExecutionRecord.id == execution_id)
        .first()
    )


def list_executions_for_pipeline(
    db: Session, pipeline_id: int
) -> list[ExecutionRecord]:
    return (
        db.query(ExecutionRecord)
        .options(selectinload(ExecutionRecord.step_executions))
        .filter(ExecutionRecord.pipeline_id == pipeline_id)
        .order_by(ExecutionRecord.id.desc())
        .all()
    )


def list_all_executions(db: Session, limit: int = 20) -> list[ExecutionRecord]:
    return (
        db.query(ExecutionRecord)
        .order_by(ExecutionRecord.id.desc())
        .limit(limit)
        .all()
    )


def list_logs(db: Session, execution_id: int) -> list[ExecutionLogRecord]:
    return (
        db.query(ExecutionLogRecord)
        .filter(ExecutionLogRecord.execution_id == execution_id)
        .order_by(ExecutionLogRecord.id)
        .all()
    )


def execute_pipeline(db: Session, pipeline: PipelineRecord) -> ExecutionRecord:
    """
    Simulate sequential Build → Test → Deploy style execution.

    For each step:
      1. Verify every accessed artifact already exists in the artifact set.
      2. If missing → mark step FAILED, pipeline FAILED, stop.
      3. Otherwise simulate the command, register declared outputs, mark SUCCESS.
    """
    steps = sorted(pipeline.steps, key=lambda s: (s.order, s.id))

    execution = ExecutionRecord(
        pipeline_id=pipeline.id,
        status=ExecutionStatus.PENDING.value,
        artifacts=[],
    )
    db.add(execution)
    db.flush()  # assign execution.id

    for step in steps:
        db.add(
            StepExecutionRecord(
                execution_id=execution.id,
                step_id=step.id,
                step_name=step.name,
                order=step.order,
                status=ExecutionStatus.PENDING.value,
            )
        )
    db.flush()

    now = _utcnow()
    execution.status = ExecutionStatus.RUNNING.value
    execution.started_at = now
    _log(db, execution, f"Pipeline '{pipeline.name}' execution started.")
    db.commit()

    # Reload with relationships for consistent updates
    execution = get_execution_or_none(db, execution.id)  # type: ignore[assignment]
    artifacts: set[str] = set()
    step_rows = {
        se.step_name: se
        for se in sorted(execution.step_executions, key=lambda x: (x.order, x.id))
    }

    for step in steps:
        step_exec = step_rows[step.name]
        ok = _run_step(db, execution, step, step_exec, artifacts)
        if not ok:
            execution.status = ExecutionStatus.FAILED.value
            execution.finished_at = _utcnow()
            execution.artifacts = sorted(artifacts)
            _log(
                db,
                execution,
                f"Pipeline '{pipeline.name}' FAILED at step '{step.name}'. Subsequent dependent steps kept PENDING.",
                level="error",
            )
            db.commit()
            return get_execution_or_none(db, execution.id)  # type: ignore[return-value]

    execution.status = ExecutionStatus.SUCCESS.value
    execution.finished_at = _utcnow()
    execution.artifacts = sorted(artifacts)
    _log(db, execution, f"Pipeline '{pipeline.name}' completed successfully.")
    db.commit()
    return get_execution_or_none(db, execution.id)  # type: ignore[return-value]


def _run_step(
    db: Session,
    execution: ExecutionRecord,
    step: PipelineStepRecord,
    step_exec: StepExecutionRecord,
    artifacts: set[str],
) -> bool:
    """Simulate one step. Returns True on success, False on failure."""
    step_exec.status = ExecutionStatus.RUNNING.value
    step_exec.started_at = _utcnow()
    _log(
        db,
        execution,
        f"Step '{step.name}' started. Simulated command: {step.command or '(none)'}",
        step_name=step.name,
    )
    db.flush()

    # Check for simulated command failure trigger (e.g. exit 1 or --fail-step)
    cmd = (step.command or "").strip()
    if (
        cmd.lower() in ("exit 1", "exit 2", "false")
        or "exit 1" in cmd.lower()
        or "--fail-step" in cmd.lower()
    ):
        reason = f"Simulated command failure: '{cmd}' returned non-zero exit code."
        step_exec.status = ExecutionStatus.FAILED.value
        step_exec.finished_at = _utcnow()
        step_exec.message = reason
        _log(db, execution, reason, step_name=step.name, level="error")
        db.flush()
        return False

    # Verify required artifacts exist before "running" the step.
    for raw_path in step.accesses or []:
        path = _normalize_path(raw_path)
        if path not in artifacts:
            reason = (
                f"Missing required artifact '{path}'. "
                f"Step '{step.name}' cannot proceed because the artifact "
                f"was not produced by an earlier step."
            )
            step_exec.status = ExecutionStatus.FAILED.value
            step_exec.finished_at = _utcnow()
            step_exec.message = reason
            _log(db, execution, reason, step_name=step.name, level="error")
            db.flush()
            return False

        _log(
            db,
            execution,
            f"Verified artifact '{path}' is available.",
            step_name=step.name,
        )

    # Simulate producing declared outputs.
    produced: list[str] = []
    for raw_out in step.outputs or []:
        path = _normalize_path(raw_out)
        artifacts.add(path)
        produced.append(path)
        _log(
            db,
            execution,
            f"Produced simulated artifact '{path}'.",
            step_name=step.name,
        )

    success_msg = (
        f"Step '{step.name}' succeeded."
        + (f" Artifacts: {', '.join(produced)}." if produced else "")
    )
    step_exec.status = ExecutionStatus.SUCCESS.value
    step_exec.finished_at = _utcnow()
    step_exec.message = success_msg
    _log(db, execution, success_msg, step_name=step.name)
    db.flush()
    return True
