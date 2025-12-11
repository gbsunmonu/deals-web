// app/deals/head.tsx
export default function Head() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${base}/deals`;
  return (
    <>
      <title>Explore local deals</title>
      <meta name="description" content="Find food, beauty, gym and more—curated local deals near you." />
      <link rel="canonical" href={url} />
      <meta property="og:title" content="Explore local deals" />
      <meta property="og:description" content="Find food, beauty, gym and more—curated local deals near you." />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
    </>
  );
}
