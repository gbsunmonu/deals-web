import QRCode from 'qrcode';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;                           // ✅ must await
  const short = decodeURIComponent(code || '').trim();

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${base}/r/${encodeURIComponent(short)}`;

  const png = await QRCode.toBuffer(url, { margin: 1, width: 512 });
  return new NextResponse(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
