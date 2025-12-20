// app/api/merchant/onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

type Body = {
  name: string;
  description?: string;
  category?: string;
  city?: string;
  address?: string;
  phone?: string;
  website?: string;
  avatarUrl?: string;
  lat?: number | null;
  lng?: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const name = (body.name || "").trim();
    if (name.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Business name must be at least 2 characters." },
        { status: 400 }
      );
    }

    // Prevent duplicate profile creation
    const existing = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ ok: true, merchantId: existing.id, reused: true }, { status: 200 });
    }

    const created = await prisma.merchant.create({
      data: {
        userId: user.id,
        name,
        description: (body.description || "").trim() || null,
        category: (body.category || "").trim() || null,
        city: (body.city || "").trim() || null,
        address: (body.address || "").trim() || null,
        phone: (body.phone || "").trim() || null,
        website: (body.website || "").trim() || null,
        avatarUrl: (body.avatarUrl || "").trim() || null,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, merchantId: created.id }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/merchant/onboarding error:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error creating merchant profile", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
