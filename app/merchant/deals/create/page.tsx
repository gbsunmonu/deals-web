// app/merchant/deals/create/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type DealFormState = {
  title: string;
  description: string;
  originalPrice: number;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  imageUrl: string;
};

export default function CreateDealPage() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<DealFormState>({
    title: "",
    description: "",
    originalPrice: 0,
    discountPercent: 0,
    startsAt: "",
    endsAt: "",
    imageUrl: "",
  });

  const discountAmount =
    (form.originalPrice * form.discountPercent) / 100 || 0;
  const finalPrice = form.originalPrice - discountAmount;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const fd = new FormData(e.currentTarget);

      // FormData can only store strings, so we normalise a bit
      fd.set("originalPrice", String(form.originalPrice || 0));
      fd.set("discountPercent", String(form.discountPercent || 0));

      const res = await fetch("/api/deals/create", {
        method: "POST",
        body: fd, // 🔴 IMPORTANT: no headers, browser sets multipart/form-data
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as any;
        throw new Error(body?.error ?? "Failed to create deal");
      }

      // go to merchant deals list
      router.push("/merchant/deals");
      router.refresh();
    } catch (err: any) {
      console.error("Create deal error", err);
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">Create New Deal</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Add a new promotion your customers can find on Dealina.
      </p>

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* LEFT: FORM */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Title
              <input
                name="title"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
              <textarea
                name="description"
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium mb-1">
              Original price
              <div className="mt-1 flex rounded-md border">
                <span className="inline-flex items-center px-3 text-sm">
                  ₦
                </span>
                <input
                  type="number"
                  min={0}
                  name="originalPrice"
                  className="w-full rounded-r-md px-3 py-2 text-sm outline-none"
                  value={form.originalPrice || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      originalPrice: Number(e.target.value || "0"),
                    }))
                  }
                />
              </div>
            </label>

            <label className="block text-sm font-medium mb-1">
              Discount (%)
              <div className="mt-1 flex rounded-md border">
                <input
                  type="number"
                  min={0}
                  max={100}
                  name="discountPercent"
                  className="w-full rounded-l-md px-3 py-2 text-sm outline-none"
                  value={form.discountPercent || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountPercent: Number(e.target.value || "0"),
                    }))
                  }
                />
                <span className="inline-flex items-center px-3 text-sm">
                  OFF
                </span>
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium mb-1">
              Starts at
              <input
                type="datetime-local"
                name="startsAt"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startsAt: e.target.value }))
                }
              />
            </label>

            <label className="block text-sm font-medium mb-1">
              Ends at
              <input
                type="datetime-local"
                name="endsAt"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endsAt: e.target.value }))
                }
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Deal image URL (optional)
              <input
                name="imageUrl"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Paste a Supabase public URL or image link"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
              />
            </label>
            <p className="mt-1 text-xs text-neutral-500">
              Use a clear photo that represents the service or product.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create deal"}
          </button>
        </form>

        {/* RIGHT: SUMMARY CARD */}
        <aside className="rounded-xl border bg-white p-6 shadow-sm text-sm">
          <h2 className="font-semibold mb-4">Deal summary</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Title</dt>
              <dd className="font-medium">
                {form.title || "Your amazing deal"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Original price</dt>
              <dd>₦{form.originalPrice || 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Discount</dt>
              <dd>{form.discountPercent || 0}% OFF</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Customer pays</dt>
              <dd>₦{finalPrice || 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">They save</dt>
              <dd className="font-semibold text-emerald-600">
                ₦{discountAmount || 0}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs text-neutral-500">
            You can always edit this deal later from your merchant tools.
          </p>
        </aside>
      </div>
    </div>
  );
}
