const nf = (min: number, max: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max })
const money0 = nf(0, 2)

export const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', JPY: '¥', USDT: 'USDT', BTC: 'BTC' }

export function fmtMoney(v: number | null | undefined, currency = 'EUR', sign = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const s = money0.format(Math.abs(v))
  const prefix = v < 0 ? '−' : sign && v > 0 ? '+' : ''
  const sym = CURRENCY_SYMBOLS[currency] ?? currency
  return `${prefix}${s} ${sym}`
}

export function fmtNum(v: number | null | undefined, max = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return nf(0, max).format(v)
}

export function fmtPct(v: number | null | undefined, digits = 1, sign = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const prefix = v < 0 ? '−' : sign && v > 0 ? '+' : ''
  return `${prefix}${nf(digits, digits).format(Math.abs(v))} %`
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', opts)
}

export const fmtMonthKey = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
  return s
}

/** Classe Tailwind selon le signe : vert / rouge / neutre. */
export const pnlColor = (v: number | null | undefined) => (!v ? 'text-muted' : v > 0 ? 'text-gain' : 'text-loss')

/** Devise la plus utilisée dans une liste de trades (pour afficher les totaux). */
export function mainCurrency(trades: { currency: string }[]): string {
  const count = new Map<string, number>()
  for (const t of trades) count.set(t.currency, (count.get(t.currency) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'EUR'
}
