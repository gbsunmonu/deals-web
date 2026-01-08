// app/admin/login/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminLoginPage(props: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp: SP =
    props.searchParams instanceof Promise
      ? await props.searchParams
      : (props.searchParams ?? {});

  const err = first(sp.err) || "";

  const msg =
    err === "1"
      ? "Wrong password."
      : err === "missing_password"
      ? "ADMIN_PASSWORD is not set in .env"
      : "";

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Admin Login</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the admin password to continue.
        </p>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {msg}
          </div>
        ) : null}

        <form className="mt-5 grid gap-3" method="POST" action="/api/admin/login">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Password</span>
            <input
              name="password"
              type="password"
              required
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Sign in
          </button>

          <Link
            href="/"
            className="text-center text-xs text-slate-500 hover:text-slate-700"
          >
            Back to site
          </Link>
        </form>
      </div>
    </main>
  );
}
