"use client";

export function useMerchantId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("merchant_id");
}
