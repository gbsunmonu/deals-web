"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation"; // 👈

export default function ConfirmPage() {
  const params = useSearchParams();                 // 👈
  const preCode = params.get("code") || "";         // 👈

  const [code, setCode] = useState(preCode);
  const [merchantId, setMerchantId] = useState("");
  const [merchantPin, setMerchantPin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // keep the field in sync if user navigates with a different code
  useEffect(() => setCode(preCode), [preCode]);     // 👈

  const handleConfirm = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/redemptions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, merchantId, merchantPin }),
      });
      const data = await res.json();
      if (res.ok) setMessage(`✅ Redemption confirmed for code: ${data.code}`);
      else setMessage(`❌ ${data.error || "Failed"}`);
    } catch {
      setMessage("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Confirm Redemption</h1>
      <p>Enter the short code, your merchant ID and PIN.</p>

      <div style={{ marginBottom: 6, fontSize: 12, color: "#666" }}>Short code</div>
      <input
        placeholder="e.g. J7YQR"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ padding: 8, width: 360 }}
      />
      <div style={{ marginTop: 10, marginBottom: 6, fontSize: 12, color: "#666" }}>Merchant ID</div>
      <input
        placeholder="merchantId (UUID)"
        value={merchantId}
        onChange={(e) => setMerchantId(e.target.value)}
        style={{ padding: 8, width: 360 }}
      />
      <div style={{ marginTop: 10, marginBottom: 6, fontSize: 12, color: "#666" }}>Merchant PIN</div>
      <input
        placeholder="6-digit PIN"
        value={merchantPin}
        onChange={(e) => setMerchantPin(e.target.value)}
        type="password"
        style={{ padding: 8, width: 360 }}
      />
      <br />
      <button onClick={handleConfirm} disabled={loading} style={{ marginTop: 14, padding: "8px 16px" }}>
        {loading ? "Checking..." : "Confirm"}
      </button>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  );
}
