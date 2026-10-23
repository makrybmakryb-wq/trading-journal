// Calcul de tous les indicateurs du tableau de bord à partir d'une liste de trades.
// Fonctions pures : mêmes entrées → mêmes sorties, donc faciles à tester.

import type { Trade } from './types'

export interface Stats {
  total: number
  wins: number
  losses: number
  breakeven: number
  /** wins ÷ (wins + losses) × 100 — les trades à l'équilibre sont exclus du dénominateur. */
  winRate: number
  netPnl: number
  grossProfit: number // somme des trades nets > 0
  grossLoss: number // somme des trades nets < 0 (valeur négative)
  totalFees: number
  avgWin: number
  avgLoss: number // valeur négative
  best: Trade | null
  worst: Trade | null
  /** Profit brut ÷ |perte brute|. null si aucune perte (infini). */
  profitFactor: number | null
  /** Plus forte baisse du capital cumulé depuis un sommet (valeur positive, en devise). */
  maxDrawdown: number
  /** Moyenne des R réalisés sur les trades pour lesquels le risque est connu. */
  avgRR: number | null
  rrCount: number
  /** Espérance par trade = netPnl ÷ total. */
  expectancy: number
  /** Ratio gain moyen ÷ |perte moyenne|. */
  payoffRatio: number | null
  planRespectRate: number | null
}

const sortChrono = (a: Trade, b: Trade) =>
  a.date.localeCompare(b.date) || (a.entryTime ?? '').localeCompare(b.entryTime ?? '') || a.id - b.id

export function computeStats(trades: Trade[]): Stats {
  const sorted = [...trades].sort(sortChrono)
  const wins = sorted.filter((t) => t.netResult > 0)
  const losses = sorted.filter((t) => t.netResult < 0)
  const breakeven = sorted.length - wins.length - losses.length

  const grossProfit = wins.reduce((s, t) => s + t.netResult, 0)
  const grossLoss = losses.reduce((s, t) => s + t.netResult, 0)
  const netPnl = grossProfit + grossLoss
  const totalFees = sorted.reduce((s, t) => s + (t.fees || 0), 0)

  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0

  let best: Trade | null = null
  let worst: Trade | null = null
  for (const t of sorted) {
    if (!best || t.netResult > best.netResult) best = t
    if (!worst || t.netResult < worst.netResult) worst = t
  }

  // Drawdown maximal : on parcourt la courbe de capital cumulé (départ à 0) et on garde
  // la plus grande chute entre un plus-haut et le point suivant.
  let cum = 0
  let peak = 0
  let maxDrawdown = 0
  for (const t of sorted) {
    cum += t.netResult
    if (cum > peak) peak = cum
    maxDrawdown = Math.max(maxDrawdown, peak - cum)
  }

  const rrs = sorted.map((t) => t.rrRealized).filter((v): v is number => typeof v === 'number')
  const plan = sorted.filter((t) => t.followedPlan !== null)

  return {
    total: sorted.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate: wins.length + losses.length ? (wins.length / (wins.length + losses.length)) * 100 : 0,
    netPnl,
    grossProfit,
    grossLoss,
    totalFees,
    avgWin,
    avgLoss,
    best,
    worst,
    profitFactor: grossLoss < 0 ? grossProfit / Math.abs(grossLoss) : null,
    maxDrawdown,
    avgRR: rrs.length ? rrs.reduce((s, v) => s + v, 0) / rrs.length : null,
    rrCount: rrs.length,
    expectancy: sorted.length ? netPnl / sorted.length : 0,
    payoffRatio: avgLoss < 0 && avgWin > 0 ? avgWin / Math.abs(avgLoss) : null,
    planRespectRate: plan.length ? (plan.filter((t) => t.followedPlan).length / plan.length) * 100 : null,
  }
}

// ---------- Regroupements pour les graphiques ----------

export type Granularity = 'day' | 'week' | 'month'

/** Lundi de la semaine ISO contenant la date (YYYY-MM-DD → YYYY-MM-DD). */
export function weekStart(date: string): string {
  const d = new Date(date + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // lundi = 0
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

export function bucketKey(date: string, g: Granularity): string {
  if (g === 'day') return date
  if (g === 'week') return weekStart(date)
  return date.slice(0, 7)
}

export interface PnlBucket {
  key: string
  pnl: number
  trades: number
  wins: number
  losses: number
}

export function pnlByPeriod(trades: Trade[], g: Granularity): PnlBucket[] {
  const map = new Map<string, PnlBucket>()
  for (const t of trades) {
    const key = bucketKey(t.date, g)
    const b = map.get(key) ?? { key, pnl: 0, trades: 0, wins: 0, losses: 0 }
    b.pnl += t.netResult
    b.trades += 1
    if (t.netResult > 0) b.wins += 1
    else if (t.netResult < 0) b.losses += 1
    map.set(key, b)
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).map((b) => ({ ...b, pnl: round2(b.pnl) }))
}

export interface EquityPoint {
  label: string
  date: string
  trade: number
  pnl: number
  equity: number
  drawdown: number
}

/** Courbe de capital cumulé (un point par trade, dans l'ordre chronologique). */
export function equityCurve(trades: Trade[], startingCapital = 0): EquityPoint[] {
  const sorted = [...trades].sort(sortChrono)
  let eq = startingCapital
  let peak = startingCapital
  return sorted.map((t, i) => {
    eq += t.netResult
    peak = Math.max(peak, eq)
    return {
      label: t.date,
      date: t.date,
      trade: i + 1,
      pnl: round2(t.netResult),
      equity: round2(eq),
      drawdown: round2(eq - peak),
    }
  })
}

export interface GroupStat {
  name: string
  trades: number
  wins: number
  losses: number
  winRate: number
  net: number
}

export function groupBy(trades: Trade[], keyOf: (t: Trade) => string | null | undefined, fallback = 'Non renseigné'): GroupStat[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const k = (keyOf(t) ?? '').trim() || fallback
    map.set(k, [...(map.get(k) ?? []), t])
  }
  return [...map.entries()]
    .map(([name, ts]) => {
      const w = ts.filter((t) => t.netResult > 0).length
      const l = ts.filter((t) => t.netResult < 0).length
      return {
        name,
        trades: ts.length,
        wins: w,
        losses: l,
        winRate: w + l ? (w / (w + l)) * 100 : 0,
        net: round2(ts.reduce((s, t) => s + t.netResult, 0)),
      }
    })
    .sort((a, b) => b.net - a.net)
}

export interface DayStat {
  date: string
  pnl: number
  trades: number
}

export function pnlByDay(trades: Trade[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>()
  for (const t of trades) {
    const d = map.get(t.date) ?? { date: t.date, pnl: 0, trades: 0 }
    d.pnl = round2(d.pnl + t.netResult)
    d.trades += 1
    map.set(t.date, d)
  }
  return map
}

// ---------- Périodes (filtres du tableau de bord) ----------

export type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'custom' | 'all'

export const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` // date locale
export const round2 = (v: number) => Math.round(v * 100) / 100

export function periodRange(
  key: PeriodKey,
  now = new Date(),
  custom?: { from?: string; to?: string },
): { from: string | null; to: string | null } {
  const today = toISO(now)
  switch (key) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // lundi
      const end = new Date(d)
      end.setDate(end.getDate() + 6)
      return { from: toISO(d), to: toISO(end) }
    }
    case 'month':
      return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
    case 'custom':
      return { from: custom?.from || null, to: custom?.to || null }
    default:
      return { from: null, to: null }
  }
}

export function filterByRange(trades: Trade[], from: string | null, to: string | null): Trade[] {
  return trades.filter((t) => (!from || t.date >= from) && (!to || t.date <= to))
}

// ---------- Profits / pertes par catégorie (jour de la semaine, tranche horaire) ----------

export interface SplitStat {
  name: string
  /** somme des trades gagnants (≥ 0) */
  profit: number
  /** somme des trades perdants, en valeur absolue (≥ 0) */
  loss: number
  net: number
  trades: number
}

/** Regroupe les trades dans des catégories ordonnées (toutes affichées, même vides). */
export function splitBy(trades: Trade[], order: string[], keyOf: (t: Trade) => string | null): SplitStat[] {
  const map = new Map<string, SplitStat>(order.map((name) => [name, { name, profit: 0, loss: 0, net: 0, trades: 0 }]))
  for (const t of trades) {
    const k = keyOf(t)
    const b = k === null ? undefined : map.get(k)
    if (!b) continue
    if (t.netResult > 0) b.profit += t.netResult
    else if (t.netResult < 0) b.loss += -t.netResult
    b.net += t.netResult
    b.trades += 1
  }
  return [...map.values()].map((b) => ({ ...b, profit: round2(b.profit), loss: round2(b.loss), net: round2(b.net) }))
}

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const weekdayOf = (date: string) => WEEKDAY_LABELS[(new Date(date + 'T12:00:00').getDay() + 6) % 7]

export const pnlByWeekday = (trades: Trade[]) => splitBy(trades, WEEKDAY_LABELS, (t) => weekdayOf(t.date))

/** Tranches horaires configurables (5/10/15/30/60 min) de 15:30 à 20:00 ; après 20:00 → « Plus ». */
export const SLOT_STEPS = [5, 10, 15, 30, 60] as const
export type SlotStep = (typeof SLOT_STEPS)[number]
const SLOT_START = 15 * 60 + 30
const SLOT_END = 20 * 60
export const BEFORE_LABEL = 'Avant'
const slotOrigin = (step: number) => Math.floor(SLOT_START / step) * step

export function slotLabels(step: SlotStep): string[] {
  const l: string[] = []
  for (let m = slotOrigin(step); m < SLOT_END; m += step) l.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
  return [...l, 'Plus']
}

/** Tranche d'une heure « HH:MM ». Avant le début → « Avant » (affichée seulement si utilisée). */
export function timeSlot(time: string | null, step: SlotStep): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? '')
  if (!m) return null
  const mins = Number(m[1]) * 60 + Number(m[2])
  const origin = slotOrigin(step)
  if (mins < origin) return BEFORE_LABEL
  if (mins >= SLOT_END) return 'Plus'
  const k = origin + Math.floor((mins - origin) / step) * step
  return `${pad(Math.floor(k / 60))}:${pad(k % 60)}`
}

export function pnlBySlot(trades: Trade[], step: SlotStep): SplitStat[] {
  const all = splitBy(trades, [BEFORE_LABEL, ...slotLabels(step)], (t) => timeSlot(t.entryTime, step))
  return all.filter((s) => s.name !== BEFORE_LABEL || s.trades > 0)
}
