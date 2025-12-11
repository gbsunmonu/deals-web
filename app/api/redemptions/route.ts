// app/api/redemptions/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { code } = (await req.json()) as { code?: string };

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid code" },
        { status: 400 }
      );
    }

    // QR contains JSON like:
    // {"type":"DEAL","dealId":"...","title":"...","expiresAt":"..."}
    let payload: any;
    try {
      payload = JSON.parse(code);
    } catch {
      return NextResponse.json(
        { error: "Code is not valid JSON" },
        { status: 400 }
      );
    }

    if (payload.type !== "DEAL" || !payload.dealId) {
      return NextResponse.json(
        { error: "Code is not a valid deal QR" },
        { status: 400 }
      );
    }

    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId as string },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found for this code" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (deal.startsAt > now) {
      return NextResponse.json(
        { error: "Deal is not active yet" },
        { status: 400 }
      );
    }

    if (deal.endsAt < now) {
      return NextResponse.json(
        { error: "Deal has expired" },
        { status: 400 }
      );
    }

    try {
      const redemption = await prisma.redemption.create({
        data: {
          dealId: deal.id,
          code,
        },
      });

      return NextResponse.json(
        {
          message: "Redemption successful",
          redemption,
        },
        { status: 201 }
      );
    } catch (err: any) {
      // unique constraint on `code` -> same QR used twice
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "This code has already been redeemed" },
          { status: 400 }
        );
      }

      console.error("Error creating redemption:", err);
      return NextResponse.json(
        { error: "Unexpected error redeeming code" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Error in POST /api/redemptions:", err);
    return NextResponse.json(
      { error: "Server error while redeeming code" },
      { status: 500 }
    );
  }
}
