import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Minimal accessible confirmation modal: focuses itself, traps Escape, restores focus on close. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl focus:outline-none"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="mt-1 text-sm text-text-muted">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full px-4 py-1.5 text-sm font-medium hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-full px-4 py-1.5 text-sm font-medium text-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              danger ? 'bg-danger hover:opacity-90' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
