// app/deals/loading.tsx
export default function LoadingDeals() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="animate-pulse bg-neutral-100 aspect-[16/9]" />
          <div className="p-4 space-y-3">
            <div className="animate-pulse h-3 w-20 bg-neutral-200 rounded" />
            <div className="animate-pulse h-4 w-3/4 bg-neutral-200 rounded" />
            <div className="animate-pulse h-3 w-1/2 bg-neutral-200 rounded" />
            <div className="animate-pulse h-3 w-28 bg-neutral-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
