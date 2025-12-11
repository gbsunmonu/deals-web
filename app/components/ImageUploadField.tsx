"use client";

import { useState } from "react";

type Props = {
  label: string;
};

export default function ImageUploadField({ label }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  return (
    <div>
      <label>{label}</label>
      <input 
        type="file" 
        name="image" 
        accept="image/*"
        onChange={handleFileChange}
      />

      {preview ? (
        <img
          src={preview}
          alt="Preview"
          className="mt-3 w-32 h-32 object-cover rounded border"
        />
      ) : null}
    </div>
  );
}
