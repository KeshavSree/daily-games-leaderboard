import AuthForm from "@/components/auth-form";
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
      expired={query.error === "expired"}
    />
  );
}
