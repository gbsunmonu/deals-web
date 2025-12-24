import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ViewTracker from "@/components/ViewTracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isLive(startsAt: Date, endsAt: Date) {
  const now = new Date();
  return now >= startsAt && now <= endsAt;
}

export default async function MerchantPublicPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const { merchantId } = await params;
  if (!merchantId) return notFound();

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      description: true,
      city: true,
      address: true,
      phone: true,
      website: true,
      deals: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          discountType: true,
          discountValue: true,
          originalPrice: true,
          imageUrl: true,
          startsAt: true,
          endsAt: true,
          maxRedemptions: true,
        },
      },
    },
  });

  if (!merchant) return notFound();

  const liveDeals = merchant.deals.filter((d) => isLive(new Date(d.startsAt), new Date(d.endsAt))).length;
  const highestDiscount =
    Math.max(
      0,
      ...merchant.deals
        .filter((d) => String(d.discountType) === "PERCENT")
        .map((d) => Number(d.discountValue ?? 0))
    ) || 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* ✅ Track merchant profile view */}
      <ViewTracker type="MERCHANT_PROFILE_VIEW" merchantId={merchant.id} />

      <header className="mb-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Merchant
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {merchant.name}
            </h1>

            {merchant.description ? (
              <p className="mt-2 text-sm text-slate-600">{merchant.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              {merchant.city ? (
                <span className="rounded-full bg-slate-100 px-3 py-1">{merchant.city}</span>
              ) : null}
              {merchant.address ? (
                <span className="rounded-full bg-slate-100 px-3 py-1">{merchant.address}</span>
              ) : null}
              {merchant.phone ? (
                <span className="rounded-full bg-slate-100 px-3 py-1">📞 {merchant.phone}</span>
              ) : null}
              {merchant.website ? (
                <a
                  href={merchant.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200"
                >
                  🌐 Website
                </a>
              ) : null}
            </div>
          </div>

          <Link
            href="/explore"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Explore
          </Link>
        </div>

        {/* Stats */}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Live deals
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{liveDeals}</p>
            <p className="mt-1 text-xs text-slate-500">Active right now</p>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Highest discount
            </p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-800">
              {highestDiscount}%
            </p>
            <p className="mt-1 text-xs text-emerald-800/80">Best offer</p>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              Total deals
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{merchant.deals.length}</p>
            <p className="mt-1 text-xs text-sky-800/80">All time</p>
          </div>
        </section>
      </header>

      {/* Deals list */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">All deals</h2>
        <p className="mt-1 text-xs text-slate-500">Browse and redeem any active deal.</p>

        {merchant.deals.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No deals yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {merchant.deals.map((d) => {
              const startsAt = new Date(d.startsAt);
              const endsAt = new Date(d.endsAt);
              const live = isLive(startsAt, endsAt);

              return (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="aspect-[16/9] w-full bg-slate-900">
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.imageUrl} alt={d.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 line-clamp-1">{d.title}</p>
                        {d.description ? (
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">{d.description}</p>
                        ) : null}
                      </div>

                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
                          live
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-50 text-slate-600 border border-slate-200",
                        ].join(" ")}
                      >
                        {live ? "Live" : "Not live"}
                      </span>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500">
                      Valid: {startsAt.toLocaleDateString()} – {endsAt.toLocaleDateString()}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-700">
                        {String(d.discountType) === "PERCENT" && Number(d.discountValue) > 0
                          ? `${Number(d.discountValue)}% OFF`
                          : "Deal"}
                      </span>

                      <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                        Open →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
