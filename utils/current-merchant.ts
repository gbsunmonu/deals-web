// deals-web/utils/current-merchant.ts
import prisma from "./prismaClient";
import { createSupabaseServerClient } from "./supabase-server";

/**
 * Returns the merchant for the currently authenticated user, or null.
 * Safely handles the "no session" / AuthSessionMissingError case.
 */
export async function getCurrentMerchant() {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // If Supabase explicitly says "no session", just treat as logged-out
    if (error && error.name === "AuthSessionMissingError") {
      return null;
    }

    // Any other auth error: log it so we can debug
    if (error) {
      console.error("getCurrentMerchant auth error:", error);
      return null;
    }

    if (!user) {
      return null;
    }

    const merchant = await prisma.merchant.findFirst({
      where: { userId: user.id },
    });

    return merchant;
  } catch (err: any) {
    // In case a future version actually *throws* AuthSessionMissingError
    if (err?.name === "AuthSessionMissingError") {
      return null;
    }

    console.error("getCurrentMerchant unexpected error:", err);
    throw err; // let Next show a real error only for unexpected stuff
  }
}
