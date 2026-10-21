// Types et constantes partagés entre le serveur (Express) et l'interface (React).

export const MARKETS = ['Forex', 'Indices', 'Actions', 'Crypto', 'Matières premières', 'Autre'] as const
export type Market = (typeof MARKETS)[number]

export const DIRECTIONS = ['long', 'short'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const EMOTIONS = [
  'Calme',
  'Confiant',
  'Concentré',
  'Neutre',
  'Hésitant',
  'Anxieux',
  'Impatient',
  'FOMO',
  'Euphorique',
  'Frustré',
  'Vengeur (revenge)',
] as const

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'USDT', 'BTC'] as const

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
  positionSize: number | null // taille de la position (valeur ou lots)
  quantity: number | null
  stopLoss: number | null
  takeProfit: number | null
  plannedRisk: number | null // risque prévu en devise
  fees: number
  currency: string
  grossResult: number // résultat brut (avant frais)
  netResult: number // résultat net (après frais)
  resultPct: number | null // gain/perte en % du capital engagé
  rrRealized: number | null // résultat net / risque prévu (en R)
  strategy: string | null
  setup: string | null
  followedPlan: boolean | null
  emotion: string | null
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
  quantity?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  plannedRisk?: number | null
  fees?: number | null
  currency?: string
  /** Résultat brut saisi à la main (prioritaire sur le calcul automatique). */
  grossResult?: number | null
  strategy?: string | null
  setup?: string | null
  followedPlan?: boolean | null
  emotion?: string | null
  comment?: string | null
  mistakes?: string | null
  lessons?: string | null
}
