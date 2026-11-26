import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export function LoadingState({ label = 'Loading platform data…', className }) {
  return (
    <div
      className={cn(
        'flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface/50 p-8 text-center',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-muted">Please wait while CI data is synchronized</p>
      </div>
    </div>
  );
}

export function SkeletonCard({ rows = 3, className }) {
  return (
    <div
      className={cn(
        'card animate-pulse p-5 space-y-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-3 w-48 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-800/60" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, _cols = 4 }) {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-10 border-b border-line bg-slate-100/50 dark:bg-slate-800/40" />
      <div className="divide-y divide-line p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface/40 p-8 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface shadow-xs text-muted">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="max-w-sm">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry, className }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-800 dark:text-rose-300',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
        <div className="min-w-0">
          <div className="font-semibold">Operation encounter issue</div>
          <div className="mt-0.5 break-words font-mono text-[11px] opacity-90">{message}</div>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-white/20 px-3 py-1 font-semibold text-rose-700 dark:text-rose-200 transition hover:bg-white/40"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}
