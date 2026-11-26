# Continuous Integration Pipeline Step Reuse Without Hidden Coupling

**CI Step Reuse Platform — Modular Pipeline Verification System**  
A static dependency verification and sequential execution platform for modular, reusable Continuous Integration (CI) pipeline steps.

---

## 1. Project Overview & Motivation

Modern DevOps workflows encourage teams to break monolithic CI pipelines into reusable, modular steps (e.g., compile, lint, test, containerize, deploy). However, step reuse frequently introduces **hidden coupling**:
- Step A produces an artifact (e.g., `build/app.jar`).
- Step B consumes `build/app.jar` directly from the filesystem or shared workspace **without explicitly declaring Step A as a dependency**.
- If Step B is reused in another pipeline or executed in isolation/parallel, the required artifact is missing, causing runtime failures or deploying stale binaries.

### Core Thesis
> **Pipeline steps are safely reusable without hidden coupling if and only if every cross-step artifact access is explicitly declared and validated against producer step outputs prior to execution.**

This project delivers:
1. A **Static Dependency Analyzer** that audits declared inputs, outputs, and accessed resources to detect hidden coupling.
2. A **RESTful API** built on FastAPI with SQLite persistence for pipelines, steps, and execution audits.
3. A **Sequential Execution Simulator** that tracks artifact creation, halts on missing dependencies, preserves downstream steps in `PENDING` state, and streams console logs.
4. A **DevOps Dashboard UI** built with React, Vite, and Tailwind CSS designed for operational CI/CD pipeline management.

---

## 2. System Architecture

```
                                  +-----------------------------+
                                  |   DevOps Dashboard (React)  |
                                  |  - Pipeline Step Builder    |
                                  |  - Visual Flow Stepper      |
                                  |  - Dependency Matrix        |
                                  |  - Live Execution Audit     |
                                  +--------------+--------------+
                                                 |
                                     REST API (/api / JSON)
                                                 |
                                  +--------------v--------------+
                                  |   FastAPI Backend Server    |
                                  |  (Pydantic & SQLAlchemy)    |
                                  +-------+--------------+------+
                                          |              |
                    +---------------------+              +---------------------+
                    |                                                          |
     +--------------v--------------+                            +--------------v--------------+
     | Static Dependency Analyzer  |                            | Execution Simulator Engine  |
     | - Detects Undeclared Access |                            | - Sequential Step Stepper   |
     | - Validates Declared I/O    |                            | - In-Memory Artifact Pool   |
     | - Reports Severity & Reason |                            | - Failure Reason Extraction |
     +-----------------------------+                            | - Step Status Propagation   |
                                                                +--------------+--------------+
                                                                               |
                                                                +--------------v--------------+
                                                                |   SQLite Database Storage   |
                                                                | (Pipelines, Steps, Logs, DB)|
                                                                +-----------------------------+
```

---

## 3. Technology Stack

| Layer | Technologies | Role / Purpose |
| :--- | :--- | :--- |
| **Backend** | Python 3.12, FastAPI, Pydantic v2 | High-performance RESTful API & schema validation |
| **Database** | SQLAlchemy 2.0, SQLite | Embedded relational storage for pipelines, steps, and executions |
| **Testing** | Pytest, TestClient | Automated unit, API, simulator, and integration test suite |
| **Frontend** | React 19, Vite, React Router v7 | Responsive single-page application dashboard |
| **Styling** | Tailwind CSS v4, Lucide Icons | DevOps engineering theme with dark/light mode and emerald accents |
| **Tooling** | Oxlint, Node.js | Fast static analysis and build tooling |

---

## 4. How to Run Locally

### Prerequisites
- Python 3.12 or higher
- Node.js 18 or higher (with `npm`)

### Step 1: Start the Backend Server
```powershell
# From the project root directory:
cd backend

# Activate the virtual environment:
.\.venv\Scripts\activate

# Start the FastAPI server (runs on http://127.0.0.1:8000):
uvicorn app.main:app --reload --port 8000
```
*API interactive documentation will be accessible at `http://127.0.0.1:8000/docs`.*

### Step 2: Start the Frontend Application
```powershell
# In a second terminal, from the project root directory:
cd frontend

# Start the Vite development server (proxies /api to localhost:8000):
npm run dev
```
*Open your browser and navigate to `http://localhost:5173/`.*

---

## 5. How to Run Tests

### Run Full Backend Test Suite (33 Tests)
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

### Run Frontend Test Suite & Production Build (3 Tests)
```powershell
cd frontend
# Run frontend tests:
npm test

# Run frontend production build:
npm run build

# Run frontend linter:
npm run lint
```

### Test Evaluation Summary Table

| Test Category | Test Suite Scope | Total Tests | Passed | Failed | Pass Rate |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **1. Dependency Analyzer** | Declared, Undeclared, No Dependency, Multi-producer, Normalization | **9** | **9** | **0** | **100%** |
| **2. Pipeline API** | Pipeline & Step CRUD, Reordering, Cascade Deletion, Seed Demo | **15** | **15** | **0** | **100%** |
| **3. Execution Simulator** | Build/Test/Deploy, Missing Artifact, Step Propagation, Logs, Failure Reasons | **8** | **8** | **0** | **100%** |
| **4. Integration (E2E)** | Full Lifecycle: Create → Add Steps → Analyze → Fix → Re-analyze → Execute → Logs | **1** | **1** | **0** | **100%** |
| **5. Frontend** | Vite Production Build, 7 Route Definitions, 18 API Client Contracts | **3** | **3** | **0** | **100%** |
| **TOTAL** | **Comprehensive System Evaluation** | **36** | **36** | **0** | **100%** |

---

## 6. Complete Demonstration Walkthrough

Follow this exact walkthrough for system demonstration:

### Phase 1: Problem Demonstration (Hidden Coupling)
1. **Open Dashboard**: Go to `http://localhost:5173/`.
   - Point out the **System Flow Overview** and KPI cards.
2. **Open Demo Pipeline**: Click **"Load Demo Pipeline"** in the top header.
   - Navigates to `Demo Build-Test-Deploy`.
   - Show the 3 steps: `Build` (outputs `build/app.jar`), `Test` (accesses `build/app.jar`), `Deploy` (accesses `build/app.jar`).
   - Highlight that `Test` declares **no dependency** on `Build`.
3. **Run Dependency Analysis**: Click the **"Dependency Analysis"** tab or click **"Analyze Coupling"**.
   - **Result**: `UNDECLARED DEPENDENCY DETECTED` (severity: `error`).
   - The visual flow highlights: `Build ── produces ──> build/app.jar ── consumed by ──> Test` (Missing Declared Dependency).

### Phase 2: Remediating Hidden Coupling
4. **Fix Dependency**:
   - Click **"Fix Dependency (Declare 'Build')"** directly on the finding card, OR open the **Step Builder** tab, edit `Test`, and select the `Build` chip.
   - Re-run analysis.
   - **Result**: `DEPENDENCY VALIDATED` (severity: `info`). Zero hidden couplings detected!

### Phase 3: Successful Execution Simulation
5. **Run Pipeline**: Click the **"Executions"** tab and click **"Run Pipeline"**.
   - The **Step-by-Step Execution Stepper** visually steps through:
     - `Build` ✓ (SUCCESS, duration ~0.1s, produced `build/app.jar`)
     - `Test` ✓ (SUCCESS, duration ~0.1s, produced `test/report.xml`)
     - `Deploy` ✓ (SUCCESS, duration ~0.1s, produced `deploy/url.txt`)
     - Pipeline status: **SUCCESS**.
   - Show the **Verified Produced Artifacts** chips.
   - Click **"View Console Logs"** to display the terminal with timestamps and step tags.

### Phase 4: Failure Scenario Demonstration (Missing Artifact)
6. **Trigger Failure Demo**: Return to Dashboard and click **"Failure Demo"** (or in Pipelines click **"Failure Demo"**).
   - Pipeline: `Demo Failure - Missing Artifact`.
   - Notice: `Build` step compiles but fails to output `build/app.jar`.
7. **Execute**: Click **"Run Pipeline"**.
   - **Result**: Pipeline status **FAILED**.
   - `Build` ✓ (SUCCESS)
   - `Test` ✗ (FAILED: *Missing required artifact 'build/app.jar'. Step 'Test' cannot proceed because the artifact was not produced by an earlier step.*)
   - `Deploy` ⏳ (PENDING: Downstream step kept in pending state to prevent corrupt deployment).
   - Point out the prominent red **Execution Failure Root Cause Banner** explaining the failure.
8. **Inspect History**: Return to Dashboard to view updated execution history and pass rate.

---

## 7. Dependency Analysis Explanation

The analyzer compares the set of artifacts produced by earlier steps against the resources accessed by downstream steps:

```
                  +----------------------------+
                  |  Step A Outputs: [app.jar] |
                  +--------------+-------------+
                                 |
           +---------------------+---------------------+
           |                                           |
           v                                           v
[Case 1: Declared Dependency]               [Case 2: Undeclared Dependency]
Step B accesses app.jar                     Step B accesses app.jar
Step B declares: ["Step A"]                 Step B declares: []
        |                                           |
        v                                           v
Status: DEPENDENCY_VALIDATED                Status: UNDECLARED_DEPENDENCY_DETECTED
Severity: INFO                              Severity: ERROR (Hidden Coupling)
```

1. **`DEPENDENCY_VALIDATED`**: The consumer step explicitly declares the producer step in `declared_dependencies`. Safe for execution.
2. **`UNDECLARED_DEPENDENCY_DETECTED`**: The consumer step accesses a resource produced by another step without declaring it. Flagged as hidden coupling.
3. **`NO_DEPENDENCY`**: The accessed resource has no producer in the pipeline (e.g. an external pre-existing file or environment variable).

---

## 8. Realistic Prototype Boundaries & Limitations

The following prototype boundaries and architecture design decisions are explicitly documented:
1. **In-Memory Artifact Tracking**: The execution engine tracks simulated artifact presence in memory; it does not mount Docker containers or execute arbitrary shell scripts on the host.
2. **Sequential Step Order**: Execution follows a linear sequence based on the step `order` index; arbitrary parallel branching (DAGs) is left for future work.
3. **Self-Contained Local Deployment**: The architecture uses FastAPI and SQLite locally without requiring external cloud runners, Kubernetes, or Tekton infrastructure.
