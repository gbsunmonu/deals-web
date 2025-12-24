// app/m/[merchantId]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ViewTracker from "@/components/ViewTracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ merchantId: string }>;
};

export default async function MerchantPublicPage({ params }: Props) {
  const { merchantId } = await params;

  if (!merchantId) return notFound();

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      description: true,
      avatarUrl: true,
      category: true,
      address: true,
      city: true,
      phone: true,
      website: true,
      deals: {
        where: {
          startsAt: { lte: new Date() },
          endsAt: { gte: new Date() },
        },
        orderBy: { endsAt: "asc" },
        select: {
          id: true,
          title: true,
          imageUrl: true,
          originalPrice: true,
          discountType: true,
          discountValue: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
  });

  if (!merchant) return notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* ✅ Track merchant profile view */}
      <ViewTracker type="MERCHANT_PROFILE_VIEW" merchantId={merchant.id} />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-3xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {merchant.avatarUrl ? (
              <img
                src={merchant.avatarUrl}
                alt={merchant.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                {merchant.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Merchant
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {merchant.name}
            </h1>

            {merchant.category ? (
              <p className="mt-1 text-xs text-slate-500">{merchant.category}</p>
            ) : null}

            {merchant.description ? (
              <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">
                {merchant.description}
              </p>
            ) : null}

            <div className="mt-3 space-y-1 text-xs text-slate-600">
              {merchant.city ? <p>City: {merchant.city}</p> : null}
              {merchant.address ? <p>Address: {merchant.address}</p> : null}
              {merchant.phone ? <p>Phone: {merchant.phone}</p> : null}
              {merchant.website ? (
                <p>
                  Website:{" "}
                  <a
                    href={merchant.website}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    {merchant.website}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Live deals</h2>
        <p className="mt-1 text-xs text-slate-500">
          Deals currently active for this merchant.
        </p>

        {merchant.deals.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No live deals right now.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {merchant.deals.map((d) => (
              <a
                key={d.id}
                href={`/deals/${d.id}`}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
              >
                <div className="aspect-[16/10] w-full bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.imageUrl ? (
                    <img
                      src={d.imageUrl}
                      alt={d.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                      No image
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-sm font-semibold text-slate-900 group-hover:underline">
                    {d.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ends: {new Date(d.endsAt).toLocaleString()}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
