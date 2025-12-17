"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";

type RedemptionDTO = {
  id: string;
  shortCode: string;
  code: string;
  expiresAt: string;
  createdAt: string;
};

function two(n: number) {
  return String(n).padStart(2, "0");
}

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${two(mm)}:${two(ss)}`;
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";
  const k = "dealina_device_id";
  const existing = window.localStorage.getItem(k);
  if (existing) return existing;
  const fresh =
    (crypto as any)?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(k, fresh);
  return fresh;
}

export default function DealQRCodeSection({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [redemption, setRedemption] = useState<RedemptionDTO | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const tickRef = useRef<any>(null);

  const expiresMs = redemption?.expiresAt ? new Date(redemption.expiresAt).getTime() : null;
  const remainingMs = expiresMs != null ? expiresMs - nowMs : null;

  const expired = remainingMs != null ? remainingMs <= 0 : false;

  const qrValue = useMemo(() => {
    if (!redemption) return "";
    // Keep your scan flow consistent (you already support URL parsing in confirm)
    return `${window.location.origin}/redeem/${redemption.shortCode}`;
  }, [redemption]);

  async function createOrGetQR() {
    setError(null);
    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch("/api/redemptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, deviceId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.details || "Failed to create QR");
      }

      setRedemption(data?.redemption ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // initial load + timer tick
  useEffect(() => {
    createOrGetQR();

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setNowMs(Date.now()), 500);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // auto regenerate once expired (no spam)
  useEffect(() => {
    if (!redemption) return;
    if (!expired) return;

    // wait a tiny bit, then regenerate
    const t = setTimeout(() => {
      createOrGetQR();
    }, 400);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Your QR Code</h3>
          <p className="mt-1 text-xs text-slate-500">
            This QR expires every 15 minutes to prevent hoarding.
          </p>
        </div>

        {redemption?.expiresAt && (
          <span
            className={[
              "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold",
              expired ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200",
            ].join(" ")}
          >
            {expired ? "Expired" : `Expires in ${msToClock(remainingMs ?? 0)}`}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4">
          {redemption ? (
            <QRCode value={qrValue || redemption.shortCode} size={180} />
          ) : (
            <div className="h-[180px] w-[180px] rounded-xl bg-slate-100" />
          )}
        </div>

        <div className="space-y-2">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="font-semibold text-slate-800">Code:</div>
            <div className="mt-1 break-all">{redemption?.shortCode ?? "—"}</div>
          </div>

          <button
            onClick={createOrGetQR}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Generating..." : expired ? "Regenerate QR" : "Refresh QR"}
          </button>

          <p className="text-[11px] text-slate-500">
            Same device = same active QR until it expires (cooldown built-in).
          </p>
        </div>
      </div>
    </section>
  );
}
