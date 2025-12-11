// lib/dbHealth.ts
import { prisma } from '@/lib/prisma';

export async function canConnectToDb(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    // cheap ping
    await prisma.$queryRaw`SELECT 1`;
    clearTimeout(t);
    return true;
  } catch (e) {
    console.error('[DB HEALTH] cannot connect:', e);
    return false;
  }
}
