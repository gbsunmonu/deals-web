// app/merchant/profile/MerchantAvatar.tsx

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

interface MerchantAvatarProps {
  merchantId: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
}

export default function MerchantAvatar({
  merchantId,
  name,
  avatarUrl,
  initials,
}: MerchantAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Basic checks
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, SVG…).");
      return;
    }

    const maxSizeMb = 2;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Image is too large. Max size is ${maxSizeMb}MB.`);
      return;
    }

    setUploading(true);

    try {
      const supabase = createSupabaseBrowser();

      const ext = file.name.split(".").pop() || "png";
      const filePath = `merchant-${merchantId}/${Date.now()}.${ext}`;

      // 1) Upload to storage bucket
      const { data, error: uploadError } = await supabase.storage
        .from("merchant-logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError || !data?.path) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to upload logo. Please try again.");
      }

      // 2) Get public URL
      const { data: urlData } = supabase.storage
        .from("merchant-logos")
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      if (!publicUrl) {
        throw new Error("Could not get logo URL from storage.");
      }

      // 3) Save URL to Merchant via API
      const res = await fetch("/api/merchant/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.error("Logo save failed:", res.status, body);
        throw new Error(body?.error || "Failed to save logo.");
      }

      // 4) Refresh page so server component sees new avatarUrl
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Something went wrong while uploading logo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow-sm transition hover:ring-2 hover:ring-emerald-500/60 disabled:cursor-not-allowed"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-base font-semibold text-slate-500">
            {initials || "Logo"}
          </span>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-black/0 text-[10px] font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <span className="mb-1 rounded-full bg-black/60 px-2 py-0.5">
            {uploading ? "Uploading…" : "Change logo"}
          </span>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <p className="max-w-xs text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
