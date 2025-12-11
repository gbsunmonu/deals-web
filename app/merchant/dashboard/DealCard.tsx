// C:\Users\Administrator\deals-web\app\merchant\dashboard\DealCard.tsx
import PreviewPriceControls, { DealLike } from './PreviewPriceControls';
import DealStatsModal from './DealStatsModal';
import DeleteDealButton from './DeleteDealButton';

type RedemptionLite = { id: string; createdAt: string };
type Deal = {
  id: string;
  title: string;
  description: string | null;
  shortCode: string;
  imageUrl: string | null;
  discountType: 'PERCENT' | 'AMOUNT' | null;
  discountValue: number | null;
  startsAt: string;
  endsAt: string;
  redemptions: RedemptionLite[];
};

function badgeText(d: DealLike) {
  if (!d.discountType || !d.discountValue) return null;
  if (d.discountType === 'PERCENT') return `${d.discountValue}% OFF`;
  if (d.discountType === 'AMOUNT') return `Save ₦${Number(d.discountValue).toLocaleString()}`;
  return null;
}

export default function DealCard({ deal }: { deal: Deal }) {
  const badge = badgeText({
    discountType: deal.discountType,
    discountValue: deal.discountValue,
  });

  const qrUrl = `/api/qrcode/${encodeURIComponent(deal.shortCode)}`;
  const redeemUrl = `/r/${encodeURIComponent(deal.shortCode)}`;
  const editUrl = `/merchant/deals/${deal.id}/edit`;

  return (
    <article className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white hover:shadow-md transition">
      {/* Image */}
      <div className="relative aspect-[16/7] bg-gray-50">
        {deal.imageUrl ? (
          <img src={deal.imageUrl} alt={deal.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-gray-400">
            <span className="text-sm">No image</span>
          </div>
        )}
        {badge && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-fuchsia-600 text-white text-xs font-semibold px-3 py-1 shadow">
            {badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 md:p-5">
        <h3 className="text-lg font-semibold leading-snug text-gray-900">{deal.title}</h3>
        {deal.description && <p className="mt-1 text-sm text-gray-600">{deal.description}</p>}

        <div className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-gray-800">Code:</span> {deal.shortCode} |{' '}
          <span className="font-medium text-gray-800">Redemptions:</span> {deal.redemptions.length}
        </div>

        <div className="mt-4">
          <PreviewPriceControls
            deal={{
              discountType: deal.discountType,
              discountValue: deal.discountValue,
            }}
          />
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={redeemUrl}
            target="_blank"
            className="inline-flex items-center rounded-lg bg-black text-white px-3 py-2 text-sm font-medium hover:bg-gray-900"
          >
            Open redeem page
          </a>

          <a
            href={qrUrl}
            download={`qr-${deal.shortCode}.png`}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Download QR
          </a>

          <DealStatsModal deal={deal} />

          <a
            href={editUrl}
            className="inline-flex items-center rounded-lg border border-blue-500 text-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-50"
          >
            Edit
          </a>

          {/* ✅ client component handles confirm + submit */}
          <DeleteDealButton id={deal.id} />
        </div>
      </div>
    </article>
  );
}
