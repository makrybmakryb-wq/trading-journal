// Sauvegarde et restauration : fichiers téléchargés / choisis par l'utilisateur.
import { DIRECTIONS, MARKETS, type Trade } from '../../shared/types'
import { tradeDb } from './db'

function download(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

/** CSV lisible directement par Excel en français (séparateur « ; », accents conservés). Sans les captures d'écran. */
export function exportCsv(trades: Trade[]) {
  const cols = Object.keys(trades[0] ?? { id: 0 }).filter((c) => c !== 'screenshot')
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const csv = [cols.join(';'), ...sorted.map((t) => cols.map((c) => esc((t as unknown as Record<string, unknown>)[c])).join(';'))].join('\r\n')
  download(`journal-trading-${stamp()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8')
}

/** Sauvegarde complète (captures d'écran comprises) à ré-importer plus tard, sur cet appareil ou un autre. */
export async function exportJson() {
  const trades = await tradeDb.all()
  download(`journal-trading-sauvegarde-${stamp()}.json`, JSON.stringify({ app: 'trading-journal', version: 1, exportedAt: new Date().toISOString(), trades }, null, 1), 'application/json')
  return trades.length
}

/** Remplace tout le journal par le contenu d'une sauvegarde JSON. Renvoie le nombre de trades importés. */
export async function importJson(file: File): Promise<number> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde valide (JSON illisible).')
  }
  const list = (data as { trades?: unknown })?.trades
  if (!Array.isArray(list)) throw new Error('Ce fichier n’est pas une sauvegarde du journal de trading.')

  const trades = list.map((t, i): Trade => {
    const r = t as Partial<Trade>
    const ok =
      r && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && typeof r.asset === 'string' && MARKETS.includes(r.market as never) && DIRECTIONS.includes(r.direction as never) && typeof r.netResult === 'number' && typeof r.id === 'number'
    if (!ok) throw new Error(`Trade n°${i + 1} invalide dans la sauvegarde : import annulé, vos données actuelles sont intactes.`)
    return r as Trade
  })
  await tradeDb.replaceAll(trades)
  return trades.length
}
