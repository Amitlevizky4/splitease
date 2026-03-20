import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Currency } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Exchange rates relative to USD (1 USD = X of target currency)
// Starts with fallback values, updated with live rates on app load
export let exchangeRates: Record<Currency, number> = {
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

export function updateExchangeRates(rates: Record<string, number>) {
  const updated = { ...exchangeRates };
  for (const key of Object.keys(updated)) {
    if (rates[key] !== undefined) {
      updated[key as Currency] = rates[key];
    }
  }
  exchangeRates = updated;
}

export const currencySymbols: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  ILS: "₪",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  CNY: "¥",
  INR: "₹",
};

export const currencyLabels: Record<Currency, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  ILS: "Israeli Shekel",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  CHF: "Swiss Franc",
  CNY: "Chinese Yuan",
  INR: "Indian Rupee",
};

export function convertToUSD(amount: number, fromCurrency: Currency): number {
  return amount / exchangeRates[fromCurrency];
}

export function convertFromUSD(
  amountUSD: number,
  toCurrency: Currency,
): number {
  return amountUSD * exchangeRates[toCurrency];
}

export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
): number {
  if (from === to) return amount;
  const usd = convertToUSD(amount, from);
  return convertFromUSD(usd, to);
}

export function formatCurrency(
  amount: number,
  currency: Currency = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(Math.abs(amount));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
