// components/ui/TrendDelta.tsx
export default function TrendDelta({ pct }: { pct: number }) {
  const up = pct > 0;
  const same = Math.abs(pct) < 0.5;
  const val = Math.abs(pct).toFixed(0);

  const color = same ? 'text-neutral-500' : up ? 'text-emerald-600' : 'text-rose-600';
  const arrow = same ? '–' : up ? '▲' : '▼';
  const title = up ? 'vs previous 14 days (up)' : same ? 'vs previous 14 days (flat)' : 'vs previous 14 days (down)';

  return (
    <span className={`ml-2 inline-flex items-center text-xs ${color}`} title={title}>
      <span className="mr-1">{arrow}</span>
      <span>{val}%</span>
    </span>
  );
}
