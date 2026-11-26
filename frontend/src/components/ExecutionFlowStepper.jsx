import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Terminal,
  XCircle,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDuration } from '../lib/utils';

export default function ExecutionFlowStepper({
  stepExecutions = [],
  pipelineSteps = [],
  selectedStep = 'all',
  onSelectStep = () => {},
  activeStepName = null,
}) {
  // Merge step execution info with pipeline step definitions (to show inputs/outputs/commands)
  const orderedSteps = [...stepExecutions].sort((a, b) => a.order - b.order);

  // Build a lookup for step metadata from pipeline steps if available
  const metaMap = {};
  pipelineSteps.forEach((s) => {
    metaMap[s.name] = s;
  });

  return (
    <div className="card p-5 space-y-4 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
            Step-by-Step Execution Flow
          </h3>
          <span className="text-[11px] text-muted">
            ({orderedSteps.length} Sequential Step{orderedSteps.length === 1 ? '' : 's'})
          </span>
        </div>

        {activeStepName && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Currently Executing: <strong>{activeStepName}</strong></span>
          </div>
        )}
      </div>

      {/* Stepper Grid */}
      <div className="grid gap-3 md:grid-cols-3">
        {orderedSteps.map((se, idx) => {
          const isSelected = selectedStep === se.step_name;
          const isRunning = se.status === 'RUNNING' || activeStepName === se.step_name;
          const isSuccess = se.status === 'SUCCESS';
          const isFailed = se.status === 'FAILED';
          const isPending = se.status === 'PENDING';

          const meta = metaMap[se.step_name] || {};
          const outputs = meta.outputs || [];
          const accesses = meta.accesses || [];
          const command = meta.command || '';

          return (
            <div key={se.id || idx} className="relative flex flex-col">
              <button
                type="button"
                onClick={() => onSelectStep(se.step_name)}
                className={`flex-1 rounded-xl border p-4 text-left transition cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5'
                    : isFailed
                      ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/70'
                      : isSuccess
                        ? 'border-emerald-500/30 bg-surface hover:border-emerald-500/60'
                        : isRunning
                          ? 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-500/5 animate-pulse'
                          : 'border-line/70 bg-canvas/60 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Step Header */}
                <div className="flex items-start justify-between gap-2 border-b border-line/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSuccess
                          ? 'bg-emerald-500 text-white'
                          : isFailed
                            ? 'bg-rose-500 text-white animate-bounce'
                            : isRunning
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isSuccess ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isFailed ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : isRunning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <div>
                      <div className="font-bold text-ink text-sm truncate max-w-[130px]">
                        {se.step_name}
                      </div>
                      <div className="text-[10px] text-muted font-mono">
                        {formatDuration(se.started_at, se.finished_at)}
                      </div>
                    </div>
                  </div>

                  <StatusBadge status={se.status} size="xs" />
                </div>

                {/* Step Body */}
                <div className="mt-3 space-y-2 text-xs">
                  {/* Command preview */}
                  {command && (
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted truncate rounded bg-canvas px-2 py-1 border border-line/50">
                      <Terminal className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">{command}</span>
                    </div>
                  )}

                  {/* Required/Accesses Artifacts */}
                  {accesses.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                        Requires:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {accesses.map((art, aIdx) => (
                          <span
                            key={aIdx}
                            className={`rounded px-1.5 py-0.2 font-mono text-[10px] ${
                              isFailed
                                ? 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                : 'border border-line bg-canvas text-ink'
                            }`}
                          >
                            {art}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outputs Produced */}
                  {outputs.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block flex items-center gap-1">
                        <Boxes className="h-3 w-3 text-emerald-500" /> Produces:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {outputs.map((art, oIdx) => (
                          <span
                            key={oIdx}
                            className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                          >
                            +{art}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message or failure reason */}
                  {se.message && (
                    <div
                      className={`rounded-md p-2 text-[11px] leading-snug font-sans ${
                        isFailed
                          ? 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium'
                          : isSuccess
                            ? 'border border-emerald-500/20 bg-emerald-500/5 text-muted'
                            : 'border border-line bg-canvas text-muted'
                      }`}
                    >
                      {isFailed && (
                        <div className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 mb-0.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>Step Error</span>
                        </div>
                      )}
                      <span>{se.message}</span>
                    </div>
                  )}

                  {isPending && !se.message && (
                    <div className="rounded-md border border-line bg-canvas/40 p-2 text-[10px] text-muted italic">
                      Halted / Waiting. Not executed due to earlier step outcome.
                    </div>
                  )}
                </div>

                {/* Filter click helper */}
                <div className="mt-3 pt-2 border-t border-line/40 text-[10px] text-muted flex items-center justify-between">
                  <span>{isSelected ? 'Viewing step logs' : 'Click to inspect logs'}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </div>
              </button>

              {/* Connecting arrow to next step (on large screens) */}
              {idx < orderedSteps.length - 1 && (
                <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-muted">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border shadow-xs ${
                      isSuccess
                        ? 'border-emerald-500 bg-surface text-emerald-500'
                        : isFailed
                          ? 'border-rose-500 bg-surface text-rose-500'
                          : 'border-line bg-surface text-muted'
                    }`}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
