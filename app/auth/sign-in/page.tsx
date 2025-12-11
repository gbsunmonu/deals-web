// app/auth/sign-in/page.tsx
import SignInCard from "@/components/auth/SignInCard";

export default function AuthSignInPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col px-4 py-12">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Merchant access</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Sign in to manage your deals, redemptions and merchant profile. If you
          don’t have an account yet, you can create one in a few seconds.
        </p>
      </div>

      <SignInCard />
    </main>
  );
}
