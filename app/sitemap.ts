// app/sitemap.ts
import { prisma } from '@/lib/prisma';

export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const now = new Date();

  const deals = await prisma.deal.findMany({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
    select: { shortCode: true, updatedAt: true },
    take: 2000, // safety cap
  });

  const staticRoutes = [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/deals`, lastModified: new Date() },
  ];

  const dealRoutes = deals.map((d) => ({
    url: `${base}/r/${encodeURIComponent(d.shortCode)}`,
    lastModified: d.updatedAt ?? new Date(),
  }));

  return [...staticRoutes, ...dealRoutes];
}
