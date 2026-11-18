import AuthForm from "@/components/auth-form";
import { ownerSignupAvailable } from "@/lib/owner-signup";
import { configured } from "@/lib/supabase";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <AuthForm
      mode="login"
      ready={configured()}
      canCreateOwner={await ownerSignupAvailable()}
      expired={query.error === "expired"}
    />
  );
}
