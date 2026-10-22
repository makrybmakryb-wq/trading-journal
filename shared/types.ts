// Types et constantes partagés entre le serveur (Express) et l'interface (React).

export const MARKETS = ['Forex', 'Indices', 'Actions', 'Crypto', 'Matières premières', 'Autre'] as const
export type Market = (typeof MARKETS)[number]

export const DIRECTIONS = ['long', 'short'] as const
export type Direction = (typeof DIRECTIONS)[number]

/** Actifs proposés dans le menu déroulant (BTC en premier). « Autre » permet de saisir un nom libre. */
export const ASSETS = ['BTC', 'ETH', 'EUR/USD', 'GOLD', 'NASD', 'Autre'] as const

/** Marché suggéré automatiquement selon l'actif choisi (modifiable dans le formulaire). */
export const ASSET_MARKET: Record<string, Market> = {
  BTC: 'Crypto',
  ETH: 'Crypto',
  'EUR/USD': 'Forex',
  GOLD: 'Matières premières',
  NASD: 'Indices',
}

export const STRATEGIES = ['OPR', 'SMC', 'ITC', 'RESISTANCE', 'Indicateur', 'Autre'] as const

/** Niveau touché en fin de trade : Take-profit ou Stop-loss. */
export const TOUCHES = ['TP', 'SL'] as const
export type Touch = (typeof TOUCHES)[number]

/** Toutes les valeurs sont en dollars. */
export const CURRENCY = 'USD'

/** Un trade tel qu'il est stocké et renvoyé par l'API. */
export interface Trade {
  id: number
  date: string // YYYY-MM-DD
  entryTime: string | null // HH:MM
  exitTime: string | null // HH:MM
  asset: string
  market: Market
  direction: Direction
  entryPrice: number | null
  exitPrice: number | null
  positionSize: number | null // taille de position en % du capital actuel au moment de l'entrée
  amount: number | null // montant engagé, en $
  quantity: number | null // unités déduites (montant ÷ prix d'entrée), conservé pour compatibilité
  touched: Touch | null // niveau touché : TP ou SL
  rr: number | null // ratio risque/rendement visé (RR)
  plannedRisk: number | null // risque calculé automatiquement, en $
  fees: number
  currency: string // toujours 'USD'
  grossResult: number // résultat brut (avant frais)
  netResult: number // résultat net (après frais)
  resultPct: number | null // gain/perte en % du capital engagé
  rrRealized: number | null // résultat net / risque prévu (en R)
  strategy: string | null
  followedPlan: boolean | null
  screenshot: string | null // nom du fichier dans /uploads
  comment: string | null
  mistakes: string | null
  lessons: string | null
  createdAt: string
  updatedAt: string
}

/** Données envoyées par le formulaire (ce que l'utilisateur saisit). */
export interface TradeInput {
  date: string
  entryTime?: string | null
  exitTime?: string | null
  asset: string
  market: Market
  direction: Direction
  entryPrice?: number | null
  exitPrice?: number | null
  positionSize?: number | null
  amount?: number | null
  quantity?: number | null
  touched?: Touch | null
  rr?: number | null
  strategy?: string | null
  followedPlan?: boolean | null
  comment?: string | null
  mistakes?: string | null
  lessons?: string | null
}
