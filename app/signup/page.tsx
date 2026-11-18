import Link from "next/link";
import AuthForm from "@/components/auth-form";
import { ownerSignupAvailable } from "@/lib/owner-signup";
export const dynamic = "force-dynamic";
export default async function Signup() {
  if (!(await ownerSignupAvailable()))
    return (
      <main className="auth-shell">
        <Link href="/" className="wordmark">
          daily<span>/</span>
        </Link>
        <h1>Invite only.</h1>
        <Link href="/login" className="text-link">
          Log in
        </Link>
      </main>
    );
  return <AuthForm mode="signup" ready />;
}
