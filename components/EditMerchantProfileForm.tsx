// components/EditMerchantProfileForm.tsx
"use client";

import { saveMerchantProfileAction } from "@/app/merchant/profile/edit/actions";

type MerchantFormData = {
  name: string;
  category: string | null;
  description: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
};

type Props = {
  merchant: MerchantFormData;
};

export default function EditMerchantProfileForm({ merchant }: Props) {
  return (
    <form
      action={saveMerchantProfileAction}
      className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h1 className="text-xl font-semibold text-gray-900">
        Edit merchant profile
      </h1>
      <p className="text-sm text-gray-500">
        Update your public business information. These details appear on your
        deals and profile.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Business name<span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              defaultValue={merchant.name}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
              placeholder="e.g. GB Barber Shop"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Category
            </label>
            <input
              name="category"
              defaultValue={merchant.category ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
              placeholder="e.g. Restaurant, Salon, Gym"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              City / Area
            </label>
            <input
              name="city"
              defaultValue={merchant.city ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
              placeholder="e.g. Ikeja, Lagos"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Address
            </label>
            <input
              name="address"
              defaultValue={merchant.address ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
              placeholder="Street & number customers can find you at"
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Phone
            </label>
            <input
              name="phone"
              defaultValue={merchant.phone ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
              placeholder="+234 801 234 5678"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Website / Instagram link
            </label>
            <input
              name="website"
              defaultValue={merchant.website ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
              placeholder="https://instagram.com/yourbusiness"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Short description
            </label>
            <textarea
              name="description"
              defaultValue={merchant.description ?? ""}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
              placeholder="Tell customers in one or two sentences why they should visit."
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500">
          Changes are saved for this merchant account only.
        </p>
        <div className="flex gap-2">
          <a
            href="/merchant/profile"
            className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
          >
            Save changes
          </button>
        </div>
      </div>
    </form>
  );
}
