// Couche de données : mêmes fonctions qu'avant (list, meta, save, remove), mais tout se passe dans le navigateur.
import { MARKETS, DIRECTIONS, CURRENCY, type Trade, type TradeInput } from '../../shared/types'
import { computeTrade } from '../../shared/calc'
import { tradeDb } from './db'

export class ApiError extends Error {
  fields: Record<string, string>
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message)
    this.fields = fields
  }
}

const nullable = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const text = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Lit une image, la réduit (max 1600 px) et la renvoie en JPEG encodé en texte (data URL) : léger à stocker. */
async function imageToDataUrl(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Lecture de l’image impossible'))
    r.readAsDataURL(file)
  })
  if (file.type === 'image/gif') return original
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Image illisible'))
      i.src = original
    })
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return original
  }
}

/** Contrôles de sécurité (le formulaire valide déjà en amont ; ici on protège la base). */
function check(input: TradeInput) {
  const fields: Record<string, string> = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) fields.date = 'Date invalide'
  if (!input.asset?.trim()) fields.asset = "L'actif est obligatoire"
  if (!MARKETS.includes(input.market)) fields.market = 'Marché invalide'
  if (!DIRECTIONS.includes(input.direction)) fields.direction = 'Sens invalide'
  if (nullable(input.entryPrice) === null) fields.entryPrice = 'Prix d’entrée obligatoire'
  if (nullable(input.exitPrice) === null) fields.exitPrice = 'Prix de sortie obligatoire'
  if (nullable(input.quantity) === null) fields.quantity = 'Quantité obligatoire'
  if (Object.keys(fields).length) throw new ApiError('Validation échouée', fields)
}

function sortTrades(list: Trade[]): Trade[] {
  return list.sort((a, b) => b.date.localeCompare(a.date) || (b.entryTime ?? '').localeCompare(a.entryTime ?? '') || b.id - a.id)
}

export const api = {
  list: async () => sortTrades(await tradeDb.all()),

  save: async (input: TradeInput & { removeScreenshot?: boolean }, file: File | null, id?: number): Promise<Trade> => {
    check(input)
    const existing = id ? await tradeDb.get(id) : undefined
    if (id && !existing) throw new ApiError('Trade introuvable')

    const c = computeTrade({
      direction: input.direction,
      entryPrice: nullable(input.entryPrice),
      exitPrice: nullable(input.exitPrice),
      quantity: nullable(input.quantity),
      touched: input.touched ?? null,
      rr: nullable(input.rr),
    })

    let screenshot = existing?.screenshot ?? null
    if (file) screenshot = await imageToDataUrl(file)
    else if (input.removeScreenshot) screenshot = null

    const now = new Date().toISOString()
    const base: Omit<Trade, 'id'> = {
      date: input.date,
      entryTime: input.entryTime || null,
      exitTime: input.exitTime || null,
      asset: input.asset.trim().toUpperCase(),
      market: input.market,
      direction: input.direction,
      entryPrice: nullable(input.entryPrice),
      exitPrice: nullable(input.exitPrice),
      positionSize: nullable(input.positionSize),
      quantity: nullable(input.quantity),
      touched: input.touched ?? null,
      rr: nullable(input.rr),
      plannedRisk: c.riskUsed, // risque calculé automatiquement
      fees: c.fees, // commission calculée automatiquement
      currency: CURRENCY,
      grossResult: c.grossResult,
      netResult: c.netResult,
      resultPct: c.resultPct,
      rrRealized: c.rrRealized,
      strategy: text(input.strategy),
      followedPlan: input.followedPlan ?? null,
      screenshot,
      comment: text(input.comment),
      mistakes: text(input.mistakes),
      lessons: text(input.lessons),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (existing) {
      const trade: Trade = { ...base, id: existing.id }
      await tradeDb.put(trade)
      return trade
    }
    const newId = await tradeDb.add(base)
    return { ...base, id: newId }
  },

  remove: (id: number) => tradeDb.remove(id).then(() => undefined),
}
