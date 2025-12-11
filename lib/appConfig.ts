// lib/appConfig.ts

// This will be used both on server and client.
// Set NEXT_PUBLIC_SITE_URL in .env and in Vercel (e.g. https://dealina.com)
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
