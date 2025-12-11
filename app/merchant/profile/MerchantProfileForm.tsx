// app/merchant/profile/MerchantProfileForm.tsx
"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMerchantProfile } from "./actions";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// Use your Supabase bucket name
const BUCKET_NAME = "merchant-avatars";

type Merchant = {
  id: string;
  name: string | null;
  description: string | null;
  category: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  avatarUrl: string | null;
};

export default function MerchantProfileForm({ merchant }: { merchant: Merchant }) {
  const [form, setForm] = React.useState<Merchant>(merchant);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [logoUploading, setLogoUploading] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const router = useRouter();

  function handleChange(field: keyof Merchant, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleLogoButtonClick() {
    if (!logoUploading) {
      fileInputRef.current?.click();
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError(null);

    if (!file.type.startsWith("image/")) {
      setLogoError("Please upload an image file (PNG, JPG, SVG…).");
      return;
    }

    const maxSizeMb = 2;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setLogoError(`Image is too large. Max size is ${maxSizeMb}MB.`);
      return;
    }

    setLogoUploading(true);
    try {
      const supabase = createSupabaseBrowser();
      const ext = file.name.split(".").pop() || "png";
      const filePath = `merchant-${form.id}/${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError || !data?.path) {
        console.error("Upload error:", uploadError);
        throw new Error(uploadError?.message || "Failed to upload logo.");
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      if (!publicUrl) {
        throw new Error("Could not get logo URL from storage.");
      }

      // Update local state so preview + hidden field update
      setForm((prev) => ({ ...prev, avatarUrl: publicUrl }));
    } catch (err: any) {
      console.error("Logo upload error:", err);
      setLogoError(
        err?.message || "Failed to upload logo. Please check your bucket.",
      );
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onSubmit(formData: FormData) {
    setStatus(null);
    setError(null);

    startTransition(async () => {
      try {
        await saveMerchantProfile(formData);

        // Optional status text (won't be seen long because of redirect)
        setStatus("Profile saved successfully.");

        // 👇 Redirect to merchant home/profile page after successful save
        router.push("/merchant/profile");
        router.refresh();
      } catch (err: any) {
        console.error("Save profile failed:", err);
        setError("Failed to save profile. Please try again.");
      }
    });
  }

  const initials = (form.name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <form action={onSubmit} className="space-y-8">
      {/* Hidden fields so server action sees ID + logo URL */}
      <input type="hidden" name="id" value={form.id} />
      <input type="hidden" name="avatarUrl" value={form.avatarUrl || ""} />

      {/* Logo preview + upload link */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow-sm">
          {form.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.avatarUrl}
              alt={form.name || "Logo"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-base font-semibold text-slate-500">
              {initials || "Logo"}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleLogoButtonClick}
            disabled={logoUploading}
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            {logoUploading ? "Uploading…" : "Upload / change logo"}
          </button>
          <p className="text-xs text-slate-400">
            This logo will appear on your deals and profile. Recommended:
            square image, at least 256×256px.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
          {logoError && <p className="text-xs text-red-600">{logoError}</p>}
        </div>
      </div>

      {/* Business name / category / city */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700">
            Business name
          </label>
          <input
            type="text"
            name="name"
            value={form.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Category
          </label>
          <input
            type="text"
            name="category"
            value={form.category || ""}
            onChange={(e) => handleChange("category", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            City
          </label>
          <input
            type="text"
            name="city"
            value={form.city || ""}
            onChange={(e) => handleChange("city", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          name="description"
          rows={4}
          value={form.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Address / phone */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Address
          </label>
          <input
            type="text"
            name="address"
            value={form.address || ""}
            onChange={(e) => handleChange("address", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Phone number
          </label>
          <input
            type="text"
            name="phone"
            value={form.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Website (optional)
        </label>
        <input
          type="text"
          name="website"
          value={form.website || ""}
          onChange={(e) => handleChange("website", e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {status && (
        <p className="text-sm font-medium text-emerald-600">{status}</p>
      )}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
        >
          {isPending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
