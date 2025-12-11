import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();

function makeCode(len = 5) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function main() {
  // 1) Create a test merchant with a hashed PIN
  const pin = process.env.SEED_TEST_PIN || '12345';
  const pinHash = await bcrypt.hash(pin, 10);

  // fixed ID so you always know it
  const merchant = await prisma.merchant.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Demo Restaurant',
      pinHash,
      status: 'ACTIVE',
    },
  });

  // 2) Create a demo deal (fields match your schema)
  const deal = await prisma.deal.create({
    data: {
      merchantId: merchant.id,
      title: '10% Off Special',
      description: 'Valid on all menu items.',
      shortCode: makeCode(),
      startsAt: new Date(),
      endsAt: addDays(new Date(), 30),
      terms: 'One per customer.',
      maxRedemptions: 200,
      perUserLimit: 1,
    },
  });

  console.log('✅ Seeded');
  console.log('Merchant ID:', merchant.id);
  console.log('Test PIN:', pin);
  console.log('Deal short code:', deal.shortCode);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
