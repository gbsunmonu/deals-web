"use client";

import { useMemo } from "react";
import { updateMerchantProfileAction } from "./update-action";

type Merchant = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;

  // ✅ NEW field in Prisma
  whatsappNumber?: string | null;

  avatarUrl?: string | null;
};

export default function MerchantProfileForm({ merchant }: { merchant: Merchant }) {
  const defaults = useMemo(
    () => ({
      name: merchant.name ?? "",
      description: merchant.description ?? "",
      category: merchant.category ?? "",
      city: merchant.city ?? "",
      address: merchant.address ?? "",
      phone: merchant.phone ?? "",
      website: merchant.website ?? "",
      whatsappNumber: merchant.whatsappNumber ?? "",
    }),
    [merchant]
  );

  return (
    <form action={updateMerchantProfileAction} className="space-y-6">
      {/* Business name */}
      <Field label="Business name" hint="This is what customers will see">
        <input
          name="name"
          defaultValue={defaults.name}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
          placeholder="e.g. Turbo Maple International"
          required
        />
      </Field>

      {/* Description */}
      <Field label="Description" hint="Short description of what you sell/do">
        <textarea
          name="description"
          defaultValue={defaults.description}
          className="min-h-[120px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
          placeholder="Tell customers about your business..."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" hint="Optional">
          <input
            name="category"
            defaultValue={defaults.category}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            placeholder="e.g. Restaurant, Beauty, Electronics"
          />
        </Field>

        <Field label="City" hint="Optional">
          <input
            name="city"
            defaultValue={defaults.city}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            placeholder="e.g. Lagos"
          />
        </Field>
      </div>

      <Field label="Address" hint="Optional">
        <input
          name="address"
          defaultValue={defaults.address}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
          placeholder="e.g. 12 Admiralty Way, Lekki"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number" hint="Optional">
          <input
            name="phone"
            defaultValue={defaults.phone}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            placeholder="e.g. 0801 234 5678"
          />
        </Field>

        {/* ✅ NEW: WhatsApp */}
        <Field label="WhatsApp number" hint="Recommended (use +234... format)">
          <input
            name="whatsappNumber"
            defaultValue={defaults.whatsappNumber}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            placeholder="e.g. +2348012345678"
          />
        </Field>
      </div>

      <Field label="Website" hint="Optional">
        <input
          name="website"
          defaultValue={defaults.website}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
          placeholder="e.g. https://yourwebsite.com"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Save profile
        </button>

        <a
          href="/merchant/profile"
          className="inline-flex items-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}
