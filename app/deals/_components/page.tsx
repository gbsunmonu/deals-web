// app/deals/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PublicDealCard from './_components/PublicDealCard';

type SearchParams = Promise<Record<string, string>>;

const PAGE_SIZE_DEFAULT = 12;
const PAGE_SIZE_MAX = 48;

export default async function ExploreDealsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;

  const q = (sp.q ?? '').trim();
  const sort = (sp.sort ?? 'new').toLowerCase(); // 'new' | 'ending' | 'discount'
  const city = (sp.city ?? '').trim();
  const category = (sp.category ?? '').trim();

  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const pageSizeRaw = Math.max(1, Number(sp.pageSize ?? PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT);
  const pageSize = Math.min(pageSizeRaw, PAGE_SIZE_MAX);
  const skip = (page - 1) * pageSize;

  const now = new Date();

  const where: any = {
    startsAt: { lte: now },
    endsAt: { gte: now },
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { shortCode: { contains: q, mode: 'insensitive' } },
      { Merchant: { name: { contains: q, mode: 'insensitive' } } },
      { city: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (city) where.city = { equals: city, mode: 'insensitive' };
  if (category) where.category = { equals: category, mode: 'insensitive' };

  const orderBy =
    sort === 'ending'
      ? [{ endsAt: 'asc' as const }]
      : sort === 'discount'
      ? [{ discountValue: 'desc' as const }, { startsAt: 'desc' as const }]
      : [{ startsAt: 'desc' as const }];

  const [citiesRaw, catsRaw, [deals, total]] = await Promise.all([
    prisma.deal.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      distinct: ['city'],
      select: { city: true },
      orderBy: { city: 'asc' },
    }),
    prisma.deal.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
    Promise.all([
      prisma.deal.findMany({
        where,
        orderBy,
        include: {
          Merchant: { select: { name: true } },
          redemptions: { select: { id: true } },
        },
        skip,
        take: pageSize,
      }),
      prisma.deal.count({ where }),
    ]),
  ]);

  const cities = citiesRaw.map((c) => c.city).filter(Boolean) as string[];
  const categories = catsRaw.map((c) => c.category).filter(Boolean) as string[];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (city) qs.set('city', city);
  if (category) qs.set('category', category);
  if (sort) qs.set('sort', sort);
  qs.set('pageSize', String(pageSize));

  function pageHref(p: number) {
    const params = new URLSearchParams(qs);
    params.set('page', String(p));
    return `/deals?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="sticky -top-px z-30 bg-white/80 backdrop-blur border rounded-xl p-3">
        <form className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3" action="/deals" method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search food, salon, gym…"
            className="w-full md:w-72 rounded-lg border px-3 py-2"
          />
          <select name="city" defaultValue={city} className="rounded-lg border px-3 py-2">
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="category" defaultValue={category} className="rounded-lg border px-3 py-2">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} className="rounded-lg border px-3 py-2">
            <option value="new">Newest</option>
            <option value="ending">Ending soon</option>
            <option value="discount">Biggest savings</option>
          </select>
          <select name="pageSize" defaultValue={String(pageSize)} className="rounded-lg border px-3 py-2">
            <option value="12">12 / page</option>
            <option value="24">24 / page</option>
            <option value="36">36 / page</option>
            <option value="48">48 / page</option>
          </select>
          <button className="rounded-lg bg-black text-white px-4 py-2">Filter</button>
        </form>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-neutral-600 bg-white">
          No active deals{q ? ` for “${q}”` : ''}{city ? ` in ${city}` : ''}{category ? ` under ${category}` : ''}.{' '}
          <Link className="underline" href="/merchant/deals/new">Post a deal</Link>.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {deals.map((deal) => (
              <PublicDealCard key={deal.id} deal={deal as any} />
            ))}
          </section>

          <nav className="flex items-center justify-center gap-2 pt-2">
            <Link
              className={`px-3 py-2 rounded-lg border bg-white hover:bg-neutral-50 ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
              href={page <= 1 ? '#' : pageHref(page - 1)}
            >
              ← Prev
            </Link>
            <span className="text-sm text-neutral-600">
              Page {page} of {totalPages} • {total} results
            </span>
            <Link
              className={`px-3 py-2 rounded-lg border bg-white hover:bg-neutral-50 ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
              href={page >= totalPages ? '#' : pageHref(page + 1)}
            >
              Next →
            </Link>
          </nav>
        </>
      )}
    </div>
  );
}
