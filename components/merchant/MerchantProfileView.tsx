"use client";

import Link from "next/link";
import React from "react";

export type MerchantProfile = {
  id?: string;
  name: string | null;
  description: string | null;
  category: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  avatarUrl?: string | null;
};

type Props = {
  merchant: MerchantProfile | null;
};

function getInitials(name: string | null | undefined) {
  if (!name) return "M";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "M";
}

export default function MerchantProfileView({ merchant }: Props) {
  if (!merchant) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-6 text-sm text-neutral-600">
        <p className="font-medium text-neutral-900">No profile yet</p>
        <p className="mt-1">
          Tell customers about your business. Create your profile to get
          started.
        </p>
        <Link
          href="/merchant/profile/edit"
          className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-xs font-medium text-white hover:bg-neutral-900"
        >
          Create profile
        </Link>
      </div>
    );
  }

  const initials = getInitials(merchant.name);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 shadow-sm">
      {/* Top section */}
      <div className="flex flex-col gap-4 border-b border-neutral-100 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-800">
            {initials}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                {merchant.name || "Untitled merchant"}
              </h2>
              {merchant.category && (
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  {merchant.category}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {merchant.city || "No city set"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/merchant/profile/edit"
            className="inline-flex items-center rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Edit profile
          </Link>
          <Link
            href="/merchant/deals"
            className="inline-flex items-center rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-900"
          >
            View deals
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-6 p-6 md:grid-cols-[2fr,1.4fr]">
        {/* Left column – description & address */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              About
            </h3>
            <p className="mt-1 text-sm text-neutral-700">
              {merchant.description || "No description yet."}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Address
            </h3>
            <p className="mt-1 text-sm text-neutral-700">
              {merchant.address || "No address set."}
            </p>
          </div>
        </div>

        {/* Right column – contact & quick info */}
        <div className="space-y-4 rounded-xl bg-neutral-50/80 p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Contact
          </h3>

          <dl className="space-y-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Phone</dt>
              <dd className="font-medium text-neutral-900">
                {merchant.phone || "Not set"}
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-neutral-500">Website / Instagram</dt>
              <dd className="max-w-[60%] text-right font-medium text-emerald-700">
                {merchant.website ? (
                  <a
                    href={merchant.website}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate hover:underline"
                  >
                    {merchant.website}
                  </a>
                ) : (
                  "Not set"
                )}
              </dd>
            </div>
          </dl>

          <hr className="my-2 border-neutral-200" />

          {/* Placeholder stats (you can wire real numbers later) */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                Deals
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">—</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                Redemptions
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">—</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                Joined
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
