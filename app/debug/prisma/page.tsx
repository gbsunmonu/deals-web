// app/debug/prisma/page.tsx
import { prisma } from '@/lib/prisma';

export default async function PrismaDebug() {
  const now = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
  return (
    <pre style={{ padding: 20 }}>
      {JSON.stringify(now, null, 2)}
    </pre>
  );
}
