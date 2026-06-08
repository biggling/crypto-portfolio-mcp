# Crypto Portfolio MCP

Multi-exchange portfolio P&L tracker for Claude. Phase 1 infrastructure — stores user holdings and live P&L. Foundation for the Crypto Tax MCP.

**Price:** Free (3 coins) / Pro $19/mo  
**Transport:** Streamable HTTP  
**Host:** VPS (`ssh ai`) + nginx + Let's Encrypt

## Tools
- `get_portfolio_summary` — live value + unrealized P&L across all holdings
- `get_asset_price` — current price for 1–50 coins
- `add_holding` — record a coin purchase (coin, qty, buy price, date, exchange)
- `remove_holding` — remove a holding
- `get_portfolio_history` — daily portfolio value over 1–365 days
- `search_coin` — resolve coin name/symbol to CoinGecko ID
- `get_market_overview` — market cap, BTC dominance, trending coins

## Stack
- TypeScript + Node.js 20
- `@modelcontextprotocol/sdk` + Express + Zod
- CoinGecko Demo API (free, 30 req/min)
- SQLite (holdings per user)
- Bearer API key auth (MVP)

## Development

```bash
# Setup
cp .env.example .env              # fill in COINGECKO_API_KEY from coingecko.com
npm install

# Development (with watch mode)
npm run dev                        # ts-node-dev watch mode

# Production
npm run build                      # compile TypeScript to dist/
npm start                          # run from dist/server.js
```

### Environment Variables
- `PORT` — HTTP listen port (default: 3000)
- `COINGECKO_API_KEY` — Demo tier from https://www.coingecko.com/en/api
- `DB_PATH` — SQLite database path (default: ./data/holdings.db)
- `NODE_ENV` — "development" or "production"

### Database

SQLite database auto-initializes with:
- `api_keys` — API key hash + tier (free/pro)
- `holdings` — user portfolio (coin, quantity, purchase price, date, exchange)

Create API keys for testing:
```bash
node -e "
const db = require('better-sqlite3')('./data/holdings.db');
const crypto = require('crypto');

const key = crypto.randomBytes(24).toString('hex');
const hash = crypto.createHash('sha256').update(key).digest('hex');
db.prepare('INSERT INTO api_keys (key_hash, tier) VALUES (?, ?)').run(hash, 'free');
console.log('Test key:', key);
"
```

Test locally:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Deployment

For production deployment to a VPS with nginx and SSL, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick start:
```bash
# On VPS as root:
cd /path/to/crypto-portfolio
sudo bash deploy.sh "https://github.com/YOUR_USERNAME/crypto-portfolio-mcp.git" "mcp.example.com"
```

The deploy script:
1. Installs Node.js 20, npm, nginx, certbot
2. Clones/pulls the repository
3. Installs dependencies and builds
4. Creates .env and data directory
5. Installs systemd service
6. Guides you through nginx and Let's Encrypt setup

Verify deployment:
```bash
bash test-deployment.sh https://mcp.example.com YOUR_API_KEY
```

## Architecture

```
Client (Claude AI)
    ↓ HTTPS
nginx reverse proxy
    ↓ :3000
crypto-portfolio-mcp (Node.js)
    ├─ CoinGecko API (live prices)
    └─ SQLite database (user holdings)
```

Auth flow:
1. Client sends `Authorization: Bearer API_KEY` header
2. Server hashes key (SHA-256) and looks up in `api_keys` table
3. Returns `userId` (key hash) and `tier` in request context
4. Tools enforce tier limits (free: 3 holdings, pro: unlimited)

## Pricing Tiers

| Tier | Holdings | History | Price |
|------|----------|---------|-------|
| Free | 3 | 30 days | $0 |
| Pro | Unlimited | 365 days | $19/mo |

## Roadmap

- Phase 1 (current): Portfolio P&L tracker ✓
- Phase 2: Crypto Tax MCP (FIFO/LIFO/HIFO lot matching, 1099-DA reports)
- Phase 3: OAuth 2.1 PKCE auth (for Anthropic directory)
- Phase 4: Billing integration (Polar.sh, Stripe)
- Phase 5: Multi-chain wallet support (Moralis, Etherscan, etc.)

## License

MIT
