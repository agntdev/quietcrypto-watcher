export interface Coin {
  ticker: "BTC" | "ETH" | "TON";
  id: string;
  name: string;
}

export interface Quote {
  price: number;
  change24h: number;
}

const COINS: Coin[] = [
  { ticker: "BTC", id: "bitcoin", name: "Bitcoin" },
  { ticker: "ETH", id: "ethereum", name: "Ethereum" },
  { ticker: "TON", id: "the-open-network", name: "Toncoin" },
];

export function coinForTicker(input: string): Coin | undefined {
  const ticker = input.trim().toUpperCase();
  return COINS.find((coin) => coin.ticker === ticker);
}

export function tickerSuggestion(input: string): string | undefined {
  const value = input.trim().toUpperCase();
  if (!value) return undefined;
  return COINS.find((coin) => coin.ticker.startsWith(value[0]) || value.startsWith(coin.ticker[0]))?.ticker;
}

export function seedCoins(): Coin[] {
  return [...COINS];
}

export async function fetchQuotes(coins: readonly Coin[]): Promise<Record<string, Quote>> {
  if (coins.length === 0) return {};
  const ids = [...new Set(coins.map((coin) => coin.id))].join(",");
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids);
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("include_24hr_change", "true");

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 429 && attempt === 0) continue;
      if (!response.ok) throw new Error(`price API returned ${response.status}`);
      const payload = (await response.json()) as Record<string, Record<string, number | undefined>>;
      const quotes: Record<string, Quote> = {};
      for (const coin of coins) {
        const item = payload[coin.id];
        if (typeof item?.usd !== "number") throw new Error("price API returned incomplete data");
        quotes[coin.ticker] = { price: item.usd, change24h: item.usd_24h_change ?? 0 };
      }
      return quotes;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("price API request failed");
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value);
}

export function formatQuote(ticker: string, quote: Quote): string {
  const sign = quote.change24h >= 0 ? "+" : "";
  return `${ticker} ${formatPrice(quote.price)} (${sign}${quote.change24h.toFixed(2)}% 24h)`;
}
