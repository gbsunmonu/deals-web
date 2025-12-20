// app/merchant/onboarding/onboarding-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CreateMerchantPayload = {
  name: string;
  description?: string;
  category?: string;
  city?: string;
  address?: string;
  phone?: string;
  website?: string;
  avatarUrl?: string;
  lat?: number | null;
  lng?: number | null;
};

function normalizeWebsite(url: string) {
  const t = (url || "").trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

export default function OnboardingClient() {
  const router = useRouter();

  const [form, setForm] = useState<CreateMerchantPayload>({
    name: "",
    description: "",
    category: "",
    city: "",
    address: "",
    phone: "",
    website: "",
    avatarUrl: "",
    lat: null,
    lng: null,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return form.name.trim().length >= 2 && !saving;
  }, [form.name, saving]);

  async function submit() {
    setError(null);

    const payload: CreateMerchantPayload = {
      ...form,
      name: form.name.trim(),
      website: normalizeWebsite(form.website || ""),
      description: (form.description || "").trim() || undefined,
      category: (form.category || "").trim() || undefined,
      city: (form.city || "").trim() || undefined,
      address: (form.address || "").trim() || undefined,
      phone: (form.phone || "").trim() || undefined,
      avatarUrl: (form.avatarUrl || "").trim() || undefined,
      lat: form.lat ?? null,
      lng: form.lng ?? null,
    };

    if (payload.name.length < 2) {
      setError("Business name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/merchant/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to create merchant profile.");
        return;
      }

      router.push("/merchant/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Name */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-900">
            Business name <span className="text-red-600">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Turbo Maple International"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            This appears on the deal card and QR pages.
          </p>
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-semibold text-slate-900">Category</label>
          <input
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            placeholder="e.g. Restaurant, Salon, Grocery"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* City */}
        <div>
          <label className="text-sm font-semibold text-slate-900">City</label>
          <input
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            placeholder="e.g. Vancouver"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-900">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            placeholder="Street address (optional)"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-sm font-semibold text-slate-900">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="Optional"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Website */}
        <div>
          <label className="text-sm font-semibold text-slate-900">Website</label>
          <input
            value={form.website}
            onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
            placeholder="example.com"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            We’ll auto-add https:// if missing.
          </p>
        </div>

        {/* Avatar URL */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-900">Logo URL</label>
          <input
            value={form.avatarUrl}
            onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))}
            placeholder="https://…"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {form.avatarUrl?.trim() ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.avatarUrl.trim()}
                alt="Logo preview"
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="text-[11px] text-slate-500">
                If the preview doesn’t show, the URL may not be a direct image link.
              </p>
            </div>
          ) : null}
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-900">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={4}
            placeholder="A short description customers will see (optional)"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={[
            "rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
            !canSubmit
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700",
          ].join(" ")}
        >
          {saving ? "Saving…" : "Create merchant profile"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/merchant/dashboard")}
          className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Skip for now
        </button>

        <p className="text-[11px] text-slate-500">
          You can edit this later in your merchant settings.
        </p>
      </div>
    </section>
  );
}
