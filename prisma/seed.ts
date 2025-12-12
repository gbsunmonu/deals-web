// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Use the same demo merchant ID you have in your .env
  const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

  // Upsert a simple demo merchant that matches your current Prisma schema
  await prisma.merchant.upsert({
    where: { id: DEMO_MERCHANT_ID },
    update: {
      name: "Demo Restaurant",
      description: "Sample merchant for testing deals.",
      city: "Lagos",
      address: "123 Demo Street, Lagos",
      phone: "+2348000000000",
      website: null,
      avatarUrl: null,
    },
    create: {
      id: DEMO_MERCHANT_ID,
      userId: null, // no linked user yet
      name: "Demo Restaurant",
      description: "Sample merchant for testing deals.",
      city: "Lagos",
      address: "123 Demo Street, Lagos",
      phone: "+2348000000000",
      website: null,
      avatarUrl: null,
    },
  });

  console.log("✅ Seed completed: Demo merchant upserted.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
