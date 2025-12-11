// app/api/deals/[id]/delete/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

function isUuid(v: string) {
  // basic UUID v4-ish check (accept any 36-char uuid)
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    v
  );
}

async function handleDelete(ctx: Ctx) {
  const { id: raw } = await ctx.params;
  if (!raw) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const idOrCode = decodeURIComponent(String(raw)).trim();

  // guard against accidental placeholders like "<some-deal-id>"
  if (idOrCode.startsWith('<') || idOrCode.endsWith('>')) {
    return NextResponse.json(
      { error: 'Replace placeholder with a real id (UUID) or short code.' },
      { status: 400 }
    );
  }

  try {
    // Find the deal either by UUID id or by shortCode.
    const deal = isUuid(idOrCode)
      ? await prisma.deal.findUnique({ where: { id: idOrCode } })
      : await prisma.deal.findFirst({ where: { shortCode: idOrCode } });

    if (!deal) {
      return NextResponse.json(
        { error: `Deal not found for "${idOrCode}"` },
        { status: 404 }
      );
    }

    // Clean up children first to avoid FK issues (adjust if your schema differs)
    const redemptionIds = (
      await prisma.redemption.findMany({
        where: { dealId: deal.id },
        select: { id: true },
      })
    ).map((r) => r.id);

    await prisma.$transaction([
      prisma.redemptionEvent.deleteMany({
        where: { redemptionId: { in: redemptionIds } },
      }),
      prisma.redemption.deleteMany({ where: { dealId: deal.id } }),
      prisma.deal.delete({ where: { id: deal.id } }),
    ]);

    return NextResponse.json({ ok: true, deleted: deal.id });
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
