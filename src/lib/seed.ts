// Données de démonstration (≈100 trades fictifs), chargées à la demande depuis le tableau de bord.
import { computeTrade } from '../../shared/calc'
import { toISO } from '../../shared/stats'
import type { Market, Direction, Trade } from '../../shared/types'
import { tradeDb } from './db'

const instruments: { asset: string; market: Market; price: number; qty: number; vol: number }[] = [
  { asset: 'EURUSD', market: 'Forex', price: 1.08, qty: 10000, vol: 0.004 },
  { asset: 'GBPUSD', market: 'Forex', price: 1.27, qty: 10000, vol: 0.005 },
  { asset: 'NASDAQ', market: 'Indices', price: 18000, qty: 1, vol: 0.012 },
  { asset: 'DAX', market: 'Indices', price: 18500, qty: 1, vol: 0.01 },
  { asset: 'AAPL', market: 'Actions', price: 190, qty: 20, vol: 0.015 },
  { asset: 'BTCUSD', market: 'Crypto', price: 65000, qty: 0.05, vol: 0.03 },
  { asset: 'XAUUSD', market: 'Matières premières', price: 2350, qty: 2, vol: 0.008 },
]
const strategies = ['Breakout', 'Pullback', 'Range', 'Tendance']
const setups = ['Double bottom', 'Drapeau', 'Retest support', 'Cassure de range']
const emotions = ['Calme', 'Confiant', 'Concentré', 'Impatient', 'FOMO', 'Hésitant', 'Frustré']

export async function seedDemo(): Promise<number> {
  let seed = 42
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
  const r = (v: number, d = 5) => Number(v.toFixed(d))
  const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const trades: Omit<Trade, 'id'>[] = []
  const today = new Date()

  for (let back = 120; back >= 0; back--) {
    const day = new Date(today)
    day.setDate(day.getDate() - back)
    if (day.getDay() === 0 || day.getDay() === 6 || rnd() < 0.3) continue
    for (let k = 0, count = 1 + Math.floor(rnd() * 3); k < count; k++) {
      const ins = pick(instruments)
      const direction: Direction = rnd() < 0.55 ? 'long' : 'short'
      const sign = direction === 'long' ? 1 : -1
      const entry = r(ins.price * (1 + (rnd() - 0.5) * 0.02))
      const riskDist = entry * ins.vol
      const stop = r(entry - sign * riskDist)
      const take = r(entry + sign * riskDist * 2)
      const win = rnd() < 0.52
      const move = win ? riskDist * (0.6 + rnd() * 1.6) : -riskDist * (0.5 + rnd() * 0.6)
      const exit = r(entry + sign * move)
      const fees = r(ins.qty * entry * 0.00005 + 0.5, 2)
      const c = computeTrade({ direction, entryPrice: entry, exitPrice: exit, quantity: ins.qty, stopLoss: stop, fees })
      const followed = rnd() < 0.78
      const h = 8 + Math.floor(rnd() * 8)
      const m = Math.floor(rnd() * 60)
      const now = new Date().toISOString()
      trades.push({
        date: toISO(day), entryTime: hm(h, m), exitTime: hm(Math.min(h + 1, 23), m), asset: ins.asset, market: ins.market, direction,
        entryPrice: entry, exitPrice: exit, positionSize: null, quantity: ins.qty, stopLoss: stop, takeProfit: take,
        plannedRisk: c.riskUsed, fees, currency: 'EUR', grossResult: c.grossResult, netResult: c.netResult, resultPct: c.resultPct, rrRealized: c.rrRealized,
        strategy: pick(strategies), setup: pick(setups), followedPlan: followed, emotion: pick(emotions), screenshot: null,
        comment: win ? 'Entrée propre, exécution conforme au plan.' : 'Le marché a invalidé le scénario.',
        mistakes: followed ? null : 'Entrée trop tôt, hors plan.',
        lessons: followed ? null : 'Attendre la confirmation avant d’entrer.',
        createdAt: now, updatedAt: now,
      })
    }
  }
  for (const t of trades) await tradeDb.add(t)
  return trades.length
}
