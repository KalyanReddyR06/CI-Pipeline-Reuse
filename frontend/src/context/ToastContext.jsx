import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur transition',
              toast.type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
              toast.type === 'error' && 'border-red-200 bg-red-50 text-red-900',
              toast.type === 'info' && 'border-slate-200 bg-white text-slate-800',
            )}
          >
            {toast.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {toast.type === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {toast.type === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              className="rounded p-0.5 hover:bg-black/5"
              onClick={() => dismiss(toast.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
