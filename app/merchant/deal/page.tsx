// app/merchant/deal/page.tsx
import { redirect } from "next/navigation";

export default function MerchantDealLegacyPage() {
  // This route is just a legacy alias.
  // Send merchants straight to the main "My deals" dashboard.
  redirect("/merchant/deals");
}
