// lib/session.ts
// Helper to get a merchant id safely in Next 16 Server Components.
// You can pass `searchParams` in, or it will fall back.

const FALLBACK = '11111111-1111-1111-1111-111111111111';

/**
 * Works whether you pass a plain object or the Promise-like
 * that Next 16 provides to server components.
 */
export async function getMerchantId(searchParams?: any): Promise<string> {
  const sp = searchParams ? await searchParams : {};
  const q = typeof sp?.merchantId === 'string' ? sp.merchantId : '';
  return q || FALLBACK;
}
