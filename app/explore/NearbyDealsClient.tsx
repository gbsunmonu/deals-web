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

export default function NearbyButton({
  className = "",
  showClear = true,
}: {
  className?: string;
  showClear?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  const sort = sp.get("sort") || "";

  useEffect(() => {
    const saved = readLS();
    if (saved) {
      setCoords(saved);
      setStatus("ok");
    }
  }, []);

  const label = useMemo(() => {
    if (status === "loading") return "Getting location…";
    if (status === "ok" && coords) return "Using your location ✅";
    return "Use my location";
  }, [status, coords]);

  function pushNearby(c: Coords) {
    const lat = round(c.lat);
    const lng = round(c.lng);

    const qs = new URLSearchParams(sp.toString());
    qs.set("sort", "nearby");
    qs.set("lat", String(lat));
    qs.set("lng", String(lng));

    router.push(`/explore?${qs.toString()}`);
  }

  function requestLocation() {
    setErr(null);

    if (!("geolocation" in navigator)) {
      setStatus("error");
      setErr("Geolocation not supported on this browser.");
      return;
    }

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeLS(c);
        setCoords(c);
        setStatus("ok");
        pushNearby(c);
      },
      (e) => {
        setStatus("error");
        if (e.code === 1) setErr("Location permission denied.");
        else if (e.code === 2) setErr("Location unavailable.");
        else if (e.code === 3) setErr("Location request timed out.");
        else setErr("Could not get your location.");
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 1000 * 60 * 10,
      }
    );
  }

  function clearLocation() {
    clearLS();
    setCoords(null);
    setStatus("idle");
    setErr(null);

    if (sort === "nearby") {
      const qs = new URLSearchParams(sp.toString());
      qs.delete("lat");
      qs.delete("lng");
      qs.delete("sort");
      const next = qs.toString();
      router.push(next ? `/explore?${next}` : "/explore");
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={requestLocation}
        disabled={status === "loading"}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-slate-200 transition",
          status === "ok" && coords
            ? "bg-white text-slate-900 hover:bg-slate-50"
            : "bg-emerald-600 text-white hover:bg-emerald-700",
          status === "loading" ? "opacity-70 cursor-not-allowed" : "",
        ].join(" ")}
        title="Use your location to rank nearby deals"
      >
        📍 {label}
      </button>

      {showClear && (status === "ok" || coords) ? (
        <button
          type="button"
          onClick={clearLocation}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          title="Clear saved location"
        >
          Clear
        </button>
      ) : null}

      {err ? <div className="w-full text-xs text-red-600">{err}</div> : null}
    </div>
  );
}
