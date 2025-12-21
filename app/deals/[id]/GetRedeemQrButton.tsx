// app/deals/[id]/GetRedeemQrButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function getOrCreateDeviceId(): string {
  const key = "ytd_device_id";
  const existing =
    typeof window !== "undefined" ? localStorage.getItem(key) : null;
  if (existing) return existing;

  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(key, created);
  return created;
}

export default function GetRedeemQrButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleGetQr() {
    setErr(null);
    setLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();

      const res = await fetch("/api/redeem/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dealId, deviceId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate QR");
      }

      const shortCode = String(json?.shortCode || "").trim();
      if (!shortCode) throw new Error("Missing shortCode from server");

      router.push(`/r/${encodeURIComponent(shortCode)}`);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      {err ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      <button
        onClick={handleGetQr}
        disabled={loading}
        className={[
          "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition",
          loading
            ? "bg-slate-200 text-slate-500 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-700",
        ].join(" ")}
      >
        {loading ? "Generating QR…" : "Get QR code"}
      </button>

      <p className="mt-2 text-xs text-slate-500">
        QR is device-locked and expires in 15 minutes.
      </p>
    </div>
  );
}
