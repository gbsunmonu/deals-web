// C:\Users\Administrator\deals-web\app\merchant\dashboard\PreviewPriceControls.tsx
'use client';

import { useState } from 'react';

export type DealLike = {
  discountType: 'PERCENT' | 'AMOUNT' | null;
  discountValue: number | null;
};

function formatNGN(n: number) {
  if (Number.isNaN(n)) return '₦0';
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

export default function PreviewPriceControls({ deal }: { deal: DealLike }) {
  const [typicalPrice, setTypicalPrice] = useState<string>('');

  const base = Number(typicalPrice) || 0;

  let customerPays = base;
  let savings = 0;

  if (deal.discountType && deal.discountValue) {
    if (deal.discountType === 'PERCENT') {
      savings = (deal.discountValue / 100) * base;
      customerPays = base - savings;
    } else if (deal.discountType === 'AMOUNT') {
      savings = deal.discountValue;
      customerPays = Math.max(0, base - savings);
    }
  }

  return (
    <div className="mt-2">
      <label className="block text-xs text-gray-500 mb-1">
        Typical price (preview only — not saved)
      </label>

      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g. 5000"
          className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          value={typicalPrice}
          onChange={(e) => setTypicalPrice(e.target.value)}
        />
      </div>

      {base > 0 && (
        <p className="mt-2 text-sm text-gray-700">
          {`If regular price is ${formatNGN(base)}, customer pays `}
          <span className="font-semibold">{formatNGN(customerPays)}</span>
          {` (saves ${formatNGN(savings)}).`}
        </p>
      )}
    </div>
  );
}
