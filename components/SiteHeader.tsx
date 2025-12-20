// components/SiteHeader.tsx
import Link from "next/link";

type Props = {
  isAuthed: boolean;
};

export default function SiteHeader({ isAuthed }: Props) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white font-bold">
            D
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">Dealina</div>
            <div className="text-[11px] text-slate-500">Save more locally</div>
          </div>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-slate-700 hover:text-slate-900">
            Explore deals
          </Link>

          {isAuthed ? (
            <>
              <Link
                href="/merchant"
                className="text-slate-700 hover:text-slate-900"
              >
                Merchant home
              </Link>
              <Link
                href="/merchant/redeem"
                className="text-slate-700 hover:text-slate-900"
              >
                Redeem QR
              </Link>
              <Link
                href="/merchant/abuse"
                className="text-slate-700 hover:text-slate-900"
              >
                Abuse
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            >
              Merchant login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
