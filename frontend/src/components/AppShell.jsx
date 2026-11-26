import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Boxes,
  Cpu,
  LayoutDashboard,
  Moon,
  Network,
  Sliders,
  Sun,
  Workflow,
} from 'lucide-react';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pipelines', label: 'Pipelines', icon: Workflow },
  { to: '/dependencies', label: 'Dependency Analysis', icon: Network },
  { to: '/executions', label: 'Executions', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Sliders },
];

function titleFromPath(pathname) {
  if (pathname === '/') return 'Overview & Analytics';
  if (pathname.startsWith('/pipelines/')) return 'Pipeline Workspace';
  if (pathname.startsWith('/pipelines')) return 'CI Pipelines';
  if (pathname.startsWith('/executions/')) return 'Execution Audit';
  if (pathname.startsWith('/executions')) return 'Execution History';
  if (pathname.startsWith('/dependencies')) return 'Cross-Step Coupling Analyzer';
  return 'CI Pipeline Reuse';
}

function breadcrumbs(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Dashboard', to: '/' }];
  const crumbs = [{ label: 'Home', to: '/' }];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({
      label: part.match(/^\d+$/) ? `Pipeline #${part}` : part.replace(/-/g, ' '),
      to: acc,
    });
  }
  return crumbs;
}

export default function AppShell({ apiOk }) {
  const location = useLocation();
  const navigate = useNavigate();
  const title = titleFromPath(location.pathname);
  const crumbs = breadcrumbs(location.pathname);

  // Dark mode state management
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('ci-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ci-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ci-theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      {/* Sidebar Navigation */}
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] text-slate-300">
        <div className="flex items-center gap-3 border-b border-[var(--color-sidebar-border)] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-xs">
            <Boxes className="h-5 w-5 font-bold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tracking-tight text-white">
              CI Step Reuse
            </div>
            <div className="truncate text-[11px] text-emerald-400/90 font-mono">
              Zero Hidden Coupling
            </div>
          </div>
        </div>

        {/* System Edition Badge */}
        <div className="px-4 pt-3 pb-1">
          <div className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="font-medium text-slate-300">CI Engine</span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300">
              v1.0.0
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 px-3 py-3">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Platform Navigation
          </div>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 shadow-xs border border-emerald-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0 transition group-hover:scale-105" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Quick Concept Hint */}
        <div className="px-4 py-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-300">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> Core Thesis
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Steps are safely reusable without hidden coupling when declared dependencies match actual artifact access.
            </p>
          </div>
        </div>

        {/* System Health Status */}
        <div className="border-t border-[var(--color-sidebar-border)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  apiOk === false
                    ? 'bg-rose-500 ring-2 ring-rose-500/30'
                    : 'bg-emerald-400 ring-2 ring-emerald-400/30 animate-pulse',
                )}
              />
              <span className="font-mono text-[11px]">
                {apiOk === false ? 'Backend Offline' : 'API Operational'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-amber-300" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div className="min-w-0">
              <div className="mb-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                {crumbs.map((c, i) => (
                  <span key={c.to} className="flex items-center gap-1">
                    {i > 0 && <span className="opacity-40">/</span>}
                    <span className={i === crumbs.length - 1 ? 'font-medium text-ink' : ''}>
                      {c.label}
                    </span>
                  </span>
                ))}
              </div>
              <h1 className="truncate text-base font-semibold tracking-tight text-ink">{title}</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDark(!isDark)}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:text-ink hover:border-slate-400"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate('/pipelines')}
              >
                <Workflow className="h-3.5 w-3.5" />
                Pipelines
              </Button>

              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate('/dependencies')}
              >
                <Network className="h-3.5 w-3.5" />
                Analyze Coupling
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h2>
          {badge}
        </div>
        {description && <p className="mt-1 text-xs text-muted sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  ...props
}) {
  const variants = {
    primary:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 border-transparent shadow-xs dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 font-semibold',
    secondary:
      'bg-surface text-ink border-line hover:bg-surface-hover active:bg-slate-100 dark:active:bg-slate-800',
    danger:
      'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:bg-rose-500/30',
    outline:
      'bg-transparent text-emerald-600 dark:text-emerald-400 border border-emerald-600/30 hover:bg-emerald-500/10',
    ghost:
      'bg-transparent text-muted border-transparent hover:bg-surface-hover hover:text-ink',
  };

  const sizes = {
    xs: 'h-7 px-2.5 text-xs',
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-3.5 text-sm',
    lg: 'h-10 px-4 text-sm',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition select-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
