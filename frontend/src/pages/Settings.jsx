import { useEffect, useState } from 'react';
import {
  Cpu,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { api } from '../api';
import { Button, PageHeader } from '../components/AppShell';
import StatusBadge from '../components/StatusBadge';

export default function Settings() {
  const [apiOk, setApiOk] = useState(null);
  const [apiBase] = useState(import.meta.env.VITE_API_BASE || '/api');
  const [checking, setChecking] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ci-theme') || 'system';
  });

  function checkHealth() {
    setChecking(true);
    api
      .health()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false))
      .finally(() => setChecking(false));
  }

  useEffect(() => {
    checkHealth();
  }, []);

  function handleThemeChange(mode) {
    setTheme(mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ci-theme', 'dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ci-theme', 'light');
    } else {
      localStorage.removeItem('ci-theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Configuration"
        description="System configuration, API connectivity telemetry, and theme preferences."
      />

      <div className="grid max-w-4xl gap-5">
        {/* Visual Appearance & Theme */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-ink">Appearance & Theme</h3>
              <p className="text-xs text-muted">Select your preferred engineering dashboard theme</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                theme === 'light'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-surface'
                  : 'border-line bg-surface hover:border-emerald-500/30'
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-ink">Light Mode</div>
                <div className="text-[11px] text-muted">White with green accents</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                theme === 'dark'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-surface'
                  : 'border-line bg-surface hover:border-emerald-500/30'
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-400">
                <Moon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-ink">Dark Mode</div>
                <div className="text-[11px] text-muted">Dark gray with green accents</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('system')}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                theme === 'system'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-surface'
                  : 'border-line bg-surface hover:border-emerald-500/30'
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-line text-ink">
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-ink">System Default</div>
                <div className="text-[11px] text-muted">Matches OS preferences</div>
              </div>
            </button>
          </div>
        </section>

        {/* API Connectivity */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-ink">Backend Connectivity</h3>
              <p className="text-xs text-muted">FastAPI server connection and health verification</p>
            </div>
            <Button size="xs" variant="secondary" onClick={checkHealth} disabled={checking}>
              <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
              Test Ping
            </Button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-line bg-canvas p-3">
              <span className="font-semibold text-muted">REST Endpoint</span>
              <span className="font-mono text-ink text-[11px]">{apiBase}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-canvas p-3">
              <span className="font-semibold text-muted">Server Status</span>
              <StatusBadge
                status={apiOk === false ? 'FAILED' : apiOk ? 'SUCCESS' : 'RUNNING'}
                label={apiOk === false ? 'Offline' : apiOk ? 'Connected & Operational' : 'Checking…'}
                size="xs"
              />
            </div>
          </div>
        </section>

        {/* Project Specification */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-ink">System Specifications</h3>
              <p className="text-xs text-muted">Continuous Integration Pipeline Step Reuse Without Hidden Coupling</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              Enterprise Ready
            </span>
          </div>

          <dl className="grid gap-2 text-xs">
            <div className="flex justify-between rounded-lg bg-canvas p-2.5">
              <dt className="text-muted font-medium">Project Title</dt>
              <dd className="font-semibold text-ink text-right">
                Continuous Integration Pipeline Step Reuse Without Hidden Coupling
              </dd>
            </div>
            <div className="flex justify-between rounded-lg bg-canvas p-2.5">
              <dt className="text-muted font-medium">Core Problem Solved</dt>
              <dd className="font-medium text-ink text-right max-w-md">
                Detecting undeclared cross-step dependencies where reusable steps read artifacts without formal contract declaration.
              </dd>
            </div>
            <div className="flex justify-between rounded-lg bg-canvas p-2.5">
              <dt className="text-muted font-medium">Architecture Guarantee</dt>
              <dd className="font-mono text-emerald-600 dark:text-emerald-400 text-right">
                Steps → Inputs/Outputs → Static Dependency Analyzer → Validated Execution
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
