// C:\Users\Administrator\deals-web\app\merchant\profile\avatar\route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111"; // same demo ID

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!file || !(file instanceof File)) {
      return NextResponse.redirect(
        new URL("/merchant/profile", request.url),
        303
      );
    }

    // Create uploads directory if needed
    const uploadsDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "merchants"
    );
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Derive file extension
    const originalName = file.name || "avatar";
    const ext = path.extname(originalName) || ".jpg";

    const fileName = `${MERCHANT_ID}-${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    // Read file data and write to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    // Public URL (served from /public)
    const publicUrl = `/uploads/merchants/${fileName}`;

    // Save in database
    await prisma.merchant.update({
      where: { id: MERCHANT_ID },
      data: { avatarUrl: publicUrl },
    });

    return NextResponse.redirect(
      new URL("/merchant/profile", request.url),
      303
    );
  } catch (err) {
    console.error("Error uploading avatar:", err);
    return NextResponse.redirect(
      new URL("/merchant/profile", request.url),
      303
    );
  }
}
