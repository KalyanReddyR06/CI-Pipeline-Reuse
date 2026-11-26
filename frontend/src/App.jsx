
import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, Outlet } from 'react-router-dom';

import AppShell from './components/AppShell';
import { ToastProvider } from './context/ToastContext';
import { api } from './api';

import Dashboard from './pages/Dashboard';
import Pipelines from './pages/Pipelines';
import PipelineDetail from './pages/PipelineDetail';
import Executions from './pages/Executions';
import ExecutionDetail from './pages/ExecutionDetail';
import Dependencies from './pages/Dependencies';
import Settings from './pages/Settings';

function ShellWithHealth() {
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    let alive = true;

    async function ping() {
      try {
        await api.health();
        if (alive) setApiOk(true);
      } catch {
        if (alive) setApiOk(false);
      }
    }

    ping();

    const id = window.setInterval(ping, 15000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <AppShell apiOk={apiOk}>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<ShellWithHealth />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipelines" element={<Pipelines />} />
            <Route path="/pipelines/:id" element={<PipelineDetail />} />
            <Route path="/executions" element={<Executions />} />
            <Route path="/executions/:id" element={<ExecutionDetail />} />
            <Route path="/dependencies" element={<Dependencies />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
