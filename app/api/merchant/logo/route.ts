// app/api/merchant/logo/route.ts

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
      console.error("[POST /api/merchant/logo] auth error:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      avatarUrl?: string;
    };

    if (!body.avatarUrl) {
      return NextResponse.json(
        { error: "avatarUrl is required" },
        { status: 400 },
      );
    }

    // Ensure merchant exists for this user
    let merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
    });

    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          userId: user.id,
          name:
            (user.user_metadata?.business_name as string | undefined) ||
            user.email?.split("@")[0] ||
            "New merchant",
          description: "",
          category: "",
          city: "",
          address: "",
          phone: "",
          website: "",
          avatarUrl: body.avatarUrl,
        },
      });
    } else {
      merchant = await prisma.merchant.update({
        where: { userId: user.id },
        data: {
          avatarUrl: body.avatarUrl,
        },
      });
    }

    return NextResponse.json({ ok: true, merchant }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/merchant/logo] error:", error);
    return NextResponse.json(
      { error: "Failed to update logo" },
      { status: 500 },
    );
  }
}
