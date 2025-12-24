import { prisma } from "@/lib/prisma";
import ExploreClient from "./ExploreClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ExplorePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const q = String(sp.q ?? "").trim();

  // basic search across deal title + merchant name + city
  const deals = await prisma.deal.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { merchant: { name: { contains: q, mode: "insensitive" } } },
              { merchant: { city: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      description: true,
      originalPrice: true,
      discountValue: true,
      discountType: true,
      startsAt: true,
      endsAt: true,
      imageUrl: true,
      maxRedemptions: true,
      merchant: { select: { id: true, name: true, city: true } },
    },
  });

  return <ExploreClient deals={deals} />;
}
