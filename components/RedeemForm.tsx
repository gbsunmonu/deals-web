"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AnyObj = Record<string, any>;

function prettifyTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
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

  const [text, setText] = useState("");
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canRedeem = useMemo(() => text.trim().length > 0 && !isSubmitting, [
    text,
    isSubmitting,
  ]);

  function resetMessages() {
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  function onTextChange(v: string) {
    setText(v);
    resetMessages();
    setScanInfo(v.trim() ? "QR code scanned. You can now redeem." : null);
  }

  async function redeemNow() {
    resetMessages();

    const payload = text.trim();
    if (!payload) {
      setErrorMsg("Paste a QR code value first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // We always send the raw scanned text. Your API supports URL / code / JSON.
        body: JSON.stringify({ qrText: payload }),
      });

      let data: AnyObj = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      // --- Normalize common response shapes --------------------------
      const status = String(data?.status ?? "").toUpperCase();
      const okFlag = data?.ok === true;
      const hasError = typeof data?.error === "string" && data.error.trim() !== "";

      // Some APIs return { message }, some return { error }, some return only status.
      const message = (data?.message as string | undefined) ?? undefined;
      const error = (data?.error as string | undefined) ?? undefined;

      // Already redeemed cases (can be 409, or status flag)
      if (res.status === 409 || status === "ALREADY_REDEEMED") {
        setErrorMsg("This QR code has already been redeemed.");
        return;
      }

      // Not found
      if (res.status === 404) {
        setErrorMsg("Redemption code not found. Please rescan the QR.");
        return;
      }

      // If server responded with an error string
      if (!res.ok || hasError) {
        setErrorMsg(error || "Failed to redeem. Try again.");
        return;
      }

      // ✅ SUCCESS detection (more permissive):
      // - any 2xx response is success
      // - OR explicit ok:true
      // - OR status === REDEEMED
      const isSuccess = res.ok || okFlag || status === "REDEEMED";

      if (isSuccess) {
        const dealTitle =
          data?.deal?.title ||
          data?.dealTitle ||
          data?.deal?.name ||
          undefined;

        const redeemedAt =
          data?.redemption?.redeemedAt ||
          data?.redeemedAt ||
          undefined;

        const when = prettifyTime(redeemedAt);
        const base =
          message ||
          (dealTitle ? `✅ Redeemed successfully: ${dealTitle}` : "✅ Redeemed successfully");

        setSuccessMsg(when ? `${base} • ${when}` : base);

        // Clear input to prevent accidental re-submit
        setText("");
        setScanInfo(null);

        // Refresh server component data so "Recent redemptions" updates
        router.refresh();
        return;
      }

      // Fallback
      setErrorMsg("Failed to redeem. Try again.");
    } catch (e: any) {
      setErrorMsg(e?.message || "Network error redeeming QR code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Redeem a QR code</h2>
      <p className="mt-1 text-xs text-gray-500">
        Scan the customer&apos;s QR code, or paste the scanned text here. Then
        click <span className="font-semibold">Redeem</span>.
      </p>

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Paste scanned QR text / URL / code here..."
          className="w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
          rows={3}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={redeemNow}
          disabled={!canRedeem}
          className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Redeeming..." : "Redeem"}
        </button>
      </div>

      {scanInfo && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {scanInfo}
        </div>
      )}

      {successMsg && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
