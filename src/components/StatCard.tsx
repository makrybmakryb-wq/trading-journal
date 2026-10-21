import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

export function StatCard({
  label,
  value,
  sub,
  color = '',
  formula,
  onClick,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  color?: string
  /** Formule affichée au survol de l'icône (i). */
  formula?: string
  onClick?: () => void
}) {
  return (
    <div className={`card group relative p-4 ${onClick ? 'cursor-pointer transition hover:border-muted/50' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
        <span>{label}</span>
        {formula && (
          <span className="relative" onClick={(e) => e.stopPropagation()}>
            <Info size={14} className="peer cursor-help opacity-60 hover:opacity-100" tabIndex={0} aria-label={`Formule : ${formula}`} />
            <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-56 rounded-lg border border-line bg-panel-2 p-2 text-[11px] normal-case leading-snug tracking-normal text-ink shadow-xl peer-hover:block peer-focus:block">
              {formula}
            </span>
          </span>
        )}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
}
