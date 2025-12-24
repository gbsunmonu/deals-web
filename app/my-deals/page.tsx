// app/my-deals/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function MyDealsPage() {
  const supabase = await getServerSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?returnTo=/my-deals");

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id as any },
    select: { id: true, name: true },
  });

  if (!merchant) redirect("/merchant/profile");

  const deals = await prisma.deal.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      maxRedemptions: true,
      _count: { select: { redemptions: true } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-7 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Merchant
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            My Deals
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Deals created by <span className="font-semibold">{merchant.name}</span>.
          </p>
        </div>

        <Link
          href="/merchant/profile"
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Merchant home
        </Link>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {deals.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No deals yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Start</th>
                  <th className="py-2 pr-3">End</th>
                  <th className="py-2 pr-3">Redemptions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      <Link className="font-medium text-slate-900 hover:underline" href={`/deals/${d.id}`}>
                        {d.title}
                      </Link>
                      <div className="text-[11px] text-slate-500">ID: {d.id}</div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                      {new Date(d.startsAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                      {new Date(d.endsAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {d._count.redemptions}
                      {d.maxRedemptions ? ` / ${d.maxRedemptions}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
