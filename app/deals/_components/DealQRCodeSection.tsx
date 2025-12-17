"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type RedemptionLike = {
  id?: string;
  shortCode?: string;
  expiresAt?: string | Date | null;
};

function toMs(d?: string | Date | null) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  const t = dt.getTime();
  return Number.isNaN(t) ? null : t;
}

function fmtMMSS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function DealQRCodeSection({
  redemption,
  children,
}: {
  redemption?: RedemptionLike | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const expiresAtMs = useMemo(
    () => toMs(redemption?.expiresAt),
    [redemption?.expiresAt]
  );

  const [now, setNow] = useState(Date.now());
  const remainingMs =
    expiresAtMs != null ? expiresAtMs - now : null;

  const expired = remainingMs != null && remainingMs <= 0;

  useEffect(() => {
    if (!expiresAtMs) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [expiresAtMs]);

  function regenerate() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {/* Countdown badge */}
      {expiresAtMs && (
        <div
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            expired
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-700",
          ].join(" ")}
        >
          <span
            className={[
              "h-2 w-2 rounded-full",
              expired ? "bg-red-500" : "bg-emerald-500",
            ].join(" ")}
          />
          {expired
            ? "QR expired"
            : `Expires in ${fmtMMSS(remainingMs!)}`}
        </div>
      )}

      {/* QR itself */}
      <div
        className={[
          "rounded-2xl border p-4 flex justify-center",
          expired ? "opacity-60" : "",
        ].join(" ")}
      >
        {children}
      </div>

      {/* Regenerate */}
      {expired && (
        <button
          onClick={regenerate}
          disabled={isPending}
          className="w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {isPending ? "Refreshing…" : "Generate new QR"}
        </button>
      )}
    </div>
  );
}
