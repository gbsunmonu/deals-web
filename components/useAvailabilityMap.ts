"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type AvailabilityRow = {
  id: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  left: number | null;
  soldOut: boolean;
  startsAt: string;
  endsAt: string;
};

type ApiResp =
  | { ok: true; map: Record<string, AvailabilityRow> }
  | { ok?: false; error?: string; details?: string };

export function useAvailabilityMap(ids: string[], opts?: { intervalMs?: number }) {
  const intervalMs = opts?.intervalMs ?? 5000;

  const [map, setMap] = useState<Record<string, AvailabilityRow>>({});
  const [error, setError] = useState<string | null>(null);

  const idsKey = useMemo(() => ids.slice().sort().join(","), [ids]);
  const timerRef = useRef<any>(null);

  async function fetchOnce() {
    if (!ids.length) return;

    try {
      setError(null);
      const res = await fetch("/api/deals/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as ApiResp;

      if (!res.ok || (data as any).ok === false) {
        throw new Error((data as any)?.error || (data as any)?.details || "Failed to load availability");
      }

      setMap((data as any).map || {});
    } catch (e: any) {
      setError(e?.message || "Failed to load availability");
    }
  }

  useEffect(() => {
    // start immediately
    fetchOnce();

    // poll
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchOnce, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, intervalMs]);

  return { map, error, refresh: fetchOnce };
}
