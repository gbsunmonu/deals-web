// app/api/deals/[id]/delete/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

async function handleDelete(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
  }

  try {
    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  return handleDelete(ctx);
}
export async function POST(_req: Request, ctx: Ctx) {
  return handleDelete(ctx);
}
export async function DELETE(_req: Request, ctx: Ctx) {
  return handleDelete(ctx);
}
