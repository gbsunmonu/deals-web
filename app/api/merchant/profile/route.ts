// app/api/merchant/profile/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[POST /api/merchant/profile] auth error:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      category?: string;
      city?: string;
      address?: string;
      phone?: string;
      website?: string;
    };

    const name =
      (body.name ?? "").trim() ||
      (user.user_metadata?.business_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "New merchant";

    const description = (body.description ?? "").trim();
    const category = (body.category ?? "").trim();
    const city = (body.city ?? "").trim();
    const address = (body.address ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const website = (body.website ?? "").trim();

    // Upsert merchant row by userId (unique)
    const merchant = await prisma.merchant.upsert({
      where: { userId: user.id },
      update: {
        name,
        description,
        category,
        city,
        address,
        phone,
        website,
      },
      create: {
        userId: user.id,
        name,
        description,
        category,
        city,
        address,
        phone,
        website,
      },
    });

    return NextResponse.json({ ok: true, merchant }, { status: 200 });
  } catch (err) {
    console.error("Save merchant profile error:", err);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 },
    );
  }
}
