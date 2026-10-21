import { useState } from 'react'
import { Modal } from './Modal'

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onCancel} size="sm" zIndex={70}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Annuler
        </button>
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Suppression…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
