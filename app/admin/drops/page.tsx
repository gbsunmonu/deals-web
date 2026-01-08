// app/admin/drops/page.tsx
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminDropsPage() {
  const ok = await requireAdmin();
  if (!ok) redirect("/admin/login");

  // Load latest drop logs (safe: model exists in Prisma schema)
  const latest = await prisma.trackDropLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tracking Drops</h1>
        <p className="text-sm text-slate-600">
          Latest tracking events that were dropped (debugging + fraud signals).
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        {latest.length === 0 ? (
          <div className="text-sm text-slate-500">No drops logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-2">Time</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Visitor</th>
                  <th className="py-2">Device</th>
                  <th className="py-2">Path</th>
                  <th className="py-2">Deal</th>
                  <th className="py-2">Merchant</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="py-2 whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2">{d.reason}</td>
                    <td className="py-2">{d.type ?? "-"}</td>
                    <td className="py-2">
                      <span className="font-mono text-xs">
                        {(d.visitorId ?? "-").slice(0, 12)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="font-mono text-xs">
                        {(d.deviceHash ?? "-").slice(0, 12)}
                      </span>
                    </td>
                    <td className="py-2">{d.path ?? "-"}</td>
                    <td className="py-2">
                      <span className="font-mono text-xs">
                        {(d.dealId ?? "-").slice(0, 12)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="font-mono text-xs">
                        {(d.merchantId ?? "-").slice(0, 12)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
