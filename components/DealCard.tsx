"use client";

import Link from "next/link";
import AvailabilityBadge from "@/components/AvailabilityBadge";
import type { AvailabilityRow } from "@/components/AvailabilityBadge";

function fmtDayMonth(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtRange(startsAt: string | Date, endsAt: string | Date) {
  const s = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const e = typeof endsAt === "string" ? new Date(endsAt) : endsAt;

  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    const dd1 = String(s.getDate()).padStart(2, "0");
    const dd2 = String(e.getDate()).padStart(2, "0");
    const mon = e.toLocaleDateString("en-GB", { month: "short" });
    return `Valid ${dd1}–${dd2} ${mon}`;
  }

  return `Valid ${fmtDayMonth(s)} – ${fmtDayMonth(e)}`;
}

function formatMoneyNGN(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function DealCard({
  deal,
  merchant,
  availability,
  availabilityPulseKey = 0,
}: {
  deal: any;
  merchant?: { id: string; name: string; city?: string | null };
  availability?: AvailabilityRow;
  availabilityPulseKey?: number;
}) {
  const soldOut = availability?.soldOut ?? false;
  const unlimited = availability?.maxRedemptions == null;
  const left = availability?.left ?? null;
  const redeemedCount = availability?.redeemedCount ?? 0;

  const max = availability?.maxRedemptions ?? deal.maxRedemptions ?? null;

  const discountValue = clampPct(Number(deal.discountValue ?? 0));
  const originalPrice = typeof deal.originalPrice === "number" ? deal.originalPrice : null;

  const isPercent = deal.discountType === "PERCENT" || deal.discountType === "PERCENTAGE";

  const saveAmount =
    originalPrice && discountValue > 0 && isPercent
      ? Math.round((originalPrice * discountValue) / 100)
      : null;

  // ✅ HOT DEAL RULE: save >= ₦1000 OR discount >= 45%
  const isHotDeal = (saveAmount != null && saveAmount >= 1000) || discountValue >= 45;

  const validLabel = fmtRange(deal.startsAt, deal.endsAt);
  const href = `/deals/${deal.id}`;

  const CardInner = (
    <article
      className={[
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition",
        soldOut ? "opacity-95" : "hover:shadow-md",
      ].join(" ")}
    >
      <div className="relative">
        {deal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-48 w-full bg-slate-100" />
        )}

        {/* Availability */}
        <div className="absolute left-3 top-3">
          <AvailabilityBadge row={availability} pulseKey={availabilityPulseKey} />
        </div>

        {/* ✅ HOT DEAL flame */}
        {isHotDeal && !soldOut && (
          <div className="absolute right-3 top-3">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
                "bg-red-600 text-white shadow-sm",
                "animate-[pulse_1.2s_ease-in-out_infinite]",
              ].join(" ")}
              title="Hot deal"
            >
              <span className="text-base leading-none">🔥</span>
              Hot deal
            </span>
          </div>
        )}

        {soldOut && <div className="absolute inset-0 bg-white/65 backdrop-blur-[1px]" />}
      </div>

      <div className="p-4">
        <div className="text-xs text-slate-600">
          {merchant?.name ? (
            <span className="font-semibold text-slate-800">{merchant.name}</span>
          ) : (
            <span className="text-slate-500">Merchant</span>
          )}
          {merchant?.city ? <span className="text-slate-400"> · {merchant.city}</span> : null}
        </div>

        <h3 className="mt-1 text-base font-semibold text-slate-900 line-clamp-2">
          {deal.title}
        </h3>

        <div className="mt-3 rounded-2xl bg-emerald-50/70 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/70">
                You save
              </p>

              {/* ✅ “Save ₦2,500” style */}
              <p className="mt-1 text-3xl font-semibold text-emerald-900">
                {saveAmount != null ? formatMoneyNGN(saveAmount) : "—"}
              </p>

              {originalPrice && saveAmount != null ? (
                <p className="mt-1 text-sm text-emerald-900/70">
                  Pay {formatMoneyNGN(originalPrice - saveAmount)} instead of {formatMoneyNGN(originalPrice)}.
                </p>
              ) : (
                <p className="mt-1 text-sm text-emerald-900/60">Limited-time discount.</p>
              )}
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/70">
                Discount
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">
                {discountValue > 0 ? `${discountValue}% off` : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-emerald-900/70">
              <div>{validLabel}</div>

              {!unlimited && typeof left === "number" && typeof max === "number" ? (
                <div className="mt-1 text-xs text-emerald-900/60">
                  {redeemedCount.toLocaleString("en-NG")} redeemed · {left.toLocaleString("en-NG")} remaining
                </div>
              ) : (
                <div className="mt-1 text-xs text-emerald-900/50">
                  {redeemedCount.toLocaleString("en-NG")} redeemed
                </div>
              )}
            </div>

            {/* ✅ CTA copy */}
            <span
              className={[
                "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
                soldOut
                  ? "bg-slate-200 text-slate-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99]",
              ].join(" ")}
            >
              {soldOut ? "Sold out" : "Claim deal →"}
            </span>
          </div>
        </div>
      </div>
    </article>
  );

  if (soldOut) return <div>{CardInner}</div>;

  return (
    <Link href={href} className="block">
      {CardInner}
    </Link>
  );
}
