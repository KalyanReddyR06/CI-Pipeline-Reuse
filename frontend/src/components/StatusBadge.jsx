import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

const STYLES = {
  SUCCESS:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  FAILED:
    'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
  RUNNING:
    'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20',
  PENDING:
    'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
  QUEUED:
    'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
  HEALTHY:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  WARNING:
    'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',

  // Dependency Analysis specific statuses
  UNDECLARED:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold',
  UNDECLARED_DEPENDENCY_DETECTED:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold',
  VALIDATED:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-bold',
  DEPENDENCY_VALIDATED:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-bold',
  NO_DEPENDENCY:
    'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20',
};

const ICONS = {
  SUCCESS: CheckCircle2,
  FAILED: XCircle,
  RUNNING: Loader2,
  PENDING: CircleDashed,
  QUEUED: Clock,
  HEALTHY: ShieldCheck,
  WARNING: AlertTriangle,
  UNDECLARED: ShieldAlert,
  UNDECLARED_DEPENDENCY_DETECTED: ShieldAlert,
  VALIDATED: ShieldCheck,
  DEPENDENCY_VALIDATED: ShieldCheck,
  NO_DEPENDENCY: CircleDot,
};

function formatBadgeLabel(key, customLabel) {
  if (customLabel) return customLabel;
  if (key === 'UNDECLARED' || key === 'UNDECLARED_DEPENDENCY_DETECTED') return 'UNDECLARED';
  if (key === 'VALIDATED' || key === 'DEPENDENCY_VALIDATED') return 'VALIDATED';
  if (key === 'NO_DEPENDENCY') return 'NO DEPENDENCY';
  return key;
}

export default function StatusBadge({ status, label, size = 'sm', className }) {
  const key = (status || 'PENDING').toUpperCase();
  const Icon = ICONS[key] || CircleDashed;
  const displayLabel = formatBadgeLabel(key, label);

  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'md'
        ? 'px-3 py-1 text-xs'
        : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide transition',
        sizeClasses,
        STYLES[key] || STYLES.PENDING,
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', key === 'RUNNING' && 'animate-spin')} />
      <span>{displayLabel}</span>
    </span>
  );
}
