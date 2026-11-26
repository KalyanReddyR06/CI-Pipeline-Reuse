import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Network,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { api } from '../api';
import { Button, PageHeader } from '../components/AppShell';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorBanner, SkeletonCard } from '../components/States';
import { DependencyVisualFlow } from '../components/DependencyFlow';
import { useToast } from '../context/ToastContext';

export default function Dependencies() {
  const navigate = useNavigate();
  const toast = useToast();
  const [pipelines, setPipelines] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState(null);
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'undeclared' | 'validated' | 'no_dep'

  const runAnalysis = useCallback(
    async (id) => {
      if (!id) return;
      try {
        setBusy(true);
        const [analysisResult, fullPipeline] = await Promise.all([
          api.analyze(Number(id)),
          api.getPipeline(Number(id)),
        ]);
        setReport(analysisResult);
        setPipelineData(fullPipeline);
        if (analysisResult.has_undeclared) {
          toast.error(
            `Undeclared dependency detected in ${analysisResult.pipeline_name}!`,
          );
        } else {
          toast.success(
            `Dependencies validated for ${analysisResult.pipeline_name}! Zero hidden coupling.`,
          );
        }
      } catch (err) {
        toast.error(err.message || 'Analysis failed');
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const loadPipelines = useCallback(async () => {
    try {
      setError('');
      const list = await api.listPipelines();
      setPipelines(list);
      if (list[0]) {
        setSelectedId(String(list[0].id));
        runAnalysis(list[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  }, [runAnalysis]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  async function openDemoAndAnalyze() {
    try {
      setBusy(true);
      const demo = await api.seedDemo();
      setSelectedId(String(demo.id));
      const list = await api.listPipelines();
      setPipelines(list);
      await runAnalysis(demo.id);
      toast.info('Demo scenario analyzed: Undeclared dependency surfaced');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function fixDependency(finding) {
    if (!pipelineData || !finding.source_step) return;
    const step = pipelineData.steps.find((s) => s.name === finding.dependent_step);
    if (!step) return;

    const currentDeps = new Set(step.declared_dependencies || []);
    currentDeps.add(finding.source_step);

    try {
      setBusy(true);
      await api.updateStep(pipelineData.id, step.id, {
        declared_dependencies: Array.from(currentDeps),
      });
      toast.success(
        `Declared "${finding.source_step}" on "${step.name}". Re-analyzing…`,
      );
      // Immediately re-run analysis to show updated result
      await runAnalysis(pipelineData.id);
    } catch (err) {
      toast.error(err.message || 'Failed to fix dependency');
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    if (!report?.findings) {
      return { total: 0, undeclared: 0, validated: 0, noDep: 0, healthRate: 100 };
    }
    const undeclared = report.findings.filter(
      (f) =>
        f.status === 'UNDECLARED_DEPENDENCY_DETECTED' ||
        f.status === 'UNDECLARED_DEPENDENCY',
    ).length;
    const validated = report.findings.filter(
      (f) => f.status === 'DEPENDENCY_VALIDATED',
    ).length;
    const noDep = report.findings.filter(
      (f) => f.status === 'NO_DEPENDENCY',
    ).length;
    const total = report.findings.length;
    const evaluated = undeclared + validated;
    const healthRate =
      evaluated === 0 ? 100 : Math.round((validated / evaluated) * 100);

    return { total, undeclared, validated, noDep, healthRate };
  }, [report]);

  const filteredFindings = useMemo(() => {
    if (!report?.findings) return [];
    if (filterType === 'undeclared') {
      return report.findings.filter(
        (f) =>
          f.status === 'UNDECLARED_DEPENDENCY_DETECTED' ||
          f.status === 'UNDECLARED_DEPENDENCY',
      );
    }
    if (filterType === 'validated') {
      return report.findings.filter((f) => f.status === 'DEPENDENCY_VALIDATED');
    }
    if (filterType === 'no_dep') {
      return report.findings.filter((f) => f.status === 'NO_DEPENDENCY');
    }
    return report.findings;
  }, [report, filterType]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Step Dependency Analysis"
        description="Statically verify artifact flow between reusable CI steps to detect and eliminate hidden coupling before pipeline execution."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={openDemoAndAnalyze}
              disabled={busy}
            >
              Analyze Demo Pipeline
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => runAnalysis(selectedId)}
              disabled={!selectedId || busy}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Analyzing…' : 'Run Static Analysis'}
            </Button>
          </>
        }
      />

      <ErrorBanner message={error} onRetry={loadPipelines} />

      {/* PIPELINE SELECTOR */}
      <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-xs font-semibold text-ink shrink-0">
            Select Pipeline:
          </label>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              runAnalysis(e.target.value);
            }}
            className="focus-ring h-9 max-w-sm w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink font-medium"
          >
            {pipelines.length === 0 && <option value="">No pipelines available</option>}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.step_count || 0} steps)
              </option>
            ))}
          </select>
        </div>

        {selectedId && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => navigate(`/pipelines/${selectedId}?tab=pipeline`)}
            >
              <Workflow className="h-3 w-3" /> Step Builder
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => navigate(`/pipelines/${selectedId}`)}
            >
              Pipeline Workspace
            </Button>
          </div>
        )}
      </div>

      {!report ? (
        <EmptyState
          icon={Network}
          title="No analysis report available"
          description="Select a pipeline above and run static analysis to surface cross-step artifact dependencies."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => runAnalysis(selectedId)}
              disabled={!selectedId || busy}
            >
              Run Static Analysis
            </Button>
          }
        />
      ) : (
        <>
          {/* OVERALL DETECTION BANNER */}
          <div
            className={`rounded-xl border p-4 text-sm font-bold flex flex-wrap items-center justify-between gap-3 ${
              report.has_undeclared
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {report.has_undeclared ? (
                <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <div>
                <div className="text-base">
                  {report.has_undeclared
                    ? 'UNDECLARED DEPENDENCY DETECTED'
                    : 'DEPENDENCY VALIDATED'}
                </div>
                <div className="text-xs font-normal opacity-90 mt-0.5 font-sans">
                  {report.has_undeclared
                    ? 'Hidden coupling detected! A downstream step accesses an artifact without declaring the producing step.'
                    : 'All artifact access contracts are explicitly declared in step dependencies. Zero hidden coupling.'}
                </div>
              </div>
            </div>
            <StatusBadge
              status={report.has_undeclared ? 'UNDECLARED' : 'VALIDATED'}
              size="md"
            />
          </div>

          {/* PHASE D SUMMARY METRIC TILES */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Total Findings
              </span>
              <div className="text-2xl font-bold text-ink mt-1">{counts.total}</div>
              <span className="text-[11px] text-muted">Artifact interactions checked</span>
            </div>

            <div
              className={`card p-4 transition ${
                counts.undeclared > 0
                  ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20'
                  : ''
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Undeclared Dependencies
              </span>
              <div
                className={`text-2xl font-bold mt-1 ${
                  counts.undeclared > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-ink'
                }`}
              >
                {counts.undeclared}
              </div>
              <span className="text-[11px] text-muted">
                {counts.undeclared > 0
                  ? 'Hidden coupling detected'
                  : 'Zero hidden coupling'}
              </span>
            </div>

            <div className="card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Validated Dependencies
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {counts.validated}
              </div>
              <span className="text-[11px] text-muted">Explicitly declared contracts</span>
            </div>

            <div className="card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Independent Accesses
              </span>
              <div className="text-2xl font-bold text-ink mt-1">{counts.noDep}</div>
              <span className="text-[11px] text-muted">Self or external resources</span>
            </div>
          </div>

          {/* FINDINGS SECTION WITH FILTER TABS */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Artifact Dependency Traceability & Relationships
                </h3>
                <p className="text-xs text-muted">
                  Visual mapping of producer outputs, consumed artifacts, and contract status
                </p>
              </div>

              {/* Filter Pills */}
              <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
                {[
                  { id: 'all', label: `All (${counts.total})` },
                  { id: 'undeclared', label: `Undeclared (${counts.undeclared})` },
                  { id: 'validated', label: `Validated (${counts.validated})` },
                  { id: 'no_dep', label: `Independent (${counts.noDep})` },
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

            {filteredFindings.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No findings for this filter"
                description={
                  counts.total === 0
                    ? 'No cross-step artifact accesses detected in this pipeline.'
                    : 'Select a different filter above to view other dependency findings.'
                }
              />
            ) : (
              <div className="space-y-4">
                {filteredFindings.map((f, idx) => (
                  <DetailedFindingCard
                    key={idx}
                    finding={f}
                    onFix={() => fixDependency(f)}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Detailed Finding Card with visual relationship and contract explanation (Phase D)
 */
function DetailedFindingCard({ finding, onFix, busy }) {
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
      className={`card p-5 transition space-y-3.5 ${
        isUndeclared
          ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
          : isValidated
            ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
            : 'border-line'
      }`}
    >
      {/* 1. Header with Status Badge and Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={finding.status} size="sm" />
          <span className="text-xs text-muted font-medium">
            Severity: <strong className="uppercase text-ink">{finding.severity}</strong>
          </span>
        </div>

        {isUndeclared && producer && (
          <Button size="xs" variant="primary" onClick={onFix} disabled={busy}>
            Fix Dependency (Declare "{producer}")
          </Button>
        )}
      </div>

      {/* 2. Visual Dependency Relationship Flow: Build ── produces ──> app.jar ── consumed by ──> Test */}
      <DependencyVisualFlow finding={finding} />

      {/* 3. Formal Contract Comparison Table */}
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
            {artifact || '(No artifact emitted)'}
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

      {/* 4. Detailed Explanation */}
      <div className="rounded-lg border border-line/60 bg-surface/50 p-3 text-xs text-muted leading-relaxed font-sans">
        <strong className="text-ink font-semibold mr-1">Analysis Rationale:</strong>
        {finding.explanation}
      </div>
    </article>
  );
}
