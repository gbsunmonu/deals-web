// lib/demo.ts
export function getActiveMerchantId() {
  if (process.env.DEMO_MODE === 'true') {
    const id = process.env.DEMO_MERCHANT_ID;
    if (!id) {
      throw new Error('DEMO_MODE is true but DEMO_MERCHANT_ID is not set');
    }
    return id;
  }

  throw new Error('Demo mode disabled; implement real auth lookup here.');
}
