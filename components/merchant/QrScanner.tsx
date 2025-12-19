"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";

type Props = {
  onResult: (text: string) => void;
  onError?: (msg: string) => void;

  // Stop scanning while redeeming (prevents double triggers)
  paused?: boolean;

  // Throttle duplicate scans
  dedupeMs?: number;
};

type CamDevice = {
  deviceId: string;
  label: string;
};

export default function QrScanner({
  onResult,
  onError,
  paused = false,
  dedupeMs = 1500,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [devices, setDevices] = useState<CamDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [streamActive, setStreamActive] = useState(false);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const lastHitRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canScan = useMemo(() => {
    return typeof window !== "undefined" && !!navigator?.mediaDevices?.getUserMedia;
  }, []);

  async function listCameras() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || "Camera",
        }));

      setDevices(cams);

      // Prefer back camera if labels exist (after permission)
      if (!deviceId && cams.length) {
        const back = cams.find((c) => /back|rear|environment/i.test(c.label));
        setDeviceId(back?.deviceId || cams[0].deviceId);
      }
    } catch (e: any) {
      setRuntimeError(e?.message || "Could not list cameras");
      onError?.(e?.message || "Could not list cameras");
    }
  }

  async function startStream() {
    setPermissionError(null);
    setRuntimeError(null);

    if (!canScan) {
      setPermissionError("Camera scanning is not supported in this browser.");
      return;
    }

    // Stop old stream if any
    stopStream();

    try {
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: { facingMode: { ideal: "environment" } }, audio: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready");

      video.srcObject = stream;
      await video.play();

      setStreamActive(true);

      // after permission, labels will show
      await listCameras();
    } catch (e: any) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access and refresh."
          : e?.message || "Could not start camera";

      setPermissionError(msg);
      onError?.(msg);
      setStreamActive(false);
    }
  }

  function stopStream() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStreamActive(false);
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (paused) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;

    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // draw frame to canvas
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    const code = jsQR(imageData.data, w, h, {
      inversionAttempts: "attemptBoth",
    });

    if (code?.data) {
      const now = Date.now();
      const last = lastHitRef.current;

      // dedupe repeated reads
      const isDup = last.text === code.data && now - last.at < dedupeMs;

      if (!isDup) {
        lastHitRef.current = { text: code.data, at: now };
        onResult(code.data);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    // attempt to list cameras initially (labels may be blank until permission)
    if (canScan) listCameras();
    // cleanup
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!streamActive) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamActive, paused, deviceId]);

  // if deviceId changes while running, restart stream
  useEffect(() => {
    if (!streamActive) return;
    startStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Scan QR with camera</p>
          <p className="mt-1 text-xs text-slate-500">
            Point the camera at the customer’s QR. We’ll detect the code automatically.
          </p>
        </div>

        <div className="flex gap-2">
          {!streamActive ? (
            <button
              type="button"
              onClick={startStream}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Start camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopStream}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {(permissionError || runtimeError) && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {permissionError || runtimeError}
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_240px] md:items-start">
        <div className="relative overflow-hidden rounded-2xl bg-slate-100">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-[320px] w-full object-cover"
          />
          {/* overlay */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-44 w-44 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.20)]" />
          </div>

          {paused && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <div className="rounded-xl bg-black/50 px-3 py-2 text-xs font-semibold">
                Processing…
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Camera
          </label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            disabled={!devices.length}
          >
            {!devices.length ? (
              <option value="">No cameras found</option>
            ) : (
              devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))
            )}
          </select>

          <p className="text-xs text-slate-500">
            Tip: Use the back camera for faster scanning.
          </p>
        </div>
      </div>

      {/* hidden canvas used for decoding */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
