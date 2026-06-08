#!/bin/bash

# Crypto Portfolio MCP — Deployment Script
# Run on VPS as root or with sudo
# Usage: sudo bash deploy.sh

set -e

REPO_URL="${1:-https://github.com/YOUR_USERNAME/crypto-portfolio-mcp.git}"
INSTALL_DIR="/opt/crypto-portfolio-mcp"
SERVICE_NAME="crypto-portfolio-mcp"
DOMAIN="${2:-mcp.example.com}"
COINGECKO_API_KEY="${COINGECKO_API_KEY:-your_demo_key_here}"

echo "=== Crypto Portfolio MCP Deployment ==="
echo "Repository: $REPO_URL"
echo "Install dir: $INSTALL_DIR"
echo "Service: $SERVICE_NAME"
echo "Domain: $DOMAIN"
echo ""

# 1. Install Node.js 20 if not present
echo "[1/8] Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "  Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  NODE_VERSION=$(node --version)
  echo "  Node.js $NODE_VERSION already installed"
fi

# 2. Install npm dependencies globally if needed
echo "[2/8] Checking npm..."
npm --version

# 3. Install/update nginx if not present
echo "[3/8] Checking nginx..."
if ! command -v nginx &> /dev/null; then
  echo "  Installing nginx..."
  sudo apt-get update
  sudo apt-get install -y nginx
else
  echo "  nginx already installed"
fi

# 4. Install Let's Encrypt certbot if not present
echo "[4/8] Checking certbot..."
if ! command -v certbot &> /dev/null; then
  echo "  Installing certbot..."
  sudo apt-get install -y certbot python3-certbot-nginx
else
  echo "  certbot already installed"
fi

# 5. Clone or pull repository
echo "[5/8] Setting up repository..."
if [ -d "$INSTALL_DIR" ]; then
  echo "  Updating existing repository..."
  cd "$INSTALL_DIR"
  git pull origin main || git pull origin master
else
  echo "  Cloning repository..."
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 6. Install Node dependencies and build
echo "[6/8] Installing dependencies..."
sudo npm ci --omit=dev

echo "  Building TypeScript..."
sudo npm run build

# 7. Create .env file
echo "[7/8] Creating .env file..."
sudo tee "$INSTALL_DIR/.env" > /dev/null <<EOF
PORT=3000
COINGECKO_API_KEY=$COINGECKO_API_KEY
DB_PATH=$INSTALL_DIR/data/holdings.db
NODE_ENV=production
EOF
echo "  .env created. Update COINGECKO_API_KEY if needed: $INSTALL_DIR/.env"

# 8. Install and enable systemd service
echo "[8/8] Setting up systemd service..."
sudo cp crypto-portfolio-mcp.service /etc/systemd/system/$SERVICE_NAME.service
sudo chown root:root /etc/systemd/system/$SERVICE_NAME.service
sudo chmod 644 /etc/systemd/system/$SERVICE_NAME.service

# Ensure data directory exists and has correct permissions
sudo mkdir -p "$INSTALL_DIR/data"
sudo chown www-data:www-data "$INSTALL_DIR/data"
sudo chmod 755 "$INSTALL_DIR/data"

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

# 9. Configure nginx
echo ""
echo "=== Nginx Configuration ==="
echo "Replace DOMAIN_PLACEHOLDER in nginx config with actual domain:"
echo "  sudo sed -i 's/DOMAIN_PLACEHOLDER/$DOMAIN/g' /etc/nginx/sites-available/mcp-apps"
echo ""
echo "Then copy nginx config:"
echo "  sudo cp nginx-mcp-apps.conf /etc/nginx/sites-available/mcp-apps"
echo "  sudo ln -sf /etc/nginx/sites-available/mcp-apps /etc/nginx/sites-enabled/mcp-apps"
echo ""
echo "Test nginx config:"
echo "  sudo nginx -t"
echo ""
echo "Reload nginx:"
echo "  sudo systemctl reload nginx"
echo ""

# 10. Setup SSL
echo "=== Let's Encrypt SSL Setup ==="
echo "Generate certificate (first time only):"
echo "  sudo certbot certonly --nginx -d $DOMAIN"
echo ""
echo "Verify service is running:"
echo "  sudo systemctl status $SERVICE_NAME"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "Test health endpoint:"
echo "  curl https://$DOMAIN/portfolio/health"
echo ""
echo "=== Deployment Complete ==="
