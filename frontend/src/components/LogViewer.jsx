import { useMemo, useState } from 'react';
import { Check, Copy, Filter, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

export default function LogViewer({ logs = [], title = '$ pipeline execute' }) {
  const [copied, setCopied] = useState(false);
  const [stepFilter, setStepFilter] = useState('all');

  const steps = useMemo(() => {
    const set = new Set();
    logs.forEach((l) => {
      if (l.step_name) set.add(l.step_name);
    });
    return [...set];
  }, [logs]);

  const filtered =
    stepFilter === 'all' ? logs : logs.filter((l) => l.step_name === stepFilter);

  async function copyLogs() {
    const text = filtered
      .map((l) => {
        const time = l.created_at ? new Date(l.created_at).toLocaleTimeString() : '';
        const step = l.step_name ? `[${l.step_name}]` : '[pipeline]';
        const level = (l.level || 'INFO').toUpperCase();
        return `${time} ${level} ${step} ${l.message}`;
      })
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#090e17] shadow-md font-mono text-xs">
      {/* Console Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0c1320] px-4 py-2.5">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="font-semibold text-[11px] tracking-wide">{title}</span>
          <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-slate-400">
            {filtered.length} line{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Step Filter Dropdown */}
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <select
              value={stepFilter}
              onChange={(e) => setStepFilter(e.target.value)}
              className="h-7 appearance-none rounded-md border border-white/10 bg-white/5 pl-8 pr-7 text-[11px] text-slate-200 outline-none hover:bg-white/10"
            >
              <option value="all" className="bg-slate-900">
                All Steps
              </option>
              {steps.map((s) => (
                <option key={s} value={s} className="bg-slate-900">
                  Step: {s}
                </option>
              ))}
            </select>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={copyLogs}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-slate-400" />
                <span>Copy Logs</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="max-h-[460px] overflow-auto p-4 leading-6 text-[12px] font-mono">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            No console output recorded for this selection.
          </div>
        ) : (
          filtered.map((log) => {
            const isError = log.level === 'error' || log.message?.includes('FAILED');
            const isSuccess = log.level === 'success' || log.message?.includes('SUCCESS');
            return (
              <div
                key={log.id}
                className={cn(
                  'grid grid-cols-[80px_100px_1fr] gap-3 border-b border-white/5 py-1 hover:bg-white/5 transition',
                  isError
                    ? 'text-rose-400 font-semibold'
                    : isSuccess
                      ? 'text-emerald-300'
                      : 'text-slate-300',
                )}
              >
                <span className="text-slate-500 select-none text-[11px]">
                  {log.created_at ? new Date(log.created_at).toLocaleTimeString() : '--:--:--'}
                </span>
                <span className="truncate text-slate-400 font-medium">
                  {log.step_name ? `[${log.step_name}]` : '[pipeline]'}
                </span>
                <span className="break-all">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
