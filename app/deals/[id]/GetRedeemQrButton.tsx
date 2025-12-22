"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  dealId: string;
};

export default function GetRedeemQrButton({ dealId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canClick = useMemo(() => !loading && !!dealId, [loading, dealId]);

  async function startRedeem() {
    if (!canClick) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/redeem/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ dealId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.shortCode) {
        throw new Error(data?.error || "Could not generate QR. Try again.");
      }

      const shortCode = String(data.shortCode);

      // ✅ send user straight to /r/[shortCode]
      router.push(`/r/${encodeURIComponent(shortCode)}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      <button
        type="button"
        onClick={startRedeem}
        disabled={!canClick}
        className={[
          "w-full rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition",
          !canClick
            ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-emerald-600 text-white hover:bg-emerald-700",
        ].join(" ")}
      >
        {loading ? "Generating QR…" : "Get QR to redeem"}
      </button>

      <p className="text-[11px] text-slate-500">
        QR expires in 15 minutes. It’s locked to your device.
      </p>
    </div>
  );
}
