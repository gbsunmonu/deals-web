// app/redemptions/page.tsx

import { redirect } from "next/navigation";

export default function RedemptionsIndexPage() {
  // For now, all redemptions happen on the merchant tools page.
  // So if someone visits /redemptions, send them there.
  redirect("/merchant/redemptions");
}
