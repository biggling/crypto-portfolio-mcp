# Crypto Portfolio MCP

> Track, analyze, and optimize your crypto portfolio directly inside Claude — multi-exchange, multi-coin, multi-wallet, with live prices and unrealized P&L.

**MCP server** (Model Context Protocol) that turns Claude into your personal crypto portfolio analyst. Connect it once and ask natural questions like *"What's my BTC up by since I bought?"* or *"How would my net worth have looked during the May crash?"* — Claude calls these tools under the hood.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Transport: Streamable HTTP](https://img.shields.io/badge/transport-Streamable_HTTP-green.svg)](#)
[![Node 20+](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](#)

---

## What it does

A Claude-native portfolio tracker that:

- **Records holdings** across exchanges and wallets (Coinbase, Binance, Kraken, MetaMask, Ledger, anything)
- **Calculates real P&L** — current value, cost basis, unrealized gain/loss in USD and %, allocation breakdown
- **Streams live prices** from CoinGecko (Demo tier, free)
- **Reconstructs historical value** — what was your portfolio worth on March 14, 2024? Now you can ask
- **Surveys the market** — BTC dominance, trending coins, top-10 movers — without leaving the chat

It's the data layer for the companion [Crypto Tax MCP](https://github.com/biggling/crypto-tax-mcp), but works fully standalone.

---

## Who it's for

| Persona | Why they use it |
|---|---|
| **Multi-exchange holders** | One place to ask "what am I actually worth?" instead of opening five apps |
| **DeFi/Layer-1 explorers** | Track holdings the exchange dashboards don't see (cold storage, hardware wallets) |
| **Active traders** | Quick P&L checks during a session without breaking flow |
| **Tax prep** | Feed the data into Crypto Tax MCP at year-end for 1099-DA reconciliation |
| **Claude power users** | You already chat with Claude all day — your portfolio should live there too |

---

## Tools (7)

| Tool | Purpose |
|---|---|
| `get_portfolio_summary` | Total value + per-asset P&L + allocation % |
| `get_asset_price` | Live price for 1–50 coins |
| `add_holding` | Record a purchase (coin, qty, price, date, exchange) |
| `remove_holding` | Remove a holding (all entries or one exchange) |
| `get_portfolio_history` | Daily portfolio value over 1–365 days |
| `search_coin` | Resolve name/symbol → CoinGecko ID |
| `get_market_overview` | Market cap, BTC dominance, trending, top-10 |

---

## Example conversations

These are the real prompts users say to Claude — what happens behind the scenes is shown in italics.

### 1. First-time setup: record a holding

> **You:** "I bought 0.5 BTC on Coinbase on Jan 15, 2024 at $42,000."

*Claude calls:* `search_coin("BTC")` → finds `bitcoin` → `add_holding({coin_id: "bitcoin", symbol: "BTC", quantity: 0.5, purchase_price_usd: 42000, purchase_date: "2024-01-15", exchange: "Coinbase"})`

> **Claude:** "Done. Tracking 0.5 BTC purchased Jan 15, 2024 at $42,000 on Coinbase ($21,000 cost basis)."

---

### 2. Check what you're worth right now

> **You:** "What's my portfolio worth?"

*Claude calls:* `get_portfolio_summary({currency: "usd"})`

> **Claude:** "Your portfolio is worth **$73,420** across 5 assets, up **+$18,920 (+34.7%)** vs cost basis.
> - **BTC** $48,200 (65.6%) — +$27,200 / +129% ↑
> - **ETH** $15,100 (20.6%) — −$2,100 / −12% ↓
> - **SOL** $6,800 (9.3%) — +$3,800 / +127% ↑
> - **USDT** $2,500 (3.4%) — flat
> - **MATIC** $820 (1.1%) — −$180 / −18% ↓"

<details>
<summary>Raw JSON output</summary>

```json
{
  "total_value": 73420.00,
  "total_cost_basis": 54500.00,
  "total_unrealized_pnl_usd": 18920.00,
  "total_unrealized_pnl_pct": 34.72,
  "currency": "usd",
  "asset_count": 5,
  "holdings": [
    {
      "coin_id": "bitcoin",
      "symbol": "BTC",
      "quantity": 0.5,
      "current_price": 96400,
      "value": 48200,
      "exchange": "Coinbase",
      "purchase_price_usd": 42000,
      "cost_basis": 21000,
      "unrealized_pnl_usd": 27200,
      "unrealized_pnl_pct": 129.52,
      "price_change_24h_pct": 2.4,
      "allocation_pct": 65.65
    }
  ]
}
```
</details>

---

### 3. Quick price check (no holding needed)

> **You:** "What's the price of SOL and AVAX right now?"

*Claude calls:* `get_asset_price({coins: ["solana", "avalanche-2"]})`

> **Claude:** "**SOL** is at $185.40 (+3.2% 24h, $84B mcap). **AVAX** is at $42.10 (−1.8% 24h, $17B mcap)."

---

### 4. Find the right coin ID

> **You:** "I want to add my Polygon holdings. What's the CoinGecko ID?"

*Claude calls:* `search_coin({query: "polygon"})`

> **Claude:** "Polygon is now branded as POL with ID `polygon-ecosystem-token`. The old MATIC token is `matic-network`. Which one do you hold?"

---

### 5. Add a wallet holding (no price/date)

> **You:** "Add 12 ETH in my Ledger cold storage. I don't remember the buy price."

*Claude calls:* `add_holding({coin_id: "ethereum", symbol: "ETH", quantity: 12, exchange: "Ledger"})`

> **Claude:** "Added 12 ETH on Ledger. No cost basis recorded — current value will show, but unrealized P&L will be null. Add a purchase price later with `add_holding` if you want gain tracking."

---

### 6. Visualize the portfolio over time

> **You:** "Show me how my portfolio performed over the last 90 days."

*Claude calls:* `get_portfolio_history({days: 90})`

> **Claude:** "Your portfolio over 90 days:
> - **Day 1** (Mar 10): $58,200
> - **Peak** (Apr 22): $81,400
> - **Trough** (May 15): $52,100
> - **Today** (Jun 8): $73,420
>
> Net change: **+$15,220 (+26.2%)**. You weathered the May correction and have recovered ~89% of the peak."

<details>
<summary>Raw JSON output (truncated)</summary>

```json
{
  "currency": "usd",
  "days": 90,
  "data_points": 90,
  "history": [
    {"date": "2026-03-10", "value": 58200.00},
    {"date": "2026-03-11", "value": 59100.00},
    "...",
    {"date": "2026-06-08", "value": 73420.00}
  ]
}
```
</details>

---

### 7. "What's everyone talking about?"

> **You:** "Give me a market snapshot — what's hot right now?"

*Claude calls:* `get_market_overview()`

> **Claude:** "**Total crypto mcap:** $3.2T (−1.2% 24h). **BTC dominance:** 56.8%. **ETH:** 14.2%.
>
> **Trending now:** Hyperliquid (HYPE), Bittensor (TAO), Ondo (ONDO), Sui (SUI), Toncoin (TON).
>
> **Top 10:** BTC $96.4K, ETH $3.4K, USDT (stable), BNB $710, SOL $185, USDC (stable), XRP $2.40, DOGE $0.42, ADA $1.10, AVAX $42."

---

### 8. Remove a holding

> **You:** "I sold all my MATIC on Coinbase, remove it."

*Claude calls:* `remove_holding({coin_id: "matic-network", exchange: "Coinbase"})`

> **Claude:** "Removed MATIC on Coinbase from your portfolio."

---

### 9. Multi-exchange same coin

> **You:** "I have 0.3 BTC on Kraken and 0.2 BTC on Binance. Add both."

*Claude calls `add_holding` twice with different `exchange` values.*

> **Claude:** "Tracking 0.5 BTC total across two exchanges (0.3 Kraken, 0.2 Binance). `get_portfolio_summary` will show them as separate rows so you can see exchange-level exposure."

---

### 10. Cost basis correction

> **You:** "I made a typo earlier — my SOL buy price was $95, not $195. Fix it."

*Claude calls:* `add_holding({coin_id: "solana", symbol: "SOL", quantity: <same>, purchase_price_usd: 95, ...})` — `upsert` merges by `(user, coin, exchange)`.

> **Claude:** "Updated. Your SOL cost basis is now $95/coin. Recalculated unrealized P&L: +$4,500 (was −$5,500 with the wrong price)."

---

## Pricing tiers

| Tier | Holdings | History | Price |
|---|---|---|---|
| **Free** | 3 | 30 days | $0 |
| **Pro** | Unlimited | 365 days | $19/mo |

Free tier is fully functional for casual portfolios. Pro removes both limits — that's all.

---

## Stack

- **Runtime:** Node.js 20, TypeScript
- **MCP SDK:** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) (Streamable HTTP transport)
- **Framework:** Express + Zod schemas
- **Prices:** [CoinGecko Demo API](https://www.coingecko.com/en/api) — 30 req/min, 10K req/month, free. 60s response cache means a 10-user free portfolio uses ~80% fewer calls than naive fetching.
- **Storage:** SQLite via `better-sqlite3` (single file, no external DB)
- **Auth:** Bearer API key (SHA-256 hashed; raw key never persisted) + MCPize upstream proxy passthrough (`X-MCPize-Customer-Id` + `X-MCPize-Tier`)

---

## Development

```bash
# Clone + install
git clone https://github.com/biggling/crypto-portfolio-mcp.git
cd crypto-portfolio-mcp
npm install

# Configure
cp .env.example .env
# Edit .env — set COINGECKO_API_KEY from https://www.coingecko.com/en/api

# Run in dev (watch mode)
npm run dev

# Build + run production
npm run build
npm start
```

### Environment variables

| Var | Purpose | Default |
|---|---|---|
| `PORT` | HTTP listen port | `3000` |
| `COINGECKO_API_KEY` | Demo-tier key from coingecko.com | required |
| `DB_PATH` | SQLite file path | `./data/holdings.db` |
| `NODE_ENV` | `production` or `development` | `production` |
| `MCPIZE_UPSTREAM_TOKEN` | Upstream proxy token for MCPize gateway | optional |

### Create a test API key

```bash
node -e "
const db = require('better-sqlite3')('./data/holdings.db');
const crypto = require('crypto');
const key = 'pk_test_' + crypto.randomBytes(24).toString('hex');
const hash = crypto.createHash('sha256').update(key).digest('hex');
db.prepare('INSERT INTO api_keys (key_hash, tier) VALUES (?, ?)').run(hash, 'pro');
console.log('Test key:', key);
"
```

### Test it works

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

You should see all 7 tools listed in the response.

---

## Deployment

For production deployment (VPS + nginx + Let's Encrypt + systemd), use:

```bash
sudo bash deploy.sh "https://github.com/biggling/crypto-portfolio-mcp.git" "mcp.example.com"
```

The script installs Node 20, builds, generates a systemd unit, and walks you through nginx + certbot. Verify with `bash test-deployment.sh https://mcp.example.com YOUR_KEY`.

---

## Architecture

```
Claude AI (or MCPize gateway)
       │  HTTPS  Bearer <key>
       ▼
nginx reverse proxy  ──► proxy_buffering off, 300s timeouts (Streamable HTTP needs this)
       │  :3000
       ▼
crypto-portfolio-mcp (Node.js / Express)
       ├─► SQLite  ──  api_keys, holdings
       └─► CoinGecko  ──  60s in-memory cache
```

### Auth flow

1. Client sends `Authorization: Bearer <key>` (direct buyer) **or** `Authorization: Bearer <upstream-token>` + `X-MCPize-Customer-Id` + `X-MCPize-Tier` (via MCPize gateway).
2. Server identifies user via SHA-256 hash — the plaintext key is never stored.
3. Tools receive `userId` (the hash) and `tier` (`free` | `pro`) in context.
4. Tier limits enforced inside each tool: free tier caps holdings at 3 and history at 30 days.

---

## Roadmap

- **Phase 1 (now):** Portfolio P&L tracker — ✅ shipped
- **Phase 2:** Crypto Tax MCP (FIFO/LIFO/HIFO lot matching, 1099-DA reconciliation) — ✅ shipped (companion repo)
- **Phase 3:** OAuth 2.1 PKCE auth for the Anthropic directory
- **Phase 4:** Polar.sh / Stripe billing for direct buyers
- **Phase 5:** Multi-chain wallet sync (Moralis, Etherscan, on-chain holdings auto-discovery)

---

## License

MIT — do whatever, but no warranty.
