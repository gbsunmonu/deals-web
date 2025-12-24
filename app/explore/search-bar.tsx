"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ExploreSearchBar() {
  const router = useRouter();
  const sp = useSearchParams();

  const initial = sp.get("q") ?? "";
  const [q, setQ] = useState(initial);

  // keep input synced if user navigates back/forward
  useEffect(() => {
    setQ(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const normalized = useMemo(() => q.trim(), [q]);

  function apply(next: string) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (next.trim()) params.set("q", next.trim());
    else params.delete("q");

    const qs = params.toString();
    router.push(qs ? `/explore?${qs}` : "/explore");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply(normalized);
  }

  function clear() {
    setQ("");
    apply("");
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full items-center gap-2">
      <div className="flex w-full items-center rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search deals, stores, city…"
          className="w-full bg-transparent text-sm text-slate-900 outline-none"
        />

        {q.trim() ? (
          <button
            type="button"
            onClick={clear}
            className="ml-2 rounded-full px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        ) : null}
      </div>

      <button
        type="submit"
        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Search
      </button>
    </form>
  );
}
