// app/api/redemptions/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const dealId = body?.dealId as string | undefined;
    const code = body?.code as string | undefined;

    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json(
        { error: "dealId is required" },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }

    // Make sure the deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    // Create redemption. `code` is unique in the DB, so duplicates are blocked.
    const redemption = await prisma.redemption.create({
      data: {
        dealId,
        code,
      },
    });

    return NextResponse.json(
      { redemption },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[redemptions/create] error:", err);
    return NextResponse.json(
      { error: "Failed to create redemption" },
      { status: 500 }
    );
  }
}
