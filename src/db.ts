import Database from "better-sqlite3";
import { createHash, randomBytes } from "crypto";
import { mkdirSync } from "fs";
import { dirname } from "path";

const DB_PATH = process.env.DB_PATH ?? "./data/holdings.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    key_hash   TEXT PRIMARY KEY,
    tier       TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS holdings (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL,
    coin_id            TEXT NOT NULL,
    symbol             TEXT NOT NULL,
    quantity           REAL NOT NULL,
    purchase_price_usd REAL,
    purchase_date      TEXT,
    exchange           TEXT,
    notes              TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
`);

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): string {
  return randomBytes(24).toString("hex"); // 48-char hex key
}

export function validateKey(rawKey: string): { valid: boolean; tier: string } {
  const row = db
    .prepare("SELECT tier FROM api_keys WHERE key_hash = ?")
    .get(hashKey(rawKey)) as { tier: string } | undefined;
  return row ? { valid: true, tier: row.tier } : { valid: false, tier: "none" };
}

export function createKey(tier: "free" | "pro" = "free"): string {
  const key = generateApiKey();
  db.prepare("INSERT INTO api_keys (key_hash, tier) VALUES (?, ?)").run(
    hashKey(key),
    tier
  );
  return key;
}

export function getUserId(rawKey: string): string {
  return hashKey(rawKey);
}

export function getHoldings(userId: string) {
  return db
    .prepare("SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at")
    .all(userId) as HoldingRow[];
}

export function countHoldings(userId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as n FROM holdings WHERE user_id = ?")
    .get(userId) as { n: number };
  return row.n;
}

export function upsertHolding(holding: HoldingRow): void {
  db.prepare(`
    INSERT INTO holdings
      (id, user_id, coin_id, symbol, quantity, purchase_price_usd, purchase_date, exchange, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      quantity = excluded.quantity,
      purchase_price_usd = excluded.purchase_price_usd,
      purchase_date = excluded.purchase_date,
      exchange = excluded.exchange,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(
    holding.id,
    holding.user_id,
    holding.coin_id,
    holding.symbol,
    holding.quantity,
    holding.purchase_price_usd ?? null,
    holding.purchase_date ?? null,
    holding.exchange ?? null,
    holding.notes ?? null
  );
}

export function deleteHolding(userId: string, coinId: string, exchange?: string): number {
  if (exchange) {
    const r = db
      .prepare("DELETE FROM holdings WHERE user_id = ? AND coin_id = ? AND exchange = ?")
      .run(userId, coinId, exchange);
    return r.changes;
  }
  const r = db
    .prepare("DELETE FROM holdings WHERE user_id = ? AND coin_id = ?")
    .run(userId, coinId);
  return r.changes;
}

export interface HoldingRow {
  id: string;
  user_id: string;
  coin_id: string;
  symbol: string;
  quantity: number;
  purchase_price_usd: number | null;
  purchase_date: string | null;
  exchange: string | null;
  notes: string | null;
}

export default db;
