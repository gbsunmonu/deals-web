// components/merchant/MerchantProfileForm.tsx
"use client";

import * as React from "react";

type MerchantProfileFormProps = {
  initialData: {
    name: string;
    description: string;
    category: string;
    address: string;
    city: string;
    phone: string;
    website: string;
  };
};

export default function MerchantProfileForm({ initialData }: MerchantProfileFormProps) {
  const [form, setForm] = React.useState(initialData);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/merchant/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save profile");
      }

      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Business name
        </label>
        <input
          name="name"
          value={form.name}
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. GB Barbershop"
          onChange={(e) => updateField("name", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Description
        </label>
        <textarea
          name="description"
          value={form.description}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Short description of your business and the type of deals you offer."
          onChange={(e) => updateField("description", e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Category
          </label>
          <input
            name="category"
            value={form.category}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. Restaurant, Salon, Gym"
            onChange={(e) => updateField("category", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            City
          </label>
          <input
            name="city"
            value={form.city}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. Lagos"
            onChange={(e) => updateField("city", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Address
        </label>
        <input
          name="address"
          value={form.address}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Street address customers will visit"
          onChange={(e) => updateField("address", e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Phone
          </label>
          <input
            name="phone"
            value={form.phone}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="+234 …"
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Website / Instagram
          </label>
          <input
            name="website"
            value={form.website}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="https://instagram.com/yourbusiness"
            onChange={(e) => updateField("website", e.target.value)}
          />
        </div>
      </div>

      {status === "success" && (
        <p className="text-sm text-emerald-600">Profile saved 👍</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600">
          {errorMessage ?? "Something went wrong"}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
