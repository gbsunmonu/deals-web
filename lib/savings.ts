// lib/savings.ts
export type DiscountType = 'PERCENT' | 'AMOUNT' | null | undefined;

/**
 * Returns a friendly savings label for a deal (without needing a price).
 * - PERCENT → "Save 15%"
 * - AMOUNT  → "Save ₦1,500"
 */
export function savingsLabel(
  discountType: DiscountType,
  discountValue?: number | null,
  currency: string = 'NGN'
) {
  if (!discountType || !discountValue) return null;
  if (discountType === 'PERCENT') return `Save ${trimZeros(discountValue)}%`;
  return `Save ${formatMoney(discountValue, currency)}`;
}

/** Formats currency simply for NGN/USD/CAD; extend as needed. */
export function formatMoney(value: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    // Fallback if the currency code is unknown on host
    const symbol = currencySymbol(currency);
    return `${symbol}${value.toLocaleString()}`;
  }
}

function currencySymbol(code: string) {
  const map: Record<string, string> = { NGN: '₦', USD: '$', CAD: '$', EUR: '€', GBP: '£' };
  return map[code] ?? '';
}

function trimZeros(n: number) {
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.0+$/, '');
}
