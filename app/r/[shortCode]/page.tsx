// app/r/[shortCode]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import CopyLinkButton from "./CopyLinkButton";
import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEVICE_COOKIE = "ytd_device";

type Props = {
  params: Promise<{ shortCode: string }>;
};

function fmtDateTime(d: Date) {
  try {
    return d.toLocaleString();
  } catch {
    return d.toISOString();
  }
}

function clampCode(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isCodeLike(s: string) {
  return /^[A-Z0-9]{4,12}$/.test(s);
}

// Build an origin that works on localhost + Vercel
async function getOrigin() {
  const h = await headers();

  // On Vercel you typically get x-forwarded-proto
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) return ""; // fallback below
  return `${proto}://${host}`;
}

export default async function RedeemShortCodePage({ params }: Props) {
  const { shortCode } = await params;
  const code = clampCode(shortCode);

  if (!code || !isCodeLike(code)) notFound();

  // ✅ cookies() is async in your Next version
  const cookieStore = await cookies();
  const cookieDevice = cookieStore.get(DEVICE_COOKIE)?.value ?? null;

  // Pull redemption + deal + merchant in one query
  const redemption = await prisma.redemption.findUnique({
    where: { shortCode: code },
    select: {
      id: true,
      shortCode: true,
      redeemedAt: true,
      expiresAt: true,
      deviceHash: true,
      deal: {
        select: {
          id: true,
          title: true,
          description: true,
          startsAt: true,
          endsAt: true,
          merchant: {
            select: {
              name: true,
              city: true,
              address: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!redemption) notFound();

  const now = new Date();
  const deal = redemption.deal;

  const dealStarts = new Date(deal.startsAt);
  const dealEnds = new Date(deal.endsAt);

  const dealNotStarted = now < dealStarts;
  const dealEnded = now > dealEnds;

  const redeemed = !!redemption.redeemedAt;

  // expiresAt is required in your latest schema, but we still guard safely
  const expiresAt = redemption.expiresAt ? new Date(redemption.expiresAt) : null;
  const expired = !expiresAt ? true : now >= expiresAt;

  // ✅ Device lock check
  const lockedDevice = redemption.deviceHash ?? null;
  const wrongDevice =
    !!lockedDevice && !!cookieDevice && lockedDevice !== cookieDevice;

  // UI state
  let statusTitle = "Ready to redeem";
  let statusBody = "Show this QR to the merchant to redeem your deal.";
  let badgeClass = "bg-emerald-100 text-emerald-800";
  let blocked = false;

  if (dealNotStarted) {
    statusTitle = "Deal not started yet";
    statusBody = `This deal starts ${fmtDateTime(dealStarts)}.`;
    badgeClass = "bg-amber-100 text-amber-900";
    blocked = true;
  } else if (dealEnded) {
    statusTitle = "Deal ended";
    statusBody = `This deal ended ${fmtDateTime(dealEnds)}.`;
    badgeClass = "bg-slate-200 text-slate-700";
    blocked = true;
  } else if (redeemed) {
    statusTitle = "Already redeemed";
    statusBody = `This QR was used on ${fmtDateTime(
      new Date(redemption.redeemedAt as any)
    )}.`;
    badgeClass = "bg-slate-200 text-slate-700";
    blocked = true;
  } else if (expired) {
    statusTitle = "QR expired";
    statusBody =
      "This QR is no longer valid. Go back to the deal page and generate a fresh QR.";
    badgeClass = "bg-red-100 text-red-800";
    blocked = true;
  } else if (wrongDevice) {
    statusTitle = "Wrong device";
    statusBody =
      "This QR was generated on a different device. Open the deal on this device and generate a new QR.";
    badgeClass = "bg-red-100 text-red-800";
    blocked = true;
  }

  // ✅ QR payload should point to THIS page URL so merchant scan lands back here
  const origin = await getOrigin();
  const pageUrl = origin
    ? `${origin}/r/${encodeURIComponent(code)}`
    : `/r/${encodeURIComponent(code)}`;

  // Simple QR image generator
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    pageUrl
  )}`;

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Yes to Deals
        </p>

        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Redeem code
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Show this page to the merchant at checkout. This QR is time-limited and
          device-locked.
        </p>

        <div className="mt-3 inline-flex items-center gap-2">
          <span
            className={[
              "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold",
              badgeClass,
            ].join(" ")}
          >
            {statusTitle}
          </span>

          {!blocked && expiresAt ? (
            <span className="text-[11px] text-slate-500">
              Expires: {fmtDateTime(expiresAt)}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-sm text-slate-600">{statusBody}</p>
      </header>

      {/* QR CARD */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-3xl bg-slate-100 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Redeem QR"
              className={[
                "h-[280px] w-[280px] rounded-2xl bg-white",
                blocked ? "opacity-40 blur-[1px]" : "",
              ].join(" ")}
            />
          </div>

          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Deal QR code
            </p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-slate-900">
              {code}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Merchant can scan the QR or type this code.
            </p>
          </div>

          <p className="text-xs text-slate-600">
            at{" "}
            <span className="font-semibold text-slate-900">
              {deal.merchant.name}
            </span>
            {deal.merchant.city ? ` · ${deal.merchant.city}` : ""}
          </p>

          <div className="flex w-full flex-wrap gap-2">
            <CopyLinkButton url={pageUrl} />

            <Link
              href={`/deals/${deal.id}`}
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to deal
            </Link>

            <Link
              href="/explore"
              className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Explore deals
            </Link>
          </div>

          {blocked ? (
            <div className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">What next?</p>
              <ul className="mt-1 list-disc pl-5">
                {wrongDevice ? (
                  <li>
                    Open the deal on this device and tap{" "}
                    <span className="font-semibold">Get QR to redeem</span>.
                  </li>
                ) : null}
                {expired && !dealEnded && !dealNotStarted && !redeemed ? (
                  <li>
                    Open the deal page and tap{" "}
                    <span className="font-semibold">Get QR to redeem</span>{" "}
                    again.
                  </li>
                ) : null}
                {redeemed ? <li>This code cannot be used again today.</li> : null}
                {dealEnded ? <li>This deal has ended and can’t be redeemed.</li> : null}
                {dealNotStarted ? <li>Come back when the deal starts.</li> : null}
              </ul>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500 text-center">
              Don’t screenshot or share this QR publicly.
            </p>
          )}
        </div>
      </section>

      {/* Deal details */}
      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Deal details</p>
        {deal.description ? (
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
            {deal.description}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No description.</p>
        )}

        <div className="mt-4 grid gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-800">Valid:</span>{" "}
            {fmtDateTime(dealStarts)} → {fmtDateTime(dealEnds)}
          </div>
          {deal.merchant.address ? (
            <div>
              <span className="font-semibold text-slate-800">Address:</span>{" "}
              {deal.merchant.address}
            </div>
          ) : null}
          {deal.merchant.phone ? (
            <div>
              <span className="font-semibold text-slate-800">Phone:</span>{" "}
              {deal.merchant.phone}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
