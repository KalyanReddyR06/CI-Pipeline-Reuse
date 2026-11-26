import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Search,
  Terminal,
} from 'lucide-react';
import { api } from '../api';
import { Button, PageHeader } from '../components/AppShell';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorBanner, SkeletonCard } from '../components/States';
import { useToast } from '../context/ToastContext';
import { formatDuration, formatRelativeTime } from '../lib/utils';

export default function Executions() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [executions, setExecutions] = useState([]);
  const [pipelines, setPipelines] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [seeding, setSeeding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setError('');
      const [execs, pipes] = await Promise.all([
        api.listExecutions(60),
        api.listPipelines(),
      ]);
      const map = {};
      pipes.forEach((p) => {
        map[p.id] = p;
      });
      setPipelines(map);
      setExecutions(execs);
    } catch (err) {
      setError(err.message || 'Failed to load execution logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSeedFailureDemo() {
    try {
      setSeeding(true);
      const pipe = await api.seedFailureDemo();
      toast.success(`Loaded failure demo: "${pipe.name}". Running execution...`);
      const exec = await api.execute(pipe.id);
      navigate(`/executions/${exec.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to seed failure demo');
    } finally {
      setSeeding(false);
    }
  }

  // Filter calculations
  const totalCount = executions.length;
  const successCount = executions.filter((e) => e.status === 'SUCCESS').length;
  const failedCount = executions.filter((e) => e.status === 'FAILED').length;
  const successRate =
    totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  const filtered = executions.filter((ex) => {
    const name = pipelines[ex.pipeline_id]?.name || '';
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q || name.toLowerCase().includes(q) || String(ex.id).includes(q);
    const matchesStatus =
      statusFilter === 'ALL' || ex.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <SkeletonCard rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Execution Audit & Simulator"
        description="Historical log of pipeline runs, step execution statuses, durations, and artifact verification."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSeedFailureDemo}
            disabled={seeding}
          >
            <AlertOctagon className="h-3.5 w-3.5 text-rose-500" />
            <span>Test Failure Scenario Demo</span>
          </Button>
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Total Executions
            </div>
            <div className="text-2xl font-black text-ink mt-1">{totalCount}</div>
          </div>
          <Activity className="h-6 w-6 text-muted/60" />
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Success Rate
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {successRate}%
            </div>
          </div>
          <CheckCircle2 className="h-6 w-6 text-emerald-500/60" />
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Failed / Halted Runs
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {failedCount}
            </div>
          </div>
          <AlertOctagon className="h-6 w-6 text-rose-500/60" />
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-canvas p-1 text-xs">
          {[
            { id: 'ALL', label: 'All', count: totalCount },
            { id: 'SUCCESS', label: 'Passed', count: successCount },
            { id: 'FAILED', label: 'Failed', count: failedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-surface text-ink shadow-xs font-bold border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded bg-canvas px-1.5 py-0.2 text-[10px] font-mono text-muted">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative max-w-xs w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or ID..."
            className="focus-ring h-8 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-xs text-ink"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No matching executions"
          description="No execution matches the active filter or search criteria."
          action={
            <Button variant="secondary" size="sm" onClick={() => { setQuery(''); setStatusFilter('ALL'); }}>
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1.5fr_120px_120px_140px_120px] gap-3 border-b border-line bg-canvas px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <div>Pipeline</div>
            <div>Status</div>
            <div>Duration</div>
            <div>Executed</div>
            <div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-line">
            {filtered.map((ex) => (
              <div
                key={ex.id}
                className="grid grid-cols-[1.5fr_120px_120px_140px_120px] items-center gap-3 px-4 py-3 text-xs hover:bg-surface-hover transition"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">
                    {pipelines[ex.pipeline_id]?.name || `Pipeline #${ex.pipeline_id}`}
                  </div>
                  <div className="font-mono text-[11px] text-muted">#EXEC-{ex.id}</div>
                </div>

                <div>
                  <StatusBadge status={ex.status} size="xs" />
                </div>

                <div className="font-mono text-muted flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted" />
                  {formatDuration(ex.started_at, ex.finished_at)}
                </div>

                <div className="text-muted text-[11px]">
                  {formatRelativeTime(ex.started_at)}
                </div>

                <div className="text-right">
                  <Link
                    to={`/executions/${ex.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  >
                    <Terminal className="h-3 w-3" /> Audit Flow
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
