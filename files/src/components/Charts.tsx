import { useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Trade } from '../../shared/types'
import { equityCurve, groupBy, pnlBySlot, countBySlot, pnlByPeriod, pnlByWeekday, weekStart, SLOT_STEPS, type SlotStep, type Granularity, type GroupStat, type SplitStat, type CountStat } from '../../shared/stats'
import { fmtDate, fmtMoney, fmtMonthKey, fmtPct } from '../lib/format'

export const GAIN = '#22c55e'
export const LOSS = '#ef4444'
export const NEUTRAL = '#64748b'
const ACCENT = '#4f8cff'
// Style « Profits et pertes » : deux barres par catégorie (rouge = profits, bleu = pertes). Échanger ici pour inverser.
export const SPLIT_PROFIT = '#e8584f'
export const SPLIT_LOSS = '#4a7bd6'

const tooltipBox = 'rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs shadow-xl'

export function ChartCard({ title, right, children, empty }: { title: string; right?: ReactNode; children: ReactNode; empty?: boolean }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      {empty ? <div className="grid h-64 place-items-center text-sm text-muted">Aucune donnée sur cette période.</div> : children}
    </section>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-bg/60 p-0.5">
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-md px-2.5 py-1 text-xs transition ${value === k ? 'bg-panel-2 text-ink' : 'text-muted hover:text-ink'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

const compact = (v: number) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

function periodLabel(key: string, g: Granularity) {
  if (g === 'month') return fmtMonthKey(key)
  if (g === 'week') return `Sem. du ${fmtDate(key, { day: '2-digit', month: 'short' })}`
  return fmtDate(key, { day: '2-digit', month: 'short' })
}

// ---------- A. Barres : P&L par jour / semaine / mois ----------
export function PnlBarChart({ trades, currency }: { trades: Trade[]; currency: string }) {
  const [g, setG] = useState<Granularity>('day')
  const data = useMemo(() => pnlByPeriod(trades, g), [trades, g])
  return (
    <ChartCard
      title="Profits et pertes"
      empty={!data.length}
      right={<Segmented value={g} onChange={setG} options={[['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']]} />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" tickFormatter={(k) => periodLabel(k, g)} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
            <ReferenceLine y={0} stroke="#334155" />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as ReturnType<typeof pnlByPeriod>[number]
                return (
                  <div className={tooltipBox}>
                    <div className="mb-1 font-medium">{periodLabel(d.key, g)}</div>
                    <div className={d.pnl >= 0 ? 'text-gain' : 'text-loss'}>{fmtMoney(d.pnl, currency, true)}</div>
                    <div className="text-muted">
                      {d.trades} trade{d.trades > 1 ? 's' : ''} · {d.wins} gagnant{d.wins > 1 ? 's' : ''} · {d.losses} perdant{d.losses > 1 ? 's' : ''}
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={36}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.pnl > 0 ? GAIN : d.pnl < 0 ? LOSS : NEUTRAL} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ---------- B. Camembert : gagnants / perdants / équilibre ----------
export function WinLossPie({ wins, losses, breakeven }: { wins: number; losses: number; breakeven: number }) {
  const total = wins + losses + breakeven
  const data = [
    { name: 'Gagnants', value: wins, color: GAIN },
    { name: 'Perdants', value: losses, color: LOSS },
    { name: 'À l’équilibre', value: breakeven, color: NEUTRAL },
  ].filter((d) => d.value > 0)
  return (
    <ChartCard title="Répartition des trades" empty={!total}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="82%"
              paddingAngle={data.length > 1 ? 3 : 0}
              stroke="none"
              label={({ value }) => `${value} (${fmtPct(((value as number) / total) * 100, 0)})`}
              labelLine={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]
                return (
                  <div className={tooltipBox}>
                    <span className="font-medium">{p.name}</span> : {p.value as number} trade{(p.value as number) > 1 ? 's' : ''} ({fmtPct(((p.value as number) / total) * 100, 1)})
                  </div>
                )
              }}
            />
            <Legend verticalAlign="bottom" iconType="circle" formatter={(v) => <span className="text-xs text-ink/80">{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ---------- C. Courbe du capital ----------
export function EquityChart({ trades, startingCapital, currency }: { trades: Trade[]; startingCapital: number; currency: string }) {
  const data = useMemo(() => equityCurve(trades, startingCapital), [trades, startingCapital])
  const last = data[data.length - 1]?.equity ?? 0
  const up = last >= startingCapital
  const color = up ? GAIN : LOSS
  return (
    <ChartCard title={startingCapital ? 'Évolution du capital' : 'Évolution cumulée des résultats'} empty={!data.length}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="trade" tickLine={false} axisLine={false} minTickGap={32} tickFormatter={(n) => `#${n}`} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} />
            <ReferenceLine y={startingCapital} stroke="#334155" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as ReturnType<typeof equityCurve>[number]
                return (
                  <div className={tooltipBox}>
                    <div className="mb-1 font-medium">
                      Trade #{d.trade} · {fmtDate(d.date)}
                    </div>
                    <div>{fmtMoney(d.equity, currency)}</div>
                    <div className={d.pnl >= 0 ? 'text-gain' : 'text-loss'}>{fmtMoney(d.pnl, currency, true)} sur ce trade</div>
                    {d.drawdown < 0 && <div className="text-muted">Drawdown : {fmtMoney(d.drawdown, currency)}</div>}
                  </div>
                )
              }}
            />
            <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#eq)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ---------- D / E. Comparaison par groupe (stratégie, actif, marché…) ----------
export function GroupChart({ title, trades, keyOf, currency }: { title: string; trades: Trade[]; keyOf: (t: Trade) => string | null | undefined; currency: string }) {
  const data = useMemo(() => groupBy(trades, keyOf), [trades, keyOf])
  const height = Math.max(180, data.length * 42 + 30)
  return (
    <ChartCard title={title} empty={!data.length}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickFormatter={compact} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} interval={0} />
            <ReferenceLine x={0} stroke="#334155" />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as GroupStat
                return (
                  <div className={tooltipBox}>
                    <div className="mb-1 font-medium">{d.name}</div>
                    <div className={d.net >= 0 ? 'text-gain' : 'text-loss'}>{fmtMoney(d.net, currency, true)}</div>
                    <div className="text-muted">
                      {d.trades} trade{d.trades > 1 ? 's' : ''} · réussite {fmtPct(d.winRate, 0)}
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="net" radius={3} maxBarSize={22}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.net > 0 ? GAIN : d.net < 0 ? LOSS : NEUTRAL} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <GroupTable data={data} currency={currency} />
    </ChartCard>
  )
}

function GroupTable({ data, currency }: { data: GroupStat[]; currency: string }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="py-1.5 font-medium">Nom</th>
            <th className="py-1.5 text-right font-medium">Trades</th>
            <th className="py-1.5 text-right font-medium">Réussite</th>
            <th className="py-1.5 text-right font-medium">Résultat net</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.name} className="border-b border-line/50 last:border-0">
              <td className="py-1.5">{d.name}</td>
              <td className="py-1.5 text-right tabular-nums">{d.trades}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtPct(d.winRate, 0)}</td>
              <td className={`py-1.5 text-right tabular-nums ${d.net > 0 ? 'text-gain' : d.net < 0 ? 'text-loss' : 'text-muted'}`}>{fmtMoney(d.net, currency, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- F. Profits et pertes par catégorie (jour de la semaine, demi-heure) ----------
function SplitChart({ title, data, currency, hint }: { title: string; data: SplitStat[]; currency: string; hint?: string }) {
  const used = data.some((d) => d.trades > 0)
  return (
    <ChartCard title={title} empty={!used}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={1} barCategoryGap="18%">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} fontSize={11} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as SplitStat
                return (
                  <div className={tooltipBox}>
                    <div className="mb-1 font-medium">{d.name}</div>
                    <div style={{ color: SPLIT_PROFIT }}>Profits : {fmtMoney(d.profit, currency)}</div>
                    <div style={{ color: SPLIT_LOSS }}>Pertes : {fmtMoney(-d.loss, currency)}</div>
                    <div className={d.net >= 0 ? 'text-gain' : 'text-loss'}>Net : {fmtMoney(d.net, currency, true)}</div>
                    <div className="text-muted">{d.trades} trade{d.trades > 1 ? 's' : ''}</div>
                  </div>
                )
              }}
            />
            <Legend verticalAlign="top" align="right" iconType="square" formatter={(v) => <span className="text-xs text-ink/80">{v}</span>} />
            <Bar dataKey="profit" name="Profits" fill={SPLIT_PROFIT} maxBarSize={18} />
            <Bar dataKey="loss" name="Pertes" fill={SPLIT_LOSS} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </ChartCard>
  )
}

export function WeekdayChart({ trades, currency }: { trades: Trade[]; currency: string }) {
  const data = useMemo(() => pnlByWeekday(trades), [trades])
  return <SplitChart title="Profits et pertes par jour de la semaine" data={data} currency={currency} />
}

const stepLabel = (n: number) => (n === 60 ? '1h' : `${n}m`)

export function TimeSlotChart({ trades, currency }: { trades: Trade[]; currency: string }) {
  const [step, setStep] = useState<SlotStep>(30)
  const data = useMemo(() => pnlBySlot(trades, step), [trades, step])
  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1">
        <span className="mr-1 text-xs text-muted">Intervalle</span>
        {SLOT_STEPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            className={`rounded px-2 py-1 text-xs ${step === n ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'}`}
          >
            {stepLabel(n)}
          </button>
        ))}
      </div>
      <SplitChart
        title={`Profits et pertes par ${step === 60 ? 'heure' : `tranche de ${step} min`}`}
        data={data}
        currency={currency}
        hint={step === 5 ? 'Selon l’heure d’entrée, de 15:30 à 18:00. « Plus » = 18:00 et après.' : 'Selon l’heure d’entrée, de 15:30 à 20:00. « Plus » = après 20:00.'}
      />
    </div>
  )
}

// ---------- G. Nombre d'entrées et de sorties par tranche horaire ----------
export const ENTRY_COLOR = '#4f8cff'
export const EXIT_COLOR = '#f59e0b'

export function EntryExitCountChart({ trades }: { trades: Trade[] }) {
  const [step, setStep] = useState<SlotStep>(30)
  const data = useMemo(() => countBySlot(trades, step), [trades, step])
  const used = data.some((d) => d.entries + d.exits > 0)
  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1">
        <span className="mr-1 text-xs text-muted">Intervalle</span>
        {SLOT_STEPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            className={`rounded px-2 py-1 text-xs ${step === n ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'}`}
          >
            {stepLabel(n)}
          </button>
        ))}
      </div>
      <ChartCard title={`Nombre d’entrées et de sorties par ${step === 60 ? 'heure' : `tranche de ${step} min`}`} empty={!used}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={1} barCategoryGap="18%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as CountStat
                  return (
                    <div className={tooltipBox}>
                      <div className="mb-1 font-medium">{d.name}</div>
                      <div style={{ color: ENTRY_COLOR }}>Entrées : {d.entries}</div>
                      <div style={{ color: EXIT_COLOR }}>Sorties : {d.exits}</div>
                    </div>
                  )
                }}
              />
              <Legend verticalAlign="top" align="right" iconType="square" formatter={(v) => <span className="text-xs text-ink/80">{v}</span>} />
              <Bar dataKey="entries" name="Entrées" fill={ENTRY_COLOR} maxBarSize={18} />
              <Bar dataKey="exits" name="Sorties" fill={EXIT_COLOR} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted">
          Selon l’heure d’entrée et l’heure de sortie, de 15:30 à {step === 5 ? '18:00' : '20:00'}. « Plus » = {step === 5 ? '18:00 et après' : 'après 20:00'}.
        </p>
      </ChartCard>
    </div>
  )
}

export { weekStart, ACCENT }
