// app/my-deals/page.tsx
import SignInCard from "@/components/auth/SignInCard";

export default function MyDealsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">My deals</h1>
      <p className="mb-8 text-sm text-neutral-600">
        Create a Dealina account to save deals, manage favourites, and see
        future features. For now, you can still browse all live deals on the
        Explore page.
      </p>

      {/* After sign in / sign up, go to merchant profile */}
      <SignInCard next="/merchant/profile" />
    </div>
  );
}
