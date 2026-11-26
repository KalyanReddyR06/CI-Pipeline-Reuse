"""FastAPI routes for pipeline and step CRUD, plus dependency analysis."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.analyzer import analyze_pipeline
from app.database import get_db
from app.demo_data import (
    make_demo_pipeline_missing_artifact,
    make_demo_pipeline_undeclared,
)
from app.executor import execute_pipeline, list_executions_for_pipeline
from app.schemas import (
    AnalysisReport,
    ExecutionRead,
    ExecutionSummary,
    PipelineCreate,
    PipelineRead,
    PipelineSummary,
    PipelineUpdate,
    StepCreate,
    StepRead,
    StepUpdate,
)

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


def _require_pipeline(db: Session, pipeline_id: int):
    record = crud.get_pipeline_or_none(db, pipeline_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline {pipeline_id} not found",
        )
    return record


@router.post("/seed-demo", response_model=PipelineRead, status_code=status.HTTP_201_CREATED)
def seed_demo_pipeline(db: Session = Depends(get_db)):
    """
    Create (or return) the demonstration pipeline with an undeclared
    Build → Test dependency. Safe to call repeatedly: if a pipeline with
    the demo name already exists, it is returned as-is.
    """
    demo = make_demo_pipeline_undeclared()
    step_payloads = [
        StepCreate(
            name=s.name,
            description=s.description,
            inputs=s.inputs,
            outputs=s.outputs,
            command=s.command,
            declared_dependencies=s.declared_dependencies,
            accesses=s.accesses,
            order=s.order,
        )
        for s in demo.steps
    ]
    existing = next(
        (p for p in crud.list_pipelines(db) if p.name == demo.name),
        None,
    )
    if existing is not None:
        # Always restore the undeclared demo so "Open Demo Pipeline" is repeatable.
        existing.description = demo.description
        return crud.replace_pipeline_steps(db, existing, step_payloads)

    payload = PipelineCreate(
        name=demo.name,
        description=demo.description,
        steps=step_payloads,
    )
    return crud.create_pipeline(db, payload)


@router.post(
    "/seed-failure-demo",
    response_model=PipelineRead,
    status_code=status.HTTP_201_CREATED,
)
def seed_failure_demo_pipeline(db: Session = Depends(get_db)):
    """
    Create (or reset) the failure demo pipeline where Build
    omits producing the jar, causing Test to fail with a missing artifact
    error and Deploy to stay in PENDING status.
    """
    demo = make_demo_pipeline_missing_artifact()
    step_payloads = [
        StepCreate(
            name=s.name,
            description=s.description,
            inputs=s.inputs,
            outputs=s.outputs,
            command=s.command,
            declared_dependencies=s.declared_dependencies,
            accesses=s.accesses,
            order=s.order,
        )
        for s in demo.steps
    ]
    existing = next(
        (p for p in crud.list_pipelines(db) if p.name == demo.name),
        None,
    )
    if existing is not None:
        existing.description = demo.description
        return crud.replace_pipeline_steps(db, existing, step_payloads)

    payload = PipelineCreate(
        name=demo.name,
        description=demo.description,
        steps=step_payloads,
    )
    return crud.create_pipeline(db, payload)


@router.post("", response_model=PipelineRead, status_code=status.HTTP_201_CREATED)
def create_pipeline(payload: PipelineCreate, db: Session = Depends(get_db)):
    return crud.create_pipeline(db, payload)


@router.get("", response_model=list[PipelineSummary])
def list_pipelines(db: Session = Depends(get_db)):
    records = crud.list_pipelines(db)
    return [
        PipelineSummary(
            id=r.id,
            name=r.name,
            description=r.description,
            step_count=len(r.steps),
        )
        for r in records
    ]


@router.get("/{pipeline_id}", response_model=PipelineRead)
def get_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    return _require_pipeline(db, pipeline_id)


@router.put("/{pipeline_id}", response_model=PipelineRead)
def update_pipeline(
    pipeline_id: int, payload: PipelineUpdate, db: Session = Depends(get_db)
):
    record = _require_pipeline(db, pipeline_id)
    return crud.update_pipeline(db, record, payload)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    record = _require_pipeline(db, pipeline_id)
    crud.delete_pipeline(db, record)
    return None


@router.post(
    "/{pipeline_id}/steps",
    response_model=StepRead,
    status_code=status.HTTP_201_CREATED,
)
def add_step(pipeline_id: int, payload: StepCreate, db: Session = Depends(get_db)):
    pipeline = _require_pipeline(db, pipeline_id)
    return crud.add_step(db, pipeline, payload)


@router.get("/{pipeline_id}/steps", response_model=list[StepRead])
def get_steps(pipeline_id: int, db: Session = Depends(get_db)):
    _require_pipeline(db, pipeline_id)
    return crud.list_steps(db, pipeline_id)


@router.put("/{pipeline_id}/steps/{step_id}", response_model=StepRead)
def update_step(
    pipeline_id: int,
    step_id: int,
    payload: StepUpdate,
    db: Session = Depends(get_db),
):
    _require_pipeline(db, pipeline_id)
    step = crud.get_step_or_none(db, pipeline_id, step_id)
    if step is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Step {step_id} not found in pipeline {pipeline_id}",
        )
    return crud.update_step(db, step, payload)


@router.delete(
    "/{pipeline_id}/steps/{step_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_step(pipeline_id: int, step_id: int, db: Session = Depends(get_db)):
    _require_pipeline(db, pipeline_id)
    step = crud.get_step_or_none(db, pipeline_id, step_id)
    if step is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Step {step_id} not found in pipeline {pipeline_id}",
        )
    crud.delete_step(db, step)
    return None


@router.post("/{pipeline_id}/analyze", response_model=AnalysisReport)
def analyze_stored_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    """
    Load the stored pipeline, convert to Phase A models, and run the
    existing dependency analyzer (behavior unchanged).
    """
    record = _require_pipeline(db, pipeline_id)
    analyzer_pipeline = crud.to_analyzer_pipeline(record)
    return analyze_pipeline(analyzer_pipeline)


@router.post(
    "/{pipeline_id}/execute",
    response_model=ExecutionRead,
    status_code=status.HTTP_201_CREATED,
)
def execute_stored_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    """Simulate sequential execution of all steps; record status and logs."""
    record = _require_pipeline(db, pipeline_id)
    if not record.steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pipeline has no steps to execute",
        )
    return execute_pipeline(db, record)


@router.get(
    "/{pipeline_id}/executions",
    response_model=list[ExecutionSummary],
)
def list_pipeline_executions(pipeline_id: int, db: Session = Depends(get_db)):
    _require_pipeline(db, pipeline_id)
    return list_executions_for_pipeline(db, pipeline_id)
