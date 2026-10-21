import { useMemo } from 'react'
import { computeStats } from '../../shared/stats'
import { useStore } from '../lib/store'
import { fmtMoney, fmtPct, mainCurrency, pnlColor } from '../lib/format'
import { PeriodFilter, usePeriod } from '../components/PeriodFilter'
import { GroupChart } from '../components/Charts'
import { StatCard } from '../components/StatCard'

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export function AnalyticsPage() {
  const { trades } = useStore()
  const p = usePeriod(trades, 'all')
  const cur = mainCurrency(trades)
  const t = p.filtered

  const plan = useMemo(() => {
    const yes = computeStats(t.filter((x) => x.followedPlan === true))
    const no = computeStats(t.filter((x) => x.followedPlan === false))
    return { yes, no }
  }, [t])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analyses</h1>
          <p className="text-sm text-muted">Où gagnez-vous, où perdez-vous ? Comparez vos résultats selon plusieurs angles.</p>
        </div>
        <PeriodFilter p={p} />
      </div>

      {(plan.yes.total > 0 || plan.no.total > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Plan respecté" value={fmtMoney(plan.yes.netPnl, cur, true)} color={pnlColor(plan.yes.netPnl)} sub={`${plan.yes.total} trades · réussite ${fmtPct(plan.yes.winRate, 0)} · espérance ${fmtMoney(plan.yes.expectancy, cur, true)}`} />
          <StatCard label="Plan non respecté" value={fmtMoney(plan.no.netPnl, cur, true)} color={pnlColor(plan.no.netPnl)} sub={`${plan.no.total} trades · réussite ${fmtPct(plan.no.winRate, 0)} · espérance ${fmtMoney(plan.no.expectancy, cur, true)}`} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupChart title="Par marché" trades={t} keyOf={(x) => x.market} currency={cur} />
        <GroupChart title="Par stratégie" trades={t} keyOf={(x) => x.strategy} currency={cur} />
        <GroupChart title="Par actif" trades={t} keyOf={(x) => x.asset} currency={cur} />
        <GroupChart title="Par type de configuration" trades={t} keyOf={(x) => x.setup} currency={cur} />
        <GroupChart title="Par émotion ressentie" trades={t} keyOf={(x) => x.emotion} currency={cur} />
        <GroupChart title="Par sens (long / short)" trades={t} keyOf={(x) => (x.direction === 'long' ? 'Long' : 'Short')} currency={cur} />
        <GroupChart title="Par jour de la semaine" trades={t} keyOf={(x) => WEEKDAYS[new Date(x.date + 'T12:00:00').getDay()]} currency={cur} />
        <GroupChart title="Respect du plan" trades={t} keyOf={(x) => (x.followedPlan === null ? null : x.followedPlan ? 'Plan respecté' : 'Plan non respecté')} currency={cur} />
      </div>
    </div>
  )
}
