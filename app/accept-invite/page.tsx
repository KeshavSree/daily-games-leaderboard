import AuthForm from "@/components/auth-form";
import { configured } from "@/lib/supabase";
export default function Accept() {
  return <AuthForm mode="invite" ready={configured()} />;
}
