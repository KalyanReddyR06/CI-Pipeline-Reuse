import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  HelpCircle,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { cn } from '../lib/utils';
import StatusBadge from './StatusBadge';

/**
 * Visual Dependency Relationship Component (Phase D)
 * Renders: Producer ── produces ──> artifact ── consumed by ──> Consumer
 */
export function DependencyVisualFlow({ finding, className }) {
  const isUndeclared =
    finding.status === 'UNDECLARED_DEPENDENCY_DETECTED' ||
    finding.status === 'UNDECLARED_DEPENDENCY';
  const isValidated = finding.status === 'DEPENDENCY_VALIDATED';
  const isMissingProducer = !finding.source_step && Boolean(finding.resource);
  const isInvalidRef = !finding.resource && Boolean(finding.source_step);
  const isSelfAccess = finding.source_step === finding.dependent_step;

  const producerName = finding.source_step || finding.producer_step;
  const consumerName = finding.dependent_step || finding.consumer_step;
  const artifactName = finding.resource || finding.artifact;

  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 transition text-xs font-mono',
        isUndeclared
          ? 'border-amber-500/30 bg-amber-500/5'
          : isValidated
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-line bg-canvas',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Visual Flow Node 1: Producer Step */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-bold shadow-xs',
              isMissingProducer
                ? 'border-dashed border-line bg-surface text-muted'
                : 'border-line bg-surface text-ink',
            )}
          >
            <Layers className="h-3.5 w-3.5 text-emerald-500" />
            <span>{producerName || '(External Source)'}</span>
          </div>

          {/* Connection arrow 1 */}
          <div className="flex items-center gap-1 text-[10px] text-muted font-sans uppercase tracking-wider font-semibold">
            <span className="hidden sm:inline">produces</span>
            <ArrowRight className="h-3.5 w-3.5 text-emerald-500" />
          </div>

          {/* Visual Flow Node 2: Artifact Badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold text-xs',
              isUndeclared
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                : isValidated
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                  : 'border-line bg-surface text-muted',
            )}
          >
            <Box
              className={cn(
                'h-3.5 w-3.5',
                isUndeclared
                  ? 'text-amber-600 dark:text-amber-400'
                  : isValidated
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted',
              )}
            />
            <span className="break-all">{artifactName || '(no artifact)'}</span>
          </div>

          {/* Connection arrow 2 */}
          <div className="flex items-center gap-1 text-[10px] text-muted font-sans uppercase tracking-wider font-semibold">
            <span className="hidden sm:inline">consumed by</span>
            <ArrowRight
              className={cn(
                'h-3.5 w-3.5',
                isUndeclared
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-500',
              )}
            />
          </div>

          {/* Visual Flow Node 3: Consumer Step */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-bold shadow-xs',
              isUndeclared
                ? 'border-amber-500/50 bg-surface text-ink ring-1 ring-amber-500/30'
                : 'border-line bg-surface text-ink',
            )}
          >
            <Workflow className="h-3.5 w-3.5 text-sky-500" />
            <span>{consumerName}</span>
          </div>
        </div>

        {/* Status Callout Pill */}
        <div className="shrink-0">
          <StatusBadge status={finding.status} size="xs" />
        </div>
      </div>

      {/* Coupling Contract Status Sub-bar */}
      <div className="mt-2.5 pt-2 border-t border-line/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans">
        <div className="flex items-center gap-2">
          {isUndeclared ? (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Hidden Coupling: "{consumerName}" accesses "{artifactName}" without declaring "{producerName}"
            </span>
          ) : isValidated ? (
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Contract Validated: "{producerName}" declared in "{consumerName}" dependencies
            </span>
          ) : isMissingProducer ? (
            <span className="flex items-center gap-1 text-muted">
              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
              Independent / External Resource: No step in pipeline produces "{artifactName}"
            </span>
          ) : isSelfAccess ? (
            <span className="flex items-center gap-1 text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Self-Access: "{consumerName}" reads its own output
            </span>
          ) : isInvalidRef ? (
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Invalid Reference: Step "{producerName}" is declared but does not exist
            </span>
          ) : null}
        </div>

        <span className="text-muted text-[10px] font-mono">
          Severity: <strong className="uppercase text-ink">{finding.severity}</strong>
        </span>
      </div>
    </div>
  );
}
