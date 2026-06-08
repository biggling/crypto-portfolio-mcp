import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  getHoldings,
  countHoldings,
  upsertHolding,
  deleteHolding,
} from "./db.js";
import {
  getPrices,
  getMarketChart,
  searchCoins,
  getGlobalData,
  getTrending,
  getTopMarkets,
} from "./coingecko.js";

const FREE_HOLDING_LIMIT = 3;
const FREE_HISTORY_DAYS = 30;

export function registerTools(server: McpServer, userId: string, tier: string) {
  // ── get_portfolio_summary ───────────────────────────────────────────────
  server.tool(
    "get_portfolio_summary",
    "Get the current value, allocation, and unrealized P&L of your entire crypto portfolio. Returns total value, per-asset breakdown with live prices, cost basis, and gain/loss in USD and %.",
    {
      currency: z
        .enum(["usd", "eur", "btc", "eth"])
        .optional()
        .default("usd")
        .describe("Display currency. Default: usd"),
      include_24h_change: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include 24-hour price change %. Default: true"),
    },
    { readOnlyHint: true, title: "Get Portfolio Summary" },
    async ({ currency, include_24h_change }) => {
      const holdings = getHoldings(userId);

      if (holdings.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                total_value: 0,
                currency,
                holdings: [],
                message: "No holdings found. Use add_holding to track your crypto.",
              }),
            },
          ],
        };
      }

      const coinIds = [...new Set(holdings.map((h) => h.coin_id))];
      const prices = await getPrices(coinIds, currency);

      let totalValue = 0;
      let totalCostBasis = 0;

      const breakdown = holdings.map((h) => {
        const priceData = prices[h.coin_id];
        const currentPrice = priceData?.[currency] ?? 0;
        const value = h.quantity * currentPrice;
        const costBasis =
          h.purchase_price_usd != null ? h.quantity * h.purchase_price_usd : null;
        const unrealizedPnl = costBasis != null ? value - costBasis : null;
        const unrealizedPnlPct =
          costBasis != null && costBasis > 0
            ? ((value - costBasis) / costBasis) * 100
            : null;

        totalValue += value;
        if (costBasis != null) totalCostBasis += costBasis;

        const entry: Record<string, unknown> = {
          coin_id: h.coin_id,
          symbol: h.symbol.toUpperCase(),
          quantity: h.quantity,
          current_price: currentPrice,
          value,
          exchange: h.exchange ?? null,
          purchase_price_usd: h.purchase_price_usd ?? null,
          cost_basis: costBasis,
          unrealized_pnl_usd: unrealizedPnl,
          unrealized_pnl_pct:
            unrealizedPnlPct != null ? Math.round(unrealizedPnlPct * 100) / 100 : null,
        };

        if (include_24h_change) {
          entry.price_change_24h_pct = priceData?.usd_24h_change ?? null;
        }

        return entry;
      });

      // sort by value desc
      breakdown.sort((a, b) => (b.value as number) - (a.value as number));

      // allocation %
      breakdown.forEach((e) => {
        (e as Record<string, unknown>).allocation_pct =
          totalValue > 0 ? Math.round(((e.value as number) / totalValue) * 10000) / 100 : 0;
      });

      const totalPnl = totalCostBasis > 0 ? totalValue - totalCostBasis : null;
      const totalPnlPct =
        totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : null;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total_value: Math.round(totalValue * 100) / 100,
              total_cost_basis: totalCostBasis > 0 ? Math.round(totalCostBasis * 100) / 100 : null,
              total_unrealized_pnl_usd: totalPnl != null ? Math.round(totalPnl * 100) / 100 : null,
              total_unrealized_pnl_pct:
                totalPnlPct != null ? Math.round(totalPnlPct * 100) / 100 : null,
              currency,
              asset_count: holdings.length,
              holdings: breakdown,
            }),
          },
        ],
      };
    }
  );

  // ── get_asset_price ─────────────────────────────────────────────────────
  server.tool(
    "get_asset_price",
    "Get the current price, 24h change, market cap, and volume for one or more cryptocurrencies. Pass CoinGecko IDs (e.g. 'bitcoin', 'ethereum', 'solana'). Use search_coin to find an ID.",
    {
      coins: z
        .array(z.string().min(1))
        .min(1)
        .max(50)
        .describe("CoinGecko IDs, e.g. ['bitcoin', 'ethereum']"),
      currency: z
        .enum(["usd", "eur", "btc", "eth"])
        .optional()
        .default("usd")
        .describe("Quote currency. Default: usd"),
    },
    { readOnlyHint: true, title: "Get Asset Price" },
    async ({ coins, currency }) => {
      const prices = await getPrices(coins, currency);

      const result = coins.map((id) => {
        const p = prices[id];
        if (!p) return { coin_id: id, error: "Not found" };
        return {
          coin_id: id,
          price: p[currency] ?? null,
          price_change_24h_pct: p.usd_24h_change ?? null,
          market_cap: p.usd_market_cap ?? null,
          volume_24h: p.usd_24h_vol ?? null,
          currency,
        };
      });

      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // ── add_holding ──────────────────────────────────────────────────────────
  server.tool(
    "add_holding",
    "Add or update a cryptocurrency holding in your portfolio. Records coin, quantity, purchase price, date, and exchange. Use search_coin to find the correct CoinGecko ID first.",
    {
      coin_id: z.string().min(1).describe("CoinGecko coin ID, e.g. 'bitcoin'"),
      symbol: z.string().min(1).describe("Ticker symbol, e.g. 'BTC'"),
      quantity: z.number().positive().describe("Number of coins held"),
      purchase_price_usd: z
        .number()
        .positive()
        .optional()
        .describe("Average purchase price in USD (for P&L calculation)"),
      purchase_date: z
        .string()
        .optional()
        .describe("ISO 8601 purchase date, e.g. '2024-01-15'"),
      exchange: z
        .string()
        .optional()
        .describe("Exchange or wallet name, e.g. 'Coinbase', 'MetaMask'"),
      notes: z.string().optional().describe("Optional notes"),
    },
    { destructiveHint: true, title: "Add Holding" },
    async ({ coin_id, symbol, quantity, purchase_price_usd, purchase_date, exchange, notes }) => {

      if (tier === "free" && countHoldings(userId) >= FREE_HOLDING_LIMIT) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Free tier limited to ${FREE_HOLDING_LIMIT} holdings. Upgrade to Pro at $19/month for unlimited holdings.`,
              }),
            },
          ],
        };
      }

      const holding = {
        id: randomUUID(),
        user_id: userId,
        coin_id: coin_id.toLowerCase(),
        symbol: symbol.toUpperCase(),
        quantity,
        purchase_price_usd: purchase_price_usd ?? null,
        purchase_date: purchase_date ?? null,
        exchange: exchange ?? null,
        notes: notes ?? null,
      };

      upsertHolding(holding);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Added ${quantity} ${symbol.toUpperCase()} (${coin_id}) to portfolio.`,
              holding,
            }),
          },
        ],
      };
    }
  );

  // ── remove_holding ───────────────────────────────────────────────────────
  server.tool(
    "remove_holding",
    "Remove a cryptocurrency holding from your portfolio by CoinGecko coin ID. Optionally specify exchange to remove only that exchange's entry.",
    {
      coin_id: z.string().min(1).describe("CoinGecko coin ID to remove, e.g. 'bitcoin'"),
      exchange: z
        .string()
        .optional()
        .describe("Remove only holdings on this exchange. Omit to remove all entries for this coin."),
    },
    { destructiveHint: true, title: "Remove Holding" },
    async ({ coin_id, exchange }) => {
      const deleted = deleteHolding(userId, coin_id.toLowerCase(), exchange);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: deleted > 0,
              rows_deleted: deleted,
              message: deleted > 0 ? `Removed ${coin_id} from portfolio.` : `No holding found for ${coin_id}${exchange ? ` on ${exchange}` : ""}.`,
            }),
          },
        ],
      };
    }
  );

  // ── get_portfolio_history ────────────────────────────────────────────────
  server.tool(
    "get_portfolio_history",
    "Get the historical total value of your portfolio over a time period (daily snapshots). Computes value by multiplying holdings quantities against historical prices for each day.",
    {
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .default(30)
        .describe("Number of days of history. Max 365 on free tier. Default: 30"),
      currency: z
        .enum(["usd", "btc"])
        .optional()
        .default("usd")
        .describe("Quote currency. Default: usd"),
    },
    { readOnlyHint: true, title: "Get Portfolio History" },
    async ({ days, currency }) => {

      const maxDays = tier === "free" ? FREE_HISTORY_DAYS : 365;
      const effectiveDays = Math.min(days, maxDays);

      const holdings = getHoldings(userId);
      if (holdings.length === 0) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ history: [], message: "No holdings tracked." }) },
          ],
        };
      }

      const coinIds = [...new Set(holdings.map((h) => h.coin_id))];

      // fetch chart data for all coins in parallel
      const charts = await Promise.all(
        coinIds.map(async (id) => ({
          id,
          prices: await getMarketChart(id, effectiveDays),
        }))
      );

      // build day → price map per coin
      const priceByDay = new Map<string, Map<string, number>>();
      for (const { id, prices } of charts) {
        for (const [ts, price] of prices) {
          const day = new Date(ts).toISOString().slice(0, 10);
          if (!priceByDay.has(day)) priceByDay.set(day, new Map());
          priceByDay.get(day)!.set(id, price);
        }
      }

      const history = [...priceByDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayPrices]) => {
          const totalValue = holdings.reduce((sum, h) => {
            const p = dayPrices.get(h.coin_id) ?? 0;
            return sum + h.quantity * p;
          }, 0);
          return { date, value: Math.round(totalValue * 100) / 100 };
        });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              currency,
              days: effectiveDays,
              data_points: history.length,
              history,
              ...(tier === "free" && days > FREE_HISTORY_DAYS
                ? { note: `Free tier limited to ${FREE_HISTORY_DAYS} days. Upgrade to Pro for 365-day history.` }
                : {}),
            }),
          },
        ],
      };
    }
  );

  // ── search_coin ───────────────────────────────────────────────────────────
  server.tool(
    "search_coin",
    "Search for a cryptocurrency by name or symbol and return its CoinGecko ID. Use this to find the correct ID before calling add_holding or get_asset_price.",
    {
      query: z
        .string()
        .min(1)
        .describe("Coin name or symbol, e.g. 'ETH' or 'Ethereum' or 'sol'"),
    },
    { readOnlyHint: true, title: "Search Coin" },
    async ({ query }) => {
      const results = await searchCoins(query);
      return {
        content: [{ type: "text", text: JSON.stringify(results) }],
      };
    }
  );

  // ── get_market_overview ───────────────────────────────────────────────────
  server.tool(
    "get_market_overview",
    "Get a snapshot of the overall crypto market: total market cap, BTC dominance, 24h change, trending coins, and top coins by market cap.",
    {},
    { readOnlyHint: true, title: "Get Market Overview" },
    async () => {
      const [global, trending, top] = await Promise.all([
        getGlobalData(),
        getTrending(),
        getTopMarkets(10),
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total_market_cap_usd: global.total_market_cap.usd,
              total_volume_24h_usd: global.total_volume.usd,
              btc_dominance_pct: Math.round(global.market_cap_percentage.btc * 100) / 100,
              eth_dominance_pct: Math.round(global.market_cap_percentage.eth * 100) / 100,
              market_cap_change_24h_pct:
                Math.round(global.market_cap_change_percentage_24h_usd * 100) / 100,
              trending_coins: trending.map((c) => ({
                id: c.id,
                name: c.name,
                symbol: c.symbol,
                rank: c.market_cap_rank,
              })),
              top_10_by_market_cap: top.map((c) => ({
                id: c.id,
                symbol: c.symbol.toUpperCase(),
                name: c.name,
                price_usd: c.current_price,
                market_cap_usd: c.market_cap,
                rank: c.market_cap_rank,
                change_24h_pct: Math.round(c.price_change_percentage_24h * 100) / 100,
              })),
            }),
          },
        ],
      };
    }
  );
}
