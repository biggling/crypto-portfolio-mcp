import "node:process";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { validateKey, getUserId } from "./db.js";
import { createAuthMiddleware, type AuthedRequest } from "./auth.js";
import { registerTools } from "./tools.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

// Stateless per-request: create a new McpServer + transport for each POST.
// No server-initiated messages needed for portfolio tools, so stateless is fine.

const authMiddleware = createAuthMiddleware({
  validateKey,
  getUserId,
  upstreamToken: process.env.MCPIZE_UPSTREAM_TOKEN,
});

app.post("/mcp", authMiddleware, async (req, res) => {
  const { userId, tier } = req as AuthedRequest;

  // Fresh server per request — userId/tier captured in closure via registerTools
  const mcpServer = new McpServer({ name: "crypto-portfolio", version: "1.0.0" });
  registerTools(mcpServer, userId, tier);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// GET + DELETE kept for clients that attempt session negotiation
app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Stateless mode: only POST /mcp supported" });
});

app.delete("/mcp", (_req, res) => {
  res.status(204).send();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "crypto-portfolio-mcp", version: "1.0.0" });
});

app.listen(PORT, () => {
  console.log(`crypto-portfolio MCP server running on port ${PORT}`);
});
