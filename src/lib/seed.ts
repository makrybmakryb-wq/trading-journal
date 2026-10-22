// Données de démonstration (≈100 trades fictifs), chargées à la demande depuis le tableau de bord.
import { computeTrade } from '../../shared/calc'
import { suggestQuantity } from '../../shared/sizing'
import { toISO } from '../../shared/stats'
import { ASSET_MARKET, CURRENCY, STRATEGIES, type Direction, type Trade } from '../../shared/types'
import { tradeDb } from './db'
import { DEFAULT_CAPITAL } from './store'

const instruments: { asset: string; price: number; vol: number }[] = [
  { asset: 'BTC', price: 65000, vol: 0.02 },
  { asset: 'ETH', price: 3200, vol: 0.025 },
  { asset: 'EUR/USD', price: 1.08, vol: 0.003 },
  { asset: 'GOLD', price: 2350, vol: 0.006 },
  { asset: 'NASD', price: 18000, vol: 0.008 },
]

export async function seedDemo(): Promise<number> {
  let seed = 42
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
  const r = (v: number, d = 5) => Number(v.toFixed(d))
  const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const trades: Trade[] = []
  const today = new Date()
  let capital = Number(localStorage.getItem('tj.startingCapital')) || DEFAULT_CAPITAL
  const start = capital
  let id = 0

  for (let back = 120; back >= 0; back--) {
    const day = new Date(today)
    day.setDate(day.getDate() - back)
    if (day.getDay() === 0 || day.getDay() === 6 || rnd() < 0.3) continue
    for (let k = 0, count = 1 + Math.floor(rnd() * 2); k < count; k++) {
      const ins = pick(instruments)
      const direction: Direction = rnd() < 0.55 ? 'long' : 'short'
      const sign = direction === 'long' ? 1 : -1
      const entry = r(ins.price * (1 + (rnd() - 0.5) * 0.02))
      const win = rnd() < 0.52
      const rr = 2
      const dist = entry * ins.vol
      const exit = r(entry + sign * (win ? dist * rr : -dist))
      const qty = suggestQuantity(trades, start, entry).quantity ?? 0
      const touched = win ? 'TP' : 'SL'
      const c = computeTrade({ direction, entryPrice: entry, exitPrice: exit, quantity: qty, touched, rr })
      const followed = rnd() < 0.78
      const h = 15 + Math.floor(rnd() * 6)
      const m = rnd() < 0.5 ? 0 : 30
      const now = new Date().toISOString()
      capital += c.netResult
      trades.push({
        id: ++id, date: toISO(day), entryTime: hm(h, m), exitTime: hm(h, Math.min(m + 20, 59)), asset: ins.asset, market: ASSET_MARKET[ins.asset], direction,
        entryPrice: entry, exitPrice: exit, positionSize: r(qty * entry, 2), quantity: qty, touched, rr,
        plannedRisk: c.riskUsed, fees: c.fees, currency: CURRENCY, grossResult: c.grossResult, netResult: c.netResult, resultPct: c.resultPct, rrRealized: c.rrRealized,
        strategy: pick(STRATEGIES), followedPlan: followed, screenshot: null,
        comment: win ? 'Entrée propre, exécution conforme au plan.' : 'Le marché a invalidé le scénario.',
        mistakes: followed ? null : 'Entrée trop tôt, hors plan.',
        lessons: followed ? null : 'Attendre la confirmation avant d’entrer.',
        createdAt: now, updatedAt: now,
      })
    }
  }
  for (const { id: _id, ...t } of trades) await tradeDb.add(t)
  return trades.length
}
