"""
CRUD helpers and conversion between ORM records and Phase A analyzer models.
"""

from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from app.db_models import ExecutionRecord, PipelineRecord, PipelineStepRecord
from app.models import Pipeline, PipelineStep
from app.schemas import PipelineCreate, PipelineUpdate, StepCreate, StepUpdate


def get_pipeline_or_none(db: Session, pipeline_id: int) -> PipelineRecord | None:
    return (
        db.query(PipelineRecord)
        .options(selectinload(PipelineRecord.steps))
        .filter(PipelineRecord.id == pipeline_id)
        .first()
    )


def list_pipelines(db: Session) -> list[PipelineRecord]:
    return (
        db.query(PipelineRecord)
        .options(selectinload(PipelineRecord.steps))
        .order_by(PipelineRecord.id)
        .all()
    )


def create_pipeline(db: Session, payload: PipelineCreate) -> PipelineRecord:
    record = PipelineRecord(name=payload.name, description=payload.description)
    for step in payload.steps:
        record.steps.append(_step_from_create(step))
    db.add(record)
    db.commit()
    db.refresh(record)
    # Re-load with steps eagerly for consistent response shape
    return get_pipeline_or_none(db, record.id)  # type: ignore[return-value]


def update_pipeline(
    db: Session, record: PipelineRecord, payload: PipelineUpdate
) -> PipelineRecord:
    if payload.name is not None:
        record.name = payload.name
    if payload.description is not None:
        record.description = payload.description
    db.commit()
    return get_pipeline_or_none(db, record.id)  # type: ignore[return-value]


def delete_pipeline(db: Session, record: PipelineRecord) -> None:
    # SQLite often does not enforce ON DELETE CASCADE unless PRAGMA foreign_keys
    # is on, so delete executions (and their logs) before the pipeline row.
    executions = (
        db.query(ExecutionRecord)
        .filter(ExecutionRecord.pipeline_id == record.id)
        .all()
    )
    for execution in executions:
        db.delete(execution)
    db.delete(record)
    db.commit()


def replace_pipeline_steps(
    db: Session, record: PipelineRecord, steps: list[StepCreate]
) -> PipelineRecord:
    """Replace all steps on a pipeline (used to reset the demo to undeclared)."""
    record.steps.clear()
    db.flush()
    for step in steps:
        record.steps.append(_step_from_create(step))
    db.commit()
    return get_pipeline_or_none(db, record.id)  # type: ignore[return-value]


def _step_from_create(payload: StepCreate) -> PipelineStepRecord:
    return PipelineStepRecord(
        name=payload.name,
        description=payload.description,
        inputs=list(payload.inputs),
        outputs=list(payload.outputs),
        command=payload.command,
        declared_dependencies=list(payload.declared_dependencies),
        accesses=list(payload.accesses),
        order=payload.order,
    )


def add_step(
    db: Session, pipeline: PipelineRecord, payload: StepCreate
) -> PipelineStepRecord:
    step = _step_from_create(payload)
    step.pipeline_id = pipeline.id
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


def get_step_or_none(
    db: Session, pipeline_id: int, step_id: int
) -> PipelineStepRecord | None:
    return (
        db.query(PipelineStepRecord)
        .filter(
            PipelineStepRecord.id == step_id,
            PipelineStepRecord.pipeline_id == pipeline_id,
        )
        .first()
    )


def list_steps(db: Session, pipeline_id: int) -> list[PipelineStepRecord]:
    return (
        db.query(PipelineStepRecord)
        .filter(PipelineStepRecord.pipeline_id == pipeline_id)
        .order_by(PipelineStepRecord.order, PipelineStepRecord.id)
        .all()
    )


def update_step(
    db: Session, step: PipelineStepRecord, payload: StepUpdate
) -> PipelineStepRecord:
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(step, key, value)
    db.commit()
    db.refresh(step)
    return step


def delete_step(db: Session, step: PipelineStepRecord) -> None:
    db.delete(step)
    db.commit()


def to_analyzer_pipeline(record: PipelineRecord) -> Pipeline:
    """
    Convert a stored pipeline into the Phase A Pydantic Pipeline so the
    existing analyzer can run unchanged.
    """
    steps = [
        PipelineStep(
            name=s.name,
            description=s.description,
            inputs=list(s.inputs or []),
            outputs=list(s.outputs or []),
            command=s.command or "",
            declared_dependencies=list(s.declared_dependencies or []),
            accesses=list(s.accesses or []),
            order=s.order,
        )
        for s in sorted(record.steps, key=lambda x: (x.order, x.id))
    ]
    return Pipeline(name=record.name, description=record.description, steps=steps)
