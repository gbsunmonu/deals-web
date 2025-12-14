"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type CreateDealPayload = {
  title: string;
  description: string;
  originalPrice: number | null;
  discountValue: number | null;
  startsAt: string; // ISO date
  endsAt: string; // ISO date
  imageUrl?: string | null;
  maxRedemptions: number | null; // ✅ NEW
};

export default function NewDealPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      const title = String(formData.get("title") || "").trim();
      const description = String(formData.get("description") || "").trim();

      const originalPriceRaw = String(formData.get("originalPrice") || "").trim();
      const discountValueRaw = String(formData.get("discountValue") || "").trim();

      const startsAt = String(formData.get("startsAt") || "").trim();
      const endsAt = String(formData.get("endsAt") || "").trim();

      // ✅ NEW: maxRedemptions (optional)
      const maxRedemptionsRaw = String(formData.get("maxRedemptions") || "").trim();

      // optional manual URL (fallback if no upload)
      let imageUrl: string | null =
        String(formData.get("imageUrl") || "").trim() || null;

      if (!title) throw new Error("Please enter a title.");

      let originalPrice: number | null = null;
      if (originalPriceRaw) {
        const n = Number(originalPriceRaw.replace(/,/g, ""));
        if (Number.isNaN(n) || n <= 0) throw new Error("Original price looks invalid.");
        originalPrice = n;
      }

      let discountValue: number | null = null;
      if (discountValueRaw) {
        const n = Number(discountValueRaw);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          throw new Error("Discount must be between 0 and 100.");
        }
        discountValue = n;
      }

      if (!startsAt || !endsAt) {
        throw new Error("Please set both start date and end date.");
      }

      // ✅ NEW: Parse maxRedemptions
      // Empty => null (unlimited)
      // Positive integer => that limit
      let maxRedemptions: number | null = null;
      if (maxRedemptionsRaw) {
        const n = Number(maxRedemptionsRaw);
        if (!Number.isInteger(n) || n <= 0) {
          throw new Error("Max redemptions must be a whole number greater than 0 (or leave empty).");
        }
        maxRedemptions = n;
      }

      // 1) If merchant selected a file, upload it to Supabase Storage
      if (imageFile) {
        const supabase = createSupabaseBrowser();

        const fileExt = imageFile.name.split(".").pop() || "jpg";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `deals/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("deal-images") // bucket name
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error("Failed to upload image. Please try again.");
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("deal-images").getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const payload: CreateDealPayload = {
        title,
        description,
        originalPrice,
        discountValue,
        startsAt,
        endsAt,
        imageUrl,
        maxRedemptions, // ✅ NEW
      };

      const res = await fetch("/api/merchant/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Create deal error:", data);
        throw new Error(data?.error || "Failed to create deal.");
      }

      router.push("/merchant/deals");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong creating the deal.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(typeof ev.target?.result === "string" ? ev.target.result : null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
          Merchant
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Create New Deal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fill in the details of your promotion. Add a clear photo so customers understand the offer quickly.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {/* Title */}
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium text-slate-900">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. 2-for-1 lunch special"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium text-slate-900">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Describe what is included in this deal."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Pricing row */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="originalPrice" className="text-sm font-medium text-slate-900">
              Original price (₦)
            </label>
            <input
              id="originalPrice"
              name="originalPrice"
              type="number"
              min={0}
              step="1"
              placeholder="e.g. 2500"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="discountValue" className="text-sm font-medium text-slate-900">
              Discount (%)
            </label>
            <input
              id="discountValue"
              name="discountValue"
              type="number"
              min={0}
              max={100}
              step="1"
              placeholder="e.g. 25"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* ✅ NEW: Max redemptions */}
        <div className="space-y-1">
          <label htmlFor="maxRedemptions" className="text-sm font-medium text-slate-900">
            Max redemptions (optional)
          </label>
          <input
            id="maxRedemptions"
            name="maxRedemptions"
            type="number"
            min={1}
            step="1"
            placeholder="Leave empty for unlimited (e.g. 1, 10, 100)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="text-[11px] text-slate-500">
            Use <span className="font-medium">1</span> for “one free item total”, or leave blank for unlimited redemptions.
          </p>
        </div>

        {/* Dates row */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="startsAt" className="text-sm font-medium text-slate-900">
              Starts at
            </label>
            <input
              id="startsAt"
              name="startsAt"
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="endsAt" className="text-sm font-medium text-slate-900">
              Ends at
            </label>
            <input
              id="endsAt"
              name="endsAt"
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Image upload + optional URL */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">
              Deal image <span className="ml-1 text-xs font-normal text-slate-500">(upload from phone)</span>
            </p>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/40">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mb-2 h-32 w-full rounded-xl object-cover"
                />
              ) : (
                <span className="mb-1 text-3xl">📷</span>
              )}
              <span className="font-medium text-slate-800">Tap to choose photo</span>
              <span className="mt-1 text-[11px] text-slate-500">JPG or PNG, max ~3MB</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>

          <div className="space-y-1">
            <label htmlFor="imageUrl" className="text-sm font-medium text-slate-900">
              Image URL (optional)
            </label>
            <input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="Paste a public image URL (optional)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500">
              Most merchants will just upload from their phone. This field is only for special cases where you already have an image URL.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-500">
            You can edit this deal later from{" "}
            <span className="font-medium text-slate-700">Merchant home</span>.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create deal"}
          </button>
        </div>
      </form>
    </main>
  );
}
