// app/merchant/page.tsx
import { redirect } from "next/navigation";

export default function MerchantRootPage() {
  // Always send merchants to the main profile/dashboard page
  redirect("/merchant/profile");
}
