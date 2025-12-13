// app/api/merchant/deals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteClient } from "@/lib/supabase-server";

type CreateDealPayload = {
  title: string;
  description: string;
  originalPrice: number | null;
  discountValue: number | null;
  startsAt: string; // "YYYY-MM-DD"
  endsAt: string; // "YYYY-MM-DD"
  imageUrl?: string | null;
};

// Copy cookies set by Supabase into the response we actually return
function attachSupabaseCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    // c has { name, value, ... } — NextResponse can accept it directly
    to.cookies.set(c as any);
  }
  return to;
}

export async function POST(req: NextRequest) {
  // IMPORTANT: create supabase client + "res" first
  const { supabase, res } = createSupabaseRouteClient(req);

  try {
    // 1) Auth – merchant must be logged in
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[Create deal] auth error:", authError);
    }

    if (!user) {
      const out = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return attachSupabaseCookies(res, out);
    }

    // 2) Find merchant for this user
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!merchant) {
      const out = NextResponse.json(
        {
          error:
            "Merchant profile not found. Please complete your profile first.",
        },
        { status: 400 }
      );
      return attachSupabaseCookies(res, out);
    }

    // 3) Read JSON body
    const body = (await req.json()) as CreateDealPayload;

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();

    if (!title) {
      const out = NextResponse.json({ error: "Title is required." }, { status: 400 });
      return attachSupabaseCookies(res, out);
    }

    // 4) Coerce numbers safely
    let originalPrice: number | null = null;
    if (body.originalPrice != null) {
      const n = Number(body.originalPrice);
      if (!Number.isNaN(n) && n > 0) originalPrice = n;
    }

    let discountValue = 0;
    if (body.discountValue != null) {
      const n = Number(body.discountValue);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) discountValue = n;
    }

    // 5) Dates
    if (!body.startsAt || !body.endsAt) {
      const out = NextResponse.json(
        { error: "Both start date and end date are required." },
        { status: 400 }
      );
      return attachSupabaseCookies(res, out);
    }

    // Make start date begin-of-day UTC-ish, end date end-of-day (prevents “ends too early”)
    const startsAt = new Date(`${body.startsAt}T00:00:00.000Z`);
    const endsAt = new Date(`${body.endsAt}T23:59:59.999Z`);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      const out = NextResponse.json(
        { error: "Invalid start or end date." },
        { status: 400 }
      );
      return attachSupabaseCookies(res, out);
    }

    // 6) Image
    const imageUrl = body.imageUrl?.trim() || null;

    // 7) Create deal
    const deal = await prisma.deal.create({
      data: {
        title,
        description,
        startsAt,
        endsAt,
        discountValue,
        ...(originalPrice != null ? { originalPrice } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        merchant: { connect: { id: merchant.id } },
      },
    });

    const out = NextResponse.json({ deal }, { status: 201 });
    return attachSupabaseCookies(res, out);
  } catch (err) {
    console.error("[Create deal route] unexpected error:", err);
    const out = NextResponse.json(
      { error: "Failed to create deal.", detail: String(err) },
      { status: 500 }
    );
    return attachSupabaseCookies(res, out);
  }
}
