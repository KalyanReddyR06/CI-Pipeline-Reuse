import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  Boxes,
  CheckCircle2,
  Cpu,
  GitBranch,
  Hash,
  Layers,
  Network,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  Workflow,
} from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/AppShell';
import ExecutionFlowStepper from '../components/ExecutionFlowStepper';
import LogViewer from '../components/LogViewer';
import PipelineGraph from '../components/PipelineGraph';
import StatusBadge from '../components/StatusBadge';
import { DependencyVisualFlow } from '../components/DependencyFlow';
import { EmptyState, ErrorBanner, LoadingState } from '../components/States';
import { useToast } from '../context/ToastContext';
import {
  STEP_TEMPLATES,
  csvToList,
  formatDuration,
  formatRelativeTime,
  listToCsv,
  normalizeArtifact,
  validateStepForm,
} from '../lib/utils';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGridIcon },
  { id: 'pipeline', label: 'Step Builder', icon: Layers },
  { id: 'dependencies', label: 'Dependency Analysis', icon: Network },
  { id: 'executions', label: 'Executions', icon: Activity },
  { id: 'logs', label: 'Logs', icon: Terminal },
];

function LayoutGridIcon(props) {
  return <Workflow {...props} />;
}

const initialStepForm = {
  name: '',
  description: '',
  inputs: '',
  outputs: '',
  command: '',
  declared_dependencies: [], // array of step names
  accesses: '',
  order: 0,
};

export default function PipelineDetail() {
  const { id } = useParams();
  const pipelineId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'pipeline';

  const [pipeline, setPipeline] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedStep, setSelectedStep] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialStepForm);
  const [formErrors, setFormErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [report, setReport] = useState(null);
  const [execution, setExecution] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDesc, setMetaDesc] = useState('');

  const setTab = (next) => setSearchParams({ tab: next });

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await api.getPipeline(pipelineId);
      setPipeline(data);
      setMetaName(data.name);
      setMetaDesc(data.description || '');

      const [execs, analysisReport] = await Promise.allSettled([
        api.listPipelineExecutions(pipelineId),
        data.steps?.length > 0 ? api.analyze(pipelineId) : Promise.resolve(null),
      ]);

      if (execs.status === 'fulfilled') {
        setHistory(execs.value);
        if (execs.value[0]) {
          const full = await api.getExecution(execs.value[0].id);
          setExecution(full);
          setLogs(await api.getExecutionLogs(execs.value[0].id));
        }
      }

      if (analysisReport.status === 'fulfilled' && analysisReport.value) {
        setReport(analysisReport.value);
      }
    } catch (err) {
      setError(err.message || 'Failed to load pipeline');
    }
  }, [pipelineId]);

  useEffect(() => {
    load();
  }, [load]);

  const orderedSteps = useMemo(() => {
    if (!pipeline?.steps) return [];
    return [...pipeline.steps].sort((a, b) => a.order - b.order || a.id - b.id);
  }, [pipeline]);

  const health = useMemo(() => {
    if (!report) return { status: 'PENDING', label: 'Unchecked' };
    if (report.has_undeclared) return { status: 'UNDECLARED', label: 'Undeclared Coupling' };
    return { status: 'VALIDATED', label: 'Validated' };
  }, [report]);

  function handleStartNewStep() {
    if (isDirty && !window.confirm('You have unsaved step changes. Discard and start new?')) {
      return;
    }
    setEditingId(null);
    setSelectedStep(null);
    setForm({
      ...initialStepForm,
      order: orderedSteps.length,
    });
    setFormErrors({});
    setIsDirty(false);
  }

  function applyTemplate(template) {
    if (isDirty && !window.confirm('Discard current edits to apply this template?')) {
      return;
    }
    setEditingId(null);
    setSelectedStep(null);
    setForm({
      name: template.name,
      description: template.description,
      inputs: template.inputs || '',
      outputs: template.outputs || '',
      accesses: template.accesses || template.inputs || '',
      command: template.command || '',
      declared_dependencies: [],
      order: orderedSteps.length,
    });
    setFormErrors({});
    setIsDirty(true);
    setTab('pipeline');
  }

  function startEdit(step) {
    if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    setSelectedStep(step);
    setEditingId(step.id);
    setForm({
      name: step.name,
      description: step.description || '',
      inputs: listToCsv(step.inputs),
      outputs: listToCsv(step.outputs),
      command: step.command || '',
      declared_dependencies: step.declared_dependencies || [],
      accesses: listToCsv(step.accesses),
      order: step.order,
    });
    setFormErrors({});
    setIsDirty(false);
    setTab('pipeline');
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function toggleDeclaredDependency(stepName) {
    const current = Array.isArray(form.declared_dependencies)
      ? form.declared_dependencies
      : [];
    let updated;
    if (current.includes(stepName)) {
      updated = current.filter((s) => s !== stepName);
    } else {
      updated = [...current, stepName];
    }
    handleFormChange('declared_dependencies', updated);
  }

  async function saveStep(e) {
    e?.preventDefault?.();
    const validation = validateStepForm(form, orderedSteps, editingId);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      toast.error('Please resolve form validation errors before saving.');
      return;
    }

    const inputsList = csvToList(form.inputs).map(normalizeArtifact);
    const outputsList = csvToList(form.outputs).map(normalizeArtifact);
    const accessesList = csvToList(form.accesses).map(normalizeArtifact);

    // CRITICAL UX GUARANTEE: In CI pipelines, artifacts declared under "inputs"
    // represent resources consumed by this step. We ensure accesses includes them
    // so the dependency analyzer immediately evaluates cross-step couplings.
    const mergedAccesses = Array.from(new Set([...inputsList, ...accessesList]));

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      inputs: inputsList,
      outputs: outputsList,
      command: form.command.trim(),
      declared_dependencies: form.declared_dependencies,
      accesses: mergedAccesses,
      order: Number(form.order) || 0,
    };

    try {
      setBusy(true);
      if (editingId) {
        await api.updateStep(pipelineId, editingId, payload);
        toast.success(`Updated step "${payload.name}"`);
      } else {
        await api.addStep(pipelineId, payload);
        toast.success(`Added step "${payload.name}"`);
      }

      setIsDirty(false);
      setEditingId(null);
      setSelectedStep(null);
      setForm(initialStepForm);
      setFormErrors({});

      const updatedPipeline = await api.getPipeline(pipelineId);
      setPipeline(updatedPipeline);

      // Auto run analysis to give immediate feedback
      try {
        const result = await api.analyze(pipelineId);
        setReport(result);
      } catch {
        /* silent */
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save step');
    } finally {
      setBusy(false);
    }
  }

  async function removeStep(stepId) {
    if (!window.confirm('Delete this pipeline step?')) return;
    try {
      setBusy(true);
      await api.deleteStep(pipelineId, stepId);
      toast.success('Step deleted');
      setSelectedStep(null);
      setEditingId(null);
      setForm(initialStepForm);
      setIsDirty(false);
      const updated = await api.getPipeline(pipelineId);
      setPipeline(updated);
      if (updated.steps?.length > 0) {
        setReport(await api.analyze(pipelineId));
      } else {
        setReport(null);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function moveStep(stepIndex, direction) {
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedSteps.length) return;

    const currentStep = orderedSteps[stepIndex];
    const otherStep = orderedSteps[targetIndex];

    try {
      setBusy(true);
      // Swap their order numbers
      await Promise.all([
        api.updateStep(pipelineId, currentStep.id, { order: targetIndex }),
        api.updateStep(pipelineId, otherStep.id, { order: stepIndex }),
      ]);
      toast.success(`Reordered: ${currentStep.name}`);
      const updated = await api.getPipeline(pipelineId);
      setPipeline(updated);
      const rep = await api.analyze(pipelineId);
      setReport(rep);
    } catch (err) {
      toast.error(err.message || 'Failed to reorder steps');
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    try {
      setBusy(true);
      const result = await api.analyze(pipelineId);
      setReport(result);
      setTab('dependencies');
      if (result.has_undeclared) {
        toast.error('Analysis: Undeclared dependency detected! (Hidden coupling)');
      } else {
        toast.success('Analysis: All dependencies validated! Zero hidden coupling.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function fixDependency(finding) {
    const step = orderedSteps.find((s) => s.name === finding.dependent_step);
    if (!step || !finding.source_step) {
      toast.error('Unable to auto-fix this finding');
      return;
    }
    const deps = new Set(step.declared_dependencies || []);
    deps.add(finding.source_step);
    try {
      setBusy(true);
      await api.updateStep(pipelineId, step.id, {
        declared_dependencies: [...deps],
      });
      toast.success(`Declared "${finding.source_step}" as dependency for "${step.name}"`);
      const updatedPipeline = await api.getPipeline(pipelineId);
      setPipeline(updatedPipeline);
      const result = await api.analyze(pipelineId);
      setReport(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runPipeline() {
    try {
      setBusy(true);
      const result = await api.execute(pipelineId);
      setExecution(result);
      setLogs(await api.getExecutionLogs(result.id));
      setHistory(await api.listPipelineExecutions(pipelineId));
      setTab('executions');
      if (result.status === 'SUCCESS') {
        toast.success(`Pipeline executed successfully: #EXEC-${result.id}`);
      } else {
        toast.error(`Pipeline execution failed: #EXEC-${result.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openExecution(execId) {
    const full = await api.getExecution(execId);
    setExecution(full);
    setLogs(await api.getExecutionLogs(execId));
    setTab('logs');
  }

  async function saveMeta() {
    try {
      setBusy(true);
      const updated = await api.updatePipeline(pipelineId, {
        name: metaName.trim(),
        description: metaDesc.trim(),
      });
      setPipeline(updated);
      setEditingMeta(false);
      toast.success('Pipeline details updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!pipeline && !error) return <LoadingState label="Loading pipeline workspace…" />;
  if (!pipeline) {
    return (
      <div>
        <ErrorBanner message={error} />
        <Button onClick={() => navigate('/pipelines')}>Back to pipelines</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PIPELINE HEADER CARD */}
      <div className="card p-5 bg-surface shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              className="mb-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              onClick={() => navigate('/pipelines')}
            >
              ← Back to Pipelines
            </button>

            {editingMeta ? (
              <div className="mt-1 space-y-2">
                <input
                  value={metaName}
                  onChange={(e) => setMetaName(e.target.value)}
                  placeholder="Pipeline name"
                  className="focus-ring h-9 w-full max-w-md rounded-lg border border-line bg-canvas px-3 text-base font-bold text-ink"
                />
                <input
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  placeholder="Short description"
                  className="focus-ring h-8 w-full max-w-xl rounded-lg border border-line bg-canvas px-3 text-xs text-ink"
                />
                <div className="flex gap-2 pt-1">
                  <Button size="xs" variant="primary" onClick={saveMeta} disabled={busy}>
                    Save Changes
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => setEditingMeta(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">
                    {pipeline.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingMeta(true)}
                    className="text-muted hover:text-ink cursor-pointer p-1"
                    title="Edit name and description"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted max-w-2xl">
                  {pipeline.description || 'Modular CI pipeline with explicit artifact contracts.'}
                </p>
              </>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={health.status} label={health.label} size="xs" />
              <span className="text-muted">·</span>
              <span className="font-medium text-muted">{orderedSteps.length} step{orderedSteps.length === 1 ? '' : 's'}</span>
              <span className="text-muted">·</span>
              <span className="text-muted">
                {history[0]
                  ? `Last executed ${formatRelativeTime(history[0].started_at)}`
                  : 'Never executed'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={analyze}
              disabled={busy || orderedSteps.length === 0}
            >
              <Network className="h-4 w-4" />
              Analyze Dependencies
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={runPipeline}
              disabled={busy || orderedSteps.length === 0}
            >
              <Play className="h-4 w-4" />
              Run Pipeline
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-5 flex flex-wrap gap-1 border-t border-line pt-3 text-xs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition cursor-pointer ${
                tab === t.id
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 font-semibold'
                  : 'text-muted hover:bg-surface-hover hover:text-ink'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.id === 'dependencies' && report?.has_undeclared && (
                <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-400/40" />
              )}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} onRetry={load} />

      {/* TAB 1: OVERVIEW */}
      {tab === 'overview' && (
        <OverviewTab
          steps={orderedSteps}
          report={report}
          history={history}
          onAnalyze={analyze}
          onRun={runPipeline}
          onOpenBuilder={() => setTab('pipeline')}
          onOpenLogs={openExecution}
        />
      )}

      {/* TAB 2: PIPELINE BUILDER (PHASE C CORE) */}
      {tab === 'pipeline' && (
        <BuilderTab
          steps={orderedSteps}
          selectedStep={selectedStep}
          setSelectedStep={setSelectedStep}
          form={form}
          formErrors={formErrors}
          isDirty={isDirty}
          editingId={editingId}
          onFormChange={handleFormChange}
          onToggleDependency={toggleDeclaredDependency}
          onSave={saveStep}
          onEdit={startEdit}
          onDelete={removeStep}
          onMove={moveStep}
          onNewStep={handleStartNewStep}
          onTemplate={applyTemplate}
          findings={report?.findings}
          busy={busy}
        />
      )}

      {/* TAB 3: DEPENDENCY ANALYSIS */}
      {tab === 'dependencies' && (
        <DependenciesTab
          report={report}
          steps={orderedSteps}
          onAnalyze={analyze}
          onFix={fixDependency}
          busy={busy}
        />
      )}

      {/* TAB 4: EXECUTIONS */}
      {tab === 'executions' && (
        <ExecutionsTab
          execution={execution}
          history={history}
          pipelineSteps={orderedSteps}
          pipeline={pipeline}
          onRun={runPipeline}
          onOpenLogs={openExecution}
          onSelectExecution={async (execId) => {
            const full = await api.getExecution(execId);
            setExecution(full);
            setLogs(await api.getExecutionLogs(execId));
          }}
          busy={busy}
        />
      )}

      {/* TAB 5: LOGS */}
      {tab === 'logs' && (
        <div className="space-y-4">
          {execution ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink">#EXEC-{execution.id}</span>
                  <StatusBadge status={execution.status} size="xs" />
                  <span className="text-xs text-muted">
                    Duration: {formatDuration(execution.started_at, execution.finished_at)}
                  </span>
                </div>
                <Link
                  to={`/executions/${execution.id}`}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Open Dedicated Execution View →
                </Link>
              </div>
              <LogViewer logs={logs} title={`$ pipeline run ${pipeline.name}`} />
            </>
          ) : (
            <EmptyState
              icon={Terminal}
              title="No execution logs available"
              description="Run the pipeline to inspect command execution output and artifact generation."
              action={
                <Button variant="primary" size="sm" onClick={runPipeline}>
                  Run Pipeline
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

/** OVERVIEW TAB COMPONENT */
function OverviewTab({ steps, report, history, onAnalyze, onRun, onOpenBuilder, onOpenLogs }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      {/* Graph Visualizer */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Pipeline Architecture</h3>
          <Button size="xs" variant="secondary" onClick={onOpenBuilder}>
            <Layers className="h-3 w-3" /> Step Builder
          </Button>
        </div>
        <PipelineGraph steps={steps} analysisFindings={report?.findings} />
      </section>

      {/* Sidebar Panels */}
      <div className="space-y-4">
        {/* Quick Actions */}
        <section className="card p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            Quick Actions
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={onAnalyze}>
              <Network className="h-3.5 w-3.5" /> Analyze Coupling
            </Button>
            <Button size="sm" variant="primary" onClick={onRun}>
              <Play className="h-3.5 w-3.5" /> Execute Pipeline
            </Button>
          </div>
        </section>

        {/* Dependency Snapshot */}
        <section className="card p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
            Dependency Coupling Status
          </h4>
          {!report ? (
            <p className="text-xs text-muted">Run analysis to verify artifact contracts.</p>
          ) : report.has_undeclared ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Undeclared Dependency Detected
              </div>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90">{report.summary}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Zero Hidden Coupling · Validated
              </div>
              <p className="mt-1 text-[11px] opacity-90">{report.summary}</p>
            </div>
          )}
        </section>

        {/* Execution History Snippet */}
        <section className="card p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            Recent Executions
          </h4>
          {history.length === 0 ? (
            <p className="text-xs text-muted">No runs recorded yet.</p>
          ) : (
            <div className="divide-y divide-line text-xs">
              {history.slice(0, 4).map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-ink">#EXEC-{ex.id}</span>
                    <StatusBadge status={ex.status} size="xs" />
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenLogs(ex.id)}
                    className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    View Logs
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** BUILDER TAB COMPONENT (PHASE C) */
function BuilderTab({
  steps,
  selectedStep,
  _setSelectedStep,
  form,
  formErrors,
  isDirty,
  editingId,
  onFormChange,
  onToggleDependency,
  onSave,
  onEdit,
  onDelete,
  onMove,
  onNewStep,
  onTemplate,
  findings,
  busy,
}) {
  const otherExistingSteps = useMemo(() => {
    return steps.filter((s) => s.id !== editingId);
  }, [steps, editingId]);

  return (
    <div className="grid gap-5 xl:grid-cols-[240px_1fr_360px]">
      {/* 1. Step Library Sidebar */}
      <aside className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink">
              <Boxes className="h-4 w-4 text-emerald-500" />
              Step Library
            </div>
          </div>
          <p className="mb-3 text-[11px] text-muted">
            Click to load pre-configured reusable CI steps:
          </p>
          <div className="space-y-2">
            {STEP_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => onTemplate(tpl)}
                className="w-full rounded-lg border border-line bg-surface p-2.5 text-left text-xs transition hover:border-emerald-500/40 hover:bg-surface-hover cursor-pointer"
              >
                <div className="font-bold text-ink flex items-center justify-between">
                  <span>{tpl.name}</span>
                  <Plus className="h-3 w-3 text-muted" />
                </div>
                <div className="mt-0.5 text-[10px] text-muted line-clamp-1">
                  {tpl.description}
                </div>
                <div className="mt-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                  out: {tpl.outputs}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
            <Cpu className="h-3.5 w-3.5" /> Architecture Tip
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            Create <strong>Build</strong> with output <code className="text-ink font-mono">build/app.jar</code>, then <strong>Test</strong> and <strong>Deploy</strong> accessing it to test undeclared coupling!
          </p>
        </div>
      </aside>

      {/* 2. Visual Sequence & Step List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Configured Pipeline Steps</h3>
          <Button size="xs" variant="primary" onClick={onNewStep}>
            <Plus className="h-3.5 w-3.5" /> Add New Step
          </Button>
        </div>

        {steps.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No steps configured"
            description="Use the Step Library on the left or the form on the right to add your first reusable CI step."
            action={
              <Button size="sm" variant="primary" onClick={onNewStep}>
                Add First Step
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const isSelected = selectedStep?.id === step.id || editingId === step.id;
              const hasUndeclared = findings?.some(
                (f) =>
                  f.status === 'UNDECLARED_DEPENDENCY_DETECTED' &&
                  f.dependent_step === step.name,
              );

              return (
                <div
                  key={step.id}
                  className={`card p-4 transition ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : hasUndeclared
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 dark:bg-slate-800 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-ink truncate">{step.name}</span>
                          {hasUndeclared && (
                            <StatusBadge status="UNDECLARED" size="xs" />
                          )}
                        </div>
                        {step.description && (
                          <p className="text-xs text-muted truncate mt-0.5">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step Controls: Edit, Reorder, Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onMove(idx, 'up')}
                        disabled={idx === 0 || busy}
                        className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                        title="Move step up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(idx, 'down')}
                        disabled={idx === steps.length - 1 || busy}
                        className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                        title="Move step down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <Button size="xs" variant="secondary" onClick={() => onEdit(step)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => onDelete(step.id)}
                        disabled={busy}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Artifacts & Command */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="rounded-lg border border-line bg-canvas p-2">
                      <span className="font-bold text-[10px] uppercase text-muted flex items-center gap-1">
                        <Box className="h-3 w-3 text-sky-500" /> Inputs / Accessed Artifacts
                      </span>
                      <div className="mt-0.5 font-mono text-[11px] text-ink truncate">
                        {(step.inputs?.length ? step.inputs : (step.accesses || [])).join(', ') || '—'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-line bg-canvas p-2">
                      <span className="font-bold text-[10px] uppercase text-muted flex items-center gap-1">
                        <Hash className="h-3 w-3 text-emerald-500" /> Produced Outputs
                      </span>
                      <div className="mt-0.5 font-mono text-[11px] text-ink truncate">
                        {(step.outputs || []).join(', ') || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Declared dependencies preview */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11px] text-muted">
                    <div className="flex items-center gap-1 truncate">
                      <GitBranch className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>Declared: </span>
                      <span className="font-semibold text-ink">
                        {(step.declared_dependencies || []).length > 0
                          ? step.declared_dependencies.join(', ')
                          : 'None'}
                      </span>
                    </div>
                    {step.command && (
                      <span className="font-mono text-[10px] opacity-70 truncate max-w-[180px]">
                        $ {step.command}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Step Configuration Form (Phase C validation & dependency selector) */}
      <aside className="card p-5 h-fit sticky top-20">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-2.5">
          <div>
            <h4 className="text-sm font-bold text-ink">
              {editingId ? 'Edit Step Configuration' : 'Configure New Step'}
            </h4>
            <span className="text-[11px] text-muted">
              {editingId ? `Editing Step #${editingId}` : 'Step parameters & artifacts'}
            </span>
          </div>
          {isDirty && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              Unsaved
            </span>
          )}
        </div>

        <form onSubmit={onSave} className="space-y-3.5 text-xs">
          {/* Step Name */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Step Name <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => onFormChange('name', e.target.value)}
              placeholder="e.g. Build, Test, Deploy"
              className={`focus-ring h-9 w-full rounded-lg border bg-canvas px-2.5 text-xs text-ink ${
                formErrors.name ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-line'
              }`}
            />
            {formErrors.name && (
              <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {formErrors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-ink mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => onFormChange('description', e.target.value)}
              placeholder="Purpose of this step"
              className="focus-ring h-8 w-full rounded-lg border border-line bg-canvas px-2.5 text-xs text-ink"
            />
          </div>

          {/* Outputs / Produced Artifacts */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Produced Outputs (Artifacts)
            </label>
            <input
              value={form.outputs}
              onChange={(e) => onFormChange('outputs', e.target.value)}
              placeholder="e.g. build/app.jar (comma-separated)"
              className="focus-ring h-8 w-full rounded-lg border border-line bg-canvas px-2.5 text-xs text-ink font-mono"
            />
            <p className="mt-0.5 text-[10px] text-muted">
              Artifacts created by this step for downstream reuse.
            </p>
          </div>

          {/* Inputs / Consumed Artifacts */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Inputs / Accessed Artifacts
            </label>
            <input
              value={form.inputs}
              onChange={(e) => onFormChange('inputs', e.target.value)}
              placeholder="e.g. build/app.jar"
              className="focus-ring h-8 w-full rounded-lg border border-line bg-canvas px-2.5 text-xs text-ink font-mono"
            />
            <p className="mt-0.5 text-[10px] text-muted">
              Files read or required by this step during execution.
            </p>
          </div>

          {/* PHASE C REQUIREMENT: Interactive Dependency Selector */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Declared Dependencies
            </label>
            <p className="mb-1.5 text-[10px] text-muted">
              Select steps that must run and provide artifacts before this step:
            </p>

            {otherExistingSteps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line p-2 text-[11px] text-muted text-center">
                No other steps exist yet to declare as dependencies.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-canvas p-2">
                {otherExistingSteps.map((s) => {
                  const isChecked = (form.declared_dependencies || []).includes(s.name);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onToggleDependency(s.name)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950'
                          : 'bg-surface text-ink border border-line hover:border-emerald-500/40'
                      }`}
                    >
                      {isChecked ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3 text-muted" />
                      )}
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}

            {formErrors.declared_dependencies && (
              <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {formErrors.declared_dependencies}
              </p>
            )}
            {formErrors.declared_warnings && (
              <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {formErrors.declared_warnings}
              </p>
            )}
          </div>

          {/* Execution Command */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Execution Command <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={form.command}
              onChange={(e) => onFormChange('command', e.target.value)}
              placeholder="e.g. java -jar build/app.jar --test"
              className={`focus-ring h-8 w-full rounded-lg border bg-canvas px-2.5 text-xs text-ink font-mono ${
                formErrors.command ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-line'
              }`}
            />
            {formErrors.command && (
              <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {formErrors.command}
              </p>
            )}
          </div>

          {/* Buttons: Save / Cancel */}
          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-line">
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              <Plus className="h-3.5 w-3.5" />
              {editingId ? 'Update Step' : 'Add Step to Pipeline'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onNewStep}
              disabled={busy}
            >
              Reset
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

/** DEPENDENCIES TAB COMPONENT (PHASE D) */
function DependenciesTab({ report, _steps, onAnalyze, onFix, busy }) {
  const [filterType, setFilterType] = useState('all');

  if (!report) {
    return (
      <EmptyState
        icon={Network}
        title="Dependency analysis not yet performed"
        description="Analyze this pipeline to discover any hidden cross-step coupling where artifacts are accessed without explicit declaration."
        action={
          <Button variant="primary" size="sm" onClick={onAnalyze} disabled={busy}>
            {busy ? 'Analyzing…' : 'Analyze Dependencies'}
          </Button>
        }
      />
    );
  }

  const undeclared = report.findings.filter(
    (f) =>
      f.status === 'UNDECLARED_DEPENDENCY_DETECTED' ||
      f.status === 'UNDECLARED_DEPENDENCY',
  );
  const validated = report.findings.filter((f) => f.status === 'DEPENDENCY_VALIDATED');
  const noDep = report.findings.filter((f) => f.status === 'NO_DEPENDENCY');

  const filtered = report.findings.filter((f) => {
    if (filterType === 'undeclared') {
      return (
        f.status === 'UNDECLARED_DEPENDENCY_DETECTED' ||
        f.status === 'UNDECLARED_DEPENDENCY'
      );
    }
    if (filterType === 'validated') return f.status === 'DEPENDENCY_VALIDATED';
    if (filterType === 'no_dep') return f.status === 'NO_DEPENDENCY';
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">
            Dependency Coupling Analysis Report
          </h3>
          <p className="text-xs text-muted">
            Static artifact comparison: Producer outputs vs Consumer accesses
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onAnalyze} disabled={busy}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Analyzing…' : 'Re-run Analysis'}
        </Button>
      </div>

      {/* Outcome Banner */}
      <div
        className={`rounded-xl border p-4 text-sm font-bold flex items-center justify-between gap-3 ${
          report.has_undeclared
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {report.has_undeclared ? (
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span>
            {report.has_undeclared
              ? 'UNDECLARED DEPENDENCY DETECTED (HIDDEN COUPLING FOUND)'
              : 'DEPENDENCY VALIDATED (ZERO HIDDEN COUPLING)'}
          </span>
        </div>
        <StatusBadge
          status={report.has_undeclared ? 'UNDECLARED' : 'VALIDATED'}
          size="sm"
        />
      </div>

      {/* Metric Tiles */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Total Findings
          </span>
          <div className="text-2xl font-bold text-ink mt-1">
            {report.findings.length}
          </div>
          <span className="text-[11px] text-muted">Artifact accesses checked</span>
        </div>
        <div
          className={`card p-4 transition ${
            undeclared.length > 0
              ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20'
              : ''
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Undeclared Couplings
          </span>
          <div
            className={`text-2xl font-bold mt-1 ${
              undeclared.length > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-ink'
            }`}
          >
            {undeclared.length}
          </div>
          <span className="text-[11px] text-muted">
            {undeclared.length > 0 ? 'Hidden coupling detected' : 'Zero hidden coupling'}
          </span>
        </div>
        <div className="card p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Validated Dependencies
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {validated.length}
          </div>
          <span className="text-[11px] text-muted">Explicitly declared</span>
        </div>
        <div className="card p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Independent Steps
          </span>
          <div className="text-2xl font-bold text-ink mt-1">{noDep.length}</div>
          <span className="text-[11px] text-muted">No cross-step artifacts</span>
        </div>
      </div>

      {/* Structured Findings List with Filter Pills */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Artifact Access Findings & Visual Relationships
          </h4>

          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
            {[
              { id: 'all', label: `All (${report.findings.length})` },
              { id: 'undeclared', label: `Undeclared (${undeclared.length})` },
              { id: 'validated', label: `Validated (${validated.length})` },
              { id: 'no_dep', label: `Independent (${noDep.length})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                  filterType === f.id
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No findings for this selection"
            description="All steps in this filter meet expected coupling contracts."
          />
        ) : (
          filtered.map((f, idx) => (
            <FindingCard key={idx} finding={f} onFix={onFix} busy={busy} />
          ))
        )}
      </div>
    </div>
  );
}

function FindingCard({ finding, onFix, busy }) {
  const isUndeclared =
    finding.status === 'UNDECLARED_DEPENDENCY_DETECTED' ||
    finding.status === 'UNDECLARED_DEPENDENCY';
  const isValidated = finding.status === 'DEPENDENCY_VALIDATED';
  const isMissingProducer = !finding.source_step && Boolean(finding.resource);
  const isInvalidRef = !finding.resource && Boolean(finding.source_step);

  const consumer = finding.dependent_step || finding.consumer_step;
  const producer = finding.source_step || finding.producer_step;
  const artifact = finding.resource || finding.artifact;

  return (
    <article
      className={`card p-5 space-y-3.5 transition ${
        isUndeclared
          ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
          : isValidated
            ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
            : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge status={finding.status} size="xs" />
          <span className="text-xs text-muted">
            Severity: <strong className="uppercase text-ink">{finding.severity}</strong>
          </span>
        </div>

        {isUndeclared && producer && (
          <Button size="xs" variant="primary" onClick={() => onFix(finding)} disabled={busy}>
            Fix Dependency (Declare "{producer}")
          </Button>
        )}
      </div>

      {/* Visual Relationship Flow: Build ── produces ──> app.jar ── consumed by ──> Test */}
      <DependencyVisualFlow finding={finding} />

      {/* Contract comparison table */}
      <div className="grid gap-3 sm:grid-cols-4 rounded-xl border border-line bg-canvas p-3 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Consumer Step
          </span>
          <span className="font-bold text-ink text-sm">{consumer}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Artifact Path
          </span>
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {artifact || '(No artifact)'}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Producer Step
          </span>
          <span className="font-bold text-ink text-sm">
            {producer || (isMissingProducer ? 'External / None' : 'Self')}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Declared Dependency
          </span>
          <span
            className={`font-semibold text-xs ${
              isValidated
                ? 'text-emerald-600 dark:text-emerald-400'
                : isUndeclared
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted'
            }`}
          >
            {isValidated
              ? `Declared (${producer})`
              : isUndeclared
                ? 'Missing (Hidden Coupling)'
                : isInvalidRef
                  ? `Invalid ("${producer}" not found)`
                  : 'Not Required'}
          </span>
        </div>
      </div>

      {/* Rationale explanation */}
      <div className="rounded-lg border border-line/60 bg-surface/50 p-2.5 text-xs text-muted leading-relaxed font-sans">
        <strong className="text-ink font-semibold mr-1">Rationale:</strong>
        {finding.explanation}
      </div>
    </article>
  );
}

/** EXECUTIONS TAB COMPONENT */
function ExecutionsTab({
  execution,
  history,
  pipelineSteps = [],
  onRun,
  onOpenLogs,
  onSelectExecution,
  busy,
}) {
  const isFailed = execution?.status === 'FAILED';
  const isSuccess = execution?.status === 'SUCCESS';
  const failedStep = execution?.step_executions?.find((s) => s.status === 'FAILED');
  const failureReason =
    execution?.failure_reason ||
    failedStep?.message ||
    'Pipeline execution halted due to an unhandled step error.';

  const pendingSteps =
    execution?.step_executions?.filter((s) => s.status === 'PENDING') || [];

  return (
    <div className="space-y-5">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">Execution Telemetry & Simulator</h3>
          <p className="text-xs text-muted">
            Sequential step progression, artifact verification, and failure analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {execution && (
            <Link
              to={`/executions/${execution.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              <Terminal className="h-3.5 w-3.5" /> Full Audit & Logs
            </Link>
          )}
          <Button size="sm" variant="primary" onClick={onRun} disabled={busy}>
            <Play className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Run Pipeline
          </Button>
        </div>
      </div>

      {!execution ? (
        <EmptyState
          icon={Play}
          title="No executions recorded for this pipeline"
          description="Click 'Run Pipeline' to execute steps sequentially and record telemetry."
          action={
            <Button variant="primary" size="sm" onClick={onRun} disabled={busy}>
              <Play className="h-3.5 w-3.5" /> Run Pipeline
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* Prominent Failure Reason Banner */}
          {isFailed && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                  <AlertOctagon className="h-5 w-5 shrink-0" />
                  <span>
                    Execution Halted: Step "{failedStep?.step_name || 'Failed Step'}" Encountered Error
                  </span>
                </div>
                <StatusBadge status="FAILED" size="xs" />
              </div>

              <div className="rounded-lg border border-rose-500/25 bg-canvas p-3 font-mono text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                {failureReason}
              </div>

              <div className="text-xs text-ink/80 pt-1 border-t border-rose-500/20">
                <strong className="text-ink">Coupling Impact:</strong>{' '}
                {pendingSteps.length > 0 ? (
                  <span>
                    Downstream step{pendingSteps.length > 1 ? 's' : ''}{' '}
                    <strong>
                      {pendingSteps.map((s) => `"${s.step_name}"`).join(', ')}
                    </strong>{' '}
                    kept in <code className="rounded bg-canvas px-1 py-0.5 font-mono font-bold text-muted">PENDING</code> state to preserve system integrity.
                  </span>
                ) : (
                  <span>Pipeline execution halted immediately.</span>
                )}
              </div>
            </div>
          )}

          {/* Success Callout */}
          {isSuccess && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="font-bold">Execution Passed:</span> All{' '}
                  {execution.step_executions?.length || 0} steps completed successfully with zero coupling errors.
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                100% Steps Passed
              </span>
            </div>
          )}

          {/* Step-by-Step Execution Visual Flow Stepper */}
          <ExecutionFlowStepper
            stepExecutions={execution.step_executions || []}
            pipelineSteps={pipelineSteps}
            onSelectStep={() => onOpenLogs(execution.id)}
          />

          {/* Bottom Grid: Artifacts + Execution History */}
          <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            {/* Artifacts & Meta */}
            <section className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-ink text-sm">
                    #EXEC-{execution.id}
                  </span>
                  <StatusBadge status={execution.status} size="xs" />
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-muted">
                  <span>Duration: {formatDuration(execution.started_at, execution.finished_at)}</span>
                  <span>Started: {formatRelativeTime(execution.started_at)}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-2">
                  Verified Produced Artifacts:
                </span>
                {execution.artifacts?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {execution.artifacts.map((art, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-300"
                      >
                        +{art}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted font-mono">No artifacts emitted.</p>
                )}
              </div>

              <div className="pt-2">
                <Button size="sm" variant="secondary" onClick={() => onOpenLogs(execution.id)}>
                  <Terminal className="h-3.5 w-3.5" /> View Console Logs
                </Button>
              </div>
            </section>

            {/* Execution History */}
            <section className="card p-5">
              <h3 className="text-sm font-bold text-ink mb-3">Execution History</h3>
              {history.length === 0 ? (
                <p className="text-xs text-muted">No prior executions for this pipeline.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-auto">
                  {history.map((ex) => {
                    const isSelectedRun = ex.id === execution.id;
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => onSelectExecution && onSelectExecution(ex.id)}
                        className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition cursor-pointer text-xs ${
                          isSelectedRun
                            ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/5'
                            : 'border-line bg-surface hover:bg-surface-hover'
                        }`}
                      >
                        <div>
                          <div className="font-mono font-bold text-ink">#EXEC-{ex.id}</div>
                          <div className="text-[11px] text-muted">
                            {formatRelativeTime(ex.started_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={ex.status} size="xs" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
