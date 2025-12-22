"use client";

import { useEffect, useRef } from "react";

type DealViewProps = {
  type: "DEAL_VIEW";
  dealId: string;
  merchantId: string;
};

type MerchantProfileViewProps = {
  type: "MERCHANT_PROFILE_VIEW";
  merchantId: string;
  dealId?: never;
};

type Props = DealViewProps | MerchantProfileViewProps;

/**
 * Fires ONE view event per mount (the server dedupes by dayKey anyway).
 * Runs client-side so it captures the customer device cookie.
 */
export default function ViewTracker(props: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const payload: any = {
      type: props.type,
      merchantId: props.merchantId,
      dealId: props.type === "DEAL_VIEW" ? props.dealId : null,
    };

    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    }).catch(() => {
      // ignore view errors (never block UX)
    });
  }, [props]);

  return null;
}
