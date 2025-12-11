import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const mask = (u?: string) =>
  u ? u.replace(/:\/\/([^:]+):([^@]+)@/, (_m, u1) => `://${u1}:****@`) : 'undefined';

export async function GET() {
  try {
    const r = await prisma.$queryRawUnsafe<{ now: Date; user: string }[]>(
      'select now(), current_user as user'
    );
    return NextResponse.json({ ok: true, url: mask(process.env.DATABASE_URL), result: r });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, url: mask(process.env.DATABASE_URL), error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
