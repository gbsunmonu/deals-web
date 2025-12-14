"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ApiResp = {
  ok?: boolean;
  status?: string;
  message?: string;
  error?: string;
  redeemedAt?: string | Date | null;
  redemption?: { id?: string; redeemedAt?: string | Date | null } | null;
  deal?: { title?: string } | null;
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RedeemForm() {
  const router = useRouter();

  const [qrText, setQrText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => qrText.trim().length > 0 && !isSubmitting, [
    qrText,
    isSubmitting,
  ]);

  function resetMessages() {
    setSuccess(null);
    setInfo(null);
    setError(null);
  }

  async function onRedeem() {
    resetMessages();

    const text = qrText.trim();
    if (!text) {
      setError("Paste the scanned QR text first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrText: text }),
      });

      let data: ApiResp = {};
      try {
        data = (await res.json()) as ApiResp;
      } catch {
        data = {};
      }

      const status = String(data?.status ?? "").toUpperCase();

      // ---- SOLD OUT
      if (status === "SOLD_OUT" || res.status === 409 && (data?.error || "").toLowerCase().includes("fully")) {
        setError("❌ Deal is sold out (redemption limit reached).");
        return;
      }

      // ---- ALREADY REDEEMED
      if (status === "ALREADY_REDEEMED" || res.status === 409) {
        const when = formatDateTime(data?.redeemedAt ?? data?.redemption?.redeemedAt ?? null);
        setError(when ? `⚠️ Already redeemed (${when}).` : "⚠️ This QR code has already been redeemed.");
        return;
      }

      // ---- EXPIRED / NOT STARTED
      if (status === "EXPIRED" || res.status === 400 && (data?.error || "").toLowerCase().includes("expired")) {
        setError("❌ This deal has expired.");
        return;
      }
      if (status === "NOT_STARTED") {
        setError("⚠️ This deal has not started yet.");
        return;
      }

      // ---- Other errors
      if (!res.ok || data?.ok === false) {
        setError(data?.error || "Failed to redeem. Please try again.");
        return;
      }

      // ---- SUCCESS
      const dealTitle = data?.deal?.title ? ` — ${data.deal.title}` : "";
      const when = formatDateTime(data?.redemption?.redeemedAt ?? null);

      setSuccess(when ? `✅ Redemption successful${dealTitle} • ${when}` : `✅ Redemption successful${dealTitle}`);

      // Clear input so merchant doesn't accidentally resubmit same QR
      setQrText("");

      // Refresh server data (recent redemptions table)
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Network error redeeming QR code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Redeem customer QR</h2>
      <p className="mt-1 text-xs text-gray-500">
        Paste the scanned QR text / link / short code and redeem it. After success, the input clears to prevent double-redemption.
      </p>

      <div className="mt-3">
        <textarea
          value={qrText}
          onChange={(e) => {
            setQrText(e.target.value);
            // Don’t clear success instantly while they read it; clear only error/info on edit.
            setError(null);
            setInfo(null);
          }}
          rows={3}
          placeholder="Paste scanned QR text / URL / short code here..."
          className="w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRedeem}
          disabled={!canSubmit}
          className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Redeeming..." : "Redeem"}
        </button>

        <button
          type="button"
          onClick={() => {
            setQrText("");
            resetMessages();
            setInfo("Cleared.");
          }}
          className="rounded-full border border-gray-200 bg-white px-5 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {success && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          {success}
        </div>
      )}

      {info && !success && !error && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
          {info}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
