// app/redeem/[code]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ConfirmResponse =
  | {
      ok: true;
      status: "REDEEMED";
      message?: string;
      deal?: { id: string; title: string };
      merchant?: { id?: string; name?: string; city?: string; address?: string; phone?: string };
      redemption?: { id: string; redeemedAt: string };
    }
  | {
      ok?: false;
      status?: "EXPIRED" | "ALREADY_REDEEMED" | "SOLD_OUT" | "CONFLICT";
      error?: string;
      redeemedAt?: string;
      details?: string;
    }
  | { error?: string; details?: string };

function fmtDateTime(iso?: string) {
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

export default function RedeemCodePage() {
  const params = useParams<{ code: string }>();
  const code = useMemo(() => (params?.code ? decodeURIComponent(params.code) : ""), [params]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConfirmResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!code) {
        setLoading(false);
        setData({ ok: false, status: "CONFLICT", error: "Missing code in URL." });
        return;
      }

      setLoading(true);
      setData(null);

      try {
        const res = await fetch("/api/redemptions/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ✅ Your confirm route supports either plain string or { code }, we send { code }
          body: JSON.stringify({ code }),
          cache: "no-store",
        });

        const json = (await res.json().catch(() => ({}))) as ConfirmResponse;
        if (cancelled) return;

        // Keep payload even if !ok so we can show proper message
        setData(json);
      } catch (e: any) {
        if (cancelled) return;
        setData({ ok: false, status: "CONFLICT", error: e?.message || "Network error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const ok = (data as any)?.ok === true && (data as any)?.status === "REDEEMED";
  const status = (data as any)?.status as string | undefined;
  const errMsg =
    (data as any)?.error ||
    (data as any)?.details ||
    (ok ? "" : "Could not redeem this code.");

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6">
        <Link href="/scan" className="text-xs font-semibold text-slate-600 hover:underline">
          ← Back to scan
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Redeem code
            </p>
            <h1 className="mt-1 text-lg font-bold text-slate-900">Confirm redemption</h1>
            <p className="mt-1 text-xs text-slate-500 break-all">
              Code: <span className="font-semibold text-slate-700">{code || "—"}</span>
            </p>
          </div>

          <span
            className={[
              "rounded-full px-3 py-1 text-[11px] font-semibold",
              loading
                ? "bg-slate-100 text-slate-600"
                : ok
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800",
            ].join(" ")}
          >
            {loading ? "Checking…" : ok ? "Redeemed" : "Needs attention"}
          </span>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Checking code validity…
            </div>
          ) : ok ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">✅ Redemption successful</p>

              {(data as any)?.deal?.title ? (
                <p className="mt-1 text-sm text-emerald-900/80">
                  Deal: <span className="font-semibold">{(data as any).deal.title}</span>
                </p>
              ) : null}

              {(data as any)?.merchant?.name ? (
                <p className="mt-1 text-sm text-emerald-900/70">
                  Merchant: <span className="font-semibold">{(data as any).merchant.name}</span>
                  {(data as any)?.merchant?.city ? (
                    <span className="text-emerald-900/50"> · {(data as any).merchant.city}</span>
                  ) : null}
                </p>
              ) : null}

              <p className="mt-2 text-xs text-emerald-900/60">
                Redeemed at:{" "}
                <span className="font-semibold">
                  {fmtDateTime((data as any)?.redemption?.redeemedAt)}
                </span>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {status === "EXPIRED"
                  ? "⏱ This QR code has expired"
                  : status === "ALREADY_REDEEMED"
                  ? "⚠️ This code was already redeemed"
                  : status === "SOLD_OUT"
                  ? "🚫 This deal is sold out"
                  : status === "CONFLICT"
                  ? "⚠️ Could not redeem, try again"
                  : "⚠️ Could not redeem this code"}
              </p>

              <p className="mt-2 text-sm text-amber-900/70">{errMsg}</p>

              {status === "ALREADY_REDEEMED" && (data as any)?.redeemedAt ? (
                <p className="mt-2 text-xs text-amber-900/60">
                  Redeemed at:{" "}
                  <span className="font-semibold">{fmtDateTime((data as any).redeemedAt)}</span>
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/scan"
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Scan again
                </Link>

                <button
                  type="button"
                  onClick={() => location.reload()}
                  className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-[11px] text-slate-400">
            Tip: If you don’t have camera scan, you can paste the short code into the Scan page.
          </p>
        </div>
      </section>
    </main>
  );
}
