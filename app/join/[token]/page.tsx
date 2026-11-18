import Link from "next/link";
import AuthForm from "@/components/auth-form";
import { invitationAvailable } from "@/lib/invitation-links";
export const dynamic = "force-dynamic";
export default async function Join({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await invitationAvailable(token)))
    return (
      <main className="auth-shell">
        <Link href="/" className="wordmark">
          daily<span>/</span>
        </Link>
        <h1>Invite unavailable.</h1>
        <p className="muted">This link has expired or already been used.</p>
        <Link href="/login" className="text-link">
          Log in
        </Link>
      </main>
    );
  return <AuthForm mode="join" invitationToken={token} ready />;
}
