'use client';

export default function GlobalFatalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          App crashed
        </h1>
        <p style={{ color: '#555' }}>
          Digest:{' '}
          <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 6 }}>
            {error.digest ?? 'n/a'}
          </code>
        </p>
        <pre
          style={{
            background: '#0b1020',
            color: '#e5e7eb',
            padding: 12,
            borderRadius: 8,
            marginTop: 12,
            overflow: 'auto',
          }}
        >
          {String(error.stack ?? error.message)}
        </pre>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'black',
            color: 'white',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
