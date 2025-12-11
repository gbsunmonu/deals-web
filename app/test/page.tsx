"use client";
import { useState } from "react";
import QRCode from "qrcode";

export default function MakeRedemption() {
  const [dealId, setDealId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createRedemption = async () => {
    if (!dealId || !merchantId) return alert("Paste the dealId and merchantId first");
    setLoading(true);
    try {
      const res = await fetch("/api/redemptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, merchantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed");
        return;
      }
      setCode(data.code);
      const dataUrl = await QRCode.toDataURL(data.payloadUrl);
      setQr(dataUrl);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Create a REAL redemption QR</h1>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#666" }}>merchantId (from merchants table)</div>
        <input
          placeholder="paste merchantId here"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          style={{ padding: 8, width: 500 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#666" }}>dealId (from deals table)</div>
        <input
          placeholder="paste dealId here"
          value={dealId}
          onChange={(e) => setDealId(e.target.value)}
          style={{ padding: 8, width: 500 }}
        />
      </div>

      <button onClick={createRedemption} style={{ padding: "8px 16px" }} disabled={loading}>
        {loading ? "Creating..." : "Create redemption & QR"}
      </button>

      {code && <p style={{ marginTop: 16 }}>Short code: <strong>{code}</strong></p>}

      {qr && (
        <div style={{ marginTop: 16 }}>
          <img src={qr} alt="qr" />
          <p>Show this to the merchant. Next we’ll build the confirm side.</p>
        </div>
      )}
    </div>
  );
}
