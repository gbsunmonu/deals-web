"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  id: string; // dealId
  title: string;
  merchantName?: string;
  endsAtIso: string; // deal endsAt (server truth)
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "Expired";
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
    // fallback
    v = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return v;
}

export default function DealQrCard({ id, title, merchantName, endsAtIso }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [shortCode, setShortCode] = useState<string>("");
  const [expiresAtIso, setExpiresAtIso] = useState<string>("");

  const [copied, setCopied] = useState(false);

  // tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function claimOrRefresh() {
    setErr(null);
    setCopied(false);
    setLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();

      const res = await fetch(`/api/deals/${id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({}), // keep body for proxies that require it
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to generate QR");
      }

      setShortCode(String(data.shortCode || ""));
      setExpiresAtIso(String(data.expiresAt || ""));
    } catch (e: any) {
      setErr(e?.message || "Could not generate QR");
    } finally {
      setLoading(false);
    }
  }

  // initial claim
  useEffect(() => {
    claimOrRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dealEndsAtMs = new Date(endsAtIso).getTime();
  const expiresAtMs = expiresAtIso ? new Date(expiresAtIso).getTime() : 0;

  const msLeft = expiresAtMs ? expiresAtMs - now : 0;
  const isExpired = expiresAtMs ? now >= expiresAtMs : false;
  const dealEnded = now >= dealEndsAtMs;

  const countdownLabel = expiresAtMs ? formatCountdown(msLeft) : "—";

  // Payload used by merchant scan/confirm:
  // We can encode a URL or just the shortCode. Your confirm route supports both.
  const payload = useMemo(() => {
    if (!shortCode) return "";
    // safest: URL, confirm route extracts last path segment
    return `${window.location.origin}/redeem/${shortCode}`;
  }, [shortCode]);

  const qrUrl = useMemo(() => {
    if (!payload) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`;
  }, [payload]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload || shortCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const canRegenerate = !dealEnded; // if deal ended, don't regenerate

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
      <div className="mb-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Deal QR code
        </p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-gray-900">{title}</h1>
        {merchantName && <p className="mt-1 text-xs text-gray-600">at {merchantName}</p>}
        <p className="mt-1 text-[11px] text-gray-500">
          This QR is locked to your device and expires in 15 minutes.
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <div
          className={[
            "flex items-center justify-center rounded-2xl p-4",
            loading ? "bg-gray-100" : isExpired ? "bg-gray-200" : "bg-gray-100",
          ].join(" ")}
        >
          {loading ? (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-white text-sm text-gray-500">
              Generating…
            </div>
          ) : qrUrl ? (
            <img
              src={qrUrl}
              alt="Deal QR code"
              className={[
                "h-56 w-56 rounded-lg bg-white transition",
                isExpired ? "opacity-40 blur-[1px]" : "",
              ].join(" ")}
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-white text-sm text-gray-500">
              No QR
            </div>
          )}
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
          {dealEnded ? "Deal ended" : isExpired ? "QR expired" : `Expires in ${countdownLabel}`}
        </div>

        <div className="flex w-full items-center justify-center gap-2">
          <button
            type="button"
            onClick={claimOrRefresh}
            disabled={!canRegenerate || loading}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition",
              !canRegenerate || loading
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : isExpired
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-gray-300 text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            {isExpired ? "Regenerate QR" : "Refresh QR"}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!payload || isExpired || loading}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition",
              !payload || isExpired || loading
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-black",
            ].join(" ")}
          >
            {copied ? "Copied ✓" : "Copy code"}
          </button>
        </div>

        {/* Fallback raw code */}
        <div className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="mb-1 text-[11px] font-semibold text-gray-700">
            No camera? Paste this:
          </p>
          <pre className="max-h-24 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-white px-2 py-1 text-[11px] text-gray-800">
            {payload || shortCode || "—"}
          </pre>
        </div>

        <p className="mt-2 text-[10px] text-gray-400 text-center">
          Don’t share your QR publicly. If it expires, regenerate.
        </p>
      </div>
    </div>
  );
}
