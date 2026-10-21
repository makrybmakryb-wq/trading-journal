import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Paperclip, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { MARKETS, type Trade } from '../../shared/types'
import { useStore } from '../lib/store'
import { exportCsv } from '../lib/backup'
import { fmtDate, fmtMoney, fmtNum, fmtPct, pnlColor } from '../lib/format'
import { PeriodFilter, usePeriod } from '../components/PeriodFilter'

type SortKey = 'date' | 'asset' | 'direction' | 'strategy' | 'netResult' | 'rrRealized'

const COLS: { key: SortKey; label: string; align?: 'right'; hide?: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'asset', label: 'Actif' },
  { key: 'direction', label: 'Sens' },
  { key: 'strategy', label: 'Stratégie', hide: 'hidden md:table-cell' },
  { key: 'rrRealized', label: 'R', align: 'right', hide: 'hidden sm:table-cell' },
  { key: 'netResult', label: 'Résultat net', align: 'right' },
]

export function TradesPage() {
  const { trades, openForm, openDetail, askDelete } = useStore()
  const p = usePeriod(trades, 'all')
  const [q, setQ] = useState('')
  const [market, setMarket] = useState('')
  const [direction, setDirection] = useState('')
  const [strategy, setStrategy] = useState('')
  const [outcome, setOutcome] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })

  const strategies = useMemo(() => [...new Set(trades.map((t) => t.strategy).filter(Boolean) as string[])].sort(), [trades])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = p.filtered.filter(
      (t) =>
        (!market || t.market === market) &&
        (!direction || t.direction === direction) &&
        (!strategy || t.strategy === strategy) &&
        (!outcome || (outcome === 'win' ? t.netResult > 0 : outcome === 'loss' ? t.netResult < 0 : t.netResult === 0)) &&
        (!needle || [t.asset, t.strategy, t.setup, t.comment, t.mistakes, t.lessons, t.emotion].some((v) => v?.toLowerCase().includes(needle))),
    )
    const m = sort.dir === 'asc' ? 1 : -1
    const val = (t: Trade) => (sort.key === 'date' ? t.date + (t.entryTime ?? '') : t[sort.key] ?? (typeof t[sort.key] === 'number' ? 0 : ''))
    return list.sort((a, b) => {
      const x = val(a)
      const y = val(b)
      // les valeurs vides (null) sont toujours reléguées en fin de liste
      if (x === '' || x === null) return 1
      if (y === '' || y === null) return -1
      return (x < y ? -1 : x > y ? 1 : 0) * m
    })
  }, [p.filtered, q, market, direction, strategy, outcome, sort])

  const total = rows.reduce((s, t) => s + t.netResult, 0)
  const cur = rows[0]?.currency ?? 'EUR'
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'asset' || key === 'strategy' ? 'asc' : 'desc' }))
  const filtersOn = q || market || direction || strategy || outcome

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Journal des trades</h1>
          <p className="text-sm text-muted">
            {rows.length} trade{rows.length > 1 ? 's' : ''} · <span className={pnlColor(total)}>{fmtMoney(total, cur, true)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => exportCsv(trades)} disabled={!trades.length}>
            <Download size={15} /> CSV
          </button>
          <button className="btn btn-primary" onClick={() => openForm()}>
            <Plus size={16} /> Nouveau trade
          </button>
        </div>
      </div>

      <PeriodFilter p={p} />

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field !pl-9" placeholder="Rechercher (actif, notes…)" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field" value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Marché">
          <option value="">Tous les marchés</option>
          {MARKETS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="field" value={strategy} onChange={(e) => setStrategy(e.target.value)} aria-label="Stratégie">
          <option value="">Toutes les stratégies</option>
          {strategies.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="field" value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Sens">
          <option value="">Long et short</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <select className="field" value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Résultat">
          <option value="">Tous les résultats</option>
          <option value="win">Gagnants</option>
          <option value="loss">Perdants</option>
          <option value="be">À l’équilibre</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
              {COLS.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium ${c.align === 'right' ? 'text-right' : ''} ${c.hide ?? ''}`}>
                  <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => toggle(c.key)}>
                    {c.label}
                    {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => openDetail(t)} className="cursor-pointer border-b border-line/50 transition last:border-0 hover:bg-panel-2/60">
                <td className="whitespace-nowrap px-4 py-3">
                  {fmtDate(t.date)}
                  {t.entryTime && <span className="ml-2 text-xs text-muted">{t.entryTime}</span>}
                </td>
                <td className="px-4 py-3 font-medium">
                  {t.asset}
                  {t.screenshot && <Paperclip size={12} className="ml-1.5 inline text-muted" aria-label="Capture jointe" />}
                  <div className="text-xs font-normal text-muted">{t.market}</div>
                </td>
                <td className={`px-4 py-3 ${t.direction === 'long' ? 'text-gain' : 'text-loss'}`}>{t.direction === 'long' ? '▲ Long' : '▼ Short'}</td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">{t.strategy ?? '—'}</td>
                <td className={`hidden px-4 py-3 text-right tabular-nums sm:table-cell ${pnlColor(t.rrRealized)}`}>{t.rrRealized === null ? '—' : fmtNum(t.rrRealized, 2)}</td>
                <td className={`px-4 py-3 text-right font-medium tabular-nums ${pnlColor(t.netResult)}`}>
                  {fmtMoney(t.netResult, t.currency, true)}
                  <div className="text-xs font-normal opacity-70">{fmtPct(t.resultPct, 2, true)}</div>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <button className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-ink" aria-label="Modifier" onClick={() => openForm({ trade: t })}>
                      <Pencil size={15} />
                    </button>
                    <button className="rounded-md p-1.5 text-muted hover:bg-loss/15 hover:text-loss" aria-label="Supprimer" onClick={() => askDelete(t)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  {filtersOn || p.key !== 'all' ? 'Aucun trade ne correspond à ces filtres.' : 'Aucun trade enregistré.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
