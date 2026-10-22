// Calculs automatiques d'un trade. Utilisé à l'enregistrement ET par le formulaire (aperçu en direct)
// pour garantir des résultats identiques. Tout est en dollars.

import type { Direction, Touch } from './types'

/** Commission : 0,0005 (= 0,05 %) du montant échangé, appliquée à l'entrée ET à la sortie. */
export const FEE_RATE = 0.0005

export interface CalcInput {
  direction: Direction
  entryPrice?: number | null
  exitPrice?: number | null
  quantity?: number | null
  touched?: Touch | null
  rr?: number | null
}

export interface CalcOutput {
  /** Résultat brut calculé depuis les prix (null si entrée, sortie ou quantité manquent). */
  autoGross: number | null
  grossResult: number
  fees: number
  netResult: number
  resultPct: number | null
  /** Risque calculé tout seul (voir formule ci-dessous), null si indéterminable. */
  riskUsed: number | null
  rrRealized: number | null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d

/**
 * Formules :
 *  - Brut (long)  = (sortie − entrée) × quantité        Brut (short) = (entrée − sortie) × quantité
 *  - Frais        = 0,0005 × quantité × (entrée + sortie)
 *  - Net          = Brut − frais
 *  - % gain/perte = Net ÷ (entrée × quantité) × 100
 *  - Risque       : SL touché → |perte brute| ; TP touché avec RR → gain brut ÷ RR
 *  - R réalisé    = Net ÷ Risque
 */
export function computeTrade(i: CalcInput): CalcOutput {
  const sign = i.direction === 'long' ? 1 : -1
  const ready = isNum(i.entryPrice) && isNum(i.exitPrice) && isNum(i.quantity)

  const autoGross = ready ? round((i.exitPrice! - i.entryPrice!) * sign * i.quantity!, 4) : null
  const gross = autoGross ?? 0
  const fees = ready ? round(FEE_RATE * i.quantity! * (i.entryPrice! + i.exitPrice!), 4) : 0
  const net = round(gross - fees, 4)

  const resultPct = isNum(i.entryPrice) && isNum(i.quantity) && i.entryPrice * i.quantity > 0 ? round((net / (i.entryPrice * i.quantity)) * 100, 4) : null

  let riskUsed: number | null = null
  if (autoGross !== null) {
    if (i.touched === 'SL' && gross < 0) riskUsed = round(Math.abs(gross), 4)
    else if (i.touched === 'TP' && isNum(i.rr) && i.rr > 0 && gross > 0) riskUsed = round(gross / i.rr, 4)
  }
  const rrRealized = riskUsed ? round(net / riskUsed, 3) : null

  return { autoGross, grossResult: round(gross, 4), fees, netResult: net, resultPct, riskUsed, rrRealized }
}
