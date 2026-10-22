import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { pad, pnlByDay, toISO } from '../../shared/stats'
import { useStore } from '../lib/store'
import { fmtDate, fmtMoney, mainCurrency, pnlColor } from '../lib/format'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function CalendarPage() {
  const { trades, openForm, openDetail } = useStore()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11
  const [selected, setSelected] = useState<string>(toISO(now))
  const cur = mainCurrency(trades)
  const today = toISO(now)

  const byDay = useMemo(() => pnlByDay(trades), [trades])

  // Grille : commence le lundi, 6 semaines max
  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const offset = (first.getDay() + 6) % 7
    const count = new Date(year, month + 1, 0).getDate()
    const out: (string | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= count; d++) out.push(`${year}-${pad(month + 1)}-${pad(d)}`)
    while (out.length % 7) out.push(null)
    return out
  }, [year, month])

  const monthPrefix = `${year}-${pad(month + 1)}`
  const monthStats = useMemo(() => {
    const days = [...byDay.values()].filter((d) => d.date.startsWith(monthPrefix))
    return { pnl: days.reduce((s, d) => s + d.pnl, 0), trades: days.reduce((s, d) => s + d.trades, 0), green: days.filter((d) => d.pnl > 0).length, red: days.filter((d) => d.pnl < 0).length }
  }, [byDay, monthPrefix])

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const dayTrades = useMemo(() => trades.filter((t) => t.date === selected).sort((a, b) => (a.entryTime ?? '').localeCompare(b.entryTime ?? '')), [trades, selected])
  const dayPnl = byDay.get(selected)?.pnl ?? 0
  const monthName = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long' })
  const years = Array.from({ length: 12 }, (_, i) => now.getFullYear() - 8 + i)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calendrier de trading</h1>
          <p className="text-sm text-muted">
            <span className="capitalize">{monthName}</span> {year} · <span className={pnlColor(monthStats.pnl)}>{fmtMoney(monthStats.pnl, cur, true)}</span> · {monthStats.trades} trade{monthStats.trades > 1 ? 's' : ''} · {monthStats.green} jour{monthStats.green > 1 ? 's' : ''} vert{monthStats.green > 1 ? 's' : ''} / {monthStats.red} rouge{monthStats.red > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost !px-2.5" onClick={() => shift(-1)} aria-label="Mois précédent">
            <ChevronLeft size={16} />
          </button>
          <select className="field !w-auto capitalize" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Mois">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' })}</option>
            ))}
          </select>
          <select className="field !w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année">
            {(years.includes(year) ? years : [...years, year].sort()).map((y) => <option key={y}>{y}</option>)}
          </select>
          <button className="btn btn-ghost !px-2.5" onClick={() => shift(1)} aria-label="Mois suivant">
            <ChevronRight size={16} />
          </button>
          <button className="btn btn-ghost" onClick={() => (setYear(now.getFullYear()), setMonth(now.getMonth()), setSelected(today))}>
            Aujourd’hui
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card p-3">
          <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase tracking-wide text-muted">
            {DAYS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />
              const d = byDay.get(date)
              const tone = !d || d.pnl === 0 ? 'border-line bg-panel-2/40' : d.pnl > 0 ? 'border-gain/40 bg-gain/15' : 'border-loss/40 bg-loss/15'
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  className={`flex aspect-[4/3] min-h-14 flex-col items-start justify-between rounded-lg border p-1.5 text-left transition hover:brightness-125 sm:p-2 ${tone} ${selected === date ? 'ring-2 ring-accent' : ''}`}
                >
                  <span className={`text-xs ${date === today ? 'grid h-5 w-5 place-items-center rounded-full bg-accent font-semibold text-white' : 'text-muted'}`}>{Number(date.slice(8))}</span>
                  {d && (
                    <span className="w-full">
                      <span className={`block truncate text-[11px] font-semibold tabular-nums sm:text-xs ${pnlColor(d.pnl)}`}>{fmtMoney(d.pnl, cur, true).replace(/\s\S+$/, '')}</span>
                      <span className="hidden text-[10px] text-muted sm:block">{d.trades} trade{d.trades > 1 ? 's' : ''}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted">
            <Legend color="bg-gain/40" label="Journée positive" />
            <Legend color="bg-loss/40" label="Journée négative" />
            <Legend color="bg-panel-2" label="Aucun trade / nul" />
          </div>
        </div>

        <aside className="card flex flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold capitalize">{fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <div className={`text-lg font-semibold tabular-nums ${pnlColor(dayPnl)}`}>{dayTrades.length ? fmtMoney(dayPnl, cur, true) : 'Aucun trade'}</div>
            </div>
            <button className="btn btn-primary !px-3 !py-1.5" onClick={() => openForm({ date: selected })}>
              <Plus size={15} /> Ajouter
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {dayTrades.map((t) => (
              <li key={t.id}>
                <button onClick={() => openDetail(t)} className="w-full rounded-lg border border-line bg-bg/50 px-3 py-2 text-left transition hover:border-muted/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {t.asset} <span className={`text-xs ${t.direction === 'long' ? 'text-gain' : 'text-loss'}`}>{t.direction === 'long' ? '▲' : '▼'}</span>
                    </span>
                    <span className={`tabular-nums ${pnlColor(t.netResult)}`}>{fmtMoney(t.netResult, 'USD', true)}</span>
                  </div>
                  <div className="text-xs text-muted">{[t.entryTime, t.strategy].filter(Boolean).join(' · ') || t.market}</div>
                </button>
              </li>
            ))}
          </ul>
          {!dayTrades.length && <p className="mt-6 text-center text-sm text-muted">Cliquez sur « Ajouter » pour enregistrer un trade à cette date.</p>}
        </aside>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  )
}
