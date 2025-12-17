"use client";

export type AvailabilityRow = {
  id: string;
  redeemedCount: number;
  left: number | null;
  soldOut: boolean;
  maxRedemptions: number | null;
};

export default function AvailabilityBadge({
  row,
  pulseKey = 0,
}: {
  row?: AvailabilityRow;
  pulseKey?: number;
}) {
  const soldOut = row?.soldOut ?? false;
  const unlimited = row?.maxRedemptions == null;
  const left = row?.left ?? null;

  let label = "Checking…";
  if (!row) label = "Checking…";
  else if (soldOut) label = "Sold out";
  else if (unlimited) label = "Unlimited";
  else if (left === 1) label = "Only 1 left";
  else if (typeof left === "number") label = `${left} left`;

  return (
    <span
      key={pulseKey}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold",
        "transition-all duration-300",
        soldOut
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
        "animate-[pulse_0.4s_ease-in-out_1]",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          !row ? "bg-slate-400" : soldOut ? "bg-red-500" : "bg-emerald-500",
        ].join(" ")}
      />
      {label}
    </span>
  );
}
