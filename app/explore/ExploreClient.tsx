"use client";

import ExploreSearchBar from "./search-bar";
import ExploreGridClient from "./ExploreGridClient";

type DealRow = {
  id: string;
  title: string;
  description: string | null;
  originalPrice: number | null;
  discountValue: number;
  discountType: string;
  startsAt: Date | string;
  endsAt: Date | string;
  imageUrl: string | null;
  maxRedemptions: number | null;
  merchant: { id: string; name: string; city: string | null };
};

export default function ExploreClient({ deals }: { deals: DealRow[] }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Explore deals
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Find live local discounts and redeem with a QR.
        </p>

        <div className="mt-4">
          <ExploreSearchBar />
        </div>
      </header>

      <ExploreGridClient deals={deals} />
    </main>
  );
}
