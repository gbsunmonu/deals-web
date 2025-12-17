// app/deals/[id]/qr/page.tsx
import prisma from "@/lib/prisma";
import DealQrCard from "@/components/DealQrCard";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DealQrPage({ params }: Props) {
  const { id } = await params;

  if (!id) notFound();

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { merchant: true },
  });

  if (!deal) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* ✅ Clear breadcrumb */}
      <div className="mb-6">
        <p className="text-xs text-gray-500">
          Deals &gt; {deal.title} &gt; Get QR
        </p>
      </div>

      {/* ✅ Important explanation box */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">How this works</p>
        <ul className="mt-1 list-disc pl-5 space-y-1 text-[13px]">
          <li>
            The QR on this page is <strong>not</strong> the redeem QR.
          </li>
          <li>
            It opens your secure QR page, where a <strong>new 15-minute QR</strong> is generated.
          </li>
          <li>
            You can save or share this safely — it will always generate a fresh QR when opened.
          </li>
        </ul>
      </div>

      <DealQrCard
        id={deal.id}
        title={deal.title}
        merchantName={deal.merchant?.name ?? undefined}
        endsAtIso={deal.endsAt.toISOString()}
      />
    </div>
  );
}
