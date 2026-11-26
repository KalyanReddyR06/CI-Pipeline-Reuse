import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  LayoutGrid,
  List,
  Network,
  Play,
  Plus,
  Search,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import { api } from '../api';
import { Button, PageHeader } from '../components/AppShell';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorBanner, SkeletonCard } from '../components/States';
import { useToast } from '../context/ToastContext';
import { formatRelativeTime, stepFlowLabel } from '../lib/utils';

export default function Pipelines() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [details, setDetails] = useState({});
  const [execMap, setExecMap] = useState({});
  const [analysisMap, setAnalysisMap] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setError('');
      const list = await api.listPipelines();
      setPipelines(list);
      const full = await Promise.all(list.map((p) => api.getPipeline(p.id)));
      const dmap = {};
      const emap = {};
      const amap = {};

      await Promise.all(
        full.map(async (p) => {
          dmap[p.id] = p;
          const [execs, analysis] = await Promise.allSettled([
            api.listPipelineExecutions(p.id),
            p.steps?.length > 0 ? api.analyze(p.id) : Promise.resolve(null),
          ]);
          if (execs.status === 'fulfilled') {
            emap[p.id] = execs.value[0] || null;
          }
          if (analysis.status === 'fulfilled' && analysis.value) {
            amap[p.id] = analysis.value;
          }
        }),
      );

      setDetails(dmap);
      setExecMap(emap);
      setAnalysisMap(amap);
    } catch (err) {
      setError(err.message || 'Unable to load pipelines');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return pipelines.filter((p) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);

      const last = execMap[p.id];
      const analysis = analysisMap[p.id];

      if (filter === 'failed') return matchesQuery && last?.status === 'FAILED';
      if (filter === 'undeclared') return matchesQuery && analysis?.has_undeclared;
      if (filter === 'validated')
        return (
          matchesQuery &&
          analysis &&
          !analysis.has_undeclared &&
          analysis.findings?.length > 0
        );
      return matchesQuery;
    });
  }, [pipelines, query, filter, execMap, analysisMap]);

  async function createPipeline(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Pipeline name is required');
      return;
    }

    setCreating(true);
    try {
      const created = await api.createPipeline({
        name: trimmed,
        description: description.trim(),
        steps: [],
      });
      toast.success(`Created pipeline "${created.name}"`);
      setName('');
      setDescription('');
      setShowCreate(false);
      navigate(`/pipelines/${created.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create pipeline');
    } finally {
      setCreating(false);
    }
  }

  async function openDemo() {
    try {
      const demo = await api.seedDemo();
      toast.success('Demo pipeline loaded');
      navigate(`/pipelines/${demo.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function openFailureDemo() {
    try {
      const demo = await api.seedFailureDemo();
      toast.success('Failure demo loaded: Missing artifact scenario');
      navigate(`/pipelines/${demo.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function analyzePipeline(id, e) {
    e?.stopPropagation?.();
    setActionBusyId(`analyze-${id}`);
    try {
      const report = await api.analyze(id);
      setAnalysisMap((prev) => ({ ...prev, [id]: report }));
      if (report.has_undeclared) {
        toast.error(`Analysis: Undeclared dependency detected in ${report.pipeline_name}`);
      } else {
        toast.success(`Analysis: All dependencies validated for ${report.pipeline_name}`);
      }
    } catch (err) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setActionBusyId(null);
    }
  }

  async function executePipeline(id, e) {
    e?.stopPropagation?.();
    setActionBusyId(`exec-${id}`);
    try {
      const result = await api.execute(id);
      setExecMap((prev) => ({ ...prev, [id]: result }));
      if (result.status === 'SUCCESS') {
        toast.success(`Execution #EXEC-${result.id} completed successfully`);
      } else {
        toast.error(`Execution #EXEC-${result.id} failed`);
      }
    } catch (err) {
      toast.error(err.message || 'Execution failed');
    } finally {
      setActionBusyId(null);
    }
  }

  async function remove(id, e) {
    e?.stopPropagation?.();
    if (!window.confirm('Delete this pipeline and all associated step history?')) return;
    try {
      await api.deletePipeline(id);
      toast.success('Pipeline deleted');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CI Pipelines"
        description="Configure, inspect, and execute reusable CI pipeline workflows without hidden coupling."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={openFailureDemo}>
              Failure Demo
            </Button>
            <Button size="sm" variant="secondary" onClick={openDemo}>
              Load Demo Pipeline
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowCreate(!showCreate)}
            >
              <Plus className="h-4 w-4" />
              New Pipeline
            </Button>
          </>
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {/* CREATE PIPELINE MODAL / FORM */}
      {showCreate && (
        <form
          onSubmit={createPipeline}
          className="card border-emerald-500/30 p-5 bg-surface/90 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="mb-4 flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-ink">Create New CI Pipeline</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-muted hover:text-ink cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Pipeline Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Build-Test-Deploy or Microservice CI"
                className="focus-ring h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Description (Optional)
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Reusable pipeline steps verifying artifact coupling"
                className="focus-ring h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={creating || !name.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? 'Creating…' : 'Create Pipeline'}
            </Button>
          </div>
        </form>
      )}

      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pipelines by name or description..."
            className="focus-ring h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-xs text-ink"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Tabs */}
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'validated', label: 'Validated' },
              { id: 'undeclared', label: 'Undeclared' },
              { id: 'failed', label: 'Failed' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                  filter === f.id
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle (Cards vs Table) */}
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-line text-ink'
                  : 'text-muted hover:text-ink'
              }`}
              title="Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-line text-ink'
                  : 'text-muted hover:text-ink'
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* PIPELINE LIST */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No pipelines match your query"
          description="Create a new custom pipeline or initialize the demo scenario."
          action={
            <Button variant="primary" size="sm" onClick={openDemo}>
              Load Demo Pipeline
            </Button>
          }
        />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1.5fr_120px_140px_140px_220px] gap-3 border-b border-line bg-canvas px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <div>Pipeline</div>
            <div>Analysis</div>
            <div>Last Run</div>
            <div>Steps Flow</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-line">
            {filtered.map((p) => {
              const detail = details[p.id];
              const last = execMap[p.id];
              const analysis = analysisMap[p.id];
              const isBusyAnalyze = actionBusyId === `analyze-${p.id}`;
              const isBusyExec = actionBusyId === `exec-${p.id}`;

              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1.5fr_120px_140px_140px_220px] items-center gap-3 px-4 py-3 text-xs hover:bg-surface-hover transition"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/pipelines/${p.id}`}
                      className="font-semibold text-ink hover:text-emerald-600 dark:hover:text-emerald-400 truncate block"
                    >
                      {p.name}
                    </Link>
                    <div className="text-[11px] text-muted truncate">
                      {p.description || 'No description provided'}
                    </div>
                  </div>

                  <div>
                    {analysis?.has_undeclared ? (
                      <StatusBadge status="UNDECLARED" size="xs" />
                    ) : analysis ? (
                      <StatusBadge status="VALIDATED" size="xs" />
                    ) : (
                      <StatusBadge status="PENDING" label="Unchecked" size="xs" />
                    )}
                  </div>

                  <div>
                    {last ? (
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={last.status} size="xs" />
                        <span className="text-[11px] text-muted">
                          {formatRelativeTime(last.started_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted text-[11px]">Never run</span>
                    )}
                  </div>

                  <div className="truncate font-mono text-[11px] text-muted">
                    {stepFlowLabel(detail?.steps)}
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={(e) => analyzePipeline(p.id, e)}
                      disabled={isBusyAnalyze || (detail?.steps || []).length === 0}
                      title="Analyze Dependencies"
                    >
                      <Network className="h-3 w-3" />
                      {isBusyAnalyze ? '…' : 'Analyze'}
                    </Button>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={(e) => executePipeline(p.id, e)}
                      disabled={isBusyExec || (detail?.steps || []).length === 0}
                      title="Execute Pipeline"
                    >
                      <Play className="h-3 w-3" />
                      {isBusyExec ? '…' : 'Execute'}
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => navigate(`/pipelines/${p.id}`)}
                    >
                      Open
                    </Button>
                    <Button
                      size="xs"
                      variant="danger"
                      onClick={(e) => remove(p.id, e)}
                      title="Delete Pipeline"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((p) => {
            const detail = details[p.id];
            const last = execMap[p.id];
            const analysis = analysisMap[p.id];
            const isBusyAnalyze = actionBusyId === `analyze-${p.id}`;
            const isBusyExec = actionBusyId === `exec-${p.id}`;

            return (
              <article
                key={p.id}
                className="card group p-5 transition hover:border-emerald-500/40 hover:shadow-sm"
              >
                {/* Top header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/pipelines/${p.id}`}
                        className="text-base font-bold text-ink hover:text-emerald-600 dark:hover:text-emerald-400 truncate"
                      >
                        {p.name}
                      </Link>
                      <span className="rounded bg-line px-1.5 py-0.2 text-[10px] font-mono text-muted">
                        #{p.id}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted line-clamp-2">
                      {p.description || 'Continuous Integration workflow'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {analysis?.has_undeclared ? (
                      <StatusBadge status="UNDECLARED" size="xs" />
                    ) : analysis ? (
                      <StatusBadge status="VALIDATED" size="xs" />
                    ) : last ? (
                      <StatusBadge status={last.status} size="xs" />
                    ) : (
                      <StatusBadge status="PENDING" label="Ready" size="xs" />
                    )}
                  </div>
                </div>

                {/* Step Flow Preview */}
                <div className="mb-4 rounded-lg border border-line bg-canvas/70 px-3 py-2 font-mono text-[11px] text-ink flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate">{stepFlowLabel(detail?.steps)}</span>
                </div>

                {/* Card Footer with Details & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                  <div className="flex items-center gap-3 text-muted text-[11px]">
                    <span className="font-semibold text-ink">
                      {detail?.steps?.length || p.step_count || 0} steps
                    </span>
                    <span>·</span>
                    <span>
                      {last
                        ? `Last run: ${formatRelativeTime(last.started_at)}`
                        : 'Never executed'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={(e) => analyzePipeline(p.id, e)}
                      disabled={isBusyAnalyze || (detail?.steps || []).length === 0}
                      title="Run dependency analyzer"
                    >
                      <Network className="h-3 w-3" />
                      {isBusyAnalyze ? '…' : 'Analyze'}
                    </Button>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={(e) => executePipeline(p.id, e)}
                      disabled={isBusyExec || (detail?.steps || []).length === 0}
                      title="Run pipeline sequentially"
                    >
                      <Play className="h-3 w-3" />
                      {isBusyExec ? '…' : 'Execute'}
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => navigate(`/pipelines/${p.id}`)}
                    >
                      Open
                    </Button>
                    <Button
                      size="xs"
                      variant="danger"
                      onClick={(e) => remove(p.id, e)}
                      title="Delete pipeline"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
