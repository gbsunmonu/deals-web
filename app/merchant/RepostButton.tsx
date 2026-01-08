"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RepostButton({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function repost() {
    if (loading) return;

    const ok = confirm("Repost this expired deal as a new deal starting today?");
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/merchant/deals/repost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        alert(data?.error || "Failed to repost");
        return;
      }

      // Go to merchant deals page (or navigate to new deal edit page if you have one)
      router.refresh();
      alert("Reposted ✅");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={repost}
      disabled={loading}
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      type="button"
    >
      {loading ? "Reposting..." : "Repost"}
    </button>
  );
}
