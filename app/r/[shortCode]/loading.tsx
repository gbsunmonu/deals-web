// app/r/[shortCode]/loading.tsx
export default function Loading() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 rounded bg-slate-100" />
        <div className="mt-3 h-8 w-3/4 rounded bg-slate-100" />
        <div className="mt-6 h-[320px] w-full rounded-3xl bg-slate-100" />
        <div className="mt-5 flex gap-2">
          <div className="h-10 flex-1 rounded-full bg-slate-100" />
          <div className="h-10 flex-1 rounded-full bg-slate-100" />
        </div>
      </div>
    </main>
  );
}
