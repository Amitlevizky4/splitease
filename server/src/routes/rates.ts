import { Router, Request, Response } from "express";

const router = Router();

// Cache exchange rates for 1 hour
let cachedRates: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "ILS",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "INR",
];

// Fallback rates in case the API is down
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  ILS: 3.65,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.1,
};

async function fetchRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cacheTimestamp < CACHE_TTL) {
    return cachedRates;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.result !== "success" || !data.rates) {
      throw new Error("Invalid response");
    }

    const rates: Record<string, number> = {};
    for (const code of SUPPORTED_CURRENCIES) {
      rates[code] = data.rates[code] ?? FALLBACK_RATES[code] ?? 1;
    }

    cachedRates = rates;
    cacheTimestamp = now;
    return rates;
  } catch (error) {
    console.error("Failed to fetch exchange rates:", error);
    // Return cached rates if available, otherwise fallback
    return cachedRates ?? FALLBACK_RATES;
  }
}

// GET /api/rates - Get current exchange rates (USD-based)
router.get("/", async (_req: Request, res: Response) => {
  const rates = await fetchRates();
  res.json({ base: "USD", rates });
});

export { router as ratesRouter };
