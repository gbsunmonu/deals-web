// app/r/[code]/CopyLinkButton.tsx
'use client';

import { useState } from 'react';

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: open share dialog
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
      title="Copy link"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
