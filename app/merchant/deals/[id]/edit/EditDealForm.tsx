// app/merchant/deals/[id]/edit/EditDealForm.tsx
"use client";

import { useState } from "react";
import type { Deal } from "@prisma/client";
import { saveDealAction } from "./actions";

type Props = {
  deal: Deal;
};

export default function EditDealForm({ deal }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAction(formData: FormData) {
    setError(null);
    setSubmitting(true);
    try {
      await saveDealAction(formData);
    } catch (err: any) {
      console.error("Save deal error:", err);
      setError(err?.message || "Failed to save deal");
      setSubmitting(false);
    }
  }

  const toInputValue = (d: Date) =>
    new Date(d).toISOString().slice(0, 16); // for datetime-local

  return (
    <form
      action={handleAction}
      className="space-y-4 rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm"
    >
      <input type="hidden" name="id" value={deal.id} />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          name="title"
          defaultValue={deal.title}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          name="description"
          defaultValue={deal.description || ""}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Original price (₦)
          </label>
          <input
            type="number"
            name="originalPrice"
            defaultValue={deal.originalPrice ?? ""}
            min={0}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Discount (%)
          </label>
          <input
            type="number"
            name="discountValue"
            defaultValue={deal.discountValue}
            min={0}
            max={100}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Starts at
          </label>
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={toInputValue(deal.startsAt)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Ends at
          </label>
          <input
            type="datetime-local"
            name="endsAt"
            defaultValue={toInputValue(deal.endsAt)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Image URL
        </label>
        <input
          name="imageUrl"
          defaultValue={deal.imageUrl || ""}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
          placeholder="https://example.com/image.jpg"
        />
        <p className="mt-1 text-xs text-gray-500">
          We&apos;re using Supabase storage URLs here.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <a
          href="/merchant/deals"
          className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
