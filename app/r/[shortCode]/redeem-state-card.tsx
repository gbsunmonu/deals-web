// app/r/[shortCode]/redeem-state-card.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type State =
  | "NOT_FOUND"
  | "EXPIRED"
  | "REDEEMED"
  | "DEAL_ENDED"
  | "DEAL_NOT_STARTED"
  | "ACTIVE";

type Props = {
  state: State;
  shortCode: string;
  redemption: {
    redeemedAt: string | null;
    expiresAt: string | null;
    deviceHash: string | null;
  } | null;
  deal: {
    id: string;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    imageUrl: string | null;
    merchant: {
      name: string;
      city: string | null;
      category: string | null;
    };
  } | null;
};

// Very small device id (stored locally). We hash it so we never show raw ID.
function getOrCreateDeviceId(): string {
  const key = "ytd_device_id";
  const existing = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  if (existing) return existing;

  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(key, created);
  return created;
}

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function badgeClass(kind: "good" | "warn" | "bad") {
  if (kind === "good") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (kind === "warn") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-800";
}

export default function RedeemStateCard({ state, shortCode, redemption, deal }: Props) {
  const [deviceMismatch, setDeviceMismatch] = useState(false);

  const expiresAt = useMemo(() => {
    if (!redemption?.expiresAt) return null;
    const d = new Date(redemption.expiresAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [redemption?.expiresAt]);

  const redeemedAt = useMemo(() => {
    if (!redemption?.redeemedAt) return null;
    const d = new Date(redemption.redeemedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [redemption?.redeemedAt]);

  useEffect(() => {
    // If no deviceHash stored, we can't mismatch-check.
    if (!redemption?.deviceHash) return;

    // Client-side check: compute our device hash the same way the server does (sha256 of stable id)
    (async () => {
      try {
        const id = getOrCreateDeviceId();
        const hash = await sha256Hex(id);
        setDeviceMismatch(hash !== redemption.deviceHash);
      } catch {
        // If hashing fails, don't block UI — just skip mismatch check.
        setDeviceMismatch(false);
      }
    })();
  }, [redemption?.deviceHash]);

  // If server says ACTIVE but device mismatch, we treat it as “blocked” state in UI.
  const effectiveState: State | "DEVICE_MISMATCH" =
    state === "ACTIVE" && deviceMismatch ? "DEVICE_MISMATCH" : state;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Deal QR code
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{shortCode}</p>
          {deal ? (
            <p className="mt-1 text-sm text-slate-600">
              at <span className="font-semibold">{deal.merchant.name}</span>
              {deal.merchant.city ? ` · ${deal.merchant.city}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">—</p>
          )}
        </div>

        {/* State badge */}
        <div
          className={[
            "rounded-full border px-3 py-1 text-xs font-semibold",
            effectiveState === "ACTIVE"
              ? badgeClass("good")
              : effectiveState === "EXPIRED" ||
                effectiveState === "DEAL_NOT_STARTED" ||
                effectiveState === "DEAL_ENDED"
              ? badgeClass("warn")
              : badgeClass("bad"),
          ].join(" ")}
        >
          {effectiveState === "ACTIVE" && "Active"}
          {effectiveState === "EXPIRED" && "Expired"}
          {effectiveState === "REDEEMED" && "Redeemed"}
          {effectiveState === "DEAL_ENDED" && "Deal ended"}
          {effectiveState === "DEAL_NOT_STARTED" && "Not started"}
          {effectiveState === "NOT_FOUND" && "Invalid code"}
          {effectiveState === "DEVICE_MISMATCH" && "Wrong device"}
        </div>
      </div>

      {/* QR image */}
      <div className="mt-6 flex flex-col items-center">
        <div className="rounded-3xl bg-slate-50 p-4">
          {/* Uses your existing endpoint: app/api/qrcode/[code] */}
          <img
            src={`/api/qrcode/${encodeURIComponent(shortCode)}`}
            alt={`QR for ${shortCode}`}
            className="h-56 w-56"
          />
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">
          Don’t screenshot or share this QR publicly.
        </p>
      </div>

      {/* State-specific guidance */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        {effectiveState === "ACTIVE" && (
          <>
            <p className="font-semibold text-slate-900">Ready to redeem</p>
            <p className="mt-1">
              Show this screen to the merchant. They will scan it to redeem.
            </p>
            {expiresAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Expires: <span className="font-semibold">{expiresAt.toLocaleString()}</span>
              </p>
            ) : null}
          </>
        )}

        {effectiveState === "DEVICE_MISMATCH" && (
          <>
            <p className="font-semibold text-slate-900">This QR is locked to another device</p>
            <p className="mt-1">
              Please open the deal again on <span className="font-semibold">this device</span> to generate a fresh QR.
            </p>
            {deal?.id ? (
              <Link
                href={`/deals/${deal.id}`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Get a new QR on this device
              </Link>
            ) : null}
          </>
        )}

        {effectiveState === "EXPIRED" && (
          <>
            <p className="font-semibold text-slate-900">This QR has expired</p>
            <p className="mt-1">
              Go back to the deal and generate a new QR code.
            </p>
            {deal?.id ? (
              <Link
                href={`/deals/${deal.id}`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Generate a new QR
              </Link>
            ) : null}
          </>
        )}

        {effectiveState === "REDEEMED" && (
          <>
            <p className="font-semibold text-slate-900">Already redeemed</p>
            <p className="mt-1">
              This code has been used and can’t be redeemed again.
            </p>
            {redeemedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Redeemed: <span className="font-semibold">{redeemedAt.toLocaleString()}</span>
              </p>
            ) : null}
          </>
        )}

        {effectiveState === "DEAL_ENDED" && (
          <>
            <p className="font-semibold text-slate-900">This deal has ended</p>
            <p className="mt-1">
              The merchant is no longer accepting this promotion.
            </p>
          </>
        )}

        {effectiveState === "DEAL_NOT_STARTED" && (
          <>
            <p className="font-semibold text-slate-900">This deal is not live yet</p>
            <p className="mt-1">
              Please come back when the deal starts.
            </p>
          </>
        )}

        {effectiveState === "NOT_FOUND" && (
          <>
            <p className="font-semibold text-slate-900">Invalid QR / code</p>
            <p className="mt-1">
              This link is incorrect or the code no longer exists.
            </p>
            <Link
              href="/explore"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
            >
              Browse live deals
            </Link>
          </>
        )}
      </div>

      {/* Deal info */}
      {deal ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Deal details
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{deal.title}</p>
          <p className="mt-1 text-sm text-slate-600">{deal.description}</p>

          <div className="mt-3 text-xs text-slate-500">
            <p>
              Starts: <span className="font-semibold">{new Date(deal.startsAt).toLocaleString()}</span>
            </p>
            <p>
              Ends: <span className="font-semibold">{new Date(deal.endsAt).toLocaleString()}</span>
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
