// deals-web/app/deals/[id]/qr/page.tsx
import prisma from "@/lib/prisma";
import DealQrCard from "@/components/DealQrCard";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DealQrPage({ params }: Props) {
  const { id } = await params; // Next 16: params is a Promise

  if (!id) {
    notFound();
  }

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { merchant: true },
  });

  if (!deal) {
    notFound();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="text-xs text-gray-500">
          Coupon &gt; Explore deals &gt; {deal.title} &gt; QR code
        </p>
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
