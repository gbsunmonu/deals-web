// C:\Users\Administrator\deals-web\app\merchant\dashboard\DealStatsModal.tsx
'use client';

import { useState } from 'react';

type DealStatsModalProps = {
  deal: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    redemptions: { id: string; createdAt: string }[];
  };
};

export default function DealStatsModal({ deal }: DealStatsModalProps) {
  const [open, setOpen] = useState(false);

  const total = deal.redemptions.length;
  const now = new Date();
  const start = new Date(deal.startsAt);
  const end = new Date(deal.endsAt);
  const active = now >= start && now <= end;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        View stats
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 grid place-items-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[90%] max-w-md relative">
            <h3 className="text-lg font-semibold mb-2">{deal.title}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {active ? (
                <span className="text-green-600 font-medium">Active</span>
              ) : (
                <span className="text-red-600 font-medium">Expired</span>
              )}{' '}
              — {new Date(deal.startsAt).toLocaleDateString()} →{' '}
              {new Date(deal.endsAt).toLocaleDateString()}
            </p>

            <p className="text-sm mb-2">
              Total redemptions: <strong>{total}</strong>
            </p>

            {total === 0 ? (
              <p className="text-sm text-gray-500 italic">No redemptions yet.</p>
            ) : (
              <ul className="max-h-40 overflow-y-auto text-sm border-t border-gray-100 mt-3 pt-2">
                {deal.redemptions.map((r) => (
                  <li key={r.id} className="py-1 text-gray-700">
                    {new Date(r.createdAt).toLocaleString('en-NG')}
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
