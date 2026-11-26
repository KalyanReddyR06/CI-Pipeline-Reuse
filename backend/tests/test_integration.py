"""
Integration tests for the complete end-to-end user journey:
1. Create pipeline
2. Add steps
3. Analyze (detect undeclared hidden coupling)
4. Fix dependency (declare dependency to eliminate hidden coupling)
5. Re-analyze (validate all dependencies)
6. Execute (run simulator to verify Build → Test → Deploy)
7. View logs (verify step-by-step telemetry)
"""

from app.models import DependencyStatus, ExecutionStatus


def test_full_end_to_end_lifecycle(client):
    # Step 1: Create pipeline
    create_resp = client.post(
        "/pipelines",
        json={
            "name": "E2E Demo Pipeline",
            "description": "Demonstrating step reuse without hidden coupling",
        },
    )
    assert create_resp.status_code == 201
    pipeline = create_resp.json()
    pipeline_id = pipeline["id"]
    assert pipeline["name"] == "E2E Demo Pipeline"

    # Step 2: Add steps with undeclared artifact dependency (Build -> SecurityScan)
    # Step 2a: Build step
    step_build = client.post(
        f"/pipelines/{pipeline_id}/steps",
        json={
            "name": "Build",
            "description": "Compile microservice",
            "inputs": [],
            "outputs": ["build/service.jar"],
            "command": "mvn clean package -DskipTests",
            "declared_dependencies": [],
            "accesses": [],
            "order": 0,
        },
    ).json()

    # Step 2b: SecurityScan step (accesses build/service.jar without declaring Build)
    step_scan = client.post(
        f"/pipelines/{pipeline_id}/steps",
        json={
            "name": "SecurityScan",
            "description": "Scan jar for CVEs",
            "inputs": ["build/service.jar"],
            "outputs": ["reports/cve.json"],
            "command": "trivy fs build/service.jar",
            "declared_dependencies": [],  # UNDECLARED!
            "accesses": ["build/service.jar"],
            "order": 1,
        },
    ).json()

    # Step 2c: Deploy step
    step_deploy = client.post(
        f"/pipelines/{pipeline_id}/steps",
        json={
            "name": "Deploy",
            "description": "Deploy verified jar",
            "inputs": ["build/service.jar"],
            "outputs": ["deploy/status.txt"],
            "command": "kubectl apply -f k8s/",
            "declared_dependencies": ["SecurityScan"],
            "accesses": ["build/service.jar"],
            "order": 2,
        },
    ).json()

    # Step 3: Analyze -> Must detect UNDECLARED dependency (hidden coupling)
    analysis_1 = client.post(f"/pipelines/{pipeline_id}/analyze").json()
    assert analysis_1["has_undeclared"] is True
    assert analysis_1["summary"] == "UNDECLARED DEPENDENCY DETECTED"
    assert analysis_1["undeclared_count"] >= 1

    undeclared_findings = [
        f for f in analysis_1["findings"]
        if f["status"] == DependencyStatus.UNDECLARED.value
    ]
    assert len(undeclared_findings) >= 1
    scan_finding = next(
        f for f in undeclared_findings
        if f["dependent_step"] == "SecurityScan" and f["resource"] == "build/service.jar"
    )
    assert scan_finding["source_step"] == "Build"
    assert scan_finding["severity"] == "error"

    # Step 4: Fix dependency -> Declare "Build" as dependency for SecurityScan and Deploy
    fix_scan_resp = client.put(
        f"/pipelines/{pipeline_id}/steps/{step_scan['id']}",
        json={"declared_dependencies": ["Build"]},
    )
    assert fix_scan_resp.status_code == 200

    fix_deploy_resp = client.put(
        f"/pipelines/{pipeline_id}/steps/{step_deploy['id']}",
        json={"declared_dependencies": ["SecurityScan", "Build"]},
    )
    assert fix_deploy_resp.status_code == 200

    # Step 5: Re-analyze -> Must be VALIDATED with zero hidden coupling
    analysis_2 = client.post(f"/pipelines/{pipeline_id}/analyze").json()
    assert analysis_2["has_undeclared"] is False
    assert analysis_2["summary"] == "DEPENDENCY VALIDATED"
    assert analysis_2["undeclared_count"] == 0
    assert analysis_2["validated_count"] >= 2

    # Step 6: Execute pipeline -> Verify sequential execution passes
    exec_resp = client.post(f"/pipelines/{pipeline_id}/execute")
    assert exec_resp.status_code == 201
    execution = exec_resp.json()

    assert execution["status"] == ExecutionStatus.SUCCESS.value
    assert "build/service.jar" in execution["artifacts"]
    assert "reports/cve.json" in execution["artifacts"]
    assert "deploy/status.txt" in execution["artifacts"]

    step_statuses = {se["step_name"]: se["status"] for se in execution["step_executions"]}
    assert step_statuses == {
        "Build": ExecutionStatus.SUCCESS.value,
        "SecurityScan": ExecutionStatus.SUCCESS.value,
        "Deploy": ExecutionStatus.SUCCESS.value,
    }

    # Step 7: View logs -> Verify execution console output
    logs_resp = client.get(f"/executions/{execution['id']}/logs")
    assert logs_resp.status_code == 200
    logs = logs_resp.json()
    assert len(logs) >= 5

    step_log_names = {l["step_name"] for l in logs if l["step_name"]}
    assert "Build" in step_log_names
    assert "SecurityScan" in step_log_names
    assert "Deploy" in step_log_names

    # Verify history
    history_resp = client.get(f"/pipelines/{pipeline_id}/executions")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) == 1
    assert history[0]["id"] == execution["id"]
    assert history[0]["status"] == ExecutionStatus.SUCCESS.value
