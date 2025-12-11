// C:\Users\Administrator\deals-web\app\merchant\profile\update\route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111"; // same as profile page

export async function POST(request: Request) {
  const formData = await request.formData();

  const name = (formData.get("name") ?? "").toString().trim();
  const description = (formData.get("description") ?? "").toString().trim();

  try {
    await prisma.merchant.update({
      where: { id: MERCHANT_ID },
      data: {
        name: name || undefined, // keep old name if empty string
        description: description || null,
      },
    });

    // Redirect back to the profile page after saving
    return NextResponse.redirect(
      new URL("/merchant/profile", request.url),
      303
    );
  } catch (err) {
    console.error("Error updating merchant profile:", err);

    // On error, just go back to the profile page for now
    return NextResponse.redirect(
      new URL("/merchant/profile", request.url),
      303
    );
  }
}
