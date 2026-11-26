/** Shared formatting & validation helpers for the UI. */

export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function greetingForNow(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatRelativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return '—';
  const ms = new Date(endIso) - new Date(startIso);
  if (Number.isNaN(ms) || ms < 0) return '—';
  const totalSec = Math.max(1, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function listToCsv(list) {
  return (list || []).join(', ');
}

export function csvToList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stepFlowLabel(steps) {
  if (!steps?.length) return 'No steps configured';
  return [...steps]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map((s) => s.name)
    .join(' → ');
}

export function normalizeArtifact(path) {
  return (path || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Form validation for pipeline steps (Phase C) */
export function validateStepForm(form, existingSteps = [], editingId = null) {
  const errors = {};
  const trimmedName = (form.name || '').trim();

  if (!trimmedName) {
    errors.name = 'Step name is required.';
  } else {
    const isDuplicate = existingSteps.some(
      (s) => s.id !== editingId && s.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) {
      errors.name = `A step named "${trimmedName}" already exists in this pipeline.`;
    }
  }

  const trimmedCommand = (form.command || '').trim();
  if (!trimmedCommand) {
    errors.command = 'Execution command is required (e.g. build or test script).';
  }

  const declaredList = Array.isArray(form.declared_dependencies)
    ? form.declared_dependencies
    : csvToList(form.declared_dependencies);

  if (trimmedName && declaredList.includes(trimmedName)) {
    errors.declared_dependencies = 'A step cannot declare a dependency on itself.';
  }

  const otherStepNames = new Set(
    existingSteps
      .filter((s) => s.id !== editingId)
      .map((s) => s.name.trim().toLowerCase()),
  );

  const unknownDeps = declaredList.filter(
    (d) => d && !otherStepNames.has(d.trim().toLowerCase()),
  );
  if (unknownDeps.length > 0) {
    errors.declared_warnings = `Referenced step(s) not currently in pipeline: ${unknownDeps.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).filter((k) => k !== 'declared_warnings').length === 0,
    errors,
  };
}

export const STEP_TEMPLATES = [
  {
    name: 'Build',
    description: 'Compile and package application artifacts',
    inputs: '',
    outputs: 'build/app.jar',
    accesses: '',
    command: 'javac App.java && jar cf build/app.jar App.class',
  },
  {
    name: 'Test',
    description: 'Run automated tests against build outputs',
    inputs: 'build/app.jar',
    outputs: 'test/report.xml',
    accesses: 'build/app.jar',
    command: 'java -jar build/app.jar --test',
  },
  {
    name: 'Package',
    description: 'Assemble a distributable package',
    inputs: 'build/app.jar',
    outputs: 'dist/app.zip',
    accesses: 'build/app.jar',
    command: 'zip dist/app.zip build/app.jar',
  },
  {
    name: 'Docker Build',
    description: 'Build a container image from artifacts',
    inputs: 'build/app.jar',
    outputs: 'image:latest',
    accesses: 'build/app.jar',
    command: 'docker build -t app:latest .',
  },
  {
    name: 'Deploy',
    description: 'Publish verified artifacts to a target environment',
    inputs: 'build/app.jar',
    outputs: 'deploy/url.txt',
    accesses: 'build/app.jar',
    command: 'cp build/app.jar /deploy/app.jar',
  },
];
