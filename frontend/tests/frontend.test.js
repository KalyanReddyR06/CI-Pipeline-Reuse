import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('Frontend Category: Production Build Verification', () => {
  const distDir = path.join(frontendDir, 'dist');
  const indexHtml = path.join(distDir, 'index.html');
  const assetsDir = path.join(distDir, 'assets');

  assert.ok(fs.existsSync(distDir), 'dist directory must exist');
  assert.ok(fs.existsSync(indexHtml), 'dist/index.html must exist');

  const htmlContent = fs.readFileSync(indexHtml, 'utf8');
  assert.ok(htmlContent.includes('<div id="root"></div>'), 'index.html contains root div');
  assert.ok(htmlContent.includes('/assets/'), 'index.html loads bundled assets');

  const assets = fs.readdirSync(assetsDir);
  const jsBundle = assets.find((f) => f.endsWith('.js'));
  const cssBundle = assets.find((f) => f.endsWith('.css'));

  assert.ok(jsBundle, 'JavaScript production bundle exists');
  assert.ok(cssBundle, 'CSS production stylesheet exists');
});

test('Frontend Category: Main Application Routes Coverage', () => {
  const appFile = path.join(frontendDir, 'src', 'App.jsx');
  assert.ok(fs.existsSync(appFile), 'App.jsx must exist');
  const appContent = fs.readFileSync(appFile, 'utf8');

  const expectedRoutes = [
    'path="/"',
    'path="/pipelines"',
    'path="/pipelines/:id"',
    'path="/executions"',
    'path="/executions/:id"',
    'path="/dependencies"',
    'path="/settings"',
  ];

  for (const route of expectedRoutes) {
    assert.ok(
      appContent.includes(route),
      `Expected route ${route} must be declared in App.jsx`,
    );
  }

  const expectedPages = [
    'Dashboard',
    'Pipelines',
    'PipelineDetail',
    'Executions',
    'ExecutionDetail',
    'Dependencies',
    'Settings',
  ];

  for (const page of expectedPages) {
    const pagePath = path.join(frontendDir, 'src', 'pages', `${page}.jsx`);
    assert.ok(fs.existsSync(pagePath), `Page component ${page}.jsx must exist`);
  }
});

test('Frontend Category: API Client Methods & Connectivity Contracts', () => {
  const apiFile = path.join(frontendDir, 'src', 'api.js');
  assert.ok(fs.existsSync(apiFile), 'api.js must exist');
  const apiContent = fs.readFileSync(apiFile, 'utf8');

  const expectedMethods = [
    'health',
    'listPipelines',
    'getPipeline',
    'createPipeline',
    'updatePipeline',
    'deletePipeline',
    'seedDemo',
    'seedFailureDemo',
    'listSteps',
    'addStep',
    'updateStep',
    'deleteStep',
    'analyze',
    'execute',
    'listPipelineExecutions',
    'listExecutions',
    'getExecution',
    'getExecutionLogs',
  ];

  for (const method of expectedMethods) {
    assert.ok(
      apiContent.includes(`${method}:`),
      `API client must export method '${method}'`,
    );
  }
});
