const BASE = "https://api.coingecko.com/api/v3";
const API_KEY = process.env.COINGECKO_API_KEY ?? "";
const CACHE_TTL_MS = 60_000; // 60s price cache

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const priceCache = new Map<string, CacheEntry<PriceMap>>();
const coinListCache = { data: [] as CoinListItem[], ts: 0 };

export interface PriceMap {
  [coinId: string]: {
    usd?: number;
    eur?: number;
    btc?: number;
    eth?: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
  };
}

export interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
}

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  total_volume: number;
}

export interface GlobalData {
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { btc: number; eth: number };
  market_cap_change_percentage_24h_usd: number;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
  price_btc: number;
}

async function cgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) headers["x-cg-demo-api-key"] = API_KEY;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function getPrices(
  coinIds: string[],
  currency: "usd" | "eur" | "btc" | "eth" = "usd"
): Promise<PriceMap> {
  const ids = coinIds.join(",");
  const cacheKey = `${ids}:${currency}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const data = await cgFetch<PriceMap>("/simple/price", {
    ids,
    vs_currencies: currency,
    include_24hr_change: "true",
    include_market_cap: "true",
    include_24hr_vol: "true",
  });

  priceCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

export async function getHistoricalPrice(coinId: string, dateIso: string): Promise<number | null> {
  // dateIso: "YYYY-MM-DD" → CoinGecko wants "DD-MM-YYYY"
  const [y, m, d] = dateIso.split("-");
  const cgDate = `${d}-${m}-${y}`;
  const data = await cgFetch<{ market_data?: { current_price?: { usd?: number } } }>(
    `/coins/${coinId}/history`,
    { date: cgDate, localization: "false" }
  );
  return data.market_data?.current_price?.usd ?? null;
}

export async function getMarketChart(coinId: string, days: number): Promise<[number, number][]> {
  const data = await cgFetch<{ prices: [number, number][] }>(
    `/coins/${coinId}/market_chart`,
    { vs_currency: "usd", days: String(days), interval: "daily" }
  );
  return data.prices;
}

export async function searchCoins(query: string): Promise<CoinListItem[]> {
  const data = await cgFetch<{ coins: Array<{ id: string; symbol: string; name: string }> }>(
    "/search",
    { query }
  );
  return data.coins.slice(0, 10).map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
  }));
}

export async function getGlobalData(): Promise<GlobalData> {
  const data = await cgFetch<{ data: GlobalData }>("/global");
  return data.data;
}

export async function getTrending(): Promise<TrendingCoin[]> {
  const data = await cgFetch<{ coins: Array<{ item: TrendingCoin & { price_btc: number } }> }>(
    "/search/trending"
  );
  return data.coins.map((c) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    market_cap_rank: c.item.market_cap_rank,
    price_btc: c.item.price_btc,
  }));
}

export async function getTopMarkets(limit = 10): Promise<MarketCoin[]> {
  return cgFetch<MarketCoin[]>("/coins/markets", {
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: String(limit),
    page: "1",
    sparkline: "false",
  });
}
