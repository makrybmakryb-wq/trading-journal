import { useMemo, useState } from 'react'
import type { Trade } from '../../shared/types'
import { filterByRange, periodRange, type PeriodKey } from '../../shared/stats'

const LABELS: [PeriodKey, string][] = [
  ['today', 'Aujourd’hui'],
  ['week', 'Cette semaine'],
  ['month', 'Ce mois-ci'],
  ['year', 'Cette année'],
  ['custom', 'Personnalisée'],
  ['all', 'Tout l’historique'],
]

/** État du filtre de période + trades filtrés. */
export function usePeriod(trades: Trade[], initial: PeriodKey = 'all') {
  const [key, setKey] = useState<PeriodKey>(initial)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const range = useMemo(() => periodRange(key, new Date(), { from, to }), [key, from, to])
  const filtered = useMemo(() => filterByRange(trades, range.from, range.to), [trades, range])
  return { key, setKey, from, setFrom, to, setTo, range, filtered }
}

export function PeriodFilter({ p }: { p: ReturnType<typeof usePeriod> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1">
        {LABELS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => p.setKey(k)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${p.key === k ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {p.key === 'custom' && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <input type="date" className="field !w-auto" value={p.from} max={p.to || undefined} onChange={(e) => p.setFrom(e.target.value)} aria-label="Du" />
          <span>→</span>
          <input type="date" className="field !w-auto" value={p.to} min={p.from || undefined} onChange={(e) => p.setTo(e.target.value)} aria-label="Au" />
        </div>
      )}
    </div>
  )
}
