import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock,
  FastForward,
  RotateCcw,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { api } from '../api';
import { Button, PageHeader } from '../components/AppShell';
import ExecutionFlowStepper from '../components/ExecutionFlowStepper';
import LogViewer from '../components/LogViewer';
import StatusBadge from '../components/StatusBadge';
import { ErrorBanner, SkeletonCard } from '../components/States';
import { useToast } from '../context/ToastContext';
import { formatDuration, formatRelativeTime } from '../lib/utils';

export default function ExecutionDetail() {
  const { id } = useParams();
  const executionId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [execution, setExecution] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [selectedStep, setSelectedStep] = useState('all');
  const [reRunning, setReRunning] = useState(false);
  const [activeStepName, setActiveStepName] = useState(null);
  const simCancelRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [ex, logRows] = await Promise.all([
        api.getExecution(executionId),
        api.getExecutionLogs(executionId),
      ]);
      setExecution(ex);
      setLogs(logRows);
      try {
        setPipeline(await api.getPipeline(ex.pipeline_id));
      } catch {
        setPipeline(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load execution');
    }
  }, [executionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      simCancelRef.current = true;
    };
  }, []);

  async function reExecute() {
    if (!execution?.pipeline_id) return;
    simCancelRef.current = false;
    setReRunning(true);
    try {
      // 1. Trigger backend execution
      const newRun = await api.execute(execution.pipeline_id);
      const allLogs = await api.getExecutionLogs(newRun.id);

      // 2. Play sequential step simulation
      const sortedSteps = [...newRun.step_executions].sort((a, b) => a.order - b.order);

      // Create initial simulated state: Pipeline QUEUED, steps PENDING
      const simExec = {
        ...newRun,
        status: 'RUNNING',
        step_executions: sortedSteps.map((s) => ({
          ...s,
          status: 'PENDING',
          started_at: null,
          finished_at: null,
        })),
        artifacts: [],
      };
      setExecution(simExec);
      setLogs([]);

      for (let i = 0; i < sortedSteps.length; i++) {
        if (simCancelRef.current) break;
        const targetStep = sortedSteps[i];
        setActiveStepName(targetStep.step_name);

        // Mark current step RUNNING
        setExecution((prev) => ({
          ...prev,
          step_executions: prev.step_executions.map((s) =>
            s.step_name === targetStep.step_name ? { ...s, status: 'RUNNING' } : s,
          ),
        }));

        // Filter logs up to this step
        const stepLogs = allLogs.filter(
          (l) => !l.step_name || l.step_name === targetStep.step_name,
        );
        setLogs(stepLogs);

        // Simulation delay per step (convincing demo pace)
        await new Promise((r) => setTimeout(r, 650));

        if (simCancelRef.current) break;

        // Apply actual step outcome from backend
        setExecution((prev) => ({
          ...prev,
          step_executions: prev.step_executions.map((s) =>
            s.step_name === targetStep.step_name ? targetStep : s,
          ),
        }));

        // If this step failed, stop simulation
        if (targetStep.status === 'FAILED') {
          break;
        }
      }

      // Finalize simulation state with full backend result
      setActiveStepName(null);
      setExecution(newRun);
      setLogs(allLogs);

      if (newRun.status === 'SUCCESS') {
        toast.success(`Pipeline #${newRun.pipeline_id} execution passed! (#EXEC-${newRun.id})`);
      } else {
        toast.error(`Pipeline execution halted due to failure: #EXEC-${newRun.id}`);
      }

      // Update URL silently
      navigate(`/executions/${newRun.id}`, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Execution failed');
      setActiveStepName(null);
      load();
    } finally {
      setReRunning(false);
    }
  }

  function skipSimulation() {
    simCancelRef.current = true;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} onRetry={load} />
        <Button variant="secondary" size="sm" onClick={() => navigate('/executions')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Executions
        </Button>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <SkeletonCard rows={4} />
      </div>
    );
  }

  const filteredLogs =
    selectedStep === 'all'
      ? logs
      : logs.filter((l) => l.step_name === selectedStep);

  const isSuccess = execution.status === 'SUCCESS';
  const isFailed = execution.status === 'FAILED';
  const isRunning = execution.status === 'RUNNING';

  const failedStep = execution.step_executions?.find((s) => s.status === 'FAILED');
  const failureReason =
    execution.failure_reason ||
    failedStep?.message ||
    'Pipeline execution halted due to an unhandled step error.';

  const pendingSteps =
    execution.step_executions?.filter((s) => s.status === 'PENDING') || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span>Execution Audit #EXEC-{execution.id}</span>
            {isRunning && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <Sparkles className="h-3.5 w-3.5 animate-spin" /> Live Simulating
              </span>
            )}
          </span>
        }
        description={
          pipeline
            ? `Pipeline: ${pipeline.name} · Step execution telemetry & console logs`
            : `Pipeline #${execution.pipeline_id} · Step execution telemetry & console logs`
        }
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/pipelines/${execution.pipeline_id}`)}
            >
              <Workflow className="h-3.5 w-3.5" /> Pipeline Workspace
            </Button>
            {reRunning ? (
              <Button size="sm" variant="secondary" onClick={skipSimulation}>
                <FastForward className="h-3.5 w-3.5" /> Skip Sim
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={reExecute}
                disabled={reRunning}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${reRunning ? 'animate-spin' : ''}`} />
                Re-run Pipeline
              </Button>
            )}
          </>
        }
      />

      {/* Execution Status Banner */}
      <div className="card p-5 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={execution.status} size="md" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted">
                Pipeline Lifecycle Status
              </div>
              <div className="text-sm font-semibold text-ink">
                {isSuccess
                  ? 'Sequential execution passed — all artifacts verified with zero coupling errors'
                  : isFailed
                    ? 'Execution stopped — step failure or missing artifact dependency detected'
                    : isRunning
                      ? 'Simulating sequential execution step by step...'
                      : 'Execution queued / pending execution'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="rounded-lg border border-line bg-canvas px-3 py-1.5">
              <span className="text-muted block text-[10px] uppercase font-semibold">Duration</span>
              <span className="font-mono font-bold text-ink">
                {formatDuration(execution.started_at, execution.finished_at)}
              </span>
            </div>
            <div className="rounded-lg border border-line bg-canvas px-3 py-1.5">
              <span className="text-muted block text-[10px] uppercase font-semibold">Started</span>
              <span className="font-medium text-ink flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted" />
                {formatRelativeTime(execution.started_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Produced Artifacts Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-muted uppercase text-[10px] flex items-center gap-1">
            <Boxes className="h-3.5 w-3.5 text-emerald-500" />
            Verified Produced Artifacts:
          </span>
          {execution.artifacts?.length > 0 ? (
            execution.artifacts.map((art, idx) => (
              <span
                key={idx}
                className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
              >
                {art}
              </span>
            ))
          ) : (
            <span className="text-muted font-mono text-[11px]">
              {isFailed ? 'None emitted before failure' : 'No artifacts emitted'}
            </span>
          )}
        </div>
      </div>

      {/* Prominent Failure Reason Banner if FAILED */}
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

          <div className="grid gap-2 sm:grid-cols-2 text-xs text-ink/80 pt-1 border-t border-rose-500/20">
            <div>
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
            <div className="sm:text-right">
              <Button
                size="xs"
                variant="secondary"
                onClick={() => navigate(`/pipelines/${execution.pipeline_id}`)}
              >
                Inspect Step Dependencies in Builder →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Callout if SUCCESS */}
      {isSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <span className="font-bold">Execution Passed:</span> All{' '}
              {execution.step_executions?.length || 0} steps completed successfully in sequential order.
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
        pipelineSteps={pipeline?.steps || []}
        selectedStep={selectedStep}
        onSelectStep={setSelectedStep}
        activeStepName={activeStepName}
      />

      {/* Step Timeline & Log Viewer */}
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        {/* Step List Timeline */}
        <section className="card p-4 h-fit">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
              Step Execution Timeline
            </h3>
            <span className="text-[11px] text-muted">
              {execution.step_executions?.length || 0} steps
            </span>
          </div>

          <ol className="space-y-2 text-xs">
            <li>
              <button
                type="button"
                onClick={() => setSelectedStep('all')}
                className={`w-full rounded-lg p-2 text-left font-medium transition cursor-pointer flex items-center justify-between ${
                  selectedStep === 'all'
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 font-semibold'
                    : 'hover:bg-surface-hover text-ink'
                }`}
              >
                <span>All Steps Console</span>
                <span className="font-mono text-[10px] opacity-75">{logs.length} lines</span>
              </button>
            </li>

            {[...(execution.step_executions || [])]
              .sort((a, b) => a.order - b.order)
              .map((se, idx) => {
                const isSelected = selectedStep === se.step_name;
                const isStepSuccess = se.status === 'SUCCESS';
                const isStepFailed = se.status === 'FAILED';

                return (
                  <li key={se.id || idx}>
                    <button
                      type="button"
                      onClick={() => setSelectedStep(se.step_name)}
                      className={`flex w-full items-start justify-between rounded-lg border p-2.5 text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/5'
                          : isStepFailed
                            ? 'border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10'
                            : 'border-line bg-surface hover:bg-surface-hover'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 font-bold text-ink">
                          <span className="text-[10px] text-muted">{idx + 1}.</span>
                          <span className="truncate">{se.step_name}</span>
                        </div>
                        {se.message && (
                          <div
                            className={`mt-1 font-mono text-[10px] line-clamp-2 ${
                              isStepSuccess ? 'text-muted' : 'text-rose-500 font-semibold'
                            }`}
                          >
                            {se.message}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <StatusBadge status={se.status} size="xs" />
                        <div className="mt-1 font-mono text-[10px] text-muted">
                          {formatDuration(se.started_at, se.finished_at)}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
          </ol>
        </section>

        {/* Console Log Output */}
        <section className="space-y-3">
          <LogViewer
            logs={filteredLogs}
            title={`$ pipeline run ${pipeline?.name || execution.pipeline_id} [${selectedStep}]`}
          />
        </section>
      </div>
    </div>
  );
}
