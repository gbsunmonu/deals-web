// app/merchant/deals/create-action.ts
"use server";

import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function toInt(v: FormDataEntryValue | null) {
  if (v === null) return 0;
  const n = Number(String(v));
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function toDate(v: FormDataEntryValue | null) {
  const s = v ? String(v) : "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function getMerchantUserId(): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnon) return null;

  const jar = await cookies();
  const accessToken = jar.get("sb-access-token")?.value || "";
  if (!accessToken) return null;

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;

  return data.user.id;
}

export async function createDealAction(formData: FormData) {
  // 1) Validate merchant auth
  const userId = await getMerchantUserId();
  if (!userId) redirect("/auth/sign-in?next=/merchant/deals/new");

  // 2) Find merchant linked to this user
  const merchant = await prisma.merchant.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!merchant) redirect("/merchant/profile/edit");

  // 3) Read + validate fields
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();

  const originalPrice = clamp(toInt(formData.get("originalPrice")), 0, 1_000_000_000);
  const discountValue = clamp(toInt(formData.get("discountValue")), 0, 100);

  const startsAt = toDate(formData.get("startsAt")) ?? new Date();
  const endsAt =
    toDate(formData.get("endsAt")) ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const imageUrlRaw = formData.get("imageUrl");
  const imageUrl = imageUrlRaw ? String(imageUrlRaw).trim() : null;

  if (!title || title.length < 3) throw new Error("Title is required");
  if (!description || description.length < 5) throw new Error("Description is required");
  if (endsAt <= startsAt) throw new Error("End date must be after start date");

  // ✅ REQUIRED by Prisma schema
  const discountType: "PERCENT" | "NONE" = discountValue > 0 ? "PERCENT" : "NONE";

  // 4) Create deal
  await prisma.deal.create({
    data: {
      title,
      description,
      originalPrice,
      discountValue,
      discountType,
      startsAt,
      endsAt,
      imageUrl,
      merchantId: merchant.id,
    },
  });

  redirect("/merchant/deals");
}
