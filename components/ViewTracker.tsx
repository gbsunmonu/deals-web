// components/ViewTracker.tsx
"use client";

import { useEffect, useRef } from "react";

type Props =
  | { type: "DEAL_VIEW"; dealId: string; merchantId?: string }
  | { type: "MERCHANT_PROFILE_VIEW"; merchantId: string; dealId?: string };

export default function ViewTracker(props: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(props),
    }).catch(() => {
      // ignore analytics failure
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
