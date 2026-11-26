import {
  ArrowDown,
  Box,
  GitBranch,
  Hash,
  Layers,
} from 'lucide-react';
import { cn } from '../lib/utils';
import StatusBadge from './StatusBadge';

function stepVisualStatus(step, analysisByStep) {
  const finding = analysisByStep?.[step.name];
  if (finding === 'UNDECLARED') {
    return { label: 'UNDECLARED', status: 'UNDECLARED' };
  }
  if (finding === 'VALIDATED') {
    return { label: 'VALIDATED', status: 'VALIDATED' };
  }
  if ((step.declared_dependencies || []).length > 0) {
    return { label: 'DECLARED', status: 'SUCCESS' };
  }
  return { label: 'ISOLATED', status: 'PENDING' };
}

export default function PipelineGraph({ steps, selectedId, onSelect, analysisFindings }) {
  const ordered = [...(steps || [])].sort((a, b) => a.order - b.order || a.id - b.id);

  const analysisByStep = {};
  for (const f of analysisFindings || []) {
    if (f.status === 'UNDECLARED_DEPENDENCY_DETECTED') {
      analysisByStep[f.dependent_step] = 'UNDECLARED';
    } else if (
      f.status === 'DEPENDENCY_VALIDATED' &&
      analysisByStep[f.dependent_step] !== 'UNDECLARED'
    ) {
      analysisByStep[f.dependent_step] = 'VALIDATED';
    }
  }

  if (ordered.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/40 p-8 text-center">
        <Layers className="h-8 w-8 text-muted/60 mb-2" />
        <h4 className="text-sm font-semibold text-ink">No Pipeline Steps Configured</h4>
        <p className="mt-1 max-w-sm text-xs text-muted">
          Add reusable steps using the Step Library or the configuration form to visualize execution flow and artifact dependencies.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface/60 p-6">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-emerald-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Pipeline Execution Flow & Artifact Dependency Graph
          </h4>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Validated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Undeclared Coupling
          </span>
        </div>
      </div>

      <div className="mx-auto flex min-w-max flex-col items-center">
        {ordered.map((step, index) => {
          const visual = stepVisualStatus(step, analysisByStep);
          const selected = selectedId === step.id;
          const inputsList = step.inputs?.length ? step.inputs : (step.accesses || []);
          const isUndeclared = visual.status === 'UNDECLARED';

          return (
            <div key={step.id || index} className="flex flex-col items-center">
              {index > 0 && (
                <div className="flex flex-col items-center py-1 text-slate-300 dark:text-slate-700">
                  <div className="h-5 w-0.5 bg-line" />
                  <ArrowDown className="h-3.5 w-3.5 text-muted -my-0.5" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onSelect?.(step)}
                className={cn(
                  'group w-[340px] rounded-xl border p-4 text-left shadow-xs transition cursor-pointer',
                  selected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-surface'
                    : isUndeclared
                      ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-500'
                      : 'border-line bg-surface hover:border-emerald-500/40 hover:shadow-sm',
                )}
              >
                {/* Header with Step Number, Name, and Status */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                        selected
                          ? 'bg-emerald-600 text-white'
                          : isUndeclared
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-white dark:bg-slate-800',
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-sm text-ink">{step.name}</div>
                      {step.description && (
                        <div className="truncate text-[11px] text-muted">{step.description}</div>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={visual.status} label={visual.label} size="xs" />
                </div>

                {/* Input & Output Artifact Badges */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Inputs / Consumed */}
                  <div className="rounded-lg border border-line bg-canvas/60 p-2">
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <Box className="h-3 w-3 text-sky-500" /> Inputs / Access
                    </div>
                    <div className="truncate font-mono text-[11px] text-ink font-medium">
                      {inputsList.length > 0 ? inputsList.join(', ') : '—'}
                    </div>
                  </div>

                  {/* Outputs / Produced */}
                  <div className="rounded-lg border border-line bg-canvas/60 p-2">
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <Hash className="h-3 w-3 text-emerald-500" /> Outputs
                    </div>
                    <div className="truncate font-mono text-[11px] text-ink font-medium">
                      {(step.outputs || []).length > 0 ? step.outputs.join(', ') : '—'}
                    </div>
                  </div>
                </div>

                {/* Declared Dependencies & Command Preview */}
                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-line text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted min-w-0">
                    <GitBranch className="h-3 w-3 shrink-0 text-emerald-500" />
                    <span className="truncate">
                      {(step.declared_dependencies || []).length > 0
                        ? `Depends on: ${step.declared_dependencies.join(', ')}`
                        : 'No declared dependencies'}
                    </span>
                  </div>
                  {step.command && (
                    <span className="font-mono text-[10px] text-muted opacity-75 shrink-0">
                      cmd
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
