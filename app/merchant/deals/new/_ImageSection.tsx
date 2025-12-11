// C:\Users\Administrator\deals-web\app\merchant\deals\new\_ImageSection.tsx
"use client";

import ImageUploadField from "@/app/components/ImageUploadField";

type Props = {
  imageUrl: string;
  onChange: (url: string) => void;
};

export default function ImageSection({ imageUrl, onChange }: Props) {
  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Deal image</h2>

      <ImageUploadField
        label="Upload an image for this deal"
        bucket="deal-images"
        initialUrl={imageUrl || undefined}
        helpText="Choose a clear photo. It will show on the deal card and explore page."
        onChange={onChange}
      />
    </section>
  );
}
