#!/bin/bash

# Crypto Portfolio MCP — Deployment Test Script
# Validates that the deployed server is working correctly
# Usage: bash test-deployment.sh https://mcp.example.com API_KEY

set -e

DOMAIN="${1:-https://localhost:3000}"
API_KEY="${2:-}"
FAILED=0

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_result() {
  local name=$1
  local expected=$2
  local actual=$3

  if [[ "$expected" == "$actual" ]]; then
    echo -e "${GREEN}✓${NC} $name"
  else
    echo -e "${RED}✗${NC} $name"
    echo "  Expected: $expected"
    echo "  Got: $actual"
    FAILED=$((FAILED + 1))
  fi
}

test_status_code() {
  local name=$1
  local expected=$2
  local response=$3

  local status=$(echo "$response" | head -n 1 | grep -oE '[0-9]{3}' || echo "ERR")
  test_result "$name (status)" "$expected" "$status"
}

echo "========================================="
echo "Crypto Portfolio MCP — Deployment Tests"
echo "========================================="
echo "Target: $DOMAIN"
echo "API Key: ${API_KEY:0:10}...${API_KEY: -4}"
echo ""

# Test 1: Health endpoint
echo "[1/6] Testing health endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$DOMAIN/health" 2>/dev/null || echo "ERR")
test_status_code "GET /health" "200" "$RESPONSE"

# Test 2: Unauthenticated request (should be 401)
echo ""
echo "[2/6] Testing unauthenticated request..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' 2>/dev/null || echo "ERR")
test_status_code "POST /mcp without auth" "401" "$RESPONSE"

# Test 3: Invalid API key (should be 401)
echo ""
echo "[3/6] Testing invalid API key..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/mcp" \
  -H "Authorization: Bearer invalid_key_12345678" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' 2>/dev/null || echo "ERR")
test_status_code "POST /mcp with invalid key" "401" "$RESPONSE"

# Test 4: Valid API key - Initialize
if [ -z "$API_KEY" ]; then
  echo ""
  echo "${YELLOW}⚠${NC} Skipping authenticated tests (no API_KEY provided)"
  echo "    To test authenticated endpoints, provide an API key:"
  echo "    bash test-deployment.sh $DOMAIN YOUR_API_KEY"
else
  echo ""
  echo "[4/6] Testing MCP initialization..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/mcp" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' 2>/dev/null || echo "ERR")
  test_status_code "POST /mcp initialize" "200" "$RESPONSE"

  # Test 5: Get portfolio summary
  echo ""
  echo "[5/6] Testing tools/list..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/mcp" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' 2>/dev/null || echo "ERR")
  test_status_code "POST /mcp tools/list" "200" "$RESPONSE"

  # Parse response to verify tools are present
  BODY=$(echo "$RESPONSE" | head -n -1)
  TOOL_COUNT=$(echo "$BODY" | grep -o '"name":"[^"]*"' | wc -l)
  if [ "$TOOL_COUNT" -ge 7 ]; then
    echo -e "${GREEN}✓${NC} Found $TOOL_COUNT tools (expected ≥7)"
  else
    echo -e "${RED}✗${NC} Found only $TOOL_COUNT tools (expected ≥7)"
    echo "$BODY"
    FAILED=$((FAILED + 1))
  fi

  # Test 6: Call get_portfolio_summary
  echo ""
  echo "[6/6] Testing tool call (get_portfolio_summary)..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/mcp" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_portfolio_summary","arguments":{}}}' 2>/dev/null || echo "ERR")
  test_status_code "POST /mcp tools/call" "200" "$RESPONSE"
fi

# Summary
echo ""
echo "========================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  echo ""
  echo "The deployment is ready for listing:"
  echo "  1. MCPize (before June 10 for 85% rev share)"
  echo "  2. Smithery (smithery.ai/new)"
  echo "  3. MCP Registry (github.com/modelcontextprotocol/registry)"
  exit 0
else
  echo -e "${RED}$FAILED test(s) failed${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  - Check service status: sudo systemctl status crypto-portfolio-mcp"
  echo "  - View logs: sudo journalctl -u crypto-portfolio-mcp -f"
  echo "  - Check nginx: sudo nginx -t && sudo tail -f /var/log/nginx/mcp-apps-error.log"
  exit 1
fi
