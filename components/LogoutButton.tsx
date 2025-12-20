"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        // ✅ Force a full navigation so server clears cookies and navbar updates
        window.location.href = "/logout";
      }}
      className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Logging out…" : "Logout"}
    </button>
  );
}
