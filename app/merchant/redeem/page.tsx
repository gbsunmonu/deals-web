"use client";

import { useState } from "react";

type Result =
  | { ok: true; status: "REDEEMED"; message: string }
  | { ok: false; status?: string; error: string };

export default function MerchantRedeemPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleRedeem() {
    if (!input.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      const data = await res.json();
      setResult(data);

      if (data.ok) {
        setInput(""); // ✅ prevent double redemption
      }
    } catch {
      setResult({ ok: false, error: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Redeem QR</h1>
      <p className="mt-1 text-sm text-slate-500">
        Paste scanned QR text, link, or short code.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        placeholder="Paste QR text or short code…"
      />

      <button
        onClick={handleRedeem}
        disabled={loading}
        className="mt-3 w-full rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
      >
        {loading ? "Checking…" : "Redeem"}
      </button>

      {/* RESULT */}
      {result && (
        <div
          className={[
            "mt-6 rounded-2xl p-6 text-center",
            result.ok
              ? "border border-emerald-200 bg-emerald-50"
              : "border border-red-200 bg-red-50",
          ].join(" ")}
        >
          <div className="text-5xl">
            {result.ok ? "✅" : "❌"}
          </div>

          <p
            className={[
              "mt-3 text-lg font-semibold",
              result.ok ? "text-emerald-800" : "text-red-800",
            ].join(" ")}
          >
            {result.ok ? "Redeemed successfully" : "Redemption failed"}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            {result.ok ? result.message : result.error}
          </p>
        </div>
      )}
    </main>
  );
}
