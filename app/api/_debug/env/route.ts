// app/api/_debug/env/route.ts
import { NextResponse } from 'next/server';

function mask(u?: string | null) {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return u.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  }
}

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: mask(process.env.DATABASE_URL),
    DIRECT_URL: mask(process.env.DIRECT_URL),
    RUNTIME_HINT: process.env.NEXT_RUNTIME ?? 'node',
  });
}
