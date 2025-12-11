'use client';

// app/error.tsx
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui",
        padding: 24,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 14, color: "#4b5563" }}>
        Sorry about that. You can try again, or go back to the previous page.
      </p>

      <button
        onClick={() => reset()}
        style={{
          marginTop: 12,
          padding: "8px 12px",
          borderRadius: 8,
          background: "black",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
