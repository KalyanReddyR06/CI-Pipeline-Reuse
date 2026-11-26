"""
Phase B tests: FastAPI CRUD + analyze against SQLite (in-memory).

Uses shared client fixture from conftest.py.
"""

from app.models import DependencyStatus


def _demo_create_payload(demo_pipeline_payload):
    return demo_pipeline_payload


def test_create_pipeline(client):
    response = client.post("/pipelines", json={"name": "Alpha", "description": "d"})
    assert response.status_code == 201
    body = response.json()
    assert body["id"] >= 1
    assert body["name"] == "Alpha"
    assert body["description"] == "d"
    assert body["steps"] == []


def test_get_pipeline(client, demo_pipeline_payload):
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    response = client.get(f"/pipelines/{created['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Demo Build-Test-Deploy"
    assert len(body["steps"]) == 3
    names = [s["name"] for s in body["steps"]]
    assert names == ["Build", "Test", "Deploy"]


def test_update_pipeline(client):
    created = client.post(
        "/pipelines", json={"name": "Old", "description": "before"}
    ).json()
    response = client.put(
        f"/pipelines/{created['id']}",
        json={"name": "New", "description": "after"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "New"
    assert body["description"] == "after"


def test_delete_pipeline(client):
    created = client.post("/pipelines", json={"name": "Temp"}).json()
    response = client.delete(f"/pipelines/{created['id']}")
    assert response.status_code == 204
    assert client.get(f"/pipelines/{created['id']}").status_code == 404


def test_add_step(client):
    created = client.post("/pipelines", json={"name": "P"}).json()
    response = client.post(
        f"/pipelines/{created['id']}/steps",
        json={
            "name": "Build",
            "description": "compile",
            "outputs": ["build/app.jar"],
            "command": "make",
            "order": 0,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Build"
    assert body["outputs"] == ["build/app.jar"]
    assert body["pipeline_id"] == created["id"]


def test_get_steps(client, demo_pipeline_payload):
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    response = client.get(f"/pipelines/{created['id']}/steps")
    assert response.status_code == 200
    steps = response.json()
    assert len(steps) == 3
    assert steps[0]["name"] == "Build"
    assert steps[1]["accesses"] == ["build/app.jar"]
    assert steps[1]["declared_dependencies"] == []


def test_analyze_stored_pipeline(client, demo_pipeline_payload):
    """Stored demo must surface UNDECLARED DEPENDENCY DETECTED via /analyze."""
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    response = client.post(f"/pipelines/{created['id']}/analyze")
    assert response.status_code == 200
    report = response.json()
    assert report["has_undeclared"] is True
    assert report["summary"] == "UNDECLARED DEPENDENCY DETECTED"

    undeclared = [
        f
        for f in report["findings"]
        if f["status"] == DependencyStatus.UNDECLARED.value
        and f["dependent_step"] == "Test"
    ]
    assert len(undeclared) == 1
    finding = undeclared[0]
    assert finding["source_step"] == "Build"
    assert finding["resource"] == "build/app.jar"
    assert finding["severity"] == "error"
    assert "UNDECLARED DEPENDENCY DETECTED" in finding["explanation"]


def test_analyze_after_fixing_dependency(client, demo_pipeline_payload):
    """After declaring Build on Test, analysis should validate that edge."""
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    steps = client.get(f"/pipelines/{created['id']}/steps").json()
    test_step = next(s for s in steps if s["name"] == "Test")

    update = client.put(
        f"/pipelines/{created['id']}/steps/{test_step['id']}",
        json={"declared_dependencies": ["Build"]},
    )
    assert update.status_code == 200

    deploy_step = next(s for s in steps if s["name"] == "Deploy")
    client.put(
        f"/pipelines/{created['id']}/steps/{deploy_step['id']}",
        json={"declared_dependencies": ["Test", "Build"]},
    )

    report = client.post(f"/pipelines/{created['id']}/analyze").json()
    assert report["has_undeclared"] is False
    assert report["summary"] == "DEPENDENCY VALIDATED"


def test_404_for_nonexistent_pipeline(client):
    assert client.get("/pipelines/99999").status_code == 404
    assert client.put("/pipelines/99999", json={"name": "X"}).status_code == 404
    assert client.delete("/pipelines/99999").status_code == 404
    assert client.get("/pipelines/99999/steps").status_code == 404
    assert (
        client.post(
            "/pipelines/99999/steps",
            json={"name": "S", "order": 0},
        ).status_code
        == 404
    )
    assert client.post("/pipelines/99999/analyze").status_code == 404


def test_list_pipelines(client):
    client.post("/pipelines", json={"name": "A"})
    client.post("/pipelines", json={"name": "B"})
    response = client.get("/pipelines")
    assert response.status_code == 200
    names = [p["name"] for p in response.json()]
    assert names == ["A", "B"]


def test_seed_demo_resets_undeclared_dependency(client):
    """Re-opening the demo must restore hidden coupling for a live demonstration."""
    first = client.post("/pipelines/seed-demo")
    assert first.status_code == 201
    pipeline = first.json()
    test_step = next(s for s in pipeline["steps"] if s["name"] == "Test")
    deploy_step = next(s for s in pipeline["steps"] if s["name"] == "Deploy")
    client.put(
        f"/pipelines/{pipeline['id']}/steps/{test_step['id']}",
        json={"declared_dependencies": ["Build"]},
    )
    client.put(
        f"/pipelines/{pipeline['id']}/steps/{deploy_step['id']}",
        json={"declared_dependencies": ["Test", "Build"]},
    )
    fixed = client.post(f"/pipelines/{pipeline['id']}/analyze").json()
    assert fixed["has_undeclared"] is False

    second = client.post("/pipelines/seed-demo")
    assert second.status_code == 201
    assert second.json()["id"] == pipeline["id"]
    test_again = next(s for s in second.json()["steps"] if s["name"] == "Test")
    assert test_again["declared_dependencies"] == []
    report = client.post(f"/pipelines/{pipeline['id']}/analyze").json()
    assert report["summary"] == "UNDECLARED DEPENDENCY DETECTED"
    assert report["has_undeclared"] is True


def test_delete_pipeline_removes_executions(client, demo_pipeline_payload):
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    execution = client.post(f"/pipelines/{created['id']}/execute").json()
    assert client.delete(f"/pipelines/{created['id']}").status_code == 204
    assert client.get(f"/executions/{execution['id']}").status_code == 404
    leftover = [
        row for row in client.get("/executions").json() if row["pipeline_id"] == created["id"]
    ]
    assert leftover == []


def test_update_step_details(client):
    """Test updating step command, description, inputs, and outputs."""
    pipeline = client.post("/pipelines", json={"name": "Step Details Pipeline"}).json()
    step = client.post(
        f"/pipelines/{pipeline['id']}/steps",
        json={
            "name": "Build",
            "command": "make",
            "outputs": ["app.bin"],
            "order": 0,
        },
    ).json()

    update_resp = client.put(
        f"/pipelines/{pipeline['id']}/steps/{step['id']}",
        json={
            "name": "Build-Updated",
            "command": "cargo build --release",
            "outputs": ["target/release/app"],
            "description": "Production Rust build",
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "Build-Updated"
    assert updated["command"] == "cargo build --release"
    assert updated["outputs"] == ["target/release/app"]
    assert updated["description"] == "Production Rust build"


def test_delete_step(client, demo_pipeline_payload):
    """Test removing an individual step from a pipeline without deleting pipeline."""
    pipeline = client.post("/pipelines", json=demo_pipeline_payload).json()
    assert len(pipeline["steps"]) == 3
    step_to_delete = pipeline["steps"][1]  # Test step

    del_resp = client.delete(
        f"/pipelines/{pipeline['id']}/steps/{step_to_delete['id']}"
    )
    assert del_resp.status_code == 204

    # Verify pipeline now has only 2 steps
    remaining_steps = client.get(f"/pipelines/{pipeline['id']}/steps").json()
    assert len(remaining_steps) == 2
    step_ids = [s["id"] for s in remaining_steps]
    assert step_to_delete["id"] not in step_ids


def test_step_reordering(client):
    """Test updating the execution order of steps in a pipeline."""
    pipeline = client.post("/pipelines", json={"name": "Reorder Test"}).json()
    s1 = client.post(
        f"/pipelines/{pipeline['id']}/steps",
        json={"name": "Step1", "order": 0},
    ).json()
    s2 = client.post(
        f"/pipelines/{pipeline['id']}/steps",
        json={"name": "Step2", "order": 1},
    ).json()

    # Swap orders: s1 becomes 1, s2 becomes 0
    client.put(f"/pipelines/{pipeline['id']}/steps/{s1['id']}", json={"order": 1})
    client.put(f"/pipelines/{pipeline['id']}/steps/{s2['id']}", json={"order": 0})

    steps = client.get(f"/pipelines/{pipeline['id']}/steps").json()
    by_id = {s["id"]: s["order"] for s in steps}
    assert by_id[s1["id"]] == 1
    assert by_id[s2["id"]] == 0
