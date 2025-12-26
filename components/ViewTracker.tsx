// components/ViewTracker.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent, type TrackEventType } from "@/lib/track";

export default function ViewTracker({
  type,
  dealId,
  merchantId,
  dedupe = true,
  meta,
}: {
  type: TrackEventType;          // ✅ fix: no more string
  dealId?: string | null;
  merchantId?: string | null;
  dedupe?: boolean;
  meta?: Record<string, any>;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    // fullPath with query string
    const qs = sp?.toString();
    const fullPath = qs ? `${pathname}?${qs}` : pathname;

    trackEvent({
      type,
      path: fullPath,
      dealId: dealId ?? undefined,
      merchantId: merchantId ?? undefined,
      dedupe,
      meta,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, dealId, merchantId, dedupe, pathname, sp?.toString()]);

  return null;
}
