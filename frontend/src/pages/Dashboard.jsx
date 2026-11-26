import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Layers,
  Network,
  Play,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Workflow,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import { Button, PageHeader } from '../components/AppShell';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorBanner, SkeletonCard } from '../components/States';
import { useToast } from '../context/ToastContext';
import {
  formatDuration,
  formatRelativeTime,
} from '../lib/utils';

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [pipelineMap, setPipelineMap] = useState({});
  const [undeclaredIssues, setUndeclaredIssues] = useState(0);
  const [validatedCount, setValidatedCount] = useState(0);
  const [seeding, setSeeding] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setError('');
      const [p, e] = await Promise.all([api.listPipelines(), api.listExecutions(15)]);
      setPipelines(p);
      setExecutions(e);

      const details = await Promise.all(p.map((item) => api.getPipeline(item.id)));
      const map = {};
      details.forEach((d) => {
        map[d.id] = d;
      });
      setPipelineMap(map);

      let undeclared = 0;
      let validated = 0;
      await Promise.all(
        details.map(async (d) => {
          if (!d.steps?.length) return;
          try {
            const report = await api.analyze(d.id);
            undeclared += report.findings.filter(
              (f) => f.status === 'UNDECLARED_DEPENDENCY_DETECTED',
            ).length;
            validated += report.findings.filter(
              (f) => f.status === 'DEPENDENCY_VALIDATED',
            ).length;
          } catch {
            /* ignore analyze errors for dashboard aggregate */
          }
        }),
      );
      setUndeclaredIssues(undeclared);
      setValidatedCount(validated);
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const success = executions.filter((x) => x.status === 'SUCCESS').length;
    const failed = executions.filter((x) => x.status === 'FAILED').length;
    const totalChecks = undeclaredIssues + validatedCount;
    const healthRate =
      totalChecks === 0
        ? 100
        : Math.round((validatedCount / totalChecks) * 100);
    return { success, failed, healthRate };
  }, [executions, undeclaredIssues, validatedCount]);

  async function openDemo() {
    setSeeding(true);
    try {
      const demo = await api.seedDemo();
      toast.success('Demo pipeline loaded with undeclared coupling scenario');
      navigate(`/pipelines/${demo.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  }

  async function openFailureDemo() {
    setSeeding(true);
    try {
      const demo = await api.seedFailureDemo();
      toast.success('Failure demo loaded: Missing artifact scenario');
      navigate(`/pipelines/${demo.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      {/* Top Page Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span>CI Pipeline Step Reuse Dashboard</span>
          </span>
        }
        description="Verify and execute modular CI steps with zero hidden coupling and automated artifact dependency analysis."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={openFailureDemo}
              disabled={seeding}
            >
              <AlertOctagon className="h-3.5 w-3.5 text-rose-500" />
              <span>Failure Demo</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={openDemo}
              disabled={seeding}
            >
              <Play className="h-3.5 w-3.5" />
              {seeding ? 'Loading Demo…' : 'Load Demo Pipeline'}
            </Button>
          </>
        }
      />

      <ErrorBanner message={error} onRetry={() => load()} />

      {/* SYSTEM ARCHITECTURE & CONCEPT COMPREHENSION FLOW */}
      <section className="card overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 via-surface to-surface p-5 dark:from-emerald-950/20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-slate-950">
              <Cpu className="h-3.5 w-3.5 font-bold" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                System Architecture Flow · Core Project Concept
              </span>
            </div>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
            System Flow Overview
          </span>
        </div>

        <p className="mb-4 text-xs text-muted leading-relaxed">
          In reusable CI pipelines, steps frequently suffer from <strong className="text-ink">hidden coupling</strong> when an artifact (e.g. <code className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">build/app.jar</code>) is accessed without declaring the producer step. This system statically audits and guarantees execution integrity.
        </p>

        {/* 6-Step Visual Flow */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              step: '01',
              title: 'Pipeline Steps',
              desc: 'Modular, reusable build tasks',
              icon: Layers,
            },
            {
              step: '02',
              title: 'Inputs / Outputs',
              desc: 'Declared files & artifacts',
              icon: Boxes,
            },
            {
              step: '03',
              title: 'Dependency Analysis',
              desc: 'Cross-step artifact tracing',
              icon: Network,
            },
            {
              step: '04',
              title: 'Validated / Undeclared',
              desc: 'Zero hidden coupling check',
              icon: ShieldAlert,
              highlight: undeclaredIssues > 0 ? 'amber' : 'green',
            },
            {
              step: '05',
              title: 'Pipeline Execution',
              desc: 'Guaranteed safe execution',
              icon: Play,
            },
            {
              step: '06',
              title: 'Execution Logs',
              desc: 'Audited output & artifacts',
              icon: Terminal,
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`relative rounded-xl border p-3 text-left transition ${
                item.highlight === 'amber'
                  ? 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/5'
                  : item.highlight === 'green'
                    ? 'border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/5'
                    : 'border-line bg-surface/70'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between text-muted">
                <item.icon className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-mono text-[10px] font-bold opacity-60">
                  {item.step}
                </span>
              </div>
              <div className="text-xs font-semibold text-ink">{item.title}</div>
              <div className="mt-0.5 text-[10px] text-muted line-clamp-2 leading-tight">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* KPI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Workflow}
          label="Total Pipelines"
          value={pipelines.length}
          hint="Reusable CI workflows configured"
          tone="emerald"
        />
        <StatCard
          icon={CheckCircle2}
          label="Successful Runs"
          value={stats.success}
          hint="Verified pipeline runs"
          tone="green"
        />
        <StatCard
          icon={XCircle}
          label="Failed Runs"
          value={stats.failed}
          hint="Faulty runs or coupling errors"
          tone="rose"
        />
        <StatCard
          icon={ShieldAlert}
          label="Undeclared Couplings"
          value={undeclaredIssues}
          hint={
            undeclaredIssues > 0
              ? 'Action required: undeclared artifact access'
              : 'All dependencies properly declared'
          }
          tone={undeclaredIssues > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* RECENT EXECUTIONS & DEPENDENCY HEALTH */}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* Recent Executions Section */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Recent Executions</h3>
              <p className="text-xs text-muted">Audit trail of pipeline runs across the platform</p>
            </div>
            <Link
              to="/executions"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {executions.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No executions recorded"
              description="Run a pipeline or seed the demo to view execution telemetry."
              action={
                <Button size="sm" variant="primary" onClick={openDemo}>
                  Load Demo Pipeline
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {executions.slice(0, 5).map((ex) => {
                const pipe = pipelineMap[ex.pipeline_id];
                return (
                  <div
                    key={ex.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">
                        {pipe?.name || `Pipeline #${ex.pipeline_id}`}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span className="font-mono">#EXEC-{ex.id}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(ex.started_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={ex.status} size="xs" />
                      <span className="w-16 text-right font-mono text-xs text-muted">
                        {formatDuration(ex.started_at, ex.finished_at)}
                      </span>
                      <Link
                        to={`/executions/${ex.id}`}
                        className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-emerald-500 transition"
                      >
                        Logs
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Dependency Health Gauge */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Coupling Health</h3>
              <p className="text-xs text-muted">Zero hidden coupling verification</p>
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => navigate('/dependencies')}
            >
              <Network className="h-3 w-3" /> Analysis
            </Button>
          </div>

          <div className="flex items-center gap-6 py-2">
            <HealthRing value={stats.healthRate} />
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-muted">Validated Dependencies</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {validatedCount}
                </div>
              </div>
              <div>
                <div className="text-muted">Undeclared Couplings</div>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {undeclaredIssues}
                </div>
              </div>
              <div className="pt-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    undeclaredIssues === 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {undeclaredIssues === 0 ? 'Coupling Free' : 'Coupling Detected'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* QUICK LAUNCH ACTIONS */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Quick Launch Actions</h3>
          <span className="text-xs text-muted font-mono">Continuous Integration Pipeline Step Reuse</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={openDemo}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface/50 p-4 text-left transition hover:border-emerald-500/40 hover:bg-surface cursor-pointer"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Play className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">1. Load Demo Pipeline</div>
              <div className="mt-0.5 text-[11px] text-muted">
                Loads the demonstration scenario with Build, Test, and Deploy steps.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dependencies')}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface/50 p-4 text-left transition hover:border-emerald-500/40 hover:bg-surface cursor-pointer"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">2. Analyze Coupling</div>
              <div className="mt-0.5 text-[11px] text-muted">
                Inspect cross-step artifact accesses and validate against declared dependencies.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/pipelines')}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface/50 p-4 text-left transition hover:border-emerald-500/40 hover:bg-surface cursor-pointer"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Workflow className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">3. Pipeline Builder</div>
              <div className="mt-0.5 text-[11px] text-muted">
                Build custom CI pipelines, reorder steps, and configure artifact input/outputs.
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  };

  return (
    <div className="card p-4 transition hover:border-emerald-500/40">
      <div className="mb-3 flex items-center justify-between">
        <div className={`rounded-lg border p-2 ${tones[tone] || tones.emerald}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
          Metric
        </span>
      </div>
      <div className="text-3xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-xs font-semibold text-ink">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted truncate">{hint}</div>
    </div>
  );
}

function HealthRing({ value }) {
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={value === 100 ? '#10b981' : '#f59e0b'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-ink">
        <span className="text-base">{value}%</span>
        <span className="text-[9px] text-muted uppercase tracking-wider">Health</span>
      </div>
    </div>
  );
}
