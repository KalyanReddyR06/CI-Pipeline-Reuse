"""
Phase C tests: local pipeline execution simulator, history, and logs.
"""

from app.models import ExecutionStatus


def test_successful_build_test_deploy_execution(client, demo_pipeline_payload):
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    response = client.post(f"/pipelines/{created['id']}/execute")
    assert response.status_code == 201
    body = response.json()

    assert body["status"] == ExecutionStatus.SUCCESS.value
    assert body["pipeline_id"] == created["id"]
    assert body["started_at"] is not None
    assert body["finished_at"] is not None
    assert "build/app.jar" in body["artifacts"]
    assert "test/report.xml" in body["artifacts"]
    assert "deploy/url.txt" in body["artifacts"]

    statuses = {se["step_name"]: se["status"] for se in body["step_executions"]}
    assert statuses == {
        "Build": ExecutionStatus.SUCCESS.value,
        "Test": ExecutionStatus.SUCCESS.value,
        "Deploy": ExecutionStatus.SUCCESS.value,
    }


def test_execution_history(client, demo_pipeline_payload):
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    first = client.post(f"/pipelines/{created['id']}/execute").json()
    second = client.post(f"/pipelines/{created['id']}/execute").json()

    history = client.get(f"/pipelines/{created['id']}/executions")
    assert history.status_code == 200
    rows = history.json()
    assert len(rows) == 2
    # Newest first
    assert rows[0]["id"] == second["id"]
    assert rows[1]["id"] == first["id"]
    assert all(r["status"] == ExecutionStatus.SUCCESS.value for r in rows)


def test_execution_logs(client, demo_pipeline_payload):
    created = client.post("/pipelines", json=demo_pipeline_payload).json()
    execution = client.post(f"/pipelines/{created['id']}/execute").json()

    detail = client.get(f"/executions/{execution['id']}")
    assert detail.status_code == 200
    assert detail.json()["status"] == ExecutionStatus.SUCCESS.value

    logs_resp = client.get(f"/executions/{execution['id']}/logs")
    assert logs_resp.status_code == 200
    logs = logs_resp.json()
    assert len(logs) >= 5
    messages = " ".join(log["message"] for log in logs)
    assert "execution started" in messages.lower() or "started" in messages.lower()
    assert "build/app.jar" in messages
    assert any(log["step_name"] == "Build" for log in logs)
    assert any(log["step_name"] == "Test" for log in logs)
    assert any(log["step_name"] == "Deploy" for log in logs)


def test_missing_artifact_failure(client):
    """
    Test accesses build/app.jar but no prior step produces it → FAILED.
    """
    payload = {
        "name": "Broken Artifact Chain",
        "description": "Test without Build",
        "steps": [
            {
                "name": "Test",
                "description": "Needs jar that was never built",
                "outputs": [],
                "command": "java -jar build/app.jar --test",
                "declared_dependencies": [],
                "accesses": ["build/app.jar"],
                "order": 0,
            }
        ],
    }
    created = client.post("/pipelines", json=payload).json()
    response = client.post(f"/pipelines/{created['id']}/execute")
    assert response.status_code == 201
    body = response.json()

    assert body["status"] == ExecutionStatus.FAILED.value
    step = body["step_executions"][0]
    assert step["step_name"] == "Test"
    assert step["status"] == ExecutionStatus.FAILED.value
    assert "Missing required artifact" in step["message"]
    assert "build/app.jar" in step["message"]


def test_pipeline_marked_failed_after_step_failure(client):
    """
    Build omits the jar; Test and Deploy should not succeed.
    Pipeline status must be FAILED; later steps remain PENDING.
    """
    payload = {
        "name": "Build Without Jar",
        "steps": [
            {
                "name": "Build",
                "description": "Build that forgets to emit the jar",
                "outputs": [],  # missing build/app.jar
                "command": "echo skip",
                "accesses": [],
                "order": 0,
            },
            {
                "name": "Test",
                "outputs": ["test/report.xml"],
                "command": "java -jar build/app.jar --test",
                "accesses": ["build/app.jar"],
                "order": 1,
            },
            {
                "name": "Deploy",
                "outputs": ["deploy/url.txt"],
                "command": "cp build/app.jar /deploy/",
                "accesses": ["build/app.jar"],
                "order": 2,
            },
        ],
    }
    created = client.post("/pipelines", json=payload).json()
    body = client.post(f"/pipelines/{created['id']}/execute").json()

    assert body["status"] == ExecutionStatus.FAILED.value
    by_name = {se["step_name"]: se for se in body["step_executions"]}
    assert by_name["Build"]["status"] == ExecutionStatus.SUCCESS.value
    assert by_name["Test"]["status"] == ExecutionStatus.FAILED.value
    assert by_name["Deploy"]["status"] == ExecutionStatus.PENDING.value

    logs = client.get(f"/executions/{body['id']}/logs").json()
    error_logs = [log for log in logs if log["level"] == "error"]
    assert any("Missing required artifact" in log["message"] for log in error_logs)
    assert any("FAILED" in log["message"] for log in error_logs)


def test_execute_nonexistent_pipeline_404(client):
    assert client.post("/pipelines/99999/execute").status_code == 404
    assert client.get("/executions/99999").status_code == 404
    assert client.get("/executions/99999/logs").status_code == 404


def test_execution_failure_reason_and_seed_failure_demo(client):
    """
    Verify failure demo: Build (no jar) → Test (fails) → Deploy (PENDING).
    The execution failure_reason must be populated.
    """
    seeded = client.post("/pipelines/seed-failure-demo")
    assert seeded.status_code == 201
    pipe = seeded.json()
    assert pipe["name"] == "Demo Failure - Missing Artifact"

    exec_resp = client.post(f"/pipelines/{pipe['id']}/execute")
    assert exec_resp.status_code == 201
    body = exec_resp.json()

    assert body["status"] == ExecutionStatus.FAILED.value
    assert body["failure_reason"] is not None
    assert "Missing required artifact 'build/app.jar'" in body["failure_reason"]

    # Verify steps
    by_name = {se["step_name"]: se for se in body["step_executions"]}
    assert by_name["Build"]["status"] == ExecutionStatus.SUCCESS.value
    assert by_name["Test"]["status"] == ExecutionStatus.FAILED.value
    assert by_name["Deploy"]["status"] == ExecutionStatus.PENDING.value

    # Verify execution detail endpoint exposes failure_reason
    detail = client.get(f"/executions/{body['id']}").json()
    assert detail["failure_reason"] == body["failure_reason"]


def test_simulated_command_failure(client):
    """
    Verify command containing 'exit 1' or '--fail-step' simulates step failure.
    """
    payload = {
        "name": "Command Failure Pipeline",
        "steps": [
            {
                "name": "FailingStep",
                "outputs": [],
                "command": "pytest --fail-step",
                "accesses": [],
                "order": 0,
            }
        ],
    }
    created = client.post("/pipelines", json=payload).json()
    body = client.post(f"/pipelines/{created['id']}/execute").json()

    assert body["status"] == ExecutionStatus.FAILED.value
    assert "Simulated command failure" in body["failure_reason"]
