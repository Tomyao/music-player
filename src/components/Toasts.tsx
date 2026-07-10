import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

const variantStyles = {
  default: { icon: Info, ring: 'border-border' },
  success: { icon: CheckCircle2, ring: 'border-emerald-500/40' },
  error: { icon: AlertCircle, ring: 'border-red-500/40' },
} as const;

/** Fixed-position toast stack; announced politely so screen readers hear updates without interrupting. */
export function Toasts() {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6"
      aria-live="polite"
      role="status"
    >
      {toasts.map((toast) => {
        const { icon: Icon, ring } = variantStyles[toast.variant ?? 'default'];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex animate-slide-up items-center gap-2 rounded-xl border ${ring} bg-surface px-4 py-3 text-sm text-text shadow-lg`}
          >
            <Icon className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
            <span className="flex-1">{toast.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
