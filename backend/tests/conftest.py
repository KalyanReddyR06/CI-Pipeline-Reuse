"""Shared pytest fixtures for API tests (in-memory SQLite)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.demo_data import make_demo_pipeline_undeclared
from app.main import app


@pytest.fixture()
def client():
    """Isolated in-memory SQLite DB for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def demo_pipeline_payload():
    demo = make_demo_pipeline_undeclared()
    return {
        "name": demo.name,
        "description": demo.description,
        "steps": [
            {
                "name": s.name,
                "description": s.description,
                "inputs": s.inputs,
                "outputs": s.outputs,
                "command": s.command,
                "declared_dependencies": s.declared_dependencies,
                "accesses": s.accesses,
                "order": s.order,
            }
            for s in demo.steps
        ],
    }
