import type { ReactNode } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Trade } from '../../shared/types'
import { fmtDate, fmtMoney, fmtNum, fmtPct, pnlColor } from '../lib/format'
import { Modal } from './Modal'

export function TradeDetailModal({
  trade: t,
  onClose,
  onEdit,
  onDelete,
}: {
  trade: Trade
  onClose: () => void
  onEdit: (t: Trade) => void
  onDelete: (t: Trade) => void
}) {
  const cur = 'USD'
  return (
    <Modal title={`${t.asset} · ${fmtDate(t.date)}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${t.direction === 'long' ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>{t.direction === 'long' ? 'LONG ▲' : 'SHORT ▼'}</span>
          <span className="text-sm text-muted">{t.market}</span>
          {t.entryTime && (
            <span className="text-sm text-muted">
              {t.entryTime}
              {t.exitTime ? ` → ${t.exitTime}` : ''}
            </span>
          )}
          <div className={`ml-auto text-2xl font-semibold tabular-nums ${pnlColor(t.netResult)}`}>{fmtMoney(t.netResult, cur, true)}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Item label="Prix d’entrée" value={fmtNum(t.entryPrice, 6)} />
          <Item label="Prix de sortie" value={fmtNum(t.exitPrice, 6)} />
          <Item label="Montant" value={t.amount != null ? fmtMoney(t.amount, cur) : t.quantity != null && t.entryPrice != null ? fmtMoney(t.quantity * t.entryPrice, cur) : '—'} />
          <Item label="Taille de position" value={fmtPct(t.positionSize, 2)} />
          <Item label="Touché" value={t.touched ?? '—'} color={t.touched === 'TP' ? 'text-gain' : t.touched === 'SL' ? 'text-loss' : ''} />
          <Item label="RR" value={t.rr === null || t.rr === undefined ? '—' : fmtNum(t.rr, 2)} />
          <Item label="Frais" value={fmtMoney(t.fees, cur)} />
          <Item label="Résultat brut" value={fmtMoney(t.grossResult, cur, true)} color={pnlColor(t.grossResult)} />
          <Item label="Résultat net" value={fmtMoney(t.netResult, cur, true)} color={pnlColor(t.netResult)} />
          <Item label="Gain / perte %" value={fmtPct(t.resultPct, 2, true)} color={pnlColor(t.resultPct)} />
          <Item label="Ratio R réalisé" value={t.rrRealized === null ? '—' : `${fmtNum(t.rrRealized, 2)} R`} color={pnlColor(t.rrRealized)} />
          <Item label="Plan respecté" value={t.followedPlan === null ? '—' : t.followedPlan ? 'Oui ✓' : 'Non ✗'} color={t.followedPlan === null ? '' : t.followedPlan ? 'text-gain' : 'text-loss'} />
          <Item label="Stratégie" value={t.strategy ?? '—'} />
        </div>

        <Note title="Commentaire / analyse" text={t.comment} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Note title="Erreurs commises" text={t.mistakes} />
          <Note title="Leçons à retenir" text={t.lessons} />
        </div>

        {t.screenshot && (
          <a href={t.screenshot} target="_blank" rel="noreferrer">
            <img src={t.screenshot} alt="Capture du graphique" className="max-h-96 rounded-lg border border-line" />
          </a>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button className="btn btn-danger" onClick={() => onDelete(t)}>
            <Trash2 size={15} /> Supprimer
          </button>
          <button className="btn btn-primary" onClick={() => onEdit(t)}>
            <Pencil size={15} /> Modifier
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Item({ label, value, color = '' }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg/50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-medium tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function Note({ title, text }: { title: string; text: string | null }) {
  if (!text) return null
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      <p className="whitespace-pre-wrap rounded-lg border border-line bg-bg/50 p-3 text-sm">{text}</p>
    </div>
  )
}
