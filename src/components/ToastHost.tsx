import { useStore } from '@/store';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  const icon = {
    success: <CheckCircle2 size={18} className="text-success-600" />,
    error: <AlertCircle size={18} className="text-error-600" />,
    info: <Info size={18} className="text-secondary-600" />,
    warning: <AlertTriangle size={18} className="text-warning-600" />,
  };
  const border = {
    success: 'border-success-200', error: 'border-error-200',
    info: 'border-secondary-200', warning: 'border-warning-200',
  };

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`card border ${border[t.type]} px-4 py-3 flex items-center gap-3 animate-slide-up shadow-pop`}
        >
          {icon[t.type]}
          <p className="text-sm font-medium text-ink-700 flex-1">{t.text}</p>
          <button onClick={() => dismissToast(t.id)} className="text-ink-400 hover:text-ink-600">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
