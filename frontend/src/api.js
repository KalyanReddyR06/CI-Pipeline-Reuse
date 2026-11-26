/**
 * Thin REST client for the FastAPI backend.
 * Uses Vite proxy (/api → http://127.0.0.1:8000) in development.
 */
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const detail =
      (body && body.detail) ||
      (typeof body === 'string' ? body : null) ||
      response.statusText;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return body;
}

export const api = {
  health: () => request('/health'),

  listPipelines: () => request('/pipelines'),
  getPipeline: (id) => request(`/pipelines/${id}`),
  createPipeline: (payload) =>
    request('/pipelines', { method: 'POST', body: JSON.stringify(payload) }),
  updatePipeline: (id, payload) =>
    request(`/pipelines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePipeline: (id) => request(`/pipelines/${id}`, { method: 'DELETE' }),
  seedDemo: () => request('/pipelines/seed-demo', { method: 'POST' }),
  seedFailureDemo: () => request('/pipelines/seed-failure-demo', { method: 'POST' }),

  listSteps: (pipelineId) => request(`/pipelines/${pipelineId}/steps`),
  addStep: (pipelineId, payload) =>
    request(`/pipelines/${pipelineId}/steps`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStep: (pipelineId, stepId, payload) =>
    request(`/pipelines/${pipelineId}/steps/${stepId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteStep: (pipelineId, stepId) =>
    request(`/pipelines/${pipelineId}/steps/${stepId}`, { method: 'DELETE' }),

  analyze: (pipelineId) =>
    request(`/pipelines/${pipelineId}/analyze`, { method: 'POST' }),
  execute: (pipelineId) =>
    request(`/pipelines/${pipelineId}/execute`, { method: 'POST' }),
  listPipelineExecutions: (pipelineId) =>
    request(`/pipelines/${pipelineId}/executions`),

  listExecutions: (limit = 20) => request(`/executions?limit=${limit}`),
  getExecution: (id) => request(`/executions/${id}`),
  getExecutionLogs: (id) => request(`/executions/${id}/logs`),
};
