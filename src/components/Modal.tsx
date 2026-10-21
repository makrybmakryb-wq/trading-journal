import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

const SIZES = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' }

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
  zIndex = 50,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: keyof typeof SIZES
  zIndex?: number
}) {
  // Échap ferme la fenêtre ; on bloque le défilement de la page derrière
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" style={{ zIndex }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`card flex max-h-[94vh] w-full flex-col rounded-b-none shadow-2xl sm:rounded-b-xl ${SIZES[size]}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
