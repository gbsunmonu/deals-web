"use server";

import prisma from "@/lib/prisma";

function makeShortCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createDeal(data: any) {
  let shortCode = makeShortCode();

  // Try 3 times to avoid collisions
  for (let i = 0; i < 3; i++) {
    const exists = await prisma.deal.findFirst({
      where: { shortCode },
      select: { id: true },
    });

    if (!exists) break;
    shortCode = makeShortCode();
  }

  const deal = await prisma.deal.create({
    data: {
      ...data,
      shortCode,
    },
  });

  return deal;
}
