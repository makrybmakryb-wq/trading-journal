import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { computeStats } from '../../shared/stats'
import { useStore } from '../lib/store'
import { fmtDate, fmtMoney, fmtNum, fmtPct, mainCurrency, pnlColor } from '../lib/format'
import { PeriodFilter, usePeriod } from '../components/PeriodFilter'
import { StatCard } from '../components/StatCard'
import { EquityChart, GroupChart, PnlBarChart, WinLossPie } from '../components/Charts'

export function Dashboard() {
  const { trades, openForm, openDetail, startingCapital } = useStore()
  const p = usePeriod(trades, 'all')
  const stats = useMemo(() => computeStats(p.filtered), [p.filtered])
  const cur = mainCurrency(trades)
  const recent = useMemo(() => p.filtered.slice(0, 6), [p.filtered])

  if (!trades.length) {
    return (
      <div className="card mx-auto mt-10 max-w-xl p-10 text-center">
        <h1 className="text-xl font-semibold">Bienvenue dans votre journal de trading</h1>
        <p className="mt-2 text-sm text-muted">Ajoutez votre premier trade pour voir apparaître vos statistiques, vos graphiques et votre calendrier.</p>
        <button className="btn btn-primary mt-6" onClick={() => openForm()}>
          <Plus size={16} /> Ajouter mon premier trade
        </button>
        <p className="mt-6 text-xs text-muted">
          Pour tester avec des données fictives : <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono">npm run seed</code>
        </p>
      </div>
    )
  }

  const m = (v: number, sign = true) => fmtMoney(v, cur, sign)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-muted">
            {p.range.from || p.range.to ? `Du ${p.range.from ? fmtDate(p.range.from) : '…'} au ${p.range.to ? fmtDate(p.range.to) : '…'}` : 'Tout l’historique'} · {stats.total} trade{stats.total > 1 ? 's' : ''}
          </p>
        </div>
        <PeriodFilter p={p} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="P&L net" value={m(stats.netPnl)} color={pnlColor(stats.netPnl)} sub={`Frais : ${m(stats.totalFees, false)}`} formula="Somme des résultats nets (brut − frais) de tous les trades de la période." />
        <StatCard label="Nombre de trades" value={stats.total} sub={`${stats.breakeven} à l’équilibre`} formula="Nombre de trades enregistrés sur la période." />
        <StatCard label="Trades gagnants" value={stats.wins} color="text-gain" formula="Trades dont le résultat net est strictement positif." />
        <StatCard label="Trades perdants" value={stats.losses} color="text-loss" formula="Trades dont le résultat net est strictement négatif." />
        <StatCard label="Taux de réussite" value={fmtPct(stats.winRate, 1)} formula="Gagnants ÷ (gagnants + perdants) × 100. Les trades à l’équilibre sont exclus." />
        <StatCard label="Profit brut" value={m(stats.grossProfit)} color="text-gain" formula="Somme des résultats nets des trades gagnants." />
        <StatCard label="Perte brute" value={m(stats.grossLoss)} color="text-loss" formula="Somme des résultats nets des trades perdants (valeur négative)." />
        <StatCard label="Profit factor" value={stats.profitFactor === null ? (stats.grossProfit > 0 ? '∞' : '—') : fmtNum(stats.profitFactor, 2)} color={stats.profitFactor !== null && stats.profitFactor < 1 ? 'text-loss' : stats.profitFactor !== null || stats.grossProfit > 0 ? 'text-gain' : ''} sub="> 1 = rentable" formula="Profit brut ÷ |perte brute|. Au-dessus de 1, vos gains dépassent vos pertes." />
        <StatCard label="Gain moyen" value={m(stats.avgWin)} color="text-gain" formula="Profit brut ÷ nombre de trades gagnants." />
        <StatCard label="Perte moyenne" value={m(stats.avgLoss)} color="text-loss" formula="Perte brute ÷ nombre de trades perdants." />
        <StatCard label="Meilleur trade" value={stats.best ? m(stats.best.netResult) : '—'} color={pnlColor(stats.best?.netResult)} sub={stats.best ? `${stats.best.asset} · ${fmtDate(stats.best.date, { day: '2-digit', month: 'short' })}` : undefined} onClick={stats.best ? () => openDetail(stats.best!) : undefined} formula="Plus grand résultat net unitaire." />
        <StatCard label="Pire trade" value={stats.worst ? m(stats.worst.netResult) : '—'} color={pnlColor(stats.worst?.netResult)} sub={stats.worst ? `${stats.worst.asset} · ${fmtDate(stats.worst.date, { day: '2-digit', month: 'short' })}` : undefined} onClick={stats.worst ? () => openDetail(stats.worst!) : undefined} formula="Plus petit (plus négatif) résultat net unitaire." />
        <StatCard label="Drawdown maximal" value={m(-stats.maxDrawdown, false)} color={stats.maxDrawdown > 0 ? 'text-loss' : 'text-muted'} formula="Plus forte baisse de la courbe de capital cumulé entre un plus-haut et le creux suivant." />
        <StatCard label="Risque/rendement moyen" value={stats.avgRR === null ? '—' : `${fmtNum(stats.avgRR, 2)} R`} color={pnlColor(stats.avgRR)} sub={stats.rrCount ? `Sur ${stats.rrCount} trade${stats.rrCount > 1 ? 's' : ''} avec risque connu` : 'Renseignez le risque ou le stop-loss'} formula="Moyenne de (résultat net ÷ risque prévu) sur les trades où le risque est connu. 1 R = le risque pris." />
        <StatCard label="Espérance par trade" value={m(stats.expectancy)} color={pnlColor(stats.expectancy)} formula="P&L net ÷ nombre de trades : ce que rapporte un trade en moyenne." />
        <StatCard label="Plan respecté" value={stats.planRespectRate === null ? '—' : fmtPct(stats.planRespectRate, 0)} formula="Part des trades (où l’information est renseignée) pour lesquels vous avez respecté votre plan." />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PnlBarChart trades={p.filtered} currency={cur} />
        </div>
        <WinLossPie wins={stats.wins} losses={stats.losses} breakeven={stats.breakeven} />
      </div>

      <EquityChart trades={p.filtered} startingCapital={startingCapital} currency={cur} />

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupChart title="Performance par stratégie" trades={p.filtered} keyOf={(t) => t.strategy} currency={cur} />
        <GroupChart title="Performance par actif" trades={p.filtered} keyOf={(t) => t.asset} currency={cur} />
      </div>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Derniers trades</h3>
          <Link to="/trades" className="text-xs text-accent hover:underline">
            Tout voir →
          </Link>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-line/60">
            {recent.map((t) => (
              <li key={t.id}>
                <button onClick={() => openDetail(t)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-panel-2/50">
                  <span className="w-24 shrink-0 text-muted">{fmtDate(t.date, { day: '2-digit', month: 'short' })}</span>
                  <span className="font-medium">{t.asset}</span>
                  <span className={`text-xs ${t.direction === 'long' ? 'text-gain' : 'text-loss'}`}>{t.direction === 'long' ? '▲ Long' : '▼ Short'}</span>
                  <span className="hidden truncate text-muted sm:block">{t.strategy}</span>
                  <span className={`ml-auto tabular-nums ${pnlColor(t.netResult)}`}>{fmtMoney(t.netResult, t.currency, true)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Aucun trade sur cette période.</p>
        )}
      </section>
    </div>
  )
}
