// app/api/qrcode/[code]/route.ts
import QRCode from "qrcode";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const payload = (code || "").trim();

    if (!payload) {
      return new Response("Missing QR payload", { status: 400 });
    }

    // Generate QR PNG as a buffer
    const pngBuffer = await QRCode.toBuffer(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 6,
    } as any);

    // Use plain Response and cast to any so TypeScript is happy
    return new Response(pngBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("[QR PNG ERROR]", err);
    return new Response("Failed to generate QR code", { status: 500 });
  }
}
