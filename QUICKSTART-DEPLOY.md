# Quick Start — Deploy Crypto Portfolio MCP to VPS

## Files Created

- **`crypto-portfolio-mcp.service`** — systemd service unit file
- **`nginx-mcp-apps.conf`** — nginx reverse proxy configuration
- **`deploy.sh`** — automated deployment script
- **`test-deployment.sh`** — validation test script
- **`DEPLOYMENT.md`** — comprehensive deployment guide

## Prerequisites

- VPS with Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- Registered domain (for SSL)
- CoinGecko Demo API key (free at coingecko.com)

## Option 1: Automated Deployment (Recommended)

```bash
# On VPS as root:
cd /path/to/crypto-portfolio-mcp
sudo bash deploy.sh "https://github.com/YOUR_USERNAME/crypto-portfolio-mcp.git" "mcp.example.com"

# Script will:
# 1. Install Node.js 20, npm, nginx, certbot
# 2. Clone/pull repository
# 3. Install dependencies and build
# 4. Create .env file
# 5. Install systemd service
# 6. Guide through nginx and SSL setup
```

Follow the on-screen instructions for nginx configuration and Let's Encrypt SSL.

## Option 2: Manual Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step manual setup.

## After Deployment

### 1. Verify Health

```bash
curl https://mcp.example.com/portfolio/health
# Expected: {"status":"ok","server":"crypto-portfolio-mcp","version":"1.0.0"}
```

### 2. Create Test API Key (on VPS)

```bash
# SSH to VPS, then:
cd /opt/crypto-portfolio-mcp

node -e "
const db = require('better-sqlite3')('./data/holdings.db');
const crypto = require('crypto');

const key = crypto.randomBytes(24).toString('hex');
const hash = crypto.createHash('sha256').update(key).digest('hex');
db.prepare('INSERT INTO api_keys (key_hash, tier) VALUES (?, ?)').run(hash, 'free');
console.log('Test key:', key);
"
```

### 3. Run Tests

```bash
bash test-deployment.sh https://mcp.example.com YOUR_API_KEY

# Or from VPS:
curl -s -w "\n%{http_code}" https://mcp.example.com/portfolio/health

# Should see:
# {"status":"ok",...}
# 200
```

### 4. Monitor Service

```bash
# View logs (real-time)
sudo journalctl -u crypto-portfolio-mcp -f

# View status
sudo systemctl status crypto-portfolio-mcp

# Restart if needed
sudo systemctl restart crypto-portfolio-mcp
```

## Deployment Timeline

| Date | Task | Deadline |
|------|------|----------|
| May 14 | ✓ Code complete, infrastructure files created | — |
| May 15–20 | Deploy to VPS | — |
| May 21–June 9 | Test, refine, prepare listing | — |
| **June 10** | **List on MCPize** | **Critical: 85% rev share** |
| June 11+ | List on Smithery, MCP Registry, Reddit | — |

## Next Steps

1. **Deploy to VPS**
   - Copy files to VPS
   - Run `sudo bash deploy.sh`
   - Complete nginx and SSL setup

2. **Test**
   - Verify health endpoint
   - Create test API key
   - Run `test-deployment.sh`

3. **List on MCPize** (before June 10)
   - Log in to MCPize.ai
   - Select deployment method
   - Submit listing
   - Confirm 85% revenue share

4. **List on other directories**
   - Smithery (smithery.ai/new)
   - MCP Registry (github.com/modelcontextprotocol/registry)
   - Reddit (r/ClaudeAI, r/algotrading)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Service won't start | Check logs: `journalctl -u crypto-portfolio-mcp -n 50` |
| 502 Bad Gateway from nginx | Ensure service is running: `systemctl is-active crypto-portfolio-mcp` |
| SSL certificate error | Generate cert: `sudo certbot certonly --nginx -d mcp.example.com` |
| Database locked | Restart service: `systemctl restart crypto-portfolio-mcp` |

## Contact & Support

See DEPLOYMENT.md for detailed troubleshooting and additional options.
