"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";

type ClaimResponseOk = {
  ok: true;
  redemptionId: string;
  shortCode: string;
  expiresAt: string; // ISO
  reused: boolean;
};

type ClaimResponseErr = {
  ok: false;
  error?: string;
  details?: string;
  cooldownSeconds?: number;
  retryAfterSeconds?: number;
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
    `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
      .toString(16)
      .slice(2)}`;

  window.localStorage.setItem(k, fresh);
  return fresh;
}

async function downloadSvgAsPng(svgEl: SVGElement, filename = "dealina-qr.png") {
  const svgData = new XMLSerializer().serializeToString(svgEl);

  // Add missing namespaces if any browser strips them
  const fixedSvg = svgData.includes("http://www.w3.org/2000/svg")
    ? svgData
    : svgData.replace(
        "<svg",
        `<svg xmlns="http://www.w3.org/2000/svg"`
      );

  const blob = new Blob([fixedSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG image"));
      img.src = url;
    });

    // scale up for sharpness
    const size = 768;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // white background (so PNG isn’t transparent)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    ctx.drawImage(img, 0, 0, size, size);

    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function DealQRCodeSection({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shortCode, setShortCode] = useState<string>("");
  const [expiresAtIso, setExpiresAtIso] = useState<string>("");

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // cooldown UI (driven by server 429 response)
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number>(0);

  const tickRef = useRef<any>(null);
  const svgWrapRef = useRef<HTMLDivElement | null>(null);

  // origin safe
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    try {
      setOrigin(window.location.origin);
    } catch {
      setOrigin("");
    }
  }, []);

  const expiresMs = expiresAtIso ? new Date(expiresAtIso).getTime() : null;
  const remainingMs = expiresMs != null ? expiresMs - nowMs : null;

  const expired = remainingMs != null ? remainingMs <= 0 : false;

  const cooldownMsLeft = Math.max(0, cooldownUntilMs - nowMs);
  const inCooldown = cooldownMsLeft > 0;

  const qrValue = useMemo(() => {
    if (!shortCode) return "";
    if (!origin) return shortCode;
    return `${origin}/redeem/${shortCode}`;
  }, [shortCode, origin]);

  async function claimOrRefresh() {
    setError(null);
    setLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();

      const res = await fetch(`/api/deals/${dealId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({}),
        cache: "no-store",
      });

      // cooldown response
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as ClaimResponseErr;

        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : 0;

        const seconds =
          Number(data?.cooldownSeconds || data?.retryAfterSeconds || 0) ||
          (Number.isFinite(retryAfterSec) ? retryAfterSec : 0);

        if (seconds > 0) {
          setCooldownUntilMs(Date.now() + seconds * 1000);
          setError(`Cooldown active. Try again in ${msToClock(seconds * 1000)}.`);
          return;
        }

        setError(data?.error || "Please wait and try again.");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as
        | ClaimResponseOk
        | ClaimResponseErr;

      if (!res.ok || !(data as any)?.ok) {
        throw new Error((data as any)?.error || "Failed to generate QR");
      }

      const ok = data as ClaimResponseOk;
      setShortCode(ok.shortCode || "");
      setExpiresAtIso(ok.expiresAt || "");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // initial load + timer tick
  useEffect(() => {
    claimOrRefresh();

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setNowMs(Date.now()), 500);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  async function handleDownload() {
    try {
      setError(null);

      if (!shortCode || !qrValue) {
        setError("QR not ready yet.");
        return;
      }
      if (expired) {
        setError("This QR is expired. Please regenerate first.");
        return;
      }

      const svg = svgWrapRef.current?.querySelector("svg");
      if (!svg) {
        setError("Could not find QR SVG to download.");
        return;
      }

      await downloadSvgAsPng(svg, `dealina-${shortCode}.png`);
    } catch (e: any) {
      setError(e?.message || "Failed to download QR");
    }
  }

  const canRegenerate = !loading && !inCooldown;
  const canDownload = !!shortCode && !!qrValue && !expired && !loading;
  const canOpenRedeem = !!shortCode && !loading;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Your QR Code</h3>
          <p className="mt-1 text-xs text-slate-500">
            This QR is device-locked and expires every 15 minutes (server enforced).
          </p>
        </div>

        {expiresAtIso && (
          <span
            className={[
              "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border",
              expired
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200",
            ].join(" ")}
          >
            {expired ? "Expired" : `Expires in ${msToClock(remainingMs ?? 0)}`}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {inCooldown && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ⏳ Cooldown active — try again in{" "}
          <span className="font-semibold">{msToClock(cooldownMsLeft)}</span>.
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
        <div
          ref={svgWrapRef}
          className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4"
        >
          {shortCode ? (
            <QRCode value={qrValue || shortCode} size={180} />
          ) : (
            <div className="h-[180px] w-[180px] rounded-xl bg-slate-100" />
          )}
        </div>

        <div className="space-y-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="font-semibold text-slate-800">Short code:</div>
            <div className="mt-1 break-all">{shortCode || "—"}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={claimOrRefresh}
              disabled={!canRegenerate}
              className={[
                "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
                !canRegenerate
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : expired
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-gray-300 text-gray-800 hover:bg-gray-50",
              ].join(" ")}
            >
              {loading ? "Generating..." : expired ? "Regenerate QR" : "Refresh QR"}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!canDownload}
              className={[
                "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
                !canDownload
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700",
              ].join(" ")}
            >
              Download QR
            </button>

            {canOpenRedeem ? (
              <Link
                href={`/redeem/${shortCode}`}
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Open redeem page →
              </Link>
            ) : null}
          </div>

          <p className="text-[11px] text-slate-500">
            If you download the QR and wait past the countdown, it will stop working — just come back and regenerate.
          </p>
        </div>
      </div>
    </section>
  );
}
