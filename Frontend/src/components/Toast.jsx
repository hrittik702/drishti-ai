import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 w-[calc(100vw-32px)] sm:w-auto sm:max-w-sm left-4 sm:left-auto pointer-events-none">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start space-x-3 p-3.5 sm:p-4 rounded-xl shadow-lg border transition-all duration-200 ${
              isSuccess ? 'bg-white border-emerald-200 text-slate-800' :
              isError ? 'bg-white border-red-300 text-slate-800' :
              isWarning ? 'bg-white border-amber-300 text-slate-800' :
              'bg-white border-blue-200 text-slate-800'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {isError && <XCircle className="w-5 h-5 text-red-600" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-blue-600" />}
            </div>

            <div className="flex-1 min-w-0">
              {toast.title && (
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  {toast.title}
                </div>
              )}
              <div className="text-xs text-slate-600 mt-0.5 leading-snug font-normal break-words">
                {toast.message}
              </div>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-md -mr-1 -mt-1"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
