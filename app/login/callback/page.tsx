// app/login/callback/page.tsx
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { getServerSupabaseRSC } from '@/lib/supabase';
import { ensureMerchant } from '@/app/actions/ensure-merchant';

export default async function CallbackPage() {
  const supabase = getServerSupabaseRSC();
  // If the user arrives here with the session cookie, they're signed in.
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await ensureMerchant();
    return (
      <main className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Signed in</h1>
        <p>Welcome back, {user.email}.</p>
        <Link href="/merchant/dashboard" className="inline-block rounded-lg bg-black text-white px-4 py-2">
          Go to Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Almost there…</h1>
      <p>Finishing sign-in. If this page doesn’t update, go back and click the magic link again.</p>
      <Link href="/login" className="underline mt-4 inline-block">Back to login</Link>
    </main>
  );
}
