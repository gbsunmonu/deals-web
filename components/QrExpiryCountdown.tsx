"use client";

import { useEffect, useMemo, useState } from "react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function QrExpiryCountdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: string | Date | null | undefined;
  onExpired?: () => void;
}) {
  const exp = useMemo(() => {
    if (!expiresAt) return null;
    const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    return Number.isNaN(d.getTime()) ? null : d;
  }, [expiresAt]);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const msLeft = exp ? exp.getTime() - now.getTime() : null;

  useEffect(() => {
    if (msLeft != null && msLeft <= 0) onExpired?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft]);

  if (!exp) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Expiry: —
      </div>
    );
  }

  const expired = msLeft != null && msLeft <= 0;
  const total = Math.max(0, Math.floor((msLeft ?? 0) / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;

  return (
    <div
      className={[
        "rounded-xl border px-3 py-2 text-xs font-semibold",
        expired
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      ].join(" ")}
    >
      {expired ? "QR expired — regenerate" : `Expires in ${pad2(mm)}:${pad2(ss)}`}
    </div>
  );
}
