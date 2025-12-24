"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Coords = { lat: number; lng: number };

const LS_KEY = "ytd_user_location_v1";

function round(n: number, dp = 5) {
  const m = Math.pow(10, dp);
  return Math.round(n * m) / m;
}

function isValidCoords(c: any): c is Coords {
  return (
    c &&
    typeof c.lat === "number" &&
    typeof c.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

function readLS(): Coords | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidCoords(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLS(c: Coords) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {}
}

function clearLS() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

export default function NearbyButton() {
  const router = useRouter();
  const sp = useSearchParams();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const sort = (sp.get("sort") || "").toLowerCase();
  const isActive = sort === "nearby" && coords;

  useEffect(() => {
    const saved = readLS();
    if (saved) {
      setCoords(saved);
      setStatus("ok");
    }
  }, []);

  const label = useMemo(() => {
    if (status === "loading") return "Getting location…";
    if (isActive) return "Using your location ✅";
    return "📍 Nearby";
  }, [status, isActive]);

  function goNearby(c: Coords) {
    const qs = new URLSearchParams();
    qs.set("sort", "nearby");
    qs.set("lat", String(round(c.lat)));
    qs.set("lng", String(round(c.lng)));
    router.push(`/explore?${qs.toString()}`);
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) return;

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeLS(c);
        setCoords(c);
        setStatus("ok");
        goNearby(c);
      },
      () => {
        setStatus("error");
      },
      { enableHighAccuracy: false, timeout: 12000 }
    );
  }

  function clearLocation() {
    clearLS();
    setCoords(null);
    setStatus("idle");
    router.push("/explore");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={requestLocation}
        disabled={status === "loading"}
        className={[
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition",
          isActive
            ? "bg-slate-900 text-white ring-slate-900"
            : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50",
          status === "loading" ? "opacity-70 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {label}
      </button>

      {isActive ? (
        <button
          type="button"
          onClick={clearLocation}
          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
