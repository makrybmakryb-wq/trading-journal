// Calculs automatiques d'un trade. Utilisé à l'enregistrement ET par le formulaire (aperçu en direct)
// pour garantir des résultats identiques. Tout est en dollars.

import type { Direction, Touch } from './types'

/** Commission : 0,0005 % (= 0,000005) du montant engagé, uniquement à l'ENTRÉE. Ex. 1 000 000 $ → 5 $. */
export const FEE_RATE = 0.0005 / 100

export interface CalcInput {
  direction: Direction
  entryPrice?: number | null
  exitPrice?: number | null
  /** Montant engagé, en $ */
  amount?: number | null
  touched?: Touch | null
  rr?: number | null
}

export interface CalcOutput {
  /** Résultat brut calculé depuis les prix (null si entrée, sortie ou montant manquent). */
  autoGross: number | null
  grossResult: number
  fees: number
  netResult: number
  /** Gain/perte net en % du montant engagé */
  resultPct: number | null
  /** Ratio R réalisé = le RR saisi (TP touché) ou −1 R (SL touché) */
  rrRealized: number | null
  /** Unités déduites : montant ÷ prix d'entrée */
  quantity: number | null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d

/**
 * Formules :
 *  - Brut (long)  = montant × (sortie − entrée) ÷ entrée     Brut (short) = montant × (entrée − sortie) ÷ entrée
 *  - Frais        = 0,0005 % × montant (à l'entrée seulement)
 *  - Net          = Brut − frais
 *  - % gain/perte = Net ÷ montant × 100
 *  - R réalisé    = RR saisi si TP touché ; −1 si SL touché
 */
export function computeTrade(i: CalcInput): CalcOutput {
  const sign = i.direction === 'long' ? 1 : -1
  const ready = isNum(i.entryPrice) && i.entryPrice > 0 && isNum(i.exitPrice) && isNum(i.amount)

  const autoGross = ready ? round(((i.exitPrice! - i.entryPrice!) / i.entryPrice!) * sign * i.amount!, 4) : null
  const gross = autoGross ?? 0
  const fees = isNum(i.amount) ? round(FEE_RATE * i.amount, 6) : 0
  const net = round(gross - fees, 4)

  const resultPct = isNum(i.amount) && i.amount > 0 ? round((net / i.amount) * 100, 4) : null

  let rrRealized: number | null = null
  if (i.touched === 'TP' && isNum(i.rr) && i.rr > 0) rrRealized = round(i.rr, 3)
  else if (i.touched === 'SL') rrRealized = -1

  const quantity = ready ? round(i.amount! / i.entryPrice!, 8) : null
  return { autoGross, grossResult: round(gross, 4), fees, netResult: net, resultPct, rrRealized, quantity }
}
