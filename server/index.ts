// Serveur Express : API REST + service de l'interface compilée (dist/) + captures d'écran.
import express from 'express'
import multer from 'multer'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { db, rowToTrade, UPLOAD_DIR } from './db'
import { computeTrade } from '../shared/calc'
import { MARKETS, DIRECTIONS } from '../shared/types'

const PORT = Number(process.env.PORT ?? 3000)
const app = express()
app.use(express.json({ limit: '1mb' }))

// ---------- Validation (zod) ----------
// Les champs facultatifs acceptent null / chaîne vide et sont normalisés en null.
const optNum = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.number().finite().nullable(),
)
const optStr = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || null : v ?? null),
  z.string().max(5000).nullable(),
)
const optTime = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)').nullable(),
)

const tradeSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
    entryTime: optTime,
    exitTime: optTime,
    asset: z.string().trim().min(1, "L'actif est obligatoire").max(40).transform((s) => s.toUpperCase()),
    market: z.enum(MARKETS),
    direction: z.enum(DIRECTIONS),
    entryPrice: optNum,
    exitPrice: optNum,
    positionSize: optNum,
    quantity: optNum.refine((v) => v === null || v > 0, 'La quantité doit être positive'),
    stopLoss: optNum,
    takeProfit: optNum,
    plannedRisk: optNum.refine((v) => v === null || v >= 0, 'Le risque doit être positif'),
    fees: optNum.refine((v) => v === null || v >= 0, 'Les frais doivent être positifs'),
    currency: z.string().trim().min(1).max(8).default('EUR'),
    grossResult: optNum,
    strategy: optStr,
    setup: optStr,
    followedPlan: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.boolean().nullable()),
    emotion: optStr,
    comment: optStr,
    mistakes: optStr,
    lessons: optStr,
    removeScreenshot: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.entryTime && d.exitTime && d.exitTime < d.entryTime) {
      // Autorisé (trade qui passe minuit) : on ne bloque pas, c'est juste inhabituel.
    }
    // Cohérence stop-loss / take-profit avec le sens de la position
    if (d.entryPrice !== null && d.stopLoss !== null) {
      const bad = d.direction === 'long' ? d.stopLoss >= d.entryPrice : d.stopLoss <= d.entryPrice
      if (bad) ctx.addIssue({ code: 'custom', path: ['stopLoss'], message: d.direction === 'long' ? 'Stop-loss doit être sous le prix d’entrée (long)' : 'Stop-loss doit être au-dessus du prix d’entrée (short)' })
    }
    if (d.entryPrice !== null && d.takeProfit !== null) {
      const bad = d.direction === 'long' ? d.takeProfit <= d.entryPrice : d.takeProfit >= d.entryPrice
      if (bad) ctx.addIssue({ code: 'custom', path: ['takeProfit'], message: d.direction === 'long' ? 'Take-profit doit être au-dessus du prix d’entrée (long)' : 'Take-profit doit être sous le prix d’entrée (short)' })
    }
    if (d.grossResult === null && !(d.entryPrice !== null && d.exitPrice !== null && d.quantity !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['grossResult'],
        message: 'Renseignez prix d’entrée, prix de sortie et quantité, ou saisissez directement le résultat brut',
      })
    }
  })

type ParsedTrade = z.infer<typeof tradeSchema>

// ---------- Captures d'écran (multer) ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Format d’image non supporté (PNG, JPG, WEBP, GIF)'))
  },
})

const removeFile = (name: string | null | undefined) => {
  if (!name) return
  const p = path.join(UPLOAD_DIR, path.basename(name))
  fs.rm(p, { force: true }, () => {})
}

/** Le formulaire envoie un multipart : champ "data" (JSON) + fichier optionnel "screenshot". */
function parseBody(req: express.Request): unknown {
  if (typeof req.body?.data === 'string') return JSON.parse(req.body.data)
  return req.body
}

function columns(d: ParsedTrade) {
  const c = computeTrade({
    direction: d.direction,
    entryPrice: d.entryPrice,
    exitPrice: d.exitPrice,
    quantity: d.quantity,
    stopLoss: d.stopLoss,
    plannedRisk: d.plannedRisk,
    fees: d.fees,
    grossResult: d.grossResult,
  })
  return {
    date: d.date,
    entry_time: d.entryTime,
    exit_time: d.exitTime,
    asset: d.asset,
    market: d.market,
    direction: d.direction,
    entry_price: d.entryPrice,
    exit_price: d.exitPrice,
    position_size: d.positionSize,
    quantity: d.quantity,
    stop_loss: d.stopLoss,
    take_profit: d.takeProfit,
    // Si le risque n'est pas saisi mais déductible du stop-loss, on le mémorise
    planned_risk: d.plannedRisk ?? c.riskUsed,
    fees: d.fees ?? 0,
    currency: d.currency,
    gross_result: c.grossResult,
    net_result: c.netResult,
    result_pct: c.resultPct,
    rr_realized: c.rrRealized,
    strategy: d.strategy,
    setup: d.setup,
    followed_plan: d.followedPlan === null ? null : d.followedPlan ? 1 : 0,
    emotion: d.emotion,
    comment: d.comment,
    mistakes: d.mistakes,
    lessons: d.lessons,
  }
}

const fail = (res: express.Response, err: unknown) => {
  if (err instanceof z.ZodError) {
    const fields: Record<string, string> = {}
    for (const i of err.issues) fields[String(i.path[0] ?? '_')] ??= i.message
    return res.status(400).json({ error: 'Validation échouée', fields })
  }
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'JSON invalide' })
  console.error(err)
  return res.status(500).json({ error: (err as Error).message ?? 'Erreur serveur' })
}

// ---------- Routes API ----------
const api = express.Router()

api.get('/health', (_req, res) => res.json({ ok: true }))

// Liste des trades. L'interface calcule les statistiques côté client, mais on accepte aussi des filtres.
api.get('/trades', (req, res) => {
  const { from, to, market, strategy, asset, direction } = req.query as Record<string, string | undefined>
  const where: string[] = []
  const args: unknown[] = []
  if (from) (where.push('date >= ?'), args.push(from))
  if (to) (where.push('date <= ?'), args.push(to))
  if (market) (where.push('market = ?'), args.push(market))
  if (strategy) (where.push('strategy = ?'), args.push(strategy))
  if (asset) (where.push('asset = ?'), args.push(asset.toUpperCase()))
  if (direction) (where.push('direction = ?'), args.push(direction))
  const sql = `SELECT * FROM trades ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC, COALESCE(entry_time,'') DESC, id DESC`
  res.json(db.prepare(sql).all(...args).map(rowToTrade))
})

api.get('/trades/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Trade introuvable' })
  res.json(rowToTrade(row as any))
})

api.post('/trades', upload.single('screenshot'), (req, res) => {
  try {
    const d = tradeSchema.parse(parseBody(req))
    const c = columns(d)
    const screenshot = req.file?.filename ?? null
    const keys = Object.keys(c)
    const info = db
      .prepare(`INSERT INTO trades (${keys.join(',')}, screenshot) VALUES (${keys.map((k) => '@' + k).join(',')}, @screenshot)`)
      .run({ ...c, screenshot })
    res.status(201).json(rowToTrade(db.prepare('SELECT * FROM trades WHERE id = ?').get(info.lastInsertRowid) as any))
  } catch (e) {
    removeFile(req.file?.filename)
    fail(res, e)
  }
})

api.put('/trades/:id', upload.single('screenshot'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      removeFile(req.file?.filename)
      return res.status(404).json({ error: 'Trade introuvable' })
    }
    const d = tradeSchema.parse(parseBody(req))
    const c = columns(d)
    let screenshot: string | null = existing.screenshot
    if (req.file) {
      removeFile(existing.screenshot)
      screenshot = req.file.filename
    } else if (d.removeScreenshot) {
      removeFile(existing.screenshot)
      screenshot = null
    }
    const sets = Object.keys(c).map((k) => `${k} = @${k}`)
    db.prepare(`UPDATE trades SET ${sets.join(', ')}, screenshot = @screenshot, updated_at = datetime('now') WHERE id = @id`).run({
      ...c,
      screenshot,
      id: existing.id,
    })
    res.json(rowToTrade(db.prepare('SELECT * FROM trades WHERE id = ?').get(existing.id) as any))
  } catch (e) {
    removeFile(req.file?.filename)
    fail(res, e)
  }
})

api.delete('/trades/:id', (req, res) => {
  const row = db.prepare('SELECT screenshot FROM trades WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'Trade introuvable' })
  db.prepare('DELETE FROM trades WHERE id = ?').run(req.params.id)
  removeFile(row.screenshot)
  res.status(204).end()
})

// Listes pour l'auto-complétion du formulaire
api.get('/meta', (_req, res) => {
  const list = (col: string) =>
    (db.prepare(`SELECT DISTINCT ${col} v FROM trades WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY ${col}`).all() as { v: string }[]).map((r) => r.v)
  res.json({ assets: list('asset'), strategies: list('strategy'), setups: list('setup') })
})

// Export CSV de tout l'historique
api.get('/export.csv', (_req, res) => {
  const rows = db.prepare('SELECT * FROM trades ORDER BY date, id').all() as any[]
  const cols = rows.length ? Object.keys(rows[0]) : ['id']
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="journal-trading.csv"')
  res.send('﻿' + csv)
})

app.use('/api', api)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }))

// Gestion des erreurs multer (fichier trop gros, mauvais format…)
app.use('/api', (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: err.message })
})

// ---------- Interface compilée (production) ----------
const dist = path.resolve('dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  // Toute autre URL renvoie index.html : c'est React Router qui gère la navigation
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res.type('text').send("Interface non compilée. Lancez 'npm run build' puis 'npm start' (ou 'npm run dev' et ouvrez http://localhost:5173).")
  })
}

app.listen(PORT, () => {
  console.log(`📈 Journal de trading : http://localhost:${PORT}`)
})
