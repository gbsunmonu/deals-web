// components/charts/Sparkline.tsx
// Lightweight SVG sparkline with optional area fill and dots.
// No external libraries needed.

type SparklineProps = {
  data: number[];          // y-values (assume equally spaced x)
  width?: number;          // px
  height?: number;         // px
  strokeWidth?: number;    // px
  showDots?: boolean;
  gradientId?: string;     // optional unique id when multiple charts on a page
  className?: string;
};

export default function Sparkline({
  data,
  width = 260,
  height = 60,
  strokeWidth = 2,
  showDots = false,
  gradientId = "sparklineGradient",
  className = "",
}: SparklineProps) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const n = Math.max(1, data.length);

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = max - min || 1;

  // map point index -> x and y -> normalized, then to SVG coords
  const stepX = n > 1 ? w / (n - 1) : 0;
  const points = data.map((y, i) => {
    const x = i * stepX;
    const ny = (y - min) / range;
    const yy = h - ny * h; // invert for SVG
    return [x, yy] as const;
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  // area path for subtle fill
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area */}
      <path d={area} fill={`url(#${gradientId})`} />

      {/* Stroke */}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots (optional) */}
      {showDots &&
        points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill="currentColor" />
        ))}
    </svg>
  );
}
