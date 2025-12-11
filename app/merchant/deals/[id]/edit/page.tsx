// app/merchant/deals/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import EditDealForm from "./EditDealForm";

type Props = {
  // Next.js 16: params is a Promise
  params: Promise<{
    id: string;
  }>;
};

export default async function EditDealPage({ params }: Props) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const deal = await prisma.deal.findUnique({
    where: { id },
  });

  if (!deal) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="text-xs text-gray-500">
          Coupon &gt; Merchant tools &gt; Your deals &gt; Edit
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Edit deal
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Update the details of this deal. Changes will apply immediately.
        </p>
      </div>

      <EditDealForm deal={deal} />
    </div>
  );
}
