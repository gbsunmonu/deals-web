// app/deals/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const deals = await prisma.deal.findMany({
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      startsAt: true,
      endsAt: true,
      merchant: { select: { id: true, name: true, city: true } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">All Deals</h1>
        <p className="mt-2 text-sm text-slate-600">Browse recently added deals.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((d) => (
          <Link
            key={d.id}
            href={`/deals/${d.id}`}
            className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
          >
            <div className="aspect-[16/10] w-full bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.imageUrl ? (
                <img src={d.imageUrl} alt={d.title} className="h-full w-full object-cover" />
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
                {d.merchant.name}
                {d.merchant.city ? ` • ${d.merchant.city}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Ends: {new Date(d.endsAt).toLocaleString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
