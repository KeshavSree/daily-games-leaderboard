import AuthForm from "@/components/auth-form";
import { configured } from "@/lib/supabase";
export default function Forgot() {
  return <AuthForm mode="forgot" ready={configured()} />;
}
