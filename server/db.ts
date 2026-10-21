// Base de données SQLite (fichier local data/journal.db) : les données survivent aux redémarrages.
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type { Trade } from '../shared/types'

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export const db = new Database(path.join(DATA_DIR, process.env.DB_FILE ?? 'journal.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT    NOT NULL,
  entry_time    TEXT,
  exit_time     TEXT,
  asset         TEXT    NOT NULL,
  market        TEXT    NOT NULL,
  direction     TEXT    NOT NULL CHECK (direction IN ('long','short')),
  entry_price   REAL,
  exit_price    REAL,
  position_size REAL,
  quantity      REAL,
  stop_loss     REAL,
  take_profit   REAL,
  planned_risk  REAL,
  fees          REAL    NOT NULL DEFAULT 0,
  currency      TEXT    NOT NULL DEFAULT 'EUR',
  gross_result  REAL    NOT NULL DEFAULT 0,
  net_result    REAL    NOT NULL DEFAULT 0,
  result_pct    REAL,
  rr_realized   REAL,
  strategy      TEXT,
  setup         TEXT,
  followed_plan INTEGER,
  emotion       TEXT,
  screenshot    TEXT,
  comment       TEXT,
  mistakes      TEXT,
  lessons       TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);
`)


/** Convertit une ligne SQL (snake_case) en objet Trade (camelCase). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToTrade(r: any): Trade {
  return {
    id: r.id,
    date: r.date,
    entryTime: r.entry_time,
    exitTime: r.exit_time,
    asset: r.asset,
    market: r.market,
    direction: r.direction,
    entryPrice: r.entry_price,
    exitPrice: r.exit_price,
    positionSize: r.position_size,
    quantity: r.quantity,
    stopLoss: r.stop_loss,
    takeProfit: r.take_profit,
    plannedRisk: r.planned_risk,
    fees: r.fees,
    currency: r.currency,
    grossResult: r.gross_result,
    netResult: r.net_result,
    resultPct: r.result_pct,
    rrRealized: r.rr_realized,
    strategy: r.strategy,
    setup: r.setup,
    followedPlan: r.followed_plan === null ? null : r.followed_plan === 1,
    emotion: r.emotion,
    screenshot: r.screenshot,
    comment: r.comment,
    mistakes: r.mistakes,
    lessons: r.lessons,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
