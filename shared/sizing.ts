// Taille de position automatique.
//  1. Départ : on investit 90 % du capital total, converti en quantité (90 % × capital ÷ prix).
//  2. Cette quantité reste FIXE pour tous les trades suivants (pas de recalcul à chaque trade).
//  3. Dès que la valeur de cette quantité (quantité × prix) tombe à 80 % du capital total ou moins,
//     on recalcule une nouvelle quantité = 90 % du capital total actuel, puis on la garde fixe, etc.

import type { Trade } from './types'

export const TARGET_PCT = 0.9
export const THRESHOLD_PCT = 0.8

type T = Pick<Trade, 'id' | 'date' | 'entryTime' | 'netResult' | 'quantity'>

const chrono = (a: T, b: T) => a.date.localeCompare(b.date) || (a.entryTime ?? '').localeCompare(b.entryTime ?? '') || a.id - b.id

export interface Sizing {
  quantity: number | null
  capital: number
  /** true si la quantité vient d'être recalculée (départ ou seuil de 80 % atteint). */
  recalculated: boolean
  /** quantité fixe en cours avant ce trade (null au tout premier trade) */
  held: number | null
}

const floor4 = (v: number) => Math.floor(v * 1e4) / 1e4

/**
 * @param prior  les trades déjà passés (pour une modification : ceux qui précèdent le trade édité)
 */
export function suggestQuantity(prior: T[], startingCapital: number, entryPrice: number | null): Sizing {
  const sorted = [...prior].sort(chrono)
  const capital = startingCapital + sorted.reduce((s, t) => s + t.netResult, 0)
  const held = [...sorted].reverse().find((t) => typeof t.quantity === 'number' && t.quantity > 0)?.quantity ?? null
  if (!entryPrice || entryPrice <= 0 || capital <= 0) return { quantity: held, capital, recalculated: false, held }

  const fresh = floor4((TARGET_PCT * capital) / entryPrice)
  if (held === null) return { quantity: fresh, capital, recalculated: true, held }
  if (held * entryPrice <= THRESHOLD_PCT * capital) return { quantity: fresh, capital, recalculated: true, held }
  return { quantity: held, capital, recalculated: false, held }
}

/** Trades qui précèdent (chronologiquement) un trade donné ; tous les trades si c'est un nouveau trade. */
export function tradesBefore(all: T[], current?: T | null): T[] {
  if (!current) return all
  return all.filter((t) => t.id !== current.id && chrono(t, current) < 0)
}
