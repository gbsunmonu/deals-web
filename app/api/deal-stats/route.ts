import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseRSC } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let userId: string | null = body.userId ?? null;
    let email: string | null = null;

    if (!userId) {
      const supabase = await getServerSupabaseRSC();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        email = user.email ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

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
      where: { userId },
      update: {
        name,
        description: description ?? "",
        category: category ?? "",
        city: city ?? "",
        address: address ?? "",
        phone: phone ?? "",
        website: website ?? "",
        logoUrl: logoUrl ?? null,
      },
      create: {
        userId,
        email: email ?? "",
        name,
        description: description ?? "",
        category: category ?? "",
        city: city ?? "",
        address: address ?? "",
        phone: phone ?? "",
        website: website ?? "",
        logoUrl: logoUrl ?? null,
      },
    });

    return NextResponse.json(
      { message: "Profile saved", merchant },
      { status: 200 }
    );
  } catch (err) {
    console.error("Merchant profile save error:", err);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    );
  }
}