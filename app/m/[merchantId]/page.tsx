import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import ViewTracker from "@/components/ViewTracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ merchantId: string }>;
};

function formatNaira(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `₦${value.toLocaleString("en-NG")}`;
}

export default async function MerchantPublicPage({ params }: Props) {
  const { merchantId } = await params;

  if (!merchantId) return notFound();

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      city: true,
      address: true,
      phone: true,
    },
  });

  if (!merchant) return notFound();

  const now = new Date();

  const deals = await prisma.deal.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      originalPrice: true,
      discountType: true,
      discountValue: true,
      startsAt: true,
      endsAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* ✅ Track Merchant Profile View */}
      <ViewTracker type="MERCHANT_PROFILE_VIEW" merchantId={merchant.id} />

      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
          Merchant
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{merchant.name}</h1>

        <div className="mt-2 text-sm text-slate-600">
          {merchant.category ? <span>{merchant.category}</span> : null}
          {merchant.city ? <span>{merchant.category ? " • " : ""}{merchant.city}</span> : null}
        </div>

        {merchant.description ? (
          <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">{merchant.description}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {merchant.address ? (
            <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-700">
              {merchant.address}
            </span>
          ) : null}
          {merchant.phone ? (
            <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-700">
              {merchant.phone}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/explore"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Explore deals
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Deals by this merchant</h2>
          <p className="text-xs text-slate-500">{deals.length} deals</p>
        </div>

        {deals.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            No deals yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => {
              const startsAt = new Date(d.startsAt);
              const endsAt = new Date(d.endsAt);
              const isLive = now >= startsAt && now <= endsAt;

              const pct = Number(d.discountValue ?? 0);
              const hasPct = String(d.discountType) === "PERCENT" && pct > 0;
              const original = d.originalPrice ?? null;
              const discounted =
                hasPct && original && original > 0
                  ? Math.max(0, Math.round(original - (original * pct) / 100))
                  : original;

              return (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition"
                >
                  <div className="aspect-[16/9] bg-slate-900">
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.imageUrl} alt={d.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900 line-clamp-2">{d.title}</p>
                      <span
                        className={[
                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          isLive ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-slate-50 text-slate-600 border border-slate-200",
                        ].join(" ")}
                      >
                        {isLive ? "Live" : "Not live"}
                      </span>
                    </div>

                    <div className="mt-2 text-sm">
                      {hasPct ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-700">
                            {formatNaira(discounted)}
                          </span>
                          <span className="text-xs text-slate-500 line-through">
                            {formatNaira(original)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-700">{formatNaira(original)}</span>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Valid {startsAt.toLocaleDateString()} – {endsAt.toLocaleDateString()}
                    </p>
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
