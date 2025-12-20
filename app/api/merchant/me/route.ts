// app/api/merchant/me/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { ok: true, isAuthed: false, isMerchant: false },
        { status: 200 }
      );
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id as any },
      select: { id: true, name: true },
    });

    return NextResponse.json(
      {
        ok: true,
        isAuthed: true,
        isMerchant: !!merchant,
        merchant: merchant ? { id: merchant.id, name: merchant.name } : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, isAuthed: false, isMerchant: false, error: e?.message ?? String(e) },
      { status: 200 }
    );
  }
}
