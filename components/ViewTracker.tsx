"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent, TrackEventType } from "@/lib/track";

export default function ViewTracker({
  type,
  dealId,
  merchantId,
  dedupe = true,
  meta,
}: {
  type: TrackEventType;
  dealId?: string | null;
  merchantId?: string | null;
  dedupe?: boolean;
  meta?: Record<string, any>;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    const qs = sp?.toString();
    const fullPath = qs ? `${pathname}?${qs}` : pathname;

    trackEvent({
      type,
      dealId: dealId ?? undefined,
      merchantId: merchantId ?? undefined,
      dedupe,
      path: fullPath,
      meta,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, dealId, merchantId, pathname, sp?.toString()]);

  return null;
}
