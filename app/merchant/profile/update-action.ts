"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

/** Keep only digits + leading + (E.164 friendly) */
function normalizeWhatsapp(input: string) {
  const v = (input || "").trim();
  if (!v) return null;

  // allow + then digits, remove spaces/dashes
  const cleaned = v.replace(/[^\d+]/g, "");
  // if multiple +, remove extras
  const fixed = cleaned.startsWith("+")
    ? "+" + cleaned.slice(1).replace(/\+/g, "")
    : cleaned.replace(/\+/g, "");

  // basic sanity: must contain at least 8 digits
  const digits = fixed.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;

  return fixed;
}

function safeStr(v: FormDataEntryValue | null, max = 2000) {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return s.length > max ? s.slice(0, max) : s;
}

export async function updateMerchantProfileAction(formData: FormData) {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();

  const user = data?.user;
  if (!user) redirect("/auth/sign-in?next=/merchant/profile/edit");

  const name = safeStr(formData.get("name"), 120);
  const description = safeStr(formData.get("description"), 5000);
  const category = safeStr(formData.get("category"), 120);
  const city = safeStr(formData.get("city"), 120);
  const address = safeStr(formData.get("address"), 300);
  const phone = safeStr(formData.get("phone"), 60);
  const website = safeStr(formData.get("website"), 300);

  // ✅ NEW
  const whatsappNumber = normalizeWhatsapp(safeStr(formData.get("whatsappNumber"), 80));

  // Basic validation
  if (!name) {
    // you can also return an error state instead of redirect
    redirect("/merchant/profile/edit?err=missing_name");
  }

  // Only update merchant that belongs to this logged-in user
  await prisma.merchant.updateMany({
    where: { userId: user.id },
    data: {
      name,
      description,
      category,
      city,
      address,
      phone,
      website,

      // ✅ save WhatsApp
      whatsappNumber,
    },
  });

  redirect("/merchant/profile");
}
