import type { Toast } from '../../state/toastContext'

export function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast__message">{toast.message}</span>
      <button type="button" className="toast__close" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  )
}
