"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Props = {
  id: string; // dealId
  title: string;
  merchantName?: string;
  endsAtIso: string; // deal endsAt (server truth)
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getOrCreateDeviceId() {
  const key = "dealina_device_id";
  let v = "";
  try {
    v = localStorage.getItem(key) || "";
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(key, v);
    }
  } catch {
    v = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return v;
}

export default function DealQrCard({
  id,
  title,
  merchantName,
  endsAtIso,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [shortCode, setShortCode] = useState("");
  const [expiresAtIso, setExpiresAtIso] = useState("");

  // origin-safe
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    try {
      setOrigin(window.location.origin);
    } catch {}
  }, []);

  // tick countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadRedeemQr() {
    setErr(null);
    setLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();

      const res = await fetch(`/api/deals/${id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to generate redeem QR");
      }

      setShortCode(String(data.shortCode));
      setExpiresAtIso(String(data.expiresAt));
    } catch (e: any) {
      setErr(e?.message || "Could not generate redeem QR");
    } finally {
      setLoading(false);
    }
  }

  // auto-generate redeem QR on load
  useEffect(() => {
    loadRedeemQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dealEndsAtMs = new Date(endsAtIso).getTime();
  const expiresAtMs = expiresAtIso ? new Date(expiresAtIso).getTime() : 0;

  const qrMsLeft = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  const isExpired = expiresAtMs ? now >= expiresAtMs : false;
  const dealEnded = now >= dealEndsAtMs;

  const payload = useMemo(() => {
    if (!shortCode) return "";
    return origin ? `${origin}/redeem/${shortCode}` : shortCode;
  }, [shortCode, origin]);

  const qrUrl = useMemo(() => {
    if (!payload) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      payload
    )}`;
  }, [payload]);

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <div className="mb-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Redeem QR
        </p>
        <h1 className="mt-1 text-lg font-bold text-slate-900">{title}</h1>
        {merchantName && (
          <p className="mt-1 text-xs text-slate-600">at {merchantName}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Show this QR to the merchant. It expires in{" "}
          <span className="font-semibold">15 minutes</span>.
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-slate-100 p-4">
          {loading ? (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-white text-sm text-slate-500">
              Generating redeem QR…
            </div>
          ) : qrUrl ? (
            <img
              src={qrUrl}
              alt="Redeem QR"
              className={[
                "h-56 w-56 rounded-lg bg-white",
                isExpired ? "opacity-40 blur-[1px]" : "",
              ].join(" ")}
            />
          ) : null}
        </div>

        <div
          className={[
            "rounded-full px-4 py-1 text-sm font-semibold",
            dealEnded
              ? "bg-slate-200 text-slate-600"
              : isExpired
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-800",
          ].join(" ")}
        >
          {dealEnded
            ? "Deal ended"
            : isExpired
            ? "Redeem QR expired"
            : `Expires in ${formatCountdown(qrMsLeft)}`}
        </div>

        {!!shortCode && (
          <div className="text-center">
            <p className="text-[11px] text-slate-500">Short code</p>
            <p className="mt-1 rounded-xl bg-slate-100 px-4 py-2 font-mono text-base font-semibold tracking-widest text-slate-900">
              {shortCode}
            </p>
          </div>
        )}

        {!!shortCode && (
          <Link
            href={`/redeem/${shortCode}`}
            className="w-full rounded-full bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Open merchant redeem screen →
          </Link>
        )}

        <button
          type="button"
          onClick={loadRedeemQr}
          disabled={dealEnded || loading}
          className={[
            "w-full rounded-full px-4 py-2 text-sm font-semibold",
            dealEnded || loading
              ? "bg-slate-200 text-slate-400"
              : "border border-slate-300 text-slate-800 hover:bg-slate-50",
          ].join(" ")}
        >
          Refresh redeem QR
        </button>

        <p className="mt-2 text-center text-[10px] text-slate-400">
          Don’t share or download this QR.  
          If it expires, refresh to generate a new one.
        </p>
      </div>
    </div>
  );
}
