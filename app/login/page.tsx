// app/login/page.tsx
import LoginClient from "./login-client";

export const dynamic = "force-dynamic";

type SP = { returnTo?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SP | Promise<SP>;
}) {
  const sp = await Promise.resolve(searchParams);
  const returnTo = sp?.returnTo || "/merchant/profile";
  return <LoginClient returnTo={returnTo} />;
}
