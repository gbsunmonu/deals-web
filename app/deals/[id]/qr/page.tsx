// app/deals/[id]/qr/page.tsx
import prisma from "@/lib/prisma";
import DealQrCard from "@/components/DealQrCard";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DealQrPage({ params }: Props) {
  const { id } = await params; // Next 16: params is a Promise

  if (!id) notFound();

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { merchant: true },
  });

  if (!deal) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs text-slate-500">
          Deals &gt; {deal.title} &gt; Get redeem QR
        </p>

        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Get your redeem QR
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Keep this page open at the counter. A new{" "}
          <span className="font-semibold">15-minute redeem QR</span> is generated
          for your device and expires automatically.
        </p>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="font-semibold">How this works</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
            <li>
              The QR you saved/shared is a <span className="font-semibold">link</span>.
              It brings you to this page.
            </li>
            <li>
              The QR shown below is the <span className="font-semibold">real redeem QR</span>{" "}
              the merchant scans.
            </li>
            <li>
              It expires in <span className="font-semibold">15 minutes</span> and can be refreshed if needed.
            </li>
            <li>
              For safety, the redeem QR is <span className="font-semibold">device-locked</span>.
              Don’t download/share the redeem QR image.
            </li>
          </ul>
        </div>
      </div>

      <DealQrCard
        id={deal.id}
        title={deal.title}
        merchantName={deal.merchant?.name ?? undefined}
        endsAtIso={deal.endsAt.toISOString()}
      />
    </main>
  );
}
