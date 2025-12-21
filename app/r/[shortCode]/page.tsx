// app/r/[shortCode]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RedeemStateCard from "./redeem-state-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ shortCode: string }>;
};

type State =
  | "NOT_FOUND"
  | "EXPIRED"
  | "REDEEMED"
  | "DEAL_ENDED"
  | "DEAL_NOT_STARTED"
  | "ACTIVE";

function normalizeCode(code: string) {
  return String(code || "").trim();
}

export default async function RedeemShortCodePage({ params }: PageProps) {
  const { shortCode } = await params;
  const code = normalizeCode(shortCode);

  if (!code) {
    redirect("/explore");
  }

  const now = new Date();

  const redemption = await prisma.redemption.findUnique({
    where: { shortCode: code },
    select: {
      id: true,
      shortCode: true,
      code: true,
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
          imageUrl: true,
          merchant: {
            select: {
              id: true,
              name: true,
              city: true,
              category: true,
            },
          },
        },
      },
    },
  });

  let state: State = "ACTIVE";

  if (!redemption) {
    state = "NOT_FOUND";
  } else if (redemption.redeemedAt) {
    state = "REDEEMED";
  } else if (redemption.expiresAt && redemption.expiresAt < now) {
    state = "EXPIRED";
  } else if (redemption.deal.endsAt < now) {
    state = "DEAL_ENDED";
  } else if (redemption.deal.startsAt > now) {
    state = "DEAL_NOT_STARTED";
  } else {
    state = "ACTIVE";
  }

  // Page still renders even if NOT_FOUND (we show a friendly UI)
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
          Yes to Deals
        </p>

        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Redeem code
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Show this page to the merchant at checkout. This QR is time-limited and device-locked.
        </p>
      </header>

      <RedeemStateCard
        state={state}
        shortCode={code}
        redemption={{
          redeemedAt: redemption?.redeemedAt ? redemption.redeemedAt.toISOString() : null,
          expiresAt: redemption?.expiresAt ? redemption.expiresAt.toISOString() : null,
          deviceHash: redemption?.deviceHash ?? null,
        }}
        deal={
          redemption
            ? {
                id: redemption.deal.id,
                title: redemption.deal.title,
                description: redemption.deal.description,
                startsAt: redemption.deal.startsAt.toISOString(),
                endsAt: redemption.deal.endsAt.toISOString(),
                imageUrl: redemption.deal.imageUrl ?? null,
                merchant: {
                  name: redemption.deal.merchant.name,
                  city: redemption.deal.merchant.city ?? null,
                  category: redemption.deal.merchant.category ?? null,
                },
              }
            : null
        }
      />

      <div className="mt-8 flex items-center justify-between text-sm">
        <Link href="/explore" className="font-semibold text-slate-700 hover:underline">
          ← Explore deals
        </Link>

        {redemption?.deal?.id ? (
          <Link
            href={`/deals/${redemption.deal.id}`}
            className="font-semibold text-emerald-700 hover:underline"
          >
            View deal details →
          </Link>
        ) : null}
      </div>
    </main>
  );
}
