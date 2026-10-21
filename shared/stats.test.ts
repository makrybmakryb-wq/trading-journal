// Tests rapides des formules : npm test
import assert from 'node:assert/strict'
import { computeTrade } from './calc'
import { computeStats, equityCurve, pnlByPeriod, weekStart, periodRange } from './stats'
import type { Trade } from './types'

// --- calc ---
const long = computeTrade({ direction: 'long', entryPrice: 100, exitPrice: 110, quantity: 10, fees: 5, stopLoss: 95 })
assert.equal(long.grossResult, 100)
assert.equal(long.netResult, 95)
assert.equal(long.resultPct, 9.5) // 95 / 1000
assert.equal(long.riskUsed, 50) // |100-95| × 10
assert.equal(long.rrRealized, 1.9)

const short = computeTrade({ direction: 'short', entryPrice: 100, exitPrice: 90, quantity: 2, fees: 1 })
assert.equal(short.grossResult, 20)
assert.equal(short.netResult, 19)

const manual = computeTrade({ direction: 'long', grossResult: -40, fees: 2, plannedRisk: 40 })
assert.equal(manual.netResult, -42)
assert.equal(manual.rrRealized, -1.05)

// --- stats ---
const mk = (id: number, date: string, net: number): Trade =>
  ({ id, date, entryTime: null, netResult: net, grossResult: net, fees: 0, rrRealized: null, followedPlan: null } as unknown as Trade)

const trades = [mk(1, '2026-01-05', 100), mk(2, '2026-01-06', -50), mk(3, '2026-01-07', -30), mk(4, '2026-01-08', 0), mk(5, '2026-01-09', 60)]
const s = computeStats(trades)
assert.equal(s.total, 5)
assert.equal(s.wins, 2)
assert.equal(s.losses, 2)
assert.equal(s.breakeven, 1)
assert.equal(s.winRate, 50)
assert.equal(s.netPnl, 80)
assert.equal(s.grossProfit, 160)
assert.equal(s.grossLoss, -80)
assert.equal(s.profitFactor, 2)
assert.equal(s.avgWin, 80)
assert.equal(s.avgLoss, -40)
assert.equal(s.maxDrawdown, 80) // pic 100 → creux 20
assert.equal(s.best?.id, 1)
assert.equal(s.worst?.id, 2)

assert.equal(computeStats([]).total, 0)
assert.equal(computeStats([mk(1, '2026-01-01', 10)]).profitFactor, null)

const eq = equityCurve(trades)
assert.equal(eq[eq.length - 1].equity, 80)
assert.equal(pnlByPeriod(trades, 'month')[0].pnl, 80)

assert.equal(weekStart('2026-10-21'), '2026-10-19') // mercredi → lundi
assert.deepEqual(periodRange('month', new Date(2026, 1, 10)), { from: '2026-02-01', to: '2026-02-28' })

console.log('✅ Tous les tests passent')
