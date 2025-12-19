"use client";

import { useMemo, useState } from "react";

export type RecentRedemptionRow = {
  id: string;
  redeemedAt: string | null;
  shortCode: string | null;
  deal: {
    id: string;
    title: string;
    discountType: string;
    discountValue: number;
    originalPrice: number | null;
  };
};

type ConfirmOk = {
  ok: true;
  status: "REDEEMED";
  message?: string;
  redemption?: { id: string; redeemedAt: string | Date };
  deal?: { id: string; title: string };
  merchant?: {
    id: string;
    name: string;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
  };
};

type ConfirmBad = {
  ok: false;
  status?: string;
  error: string;
  redeemedAt?: string | Date;
};

type ConfirmWeird = {
  error?: string;
  details?: string;
  message?: string;
};

type ConfirmResponse = ConfirmOk | ConfirmBad | ConfirmWeird;

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoneyNGN(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function estSave(row: RecentRedemptionRow) {
  const isPercent =
    row.deal.discountType === "PERCENT" || row.deal.discountType === "PERCENTAGE";
  if (!isPercent) return null;
  if (typeof row.deal.originalPrice !== "number") return null;
  const pct = Number(row.deal.discountValue || 0);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round((row.deal.originalPrice * pct) / 100);
}

export default function RedeemClient({
  initialRecent,
}: {
  initialRecent: RecentRedemptionRow[];
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<ConfirmOk | ConfirmBad | null>(null);

  const [recent, setRecent] = useState<RecentRedemptionRow[]>(initialRecent);

  const normalizedError = useMemo(() => {
    if (!result) return null;
    if ("ok" in result && result.ok === false) return result.error;
    return null;
  }, [result]);

  const normalizedOk = useMemo(() => {
    if (!result) return null;
    if ("ok" in result && result.ok === true) return result;
    return null;
  }, [result]);

  function reset() {
    setText("");
    setResult(null);
  }

  async function onRedeem() {
    const qrText = text.trim();
    if (!qrText) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Your confirm route supports either raw string or JSON containing qrText/payload/etc.
        body: JSON.stringify({ qrText }),
        cache: "no-store",
      });

      const data: ConfirmResponse = await res.json().catch(() => ({}));

      // Success
      if ((data as any)?.ok === true) {
        const ok = data as ConfirmOk;
        setResult(ok);

        // best-effort: push into recent list
        const redeemedAt =
          ok.redemption?.redeemedAt instanceof Date
            ? ok.redemption.redeemedAt.toISOString()
            : typeof ok.redemption?.redeemedAt === "string"
            ? ok.redemption.redeemedAt
            : new Date().toISOString();

        const dealTitle = ok.deal?.title ?? "(Deal)";
        const dealId = ok.deal?.id ?? "unknown";

        setRecent((prev) => {
          const next: RecentRedemptionRow[] = [
            {
              id: ok.redemption?.id ?? crypto.randomUUID(),
              redeemedAt,
              shortCode: null,
              deal: {
                id: dealId,
                title: dealTitle,
                discountType: "",
                discountValue: 0,
                originalPrice: null,
              },
            },
            ...prev,
          ];
          return next.slice(0, 20);
        });

        // Clear input after success to prevent double paste
        setText("");
        return;
      }

      // Error (normalized)
      const errMsg =
        (data as any)?.error ||
        (data as any)?.details ||
        (data as any)?.message ||
        "Could not confirm redemption.";

      setResult({ ok: false, error: String(errMsg) });
    } catch (e: any) {
      setResult({
        ok: false,
        error: e?.message || "Network error confirming redemption.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: Redeem box + big status */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Redeem customer QR
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste the scanned QR text / link / short code and redeem it.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste QR text / link / short code here…"
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          rows={4}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onRedeem}
            disabled={loading || !text.trim()}
            className={[
              "rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
              loading || !text.trim()
                ? "bg-slate-200 text-slate-500"
                : "bg-slate-900 text-white hover:bg-black",
            ].join(" ")}
          >
            {loading ? "Redeeming…" : "Redeem"}
          </button>

          <button
            type="button"
            onClick={reset}
            disabled={loading && !result}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>

        {/* BIG CONFIRMATION */}
        {normalizedOk && (
          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl text-white">
                ✓
              </div>
              <div className="flex-1">
                <div className="text-lg font-semibold text-emerald-900">
                  Redeemed successfully
                </div>
                <div className="mt-1 text-sm text-emerald-900/70">
                  {normalizedOk.deal?.title ? (
                    <>
                      Deal:{" "}
                      <span className="font-semibold">
                        {normalizedOk.deal.title}
                      </span>
                    </>
                  ) : (
                    "Deal redeemed."
                  )}
                </div>
                {normalizedOk.redemption?.redeemedAt && (
                  <div className="mt-1 text-sm text-emerald-900/70">
                    Time:{" "}
                    <span className="font-medium">
                      {fmtDateTime(
                        typeof normalizedOk.redemption.redeemedAt === "string"
                          ? normalizedOk.redemption.redeemedAt
                          : normalizedOk.redemption.redeemedAt.toISOString()
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {normalizedError && (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-3xl text-white">
                ✗
              </div>
              <div className="flex-1">
                <div className="text-lg font-semibold text-red-900">
                  Redemption failed
                </div>
                <div className="mt-1 text-sm text-red-900/80">
                  {normalizedError}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* RIGHT: Recent redemptions */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Recent redemptions
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Latest 20 successful redemptions.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-semibold">Date</th>
                <th className="py-2 pr-4 font-semibold">Deal</th>
                <th className="py-2 pr-4 font-semibold">Discount</th>
                <th className="py-2 pr-4 font-semibold">Original price</th>
                <th className="py-2 pr-0 font-semibold">Est save</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={5}>
                    No redemptions yet.
                  </td>
                </tr>
              ) : (
                recent.map((r) => {
                  const save = estSave(r);
                  const pct =
                    r.deal.discountValue && r.deal.discountValue > 0
                      ? `${Math.round(r.deal.discountValue)}%`
                      : "—";
                  const orig =
                    typeof r.deal.originalPrice === "number"
                      ? formatMoneyNGN(r.deal.originalPrice)
                      : "—";

                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 text-slate-700">
                        {fmtDateTime(r.redeemedAt)}
                      </td>
                      <td className="py-3 pr-4 text-slate-900">
                        <div className="font-medium">{r.deal.title}</div>
                        <div className="text-xs text-slate-500">
                          ID: {r.deal.id}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{pct}</td>
                      <td className="py-3 pr-4 text-slate-700">{orig}</td>
                      <td className="py-3 pr-0 text-slate-700">
                        {save != null ? formatMoneyNGN(save) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
