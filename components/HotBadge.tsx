// components/HotBadge.tsx
export default function HotBadge({ label = "Hot" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
      <span aria-hidden>🔥</span>
      {label}
    </span>
  );
}
