"""Execution history and log endpoints (not nested under /pipelines)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.executor import get_execution_or_none, list_all_executions, list_logs
from app.schemas import ExecutionLogRead, ExecutionRead, ExecutionSummary

router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("", response_model=list[ExecutionSummary])
def list_executions(limit: int = 20, db: Session = Depends(get_db)):
    """Recent executions across all pipelines (newest first)."""
    return list_all_executions(db, limit=limit)


@router.get("/{execution_id}", response_model=ExecutionRead)
def get_execution(execution_id: int, db: Session = Depends(get_db)):
    record = get_execution_or_none(db, execution_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution {execution_id} not found",
        )
    return record


@router.get("/{execution_id}/logs", response_model=list[ExecutionLogRead])
def get_execution_logs(execution_id: int, db: Session = Depends(get_db)):
    record = get_execution_or_none(db, execution_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution {execution_id} not found",
        )
    return list_logs(db, execution_id)
