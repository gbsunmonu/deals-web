// deals-web/app/api/merchant/profile/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer(); // ✅ IMPORTANT

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[POST /api/merchant/profile] auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      name,
      description,
      category,
      city,
      address,
      phone,
      website,
      logoUrl,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const merchant = await prisma.merchant.upsert({
      where: { userId: user.id },
      update: {
        name,
        description: description ?? "",
        category: category ?? "",
        city: city ?? "",
        address: address ?? "",
        phone: phone ?? "",
        website: website ?? "",
        avatarUrl: logoUrl ?? null,
      },
      create: {
        userId: user.id,
        name,
        description: description ?? "",
        category: category ?? "",
        city: city ?? "",
        address: address ?? "",
        phone: phone ?? "",
        website: website ?? "",
        avatarUrl: logoUrl ?? null,
      },
    });

    return NextResponse.json(
      { message: "Profile saved", merchant },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/merchant/profile] error:", err);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    );
  }
}
