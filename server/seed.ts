// Données de démonstration : npm run seed  (n'ajoute rien si le journal contient déjà des trades, sauf avec --force)
import { db } from './db'
import { computeTrade } from '../shared/calc'

const force = process.argv.includes('--force')
const existing = (db.prepare('SELECT COUNT(*) n FROM trades').get() as { n: number }).n
if (existing && !force) {
  console.log(`Le journal contient déjà ${existing} trade(s). Utilisez "npm run seed -- --force" pour ajouter les données de démonstration quand même.`)
  process.exit(0)
}

// Générateur pseudo-aléatoire reproductible
let seed = 42
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]

const instruments = [
  { asset: 'EURUSD', market: 'Forex', price: 1.08, qty: 10000, vol: 0.004 },
  { asset: 'GBPUSD', market: 'Forex', price: 1.27, qty: 10000, vol: 0.005 },
  { asset: 'NASDAQ', market: 'Indices', price: 18000, qty: 1, vol: 0.012 },
  { asset: 'DAX', market: 'Indices', price: 18500, qty: 1, vol: 0.01 },
  { asset: 'AAPL', market: 'Actions', price: 190, qty: 20, vol: 0.015 },
  { asset: 'BTCUSD', market: 'Crypto', price: 65000, qty: 0.05, vol: 0.03 },
  { asset: 'XAUUSD', market: 'Matières premières', price: 2350, qty: 2, vol: 0.008 },
] as const
const strategies = ['Breakout', 'Pullback', 'Range', 'Tendance']
const setups = ['Double bottom', 'Drapeau', 'Retest support', 'Cassure de range']
const emotions = ['Calme', 'Confiant', 'Concentré', 'Impatient', 'FOMO', 'Hésitant', 'Frustré']

const insert = db.prepare(`INSERT INTO trades (date, entry_time, exit_time, asset, market, direction, entry_price, exit_price, quantity, stop_loss, take_profit,
  planned_risk, fees, currency, gross_result, net_result, result_pct, rr_realized, strategy, setup, followed_plan, emotion, comment, mistakes, lessons)
  VALUES (@date,@entry_time,@exit_time,@asset,@market,@direction,@entry_price,@exit_price,@quantity,@stop_loss,@take_profit,@planned_risk,@fees,'EUR',
  @gross_result,@net_result,@result_pct,@rr_realized,@strategy,@setup,@followed_plan,@emotion,@comment,@mistakes,@lessons)`)

const r = (v: number, d = 5) => Number(v.toFixed(d))
const today = new Date()
let n = 0
db.transaction(() => {
  for (let back = 120; back >= 0; back--) {
    const day = new Date(today)
    day.setDate(day.getDate() - back)
    if (day.getDay() === 0 || day.getDay() === 6 || rnd() < 0.3) continue
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    for (let k = 0, count = 1 + Math.floor(rnd() * 3); k < count; k++) {
      const ins = pick(instruments)
      const direction = rnd() < 0.55 ? 'long' : 'short'
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
      const t = (hh: number, mm: number) => `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      insert.run({
        date, entry_time: t(h, m), exit_time: t(Math.min(h + 1, 23), m), asset: ins.asset, market: ins.market, direction,
        entry_price: entry, exit_price: exit, quantity: ins.qty, stop_loss: stop, take_profit: take,
        planned_risk: c.riskUsed, fees, gross_result: c.grossResult, net_result: c.netResult, result_pct: c.resultPct, rr_realized: c.rrRealized,
        strategy: pick(strategies), setup: pick(setups), followed_plan: followed ? 1 : 0, emotion: pick(emotions),
        comment: win ? 'Entrée propre, exécution conforme au plan.' : 'Le marché a invalidé le scénario.',
        mistakes: followed ? null : 'Entrée trop tôt, hors plan.',
        lessons: followed ? null : 'Attendre la confirmation avant d’entrer.',
      })
      n++
    }
  }
})()
console.log(`✅ ${n} trades de démonstration ajoutés.`)
