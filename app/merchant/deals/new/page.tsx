"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type InventoryMode = "UNLIMITED" | "ONE" | "LIMITED";

function yyyyMmDd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NewDealPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [originalPrice, setOriginalPrice] = useState<string>("");
  const [discountValue, setDiscountValue] = useState<string>("0");

  // ✅ Upload + (optional) URL fallback
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");

  // ✅ Date only
  const [startDate, setStartDate] = useState(() => yyyyMmDd(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return yyyyMmDd(d);
  });

  const [inventoryMode, setInventoryMode] = useState<InventoryMode>("UNLIMITED");
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");

  const [error, setError] = useState<string | null>(null);

  const computedPreview = useMemo(() => {
    if (inventoryMode === "UNLIMITED") return "Unlimited redemptions until expiry.";
    if (inventoryMode === "ONE") return "Only 1 total redemption (one free item).";
    const n = Number(maxRedemptions);
    if (!Number.isFinite(n) || n <= 0) return "Limited inventory (enter a number).";
    return `${n} total redemptions available.`;
  }, [inventoryMode, maxRedemptions]);

  async function uploadImageIfNeeded(): Promise<string | null> {
    // If file chosen, upload it. If not, use URL field (optional).
    if (!imageFile) {
      const url = imageUrl.trim();
      return url ? url : null;
    }

    const fd = new FormData();
    fd.append("file", imageFile);

    const res = await fetch("/api/uploads/deal-image", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.details || "Image upload failed");
    }
    return data.url as string;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const orig = originalPrice.trim() ? Number(originalPrice) : null;
    const disc = discountValue.trim() ? Number(discountValue) : 0;

    const max =
      inventoryMode === "LIMITED" && maxRedemptions.trim()
        ? Number(maxRedemptions)
        : null;

    if (inventoryMode === "LIMITED" && (!max || !Number.isFinite(max) || max <= 0)) {
      setError("For Limited inventory, maxRedemptions must be a number > 0.");
      return;
    }

    // Optional: simple date sanity check
    if (!startDate || startDate.length !== 10) {
      setError("Valid startDate (YYYY-MM-DD) is required.");
      return;
    }
    if (!endDate || endDate.length !== 10) {
      setError("Valid endDate (YYYY-MM-DD) is required.");
      return;
    }

    startTransition(async () => {
      try {
        const finalImageUrl = await uploadImageIfNeeded();

        const res = await fetch("/api/merchant/deals/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            originalPrice: orig,
            discountValue: Number.isFinite(disc) ? disc : 0,
            discountType: disc > 0 ? "PERCENT" : "NONE",
            imageUrl: finalImageUrl,

            // ✅ send DATE-ONLY fields (backend will convert to 23:59)
            startDate,
            endDate,

            inventoryMode,
            maxRedemptions: max,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || data?.details || "Failed to create deal.");
        }

        router.push("/merchant/deals");
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Something went wrong.");
      }
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Create new deal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Date-only: we automatically set start/end to 23:59.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Basic info */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                rows={4}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Original price (₦)
                </label>
                <input
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Discount % (0–100)
                </label>
                <input
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* ✅ Upload image */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Upload image (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                If you upload a file, we’ll store it in Supabase Storage and save the URL automatically.
              </p>
            </div>

            {/* Optional URL fallback */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Image URL (optional fallback)
              </label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="https://..."
              />
            </div>
          </div>
        </section>

        {/* ✅ Date-only timing */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Timing</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Starts on
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                We assume 23:59 for the start time.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ends on
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                We assume 23:59 for the end time.
              </p>
            </div>
          </div>
        </section>

        {/* Inventory */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Inventory</h2>
          <p className="mt-1 text-xs text-slate-500">
            Decide how many total redemptions are allowed for this deal.
          </p>

          <div className="mt-3 grid gap-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name="inventory"
                checked={inventoryMode === "UNLIMITED"}
                onChange={() => setInventoryMode("UNLIMITED")}
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">Unlimited</div>
                <div className="text-xs text-slate-500">No limit until the deal expires.</div>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name="inventory"
                checked={inventoryMode === "ONE"}
                onChange={() => setInventoryMode("ONE")}
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">One only</div>
                <div className="text-xs text-slate-500">Exactly 1 total redemption.</div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name="inventory"
                checked={inventoryMode === "LIMITED"}
                onChange={() => setInventoryMode("LIMITED")}
                className="mt-1"
              />
              <div className="w-full">
                <div className="text-sm font-semibold text-slate-900">Limited</div>
                <div className="text-xs text-slate-500">Set total redemptions (e.g. 100).</div>

                <div className="mt-2">
                  <input
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(e.target.value)}
                    disabled={inventoryMode !== "LIMITED"}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-60 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 100"
                  />
                </div>
              </div>
            </label>

            <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {computedPreview}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {isPending ? "Creating..." : "Create deal"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/merchant/deals")}
            disabled={isPending}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
