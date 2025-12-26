// app/m/[merchantId]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ViewTracker from "@/components/ViewTracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MerchantPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const { merchantId } = await params;

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      description: true,
      city: true,
      address: true,
      website: true,
      phone: true,
      deals: {
        where: { endsAt: { gte: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          endsAt: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!merchant) return notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* ✅ Track merchant view */}
      <ViewTracker
        type="MERCHANT_PROFILE_VIEW"
        merchantId={merchant.id}
        dedupe={true}
        meta={{ merchantName: merchant.name }}
      />

      <div className="mb-6">
        <Link href="/explore" className="text-sm font-semibold text-emerald-700">
          ← Back to Explore
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{merchant.name}</h1>

        <p className="mt-1 text-sm text-slate-600">
          {merchant.city ? merchant.city : ""}
          {merchant.address ? ` · ${merchant.address}` : ""}
        </p>

        {merchant.description ? (
          <p className="mt-4 whitespace-pre-line text-slate-700">{merchant.description}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {merchant.website ? (
            <a
              href={merchant.website}
              className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200"
            >
              🌐 Website
            </a>
          ) : null}
          {merchant.phone ? (
            <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
              📞 {merchant.phone}
            </span>
          ) : null}
        </div>
      </section>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Active deals</h2>

      {merchant.deals.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No active deals right now.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {merchant.deals.map((d) => (
            <Link
              key={d.id}
              href={`/deals/${d.id}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md"
            >
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt={d.title} className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 w-full bg-slate-100" />
              )}
              <div className="p-4">
                <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                  {d.title}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Ends {new Date(d.endsAt).toLocaleDateString("en-GB")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
