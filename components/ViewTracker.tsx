"use client";

import { useEffect } from "react";

type Props =
  | { type: "DEAL_VIEW"; dealId: string; merchantId?: string }
  | { type: "MERCHANT_PROFILE_VIEW"; merchantId: string; dealId?: string };

export default function ViewTracker(props: Props) {
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(props),
    }).catch(() => {});

    return () => controller.abort();
  }, [JSON.stringify(props)]);

  return null;
}
