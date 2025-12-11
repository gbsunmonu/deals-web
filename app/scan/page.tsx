"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls, Result } from "@zxing/browser";

function extractCodeFromUrl(text: string): string | null {
  // Accept either a bare code (e.g., J7YQR) or a URL like http://localhost:3000/r/J7YQR
  const bare = text.trim().toUpperCase();
  if (/^[A-Z0-9]{4,10}$/.test(bare)) return bare;

  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    // find last non-empty segment as code
    const maybe = parts[parts.length - 1]?.toUpperCase() || "";
    return /^[A-Z0-9]{4,10}$/.test(maybe) ? maybe : null;
  } catch {
    return null;
  }
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [lastText, setLastText] = useState<string>("");
  const [merchantId, setMerchantId] = useState("");
  const [merchantPin, setMerchantPin] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let active = true;

    async function start() {
      try {
        const video = videoRef.current!;
        const controls = await reader.decodeFromVideoDevice(
          undefined, // default camera
          video,
          (result: Result | undefined, _err, _controls) => {
            // Save controls so we can stop later
            if (_controls && !controlsRef.current) controlsRef.current = _controls;

            if (!active || !result) return;
            const text = result.getText();
            setLastText(text);
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        setMessage("Could not access camera. Check permissions.");
      }
    }

    start();
    return () => {
      active = false;
      controlsRef.current?.stop();
    };
  }, []);

  const confirmScanned = async () => {
    setMessage("");
    const code = extractCodeFromUrl(lastText);
    if (!code) {
      setMessage("Could not read a valid code from the scan.");
      return;
    }
    if (!merchantId || !merchantPin) {
      setMessage("Enter merchantId and PIN first.");
      return;
    }
    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, merchantId, merchantPin }),
      });
      const data = await res.json();
      if (res.ok) setMessage(`✅ Confirmed: ${code}`);
      else setMessage(`❌ ${data.error || "Failed"}`);
    } catch {
      setMessage("Server error.");
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Scan QR to Confirm</h1>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#666" }}>Merchant ID</div>
        <input
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          placeholder="merchantId (UUID)"
          style={{ padding: 8, width: 420 }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#666" }}>Merchant PIN</div>
        <input
          value={merchantPin}
          onChange={(e) => setMerchantPin(e.target.value)}
          placeholder="6-digit PIN"
          type="password"
          style={{ padding: 8, width: 420 }}
        />
      </div>

      <video ref={videoRef} style={{ width: 420, height: 320, background: "#000" }} />

      <div style={{ marginTop: 10 }}>
        <p style={{ fontSize: 12, color: "#666" }}>Last scan:</p>
        <code>{lastText || "Nothing scanned yet"}</code>
      </div>

      <button onClick={confirmScanned} style={{ marginTop: 12, padding: "8px 16px" }}>
        Confirm scanned code
      </button>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}
