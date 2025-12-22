// app/merchant/redeem/redeem-preview-modal.tsx
"use client";

type PreviewOk = {
  ok: true;
  state:
    | "READY"
    | "DEAL_NOT_STARTED"
    | "DEAL_ENDED"
    | "QR_EXPIRED"
    | "ALREADY_REDEEMED"
    | "SOLD_OUT";
  canRedeem: boolean;
  shortCode: string;
  now: string;
  expiresAt: string | null;
  redeemedAt: string | null;
  deal: {
    id: string;
    title: string;
    merchantName: string;
    startsAt: string;
    endsAt: string;
    discountType: string;
    discountValue: number;
    originalPrice: number | null;
    maxRedemptions: number | null;
  };
};

type PreviewErr = {
  ok: false;
  error: string;
  message?: string;
  deal?: { id: string; title: string; merchantName: string };
};

type Props = {
  open: boolean;
  loading?: boolean;
  data: PreviewOk | PreviewErr | null;
  onClose: () => void;
  onConfirm: () => void;
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function badgeFor(state: PreviewOk["state"]) {
  switch (state) {
    case "READY":
      return { label: "Ready", cls: "bg-emerald-100 text-emerald-800" };
    case "QR_EXPIRED":
      return { label: "Expired", cls: "bg-red-100 text-red-800" };
    case "ALREADY_REDEEMED":
      return { label: "Already redeemed", cls: "bg-slate-200 text-slate-700" };
    case "DEAL_NOT_STARTED":
      return { label: "Not started", cls: "bg-amber-100 text-amber-900" };
    case "DEAL_ENDED":
      return { label: "Deal ended", cls: "bg-slate-200 text-slate-700" };
    case "SOLD_OUT":
      return { label: "Sold out", cls: "bg-red-100 text-red-800" };
    default:
      return { label: String(state), cls: "bg-slate-200 text-slate-700" };
  }
}

export default function RedeemPreviewModal({
  open,
  loading,
  data,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  const ok = data && (data as any).ok === true ? (data as PreviewOk) : null;
  const err = data && (data as any).ok === false ? (data as PreviewErr) : null;

  const state = ok?.state ?? null;
  const badge = state ? badgeFor(state) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Redeem preview
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              Confirm before redeeming
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              Loading preview…
            </div>
          ) : null}

          {err ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <p className="font-semibold">Cannot redeem</p>
              <p className="mt-1">{err.message || err.error}</p>
            </div>
          ) : null}

          {ok ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{ok.deal.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Merchant: <span className="font-semibold">{ok.deal.merchantName}</span>
                  </p>
                </div>

                {badge ? (
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Short code</span>
                  <span className="font-mono font-semibold tracking-widest">{ok.shortCode}</span>
                </div>

                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                  <div>Deal valid: {fmt(ok.deal.startsAt)} → {fmt(ok.deal.endsAt)}</div>
                  <div>QR expires: {fmt(ok.expiresAt)}</div>
                  {ok.redeemedAt ? <div>Redeemed at: {fmt(ok.redeemedAt)}</div> : null}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={!ok.canRedeem}
                  className={[
                    "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                    ok.canRedeem
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "cursor-not-allowed bg-slate-200 text-slate-500",
                  ].join(" ")}
                >
                  Confirm redeem
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>

              {!ok.canRedeem ? (
                <p className="text-[11px] text-slate-500">
                  This QR can’t be redeemed in its current state.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Confirming will permanently redeem this QR.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
