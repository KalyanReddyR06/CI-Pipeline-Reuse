"""
Demo pipeline fixtures used by tests and seed data.

Demonstration scenario:

  Build  → produces build/app.jar
  Test   → accesses build/app.jar, initially NO declared dependency
  Deploy → accesses build/app.jar, declares dependency on Test
"""

from app.models import Pipeline, PipelineStep


def make_demo_pipeline_undeclared() -> Pipeline:
    """Demo pipeline with an undeclared Build → Test dependency."""
    return Pipeline(
        name="Demo Build-Test-Deploy",
        description=(
            "Demonstration pipeline. Test accesses Build's jar without declaring "
            "the dependency; Deploy declares Test but also accesses the jar."
        ),
        steps=[
            PipelineStep(
                name="Build",
                description="Compile and package the application",
                inputs=[],
                outputs=["build/app.jar"],
                command="javac App.java && jar cf build/app.jar App.class",
                declared_dependencies=[],
                accesses=[],
                order=0,
            ),
            PipelineStep(
                name="Test",
                description="Run unit tests against the built artifact",
                inputs=[],
                outputs=["test/report.xml"],
                command="java -jar build/app.jar --test",
                declared_dependencies=[],  # missing Build — hidden coupling
                accesses=["build/app.jar"],
                order=1,
            ),
            PipelineStep(
                name="Deploy",
                description="Deploy the verified artifact",
                inputs=[],
                outputs=["deploy/url.txt"],
                command="cp build/app.jar /deploy/app.jar",
                declared_dependencies=["Test"],
                accesses=["build/app.jar"],
                order=2,
            ),
        ],
    )


def make_demo_pipeline_fixed() -> Pipeline:
    """Same demo after Test declares its dependency on Build."""
    pipeline = make_demo_pipeline_undeclared()
    for step in pipeline.steps:
        if step.name == "Test":
            step.declared_dependencies = ["Build"]
        if step.name == "Deploy":
            # Deploy also needs Build for the jar it accesses
            step.declared_dependencies = ["Test", "Build"]
    return pipeline


def make_demo_pipeline_missing_artifact() -> Pipeline:
    """
    Demo pipeline illustrating execution failure due to a missing artifact.

    Build fails to produce 'build/app.jar'.
    Test accesses 'build/app.jar' and fails immediately.
    Deploy remains in PENDING status.
    """
    return Pipeline(
        name="Demo Failure - Missing Artifact",
        description=(
            "Failure scenario: Build does not emit 'build/app.jar'. "
            "Test halts with missing artifact error, keeping Deploy in PENDING state."
        ),
        steps=[
            PipelineStep(
                name="Build",
                description="Compile source (omits producing app.jar)",
                inputs=[],
                outputs=[],  # Intentionally missing build/app.jar
                command="echo 'Compiling...' && echo 'Build completed without producing app.jar'",
                declared_dependencies=[],
                accesses=[],
                order=0,
            ),
            PipelineStep(
                name="Test",
                description="Run test suite against built jar",
                inputs=[],
                outputs=["test/report.xml"],
                command="java -jar build/app.jar --test",
                declared_dependencies=["Build"],
                accesses=["build/app.jar"],
                order=1,
            ),
            PipelineStep(
                name="Deploy",
                description="Deploy verified jar to staging",
                inputs=[],
                outputs=["deploy/url.txt"],
                command="cp build/app.jar /deploy/app.jar",
                declared_dependencies=["Test"],
                accesses=["build/app.jar"],
                order=2,
            ),
        ],
    )
