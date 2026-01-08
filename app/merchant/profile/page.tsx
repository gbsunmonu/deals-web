// app/merchant/profile/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function digitsOnly(v: string) {
  return (v || "").replace(/\D/g, "");
}

// Convert +23480123... OR 080... into a wa.me-ready number (best-effort)
function toWhatsAppWaMe(waRaw: string | null | undefined) {
  const raw = (waRaw || "").trim();
  if (!raw) return null;

  // keep only digits
  let d = digitsOnly(raw);

  // If they stored as +234..., digitsOnly already gives 234...
  // If they stored as 080..., we can *optionally* assume Nigeria and convert:
  // 080123... -> 23480123...
  // If you don't want this assumption, delete this block.
  if (d.startsWith("0") && d.length >= 10) {
    d = "234" + d.slice(1);
  }

  // sanity: wa.me expects countrycode+number. Minimum length ~10 digits
  if (d.length < 10 || d.length > 15) return null;

  return `https://wa.me/${d}`;
}

export default async function MerchantProfilePage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    redirect("/auth/sign-in?next=/merchant/profile");
  }

  // Resolve merchant by authenticated user
  let merchant = await prisma.merchant.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // If missing, create a basic merchant then send to edit page
  if (!merchant) {
    await prisma.merchant.create({
      data: {
        userId: user.id,
        name:
          (user.user_metadata?.business_name as string | undefined) ||
          user.email?.split("@")[0] ||
          "New merchant",
        description: "",
        category: "",
        city: "",
        address: "",
        phone: "",
        website: "",
        avatarUrl: null,
        whatsappNumber: null,
      },
    });

    redirect("/merchant/profile/edit");
  }

  const waUrl = toWhatsAppWaMe(merchant.whatsappNumber);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-500">
            MERCHANT
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            {merchant.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your public business profile and contact options.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/merchant/profile/edit"
            className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            Edit profile
          </Link>

          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Chat on WhatsApp
            </a>
          ) : (
            <Link
              href="/merchant/profile/edit"
              className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Add WhatsApp number
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Business details
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Info label="City" value={merchant.city || "—"} />
            <Info label="Category" value={merchant.category || "—"} />
            <Info label="Phone" value={merchant.phone || "—"} />
            <Info label="Website" value={merchant.website || "—"} />
            <Info
              label="WhatsApp"
              value={merchant.whatsappNumber || "—"}
              hint={
                waUrl
                  ? "Customers can tap “Chat on WhatsApp”."
                  : "Add WhatsApp number to enable chat."
              }
            />
            <Info label="Address" value={merchant.address || "—"} />
          </div>

          {merchant.description ? (
            <div className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Description
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {merchant.description}
              </p>
            </div>
          ) : null}
        </div>

        {/* WhatsApp helper card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            WhatsApp contact
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            This helps customers message you without calling.
          </p>

          <div className="mt-4 space-y-2">
            {waUrl ? (
              <>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full rounded-full bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Open WhatsApp chat
                </a>

                {/* Copy link button (clientless trick with selectable input) */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    Shareable link
                  </div>
                  <input
                    readOnly
                    value={waUrl}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Tip: click the box to select, then copy.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                No WhatsApp number set yet.
                <div className="mt-3">
                  <Link
                    href="/merchant/profile/edit"
                    className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                  >
                    Add WhatsApp number
                  </Link>
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Recommended format: <span className="font-mono">+2348012345678</span>
          </p>
        </div>
      </section>
    </main>
  );
}

function Info({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
