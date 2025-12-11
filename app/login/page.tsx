// app/login/page.tsx
import SignInCard from "@/components/auth/SignInCard";

type Props = {
  searchParams: {
    next?: string;
  };
};

export default function LoginPage({ searchParams }: Props) {
  const next = searchParams.next || "/my-deals";

  return (
    <div className="mx-auto max-w-md pt-12 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Sign in to Dealina
        </h1>
        <p className="text-sm text-slate-500">
          Use your email and password to sign in. If you don&apos;t have an
          account yet, you can create one with the same form.
        </p>
      </div>

      <div className="mt-6">
        <SignInCard next={next} />
      </div>
    </div>
  );
}
