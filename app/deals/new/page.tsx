// inside your form UI:
'use client';
import { useState, useTransition } from 'react';
import DealImageUpload from '@/components/upload/DealImageUpload';
import { getDealUploadTarget } from '@/actions/imageUpload';
import { useMerchantId } from '@/components/hooks/useMerchantId'; // small helper below

export function ImagePicker() {
  const merchantId = useMerchantId(); // reads from a data-* attr or endpoint
  const [imagePath, setImagePath] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <DealImageUpload
        onUploaded={(p) => setImagePath(p)}
        getTarget={async () => getDealUploadTarget(merchantId)}
      />
      <input type="hidden" name="imagePath" value={imagePath ?? ''} />
      {imagePath && <div className="text-xs text-green-600">Image ready ✓</div>}
    </div>
  );
}
