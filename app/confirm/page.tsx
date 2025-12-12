"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConfirmContent() {
  const params = useSearchParams();
  const email = params.get("email");

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Check your email</h1>

      <p className="mt-3 text-slate-600">
        We sent a confirmation link to:
      </p>

      <p className="mt-1 font-medium">{email || "your inbox"}</p>

      <p className="mt-4 text-sm text-slate-500">
        Click the link inside to complete your sign-in.
      </p>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ConfirmContent />
    </Suspense>
  );
}
