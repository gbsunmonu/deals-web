"use client";

import { useTransition } from "react";
import { repostDealAction } from "./repost-action";

export default function RepostButton({ dealId }: { dealId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          // ensure dealId exists
          if (!formData.get("dealId")) formData.set("dealId", dealId);
          await repostDealAction(formData);
        });
      }}
    >
      <input type="hidden" name="dealId" value={dealId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
        title="Create a new copy of this deal starting now"
      >
        {pending ? "Reposting..." : "Repost"}
      </button>
    </form>
  );
}
