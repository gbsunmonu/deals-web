// app/sitemap.ts
import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    "http://localhost:3000";

  const deals = await prisma.deal.findMany({
    select: {
      id: true,
      shortCode: true, // string | null
      updatedAt: true,
    },
  });

  const dealRoutes: MetadataRoute.Sitemap = deals.map((d) => {
    // ✅ Always ensure we pass a non-null string into encodeURIComponent
    const code: string = d.shortCode ?? d.id;
    const url = `${base}/r/${encodeURIComponent(code)}`;

    return {
      url,
      lastModified: d.updatedAt ?? new Date(),
    };
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
    },
    {
      url: `${base}/explore`,
      lastModified: new Date(),
    },
  ];

  return [...staticRoutes, ...dealRoutes];
}
