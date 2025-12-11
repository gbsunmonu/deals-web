// components/ui/Stat.tsx
import * as React from 'react';

export function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
          <div className="truncate text-2xl font-semibold">{value}</div>
          {hint ? <div className="mt-0.5 text-xs text-neutral-500">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}
