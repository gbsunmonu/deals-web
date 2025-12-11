// app/api/merchant/update/route.ts
import { NextResponse } from "next/server";
import { getServerSupabaseRSC } from "@/lib/supabase";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const supabase = getServerSupabaseRSC();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const updated = await prisma.merchant.update({
      where: { id: user.id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        city: body.city,
        address: body.address,
        phone: body.phone,
        website: body.website,
      },
    });

    return NextResponse.json({ success: true, merchant: updated });
  } catch (err: any) {
    console.error("UPDATE ERROR:", err);
    return NextResponse.json(
      { error: err.message ?? "Update failed" },
      { status: 500 }
    );
  }
}
