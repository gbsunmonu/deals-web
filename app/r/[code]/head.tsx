// app/r/[code]/head.tsx
type Props = { params: Promise<{ code: string }> };

export default async function Head(props: Props) {
  const { code } = await props.params;
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${base}/r/${encodeURIComponent(code)}`;
  return (
    <>
      <title>Deal {code}</title>
      <meta name="description" content="Unlock this offer with the short code." />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={`Deal ${code}`} />
      <meta property="og:description" content="Unlock this offer with the short code." />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
    </>
  );
}
