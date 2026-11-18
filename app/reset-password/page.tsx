import AuthForm from "@/components/auth-form";
import { configured } from "@/lib/supabase";
export default function Reset() {
  return <AuthForm mode="reset" ready={configured()} />;
}
