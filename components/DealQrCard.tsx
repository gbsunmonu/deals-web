"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Props = {
  id: string; // dealId
  title: string;
  merchantName?: string;
  endsAtIso: string;
};

type BlockedByInfo = {
  dealId: string;
  shortCode?: string | null;
  expiresAt?: string | null;
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

export default function DealQrCard({ id, title, merchantName, endsAtIso }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  const [shortCode, setShortCode] = useState("");
  const [expiresAtIso, setExpiresAtIso] = useState("");

  const [err, setErr] = useState<string | null>(null);

  // ✅ Anti-hoarding info (if server blocks NEW QR generation)
  const [blockedBy, setBlockedBy] = useState<BlockedByInfo | null>(null);

  // ✅ cooldown UI state (server may return retryAfterSeconds)
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number>(0);
  const cooldownMsLeft = Math.max(0, cooldownUntilMs - now);
  const inCooldown = cooldownMsLeft > 0;

  // origin safe
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    try {
      setOrigin(window.location.origin);
    } catch {
      setOrigin("");
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function claimOrRefresh() {
    setErr(null);
    setBlockedBy(null);

    // ✅ block clicks while cooldown active
    if (inCooldown) return;

    setLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();

      const res = await fetch(`/api/deals/${id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({}),
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      // ✅ Anti-hoarding or cooldown response
      if (res.status === 429) {
        const retryAfterSeconds = Number(
          data?.retryAfterSeconds || data?.cooldownSeconds || 0
        );
        if (retryAfterSeconds > 0) {
          setCooldownUntilMs(Date.now() + retryAfterSeconds * 1000);
        }

        if (data?.blockedBy?.dealId) {
          setBlockedBy({
            dealId: String(data.blockedBy.dealId),
            shortCode: data.blockedBy.shortCode ?? null,
            expiresAt: data.blockedBy.expiresAt ?? null,
          });
        }

        setErr(data?.error || "Please wait before generating another QR.");
        return;
      }

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

  useEffect(() => {
    claimOrRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dealEndsAtMs = new Date(endsAtIso).getTime();
  const expiresAtMs = expiresAtIso ? new Date(expiresAtIso).getTime() : 0;

  const qrMsLeft = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  const isExpired = expiresAtMs ? now >= expiresAtMs : false;
  const dealEnded = now >= dealEndsAtMs;

  const payload = useMemo(() => {
    if (!shortCode) return "";
    if (!origin) return shortCode;
    return `${origin}/redeem/${shortCode}`;
  }, [shortCode, origin]);

  const qrUrl = useMemo(() => {
    if (!payload) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      payload
    )}`;
  }, [payload]);

  const blockedExpiresMs = blockedBy?.expiresAt
    ? new Date(blockedBy.expiresAt).getTime()
    : 0;
  const blockedMsLeft = blockedExpiresMs
    ? Math.max(0, blockedExpiresMs - now)
    : 0;

  // ✅ If blockedBy is present, user should NOT try to "refresh" this deal's QR
  const isBlocked = !!blockedBy?.dealId;

  const canRefresh = !loading && !dealEnded && !inCooldown && !isBlocked;

  const blockedDealQrPath = blockedBy?.dealId
    ? `/deals/${blockedBy.dealId}/qr`
    : "";

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
      <div className="mb-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Deal QR code
        </p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        {merchantName && (
          <p className="mt-1 text-xs text-gray-600">at {merchantName}</p>
        )}
        <p className="mt-1 text-[11px] text-gray-500">
          This QR is locked to your device and expires in 15 minutes.
        </p>
      </div>

      {/* ✅ Anti-hoarding banner with deep-link */}
      {isBlocked && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="font-semibold">⚠️ You already have an active QR</p>

          <p className="mt-1 text-[13px]">
            Only <span className="font-semibold">one active QR</span> is allowed per device to prevent hoarding.
            {blockedBy?.expiresAt ? (
              <>
                {" "}
                Your current active QR expires in{" "}
                <span className="font-semibold">
                  {formatCountdown(blockedMsLeft)}
                </span>
                .
              </>
            ) : null}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {blockedDealQrPath && (
              <Link
                href={blockedDealQrPath}
                className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Open active QR →
              </Link>
            )}

            <button
              type="button"
              onClick={claimOrRefresh}
              disabled={loading || inCooldown}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition",
                loading || inCooldown
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "border border-amber-300 text-amber-900 hover:bg-amber-100",
              ].join(" ")}
            >
              Try again
            </button>
          </div>

          <p className="mt-2 text-[11px] text-amber-900/70">
            If the customer downloaded a QR image earlier, it still expires after 15 minutes — they must open the active QR page to redeem.
          </p>
        </div>
      )}

      {/* Generic error (only if not blockedBy) */}
      {err && !isBlocked && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {inCooldown && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          ⏳ Cooldown active — try again in{" "}
          <span className="font-semibold">
            {formatCountdown(cooldownMsLeft)}
          </span>
          .
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center rounded-2xl bg-gray-100 p-4">
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
          {dealEnded
            ? "Deal ended"
            : isExpired
            ? "QR expired"
            : `Expires in ${formatCountdown(qrMsLeft)}`}
        </div>

        {/* ✅ Hide refresh when blocked */}
        {!isBlocked && (
          <div className="flex w-full items-center justify-center gap-2">
            <button
              type="button"
              onClick={claimOrRefresh}
              disabled={!canRefresh}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition",
                !canRefresh
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700",
              ].join(" ")}
            >
              {isExpired ? "Generate new QR" : "Refresh QR"}
            </button>
          </div>
        )}

        <div className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="mb-1 text-[11px] font-semibold text-gray-700">
            Redeem link:
          </p>
          <pre className="max-h-24 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-white px-2 py-1 text-[11px] text-gray-800">
            {payload || shortCode || "—"}
          </pre>
        </div>

        <p className="mt-2 text-[10px] text-gray-400 text-center">
          Don’t share your QR publicly. If it expires, generate a new one.
        </p>
      </div>
    </div>
  );
}
