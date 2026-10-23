// Tests rapides des formules : npm test
import assert from 'node:assert/strict'
import { computeTrade } from './calc'
import { suggestQuantity } from './sizing'
import { computeStats, equityCurve, pnlByPeriod, weekStart, periodRange, pnlBySlot, countBySlot, timeSlot, pnlByWeekday } from './stats'
import type { Trade } from './types'

// --- calc ---
// Long 1 000 $ @100 → 110 : brut 100 ; frais 0,0005 % × 1 000 = 0,005 ; net 99,995 ; R réalisé = RR saisi
const long = computeTrade({ direction: 'long', entryPrice: 100, exitPrice: 110, amount: 1000, touched: 'TP', rr: 2 })
assert.equal(long.grossResult, 100)
assert.equal(long.fees, 0.005)
assert.equal(long.netResult, 99.995)
assert.equal(long.rrRealized, 2)
assert.equal(long.quantity, 10)
// 1 000 000 $ → 5 $ de frais
assert.equal(computeTrade({ direction: 'long', entryPrice: 100, exitPrice: 100, amount: 1_000_000 }).fees, 5)

const short = computeTrade({ direction: 'short', entryPrice: 100, exitPrice: 105, amount: 200, touched: 'SL' })
assert.equal(short.grossResult, -10)
assert.equal(short.rrRealized, -1)
assert.equal(computeTrade({ direction: 'long' }).autoGross, null)

// --- taille de position ---
const prior = (id: number, date: string, net: number, quantity: number) => ({ id, date, entryTime: null, netResult: net, quantity })
let sz = suggestQuantity([], 100000, 50000)
assert.equal(sz.quantity, 1.8) // 90 % de 100 000 ÷ 50 000
assert.equal(sz.recalculated, true)
// capital 100 500, position 1,8 × 50 000 = 90 000 (89,5 % du capital) → on garde 1,8
sz = suggestQuantity([prior(1, '2026-01-01', 500, 1.8)], 100000, 50000)
assert.equal(sz.quantity, 1.8)
assert.equal(sz.recalculated, false)
// capital 112 600 : 90 000 = 79,9 % (≤ 80 %) → nouvelle quantité = 90 % × 112 600 ÷ 50 000
sz = suggestQuantity([prior(1, '2026-01-01', 12600, 1.8)], 100000, 50000)
assert.equal(sz.recalculated, true)
assert.equal(sz.quantity, 2.0268)

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

// --- tranches horaires ---
assert.equal(timeSlot('15:29', 30), 'Avant')
assert.equal(timeSlot('15:34', 5), '15:30')
assert.equal(timeSlot('15:47', 15), '15:45')
assert.equal(timeSlot('16:19', 10), '16:10')
assert.equal(timeSlot('19:59', 30), '19:30')
assert.equal(timeSlot('15:40', 60), '15:00')
assert.equal(timeSlot('17:59', 5), '17:55')
assert.equal(timeSlot('18:00', 5), 'Plus')
assert.equal(timeSlot('18:00', 30), '18:00')
assert.equal(timeSlot('20:00', 30), 'Plus')
assert.equal(pnlBySlot([], 5).length, 31) // 15:30 … 17:55 (30 tranches) + « Plus »
assert.equal(pnlBySlot([], 30).length, 10)
assert.equal(pnlBySlot([], 60).length, 6)
// --- nombre d'entrées / sorties par tranche ---
const ex = (id: number, entry: string | null, exit: string | null): Trade => ({ ...mk(id, '2026-01-05', 10), entryTime: entry, exitTime: exit }) as Trade
const cnt = countBySlot([ex(1, '15:40', '16:10'), ex(2, '15:45', '16:20'), ex(3, '16:05', null), ex(4, '15:00', '18:30')], 30)
assert.deepEqual(cnt.find((c) => c.name === '15:30'), { name: '15:30', entries: 2, exits: 0 })
assert.deepEqual(cnt.find((c) => c.name === '16:00'), { name: '16:00', entries: 1, exits: 2 })
assert.deepEqual(cnt.find((c) => c.name === 'Avant'), { name: 'Avant', entries: 1, exits: 0 })
assert.deepEqual(cnt.find((c) => c.name === '18:30'), { name: '18:30', entries: 0, exits: 1 })
assert.equal(countBySlot([], 30).length, 10)
assert.equal(countBySlot([], 5).length, 31)
const wd = pnlByWeekday([{ ...mk(1, '2026-01-05', 100) }, { ...mk(2, '2026-01-05', -40) }])
assert.deepEqual(wd[0], { name: 'Lun', profit: 100, loss: 40, net: 60, trades: 2 })

console.log('✅ Tous les tests passent')
