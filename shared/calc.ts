// Calculs automatiques d'un trade. Utilisé par le serveur (à l'enregistrement)
// ET par le formulaire (aperçu en direct) pour garantir des résultats identiques.

import type { Direction } from './types'

export interface CalcInput {
  direction: Direction
  entryPrice?: number | null
  exitPrice?: number | null
  quantity?: number | null
  stopLoss?: number | null
  plannedRisk?: number | null
  fees?: number | null
  grossResult?: number | null // saisie manuelle éventuelle
}

export interface CalcOutput {
  /** Résultat brut calculé automatiquement depuis les prix (null si impossible). */
  autoGross: number | null
  grossResult: number
  netResult: number
  resultPct: number | null
  /** Risque utilisé pour le ratio (risque prévu saisi, sinon |entrée − stop| × quantité). */
  riskUsed: number | null
  rrRealized: number | null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d

/**
 * Formules :
 *  - Brut (long)  = (sortie − entrée) × quantité
 *  - Brut (short) = (entrée − sortie) × quantité
 *  - Net          = Brut − frais
 *  - % gain/perte = Net ÷ (entrée × quantité) × 100      (capital engagé)
 *  - Risque       = risque prévu, sinon |entrée − stop-loss| × quantité
 *  - R réalisé    = Net ÷ Risque
 * Si le résultat brut est saisi manuellement (utile en Forex/CFD où la valeur du pip varie),
 * il remplace le brut calculé.
 */
export function computeTrade(i: CalcInput): CalcOutput {
  const fees = isNum(i.fees) ? i.fees : 0
  const sign = i.direction === 'long' ? 1 : -1

  let autoGross: number | null = null
  if (isNum(i.entryPrice) && isNum(i.exitPrice) && isNum(i.quantity)) {
    autoGross = round((i.exitPrice - i.entryPrice) * sign * i.quantity, 4)
  }

  const gross = isNum(i.grossResult) ? i.grossResult : autoGross ?? 0
  const net = round(gross - fees, 4)

  let resultPct: number | null = null
  if (isNum(i.entryPrice) && isNum(i.quantity) && i.entryPrice * i.quantity > 0) {
    resultPct = round((net / (i.entryPrice * i.quantity)) * 100, 4)
  }

  let riskUsed: number | null = null
  if (isNum(i.plannedRisk) && i.plannedRisk > 0) riskUsed = i.plannedRisk
  else if (isNum(i.entryPrice) && isNum(i.stopLoss) && isNum(i.quantity)) {
    const r = Math.abs(i.entryPrice - i.stopLoss) * i.quantity
    if (r > 0) riskUsed = round(r, 4)
  }

  const rrRealized = riskUsed ? round(net / riskUsed, 3) : null

  return { autoGross, grossResult: round(gross, 4), netResult: net, resultPct, riskUsed, rrRealized }
}
